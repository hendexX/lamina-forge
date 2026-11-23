export type PresetType = 'lamina_vet_anatomy' | 'roblox_studio_asset' | 'raw_high_poly_pbr';

export type ResolutionOption = 512 | 1024 | 1536;

export type PbrChannel = 'full_pbr' | 'albedo' | 'clay' | 'roughness_metallic';

export type ViewportTheme = 'dark' | 'light';

export type GenerationMode = 'image_to_3d' | 'text_to_3d';

export type BackendProvider = 'custom' | 'fal';

export interface MeshStats {
  triangles: number;
  vertices: number;
  width_m: number;
  height_m: number;
  depth_m: number;
  preset?: string;
  draco_compressed?: boolean;
  has_pbr_textures?: boolean;
}

export interface HealthResponse {
  status: string;
  mock_mode: boolean;
  model: string;
  device: string;
  gpu_name: string;
  version: string;
}

export interface JobResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stage: string;
  stages: string[];
  progress: number;
  created_at: number;
  completed_at?: number | null;
  resolution: number;
  target_tris: number;
  preset: PresetType;
  seed: number;
  prompt?: string | null;
  download_url?: string | null;
  metadata?: MeshStats | null;
  error?: string | null;
}

export interface AssetRecord {
  id: string;
  name: string;
  createdAt: number;
  preset: PresetType;
  resolution: ResolutionOption;
  targetTris: number;
  seed: number;
  mode: GenerationMode;
  prompt?: string;
  thumbnailDataUrl?: string;
  metadata: MeshStats;
  jobId?: string;
  glbBuffer: ArrayBuffer;
}

export const PRESET_CONFIG: Record<
  PresetType,
  {
    label: string;
    shortLabel: string;
    description: string;
    defaultTris: number;
    maxTris: number;
  }
> = {
  lamina_vet_anatomy: {
    label: 'Lamina Vet Anatomy',
    shortLabel: 'Vet Anatomy',
    description: 'Smooth organic shading, Y-up, normalized 2.0m scale',
    defaultTris: 15000,
    maxTris: 45000,
  },
  roblox_studio_asset: {
    label: 'Roblox Studio Asset',
    shortLabel: 'Roblox Asset',
    description: 'Low-poly decimated < 10k tris, centered pivot at Z = 0',
    defaultTris: 8000,
    maxTris: 45000,
  },
  raw_high_poly_pbr: {
    label: 'Raw High-Poly PBR',
    shortLabel: 'High-Poly PBR',
    description: 'High geometric fidelity with balanced PBR textures',
    defaultTris: 35000,
    maxTris: 45000,
  },
};

export const RESOLUTION_OPTIONS: { value: ResolutionOption; label: string; tag: string }[] = [
  { value: 512, label: '512³', tag: 'Fast Draft' },
  { value: 1024, label: '1024³', tag: 'Balanced' },
  { value: 1536, label: '1536³', tag: 'Ultra Detail' },
];
