import { create } from 'zustand';
import * as THREE from 'three';
import {
  AssetRecord,
  BackendProvider,
  GenerationMode,
  MeshStats,
  OutputFileItem,
  PbrChannel,
  PRESET_CONFIG,
  PresetType,
  ResolutionOption,
  ViewportTheme,
} from '../types/studio';
import {
  deleteAssetFromDB,
  loadAssetsFromDB,
  loadStoredSettings,
  saveAssetToDB,
  saveStoredSettings,
} from '../services/storage';
import {
  downloadJobGlb,
  downloadOutputGlb,
  fetchJobStatus,
  fetchServerOutputs,
  generateReferenceImage,
  pingBackend,
  runFalTrellisGeneration,
  submitGenerationJob,
} from '../services/api';

interface ToastMessage {
  id: number;
  type: 'info' | 'success' | 'error';
  text: string;
}

interface StudioState {
  // Backend & Settings
  provider: BackendProvider;
  apiUrl: string;
  falApiKey: string;
  geminiApiKey: string;
  connectionStatus: 'checking' | 'connected' | 'offline';
  gpuLabel: string;
  mockMode: boolean;
  settingsOpen: boolean;

  // Creation Dock Inputs
  mode: GenerationMode;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  removeBg: boolean;
  prompt: string;
  resolution: ResolutionOption;
  preset: PresetType;
  targetTris: number;
  seed: number;

  // Generation State
  isGenerating: boolean;
  isGeneratingRef: boolean;
  currentStage: string;
  progress: number;
  error: string | null;
  toast: ToastMessage | null;

  // Viewport State
  theme: ViewportTheme;
  autoRotate: boolean;
  wireframe: boolean;
  pbrChannel: PbrChannel;
  cameraResetCounter: number;
  liveMeshStats: MeshStats | null;
  activeSceneObject: THREE.Object3D | null;

  // Asset History & Server Recovery
  assets: AssetRecord[];
  activeAssetId: string | null;
  activeGlbUrl: string | null;
  serverOutputs: OutputFileItem[];
  isLoadingOutputs: boolean;

  // Actions
  init: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  updateSettings: (partial: {
    provider?: BackendProvider;
    apiUrl?: string;
    falApiKey?: string;
    geminiApiKey?: string;
  }) => Promise<void>;
  checkConnection: () => Promise<void>;
  refreshServerOutputs: () => Promise<void>;
  loadServerOutput: (output: OutputFileItem) => Promise<void>;
  retryAssetDownload: (id: string) => Promise<void>;

  setMode: (mode: GenerationMode) => void;
  setImageFile: (file: File | null, previewUrl: string | null) => void;
  setRemoveBg: (v: boolean) => void;
  setPrompt: (prompt: string) => void;
  setResolution: (res: ResolutionOption) => void;
  setPreset: (preset: PresetType) => void;
  setTargetTris: (tris: number) => void;
  setSeed: (seed: number) => void;
  randomizeSeed: () => void;

  setTheme: (theme: ViewportTheme) => void;
  toggleTheme: () => void;
  setAutoRotate: (v: boolean) => void;
  setWireframe: (v: boolean) => void;
  setPbrChannel: (channel: PbrChannel) => void;
  triggerCameraReset: () => void;
  setLiveMeshStats: (stats: MeshStats | null) => void;
  setActiveSceneObject: (obj: THREE.Object3D | null) => void;

  showToast: (type: ToastMessage['type'], text: string) => void;
  clearToast: () => void;

  synthesizeReferenceImage: () => Promise<void>;
  startGeneration: () => Promise<void>;
  selectAsset: (id: string) => void;
  deleteAsset: (id: string) => Promise<void>;
}

const initialSettings = loadStoredSettings();

