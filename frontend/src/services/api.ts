import {
  BackendProvider,
  HealthResponse,
  JobResponse,
  OutputFileItem,
  PresetType,
  ResolutionOption,
} from '../types/studio';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function pingBackend(
  provider: BackendProvider,
  apiUrl: string,
  falApiKey: string,
): Promise<HealthResponse> {
  if (provider === 'fal') {
    if (!falApiKey.trim()) {
      throw new Error('Missing fal.ai API key');
    }
    return {
      status: 'ok',
      mock_mode: false,
      model: 'fal-ai/trellis',
      device: 'cloud',
      gpu_name: 'fal.ai Serverless GPU',
      version: '1.0.0',
    };
  }

  const base = normalizeUrl(apiUrl);
  if (!base) {
    throw new Error('Backend URL is empty');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${base}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Health check failed (${res.status})`);
    }
    return (await res.json()) as HealthResponse;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function generateReferenceImage(params: {
  apiUrl: string;
  prompt: string;
  geminiApiKey?: string;
}): Promise<{ imageDataUrl: string; provider: string }> {
  const base = normalizeUrl(params.apiUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.geminiApiKey?.trim()) {
    headers['X-Gemini-Api-Key'] = params.geminiApiKey.trim();
  }

  const res = await fetch(`${base}/api/text-to-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: params.prompt }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Reference image generation failed (${res.status})`);
  }

  const data = (await res.json()) as { image_data_url: string; provider: string };
  return {
    imageDataUrl: data.image_data_url,
    provider: data.provider,
  };
}

export async function submitGenerationJob(params: {
  apiUrl: string;
  imageFile: File | null;
  resolution: ResolutionOption;
  targetTris: number;
  preset: PresetType;
  seed: number;
  removeBg: boolean;
  prompt?: string;
}): Promise<JobResponse> {
  const base = normalizeUrl(params.apiUrl);
  const form = new FormData();
  if (params.imageFile) {
    form.append('image', params.imageFile);
  }
  form.append('resolution', String(params.resolution));
  form.append('target_tris', String(params.targetTris));
  form.append('preset', params.preset);
  form.append('seed', String(params.seed));
  form.append('remove_bg', String(params.removeBg));
  if (params.prompt) {
    form.append('prompt', params.prompt);
  }

  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Failed to submit job (${res.status})`);
  }

  return (await res.json()) as JobResponse;
}

export async function fetchJobStatus(apiUrl: string, jobId: string): Promise<JobResponse> {
  const base = normalizeUrl(apiUrl);
  const res = await fetch(`${base}/api/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch job status (${res.status})`);
  }
  return (await res.json()) as JobResponse;
}

async function fetchGlbWithRetry(
  url: string,
  maxAttempts = 3,
  backoffMs = 1500,
): Promise<ArrayBuffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to download GLB (${res.status})`);
      }
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0) {
        throw new Error('Downloaded GLB file was empty');
      }
      return buffer;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, backoffMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to download GLB after retries');
}

export async function downloadJobGlb(apiUrl: string, jobId: string): Promise<ArrayBuffer> {
  const base = normalizeUrl(apiUrl);
  return await fetchGlbWithRetry(
    `${base}/api/jobs/${encodeURIComponent(jobId)}/download?format=glb`,
    3,
    1500,
  );
}

export async function fetchServerOutputs(apiUrl: string): Promise<OutputFileItem[]> {
  const base = normalizeUrl(apiUrl);
  if (!base) return [];
  const res = await fetch(`${base}/api/outputs`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to list outputs (${res.status})`);
  }
  const data = (await res.json()) as { outputs?: OutputFileItem[] };
  return Array.isArray(data.outputs) ? data.outputs : [];
}

export async function downloadOutputGlb(apiUrl: string, filename: string): Promise<ArrayBuffer> {
  const base = normalizeUrl(apiUrl);
  return await fetchGlbWithRetry(
    `${base}/api/outputs/${encodeURIComponent(filename)}`,
    3,
    1500,
  );
}

export async function downloadJobFormatFromBackend(
  apiUrl: string,
  jobId: string,
  format: 'glb' | 'obj' | 'stl' | 'fbx',
): Promise<Blob> {
  const base = normalizeUrl(apiUrl);
  const res = await fetch(
    `${base}/api/jobs/${encodeURIComponent(jobId)}/download?format=${format}`,
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Backend ${format.toUpperCase()} export failed (${res.status})`);
  }
  return await res.blob();
}

/**
 * Submit an Image-to-3D job directly to fal.ai TRELLIS endpoint when fal provider is selected.
 */
export async function runFalTrellisGeneration(params: {
  falApiKey: string;
  imageDataUrl: string;
  seed: number;
  onProgress: (stage: string, pct: number) => void;
}): Promise<ArrayBuffer> {
  params.onProgress('Removing Background', 18);
  const res = await fetch('https://fal.run/fal-ai/trellis', {
    method: 'POST',
    headers: {
      Authorization: `Key ${params.falApiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: params.imageDataUrl,
      seed: params.seed,
      texture_size: 2048,
      mesh_simplify: 0.95,
    }),
  });

  params.onProgress('Generating O-Voxel Geometry', 60);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai error (${res.status}): ${text.slice(0, 180)}`);
  }

  const data = (await res.json()) as { model_mesh?: { url?: string } };
  const meshUrl = data.model_mesh?.url;
  if (!meshUrl) {
    throw new Error('fal.ai did not return a model_mesh URL.');
  }

  params.onProgress('Optimizing Mesh', 90);
  const glbRes = await fetch(meshUrl);
  if (!glbRes.ok) {
    throw new Error('Failed to fetch GLB from fal.ai storage.');
  }
  return await glbRes.arrayBuffer();
}