function createObjectUrlFromBuffer(buffer: ArrayBuffer): string {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

export const useStudioStore = create<StudioState>((set, get) => ({
  provider: initialSettings.provider,
  apiUrl: initialSettings.apiUrl,
  falApiKey: initialSettings.falApiKey,
  geminiApiKey: initialSettings.geminiApiKey,
  connectionStatus: 'checking',
  gpuLabel: 'Connecting...',
  mockMode: false,
  settingsOpen: false,

  mode: 'image_to_3d',
  imageFile: null,
  imagePreviewUrl: null,
  removeBg: true,
  prompt: '',
  resolution: 1024,
  preset: 'organic_anatomy',
  targetTris: PRESET_CONFIG.organic_anatomy.defaultTris,
  seed: 42,

  isGenerating: false,
  isGeneratingRef: false,
  currentStage: '',
  progress: 0,
  error: null,
  toast: null,

  theme: 'dark',
  autoRotate: false,
  wireframe: false,
  pbrChannel: 'full_pbr',
  cameraResetCounter: 0,
  liveMeshStats: null,
  activeSceneObject: null,

  assets: [],
  activeAssetId: null,
  activeGlbUrl: null,
  serverOutputs: [],
  isLoadingOutputs: false,

  init: async () => {
    try {
      const saved = await loadAssetsFromDB();
      if (saved.length > 0) {
        const first = saved[0];
        const url = first.glbBuffer.byteLength > 0 ? createObjectUrlFromBuffer(first.glbBuffer) : null;
        set({
          assets: saved,
          activeAssetId: first.id,
          activeGlbUrl: url,
          liveMeshStats: first.metadata,
        });
      }
    } catch {
      // Ignore IndexedDB init errors in restricted contexts
    }
    await get().checkConnection();
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  updateSettings: async (partial) => {
    const next = {
      provider: partial.provider ?? get().provider,
      apiUrl: partial.apiUrl ?? get().apiUrl,
      falApiKey: partial.falApiKey ?? get().falApiKey,
      geminiApiKey: partial.geminiApiKey ?? get().geminiApiKey,
    };
    saveStoredSettings(next);
    set(next);
    await get().checkConnection();
  },

  checkConnection: async () => {
    set({ connectionStatus: 'checking' });
    try {
      const { provider, apiUrl, falApiKey } = get();
      const health = await pingBackend(provider, apiUrl, falApiKey);
      set({
        connectionStatus: 'connected',
        gpuLabel: health.gpu_name || 'Connected',
        mockMode: Boolean(health.mock_mode),
      });
      if (provider !== 'fal') {
        void get().refreshServerOutputs();
      }
    } catch {
      set({
        connectionStatus: 'offline',
        gpuLabel: 'Offline',
        mockMode: false,
      });
    }
  },

  refreshServerOutputs: async () => {
    const { provider, apiUrl } = get();
    if (provider === 'fal' || !apiUrl.trim()) return;
    set({ isLoadingOutputs: true });
    try {
      const outputs = await fetchServerOutputs(apiUrl);
      set({ serverOutputs: outputs, isLoadingOutputs: false });
    } catch {
      set({ isLoadingOutputs: false });
    }
  },

  loadServerOutput: async (output) => {
    const { apiUrl } = get();
    set({ error: null });
    try {
      get().showToast('info', `Loading ${output.filename}...`);
      const glbBuffer = await downloadOutputGlb(apiUrl, output.filename);
      const existing = get().assets.find(
        (a) => a.jobId && output.filename === `${a.jobId}.glb`,
      );
      const baseName = output.filename.replace(/\.glb$/i, '');
      const record: AssetRecord = existing
        ? { ...existing, glbBuffer, pendingDownload: false }
        : {
            id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: baseName,
            createdAt: Math.round(output.created_at * 1000) || Date.now(),
            preset: get().preset,
            resolution: get().resolution,
            targetTris: get().targetTris,
            seed: get().seed,
            mode: 'image_to_3d',
            metadata: {
              triangles: 0,
              vertices: 0,
              width_m: 0,
              height_m: 0,
              depth_m: 0,
              preset: get().preset,
            },
            jobId: baseName,
            downloadUrl: output.download_url,
            pendingDownload: false,
            glbBuffer,
          };

      await saveAssetToDB(record);

      const prevUrl = get().activeGlbUrl;
      const nextUrl = createObjectUrlFromBuffer(glbBuffer);
      if (prevUrl) URL.revokeObjectURL(prevUrl);

      set((s) => ({
        assets: existing
          ? s.assets.map((a) => (a.id === existing.id ? record : a))
          : [record, ...s.assets],
        activeAssetId: record.id,
        activeGlbUrl: nextUrl,
        liveMeshStats: record.metadata,
      }));
      get().showToast('success', `Loaded ${output.filename} from server outputs.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to load ${output.filename}`;
      set({ error: msg });
      get().showToast('error', msg);
    }
  },

  retryAssetDownload: async (id) => {
    const asset = get().assets.find((a) => a.id === id);
    if (!asset || !asset.jobId) return;
    const { apiUrl } = get();
    try {
      get().showToast('info', `Retrying download for "${asset.name}"...`);
      const glbBuffer = await downloadJobGlb(apiUrl, asset.jobId);
      const updated: AssetRecord = {
        ...asset,
        glbBuffer,
        pendingDownload: false,
      };
      await saveAssetToDB(updated);

      const prevUrl = get().activeGlbUrl;
      const nextUrl = createObjectUrlFromBuffer(glbBuffer);
      if (prevUrl) URL.revokeObjectURL(prevUrl);

      set((s) => ({
        assets: s.assets.map((a) => (a.id === id ? updated : a)),
        activeAssetId: updated.id,
        activeGlbUrl: nextUrl,
        liveMeshStats: updated.metadata,
        error: null,
      }));
      get().showToast('success', `Loaded "${asset.name}" into viewport.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry download failed.';
      set({ error: msg });
      get().showToast('error', msg);
    }
  },

  setMode: (mode) => set({ mode, error: null }),
  setImageFile: (file, previewUrl) => set({ imageFile: file, imagePreviewUrl: previewUrl, error: null }),
  setRemoveBg: (removeBg) => set({ removeBg }),
  setPrompt: (prompt) => set({ prompt }),
  setResolution: (resolution) => set({ resolution }),

  setPreset: (preset) => {
    const cfg = PRESET_CONFIG[preset];
    set({
      preset,
      targetTris: cfg.defaultTris,
    });
  },

  setTargetTris: (targetTris) => set({ targetTris }),
  setSeed: (seed) => set({ seed: Number.isFinite(seed) ? Math.max(0, Math.floor(seed)) : 42 }),
  randomizeSeed: () => set({ seed: Math.floor(Math.random() * 999999) }),

  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setWireframe: (wireframe) => set({ wireframe }),
  setPbrChannel: (pbrChannel) => set({ pbrChannel }),
  triggerCameraReset: () => set((s) => ({ cameraResetCounter: s.cameraResetCounter + 1 })),
  setLiveMeshStats: (liveMeshStats) => set({ liveMeshStats }),
  setActiveSceneObject: (activeSceneObject) => set({ activeSceneObject }),

  showToast: (type, text) => {
    const id = Date.now();
    set({ toast: { id, type, text } });
    window.setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 4000);
  },
  clearToast: () => set({ toast: null }),

  synthesizeReferenceImage: async () => {
    const { prompt, preset, apiUrl, geminiApiKey } = get();
    if (!prompt.trim()) {
      set({ error: 'Enter a description to generate a studio reference image.' });
      return;
    }

    const styleGuidance = PRESET_CONFIG[preset]?.promptGuidance;
    const styledPrompt = styleGuidance
      ? `${prompt.trim()}, ${styleGuidance}`
      : prompt.trim();

    set({ isGeneratingRef: true, error: null });
    try {
      const { imageDataUrl } = await generateReferenceImage({
        apiUrl,
        prompt: styledPrompt,
        geminiApiKey,
      });
      const file = await dataUrlToFile(imageDataUrl, 'reference_studio.png');
      set({
        imageFile: file,
        imagePreviewUrl: imageDataUrl,
        isGeneratingRef: false,
      });
      get().showToast('success', 'Studio reference image ready for TRELLIS.2-4B.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reference synthesis failed.';
      set({ isGeneratingRef: false, error: msg });
      get().showToast('error', msg);
    }
  },

  startGeneration: async () => {
    const state = get();
    if (state.isGenerating) return;

    if (state.mode === 'image_to_3d' && !state.imageFile && !state.mockMode) {
      set({ error: 'Please drop or select a reference image first.' });
      return;
    }

    if (state.mode === 'text_to_3d' && !state.imageFile) {
      if (!state.prompt.trim()) {
        set({ error: 'Enter a prompt and generate a reference image first.' });
        return;
      }
      await get().synthesizeReferenceImage();
      if (!get().imageFile) return;
    }

    const activeFile = get().imageFile;
    const activePreview = get().imagePreviewUrl;

    set({
      isGenerating: true,
      currentStage: 'Removing Background',
      progress: 8,
      error: null,
    });

    try {
      let glbBuffer: ArrayBuffer;
      let metadata: MeshStats;
      let jobId: string | undefined;

      if (state.provider === 'fal') {
        if (!activePreview) {
          throw new Error('An image is required for fal.ai TRELLIS generation.');
        }
        glbBuffer = await runFalTrellisGeneration({
          falApiKey: state.falApiKey,
          imageDataUrl: activePreview,
          seed: state.seed,
          onProgress: (stage, pct) => set({ currentStage: stage, progress: pct }),
        });
        metadata = {
          triangles: state.targetTris,
          vertices: Math.round(state.targetTris / 2),
          width_m: 1.5,
          height_m: 1.8,
          depth_m: 1.5,
          preset: state.preset,
        };
      } else {
        const job = await submitGenerationJob({
          apiUrl: state.apiUrl,
          imageFile: activeFile,
          resolution: state.resolution,
          targetTris: state.targetTris,
          preset: state.preset,
          seed: state.seed,
          removeBg: state.removeBg,
          prompt: state.prompt || undefined,
        });
        jobId = job.id;

        let latest = job;
        while (latest.status === 'queued' || latest.status === 'processing') {
          set({
            currentStage: latest.stage || 'Processing',
            progress: Math.max(10, latest.progress),
          });
          await new Promise((r) => window.setTimeout(r, 350));
          latest = await fetchJobStatus(state.apiUrl, job.id);
        }

        if (latest.status === 'failed') {
          throw new Error(latest.error || '3D generation job failed on backend.');
        }

        metadata = latest.metadata || {
          triangles: state.targetTris,
          vertices: Math.round(state.targetTris / 2),
          width_m: 1.5,
          height_m: 2.0,
          depth_m: 1.5,
          preset: state.preset,
        };

        const presetShort = PRESET_CONFIG[state.preset].shortLabel;
        const assetName =
          state.prompt.trim().slice(0, 32) ||
          activeFile?.name.replace(/\.[^.]+$/, '') ||
          `${presetShort} #${state.seed}`;

        const pendingRecord: AssetRecord = {
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: assetName,
          createdAt: Date.now(),
          preset: state.preset,
          resolution: state.resolution,
          targetTris: state.targetTris,
          seed: state.seed,
          mode: state.mode,
          prompt: state.prompt || undefined,
          thumbnailDataUrl: activePreview || undefined,
          metadata,
          jobId,
          downloadUrl: latest.download_url || `/api/jobs/${job.id}/download?format=glb`,
          pendingDownload: true,
          glbBuffer: new ArrayBuffer(0),
        };

        // Add completed job to Asset History immediately before fetching the GLB blob
        set((s) => ({
          assets: [pendingRecord, ...s.assets],
          activeAssetId: pendingRecord.id,
          liveMeshStats: metadata,
          currentStage: 'Loading 3D Asset',
          progress: 98,
        }));

        try {
          glbBuffer = await downloadJobGlb(state.apiUrl, job.id);
        } catch (dlErr) {
          const dlMsg =
            dlErr instanceof Error ? dlErr.message : 'Failed to fetch GLB from backend.';
          set({
            isGenerating: false,
            currentStage: '',
            progress: 0,
            error: `Model generated and saved on server, but viewport download failed (${dlMsg}). Click it in Asset History or Server Outputs to retry.`,
          });
          get().showToast(
            'error',
            'Model saved on server — click it in Asset History or Server Outputs to load.',
          );
          void get().refreshServerOutputs();
          return;
        }

        const completedRecord: AssetRecord = {
          ...pendingRecord,
          glbBuffer,
          pendingDownload: false,
        };
        await saveAssetToDB(completedRecord);

        const prevUrl = get().activeGlbUrl;
        const nextUrl = createObjectUrlFromBuffer(glbBuffer);
        if (prevUrl) URL.revokeObjectURL(prevUrl);

        set((s) => ({
          assets: s.assets.map((a) => (a.id === completedRecord.id ? completedRecord : a)),
          activeAssetId: completedRecord.id,
          activeGlbUrl: nextUrl,
          liveMeshStats: metadata,
          isGenerating: false,
          currentStage: 'Completed',
          progress: 100,
        }));
        void get().refreshServerOutputs();
        get().showToast(
          'success',
          `Generated "${assetName}" (${metadata.triangles.toLocaleString()} tris).`,
        );
        return;
      }

      const presetShort = PRESET_CONFIG[state.preset].shortLabel;
      const assetName =
        state.prompt.trim().slice(0, 32) ||
        activeFile?.name.replace(/\.[^.]+$/, '') ||
        `${presetShort} #${state.seed}`;

      const record: AssetRecord = {
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: assetName,
        createdAt: Date.now(),
        preset: state.preset,
        resolution: state.resolution,
        targetTris: state.targetTris,
        seed: state.seed,
        mode: state.mode,
        prompt: state.prompt || undefined,
        thumbnailDataUrl: activePreview || undefined,
        metadata,
        jobId,
        glbBuffer,
      };

      await saveAssetToDB(record);

      const prevUrl = get().activeGlbUrl;
      const nextUrl = createObjectUrlFromBuffer(glbBuffer);
      if (prevUrl) URL.revokeObjectURL(prevUrl);

      set((s) => ({
        assets: [record, ...s.assets],
        activeAssetId: record.id,
        activeGlbUrl: nextUrl,
        liveMeshStats: metadata,
        isGenerating: false,
        currentStage: 'Completed',
        progress: 100,
      }));
      get().showToast('success', `Generated "${assetName}" (${metadata.triangles.toLocaleString()} tris).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed.';
      set({
        isGenerating: false,
        currentStage: '',
        progress: 0,
        error: msg,
      });
      get().showToast('error', msg);
    }
  },

  selectAsset: (id) => {
    const asset = get().assets.find((a) => a.id === id);
    if (!asset) return;
    if (asset.glbBuffer.byteLength === 0 && asset.jobId) {
      set({ activeAssetId: asset.id, liveMeshStats: asset.metadata });
      void get().retryAssetDownload(asset.id);
      return;
    }
    const prevUrl = get().activeGlbUrl;
    const nextUrl = createObjectUrlFromBuffer(asset.glbBuffer);
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({
      activeAssetId: asset.id,
      activeGlbUrl: nextUrl,
      liveMeshStats: asset.metadata,
    });
  },

  deleteAsset: async (id) => {
    await deleteAssetFromDB(id);
    const remaining = get().assets.filter((a) => a.id !== id);
    const wasActive = get().activeAssetId === id;

    if (wasActive) {
      const prevUrl = get().activeGlbUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      if (remaining.length > 0) {
        const next = remaining[0];
        set({
          assets: remaining,
          activeAssetId: next.id,
          activeGlbUrl: createObjectUrlFromBuffer(next.glbBuffer),
          liveMeshStats: next.metadata,
        });
      } else {
        set({
          assets: remaining,
          activeAssetId: null,
          activeGlbUrl: null,
          liveMeshStats: null,
          activeSceneObject: null,
        });
      }
    } else {
      set({ assets: remaining });
    }
  },
}));
