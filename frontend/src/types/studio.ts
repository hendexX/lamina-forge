export type ModelStyle =
  | 'stylized_game_asset'
  | 'realistic_pbr_prop'
  | 'organic_anatomy'
  | 'hard_surface_scifi'
  | 'miniature_3d_print';

export type PresetType = ModelStyle;

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
  preset: string;
  seed: number;
  prompt?: string | null;
  download_url?: string | null;
  metadata?: MeshStats | null;
  error?: string | null;
}

export interface OutputFileItem {
  filename: string;
  size_bytes: number;
  created_at: number;
  download_url: string;
}

export interface AssetRecord {
  id: string;
  name: string;
  createdAt: number;
  preset: string;
  resolution: ResolutionOption;
  targetTris: number;
  seed: number;
  mode: GenerationMode;
  prompt?: string;
  thumbnailDataUrl?: string;
  metadata: MeshStats;
  jobId?: string;
  downloadUrl?: string;
  pendingDownload?: boolean;
  glbBuffer: ArrayBuffer;
}

export interface StyleConfig {
  label: string;
  shortLabel: string;
  description: string;
  defaultTris: number;
  promptGuidance: string;
}

export const MODEL_STYLES: Record<ModelStyle, StyleConfig> = {
  stylized_game_asset: {
    label: 'Stylized Game Asset',
    shortLabel: 'Stylized Game',
    description: 'Clean bold forms, optimized game-ready silhouette',
    defaultTris: 12000,
    promptGuidance: 'stylized game-ready 3D prop, clean bold forms, satin hand-crafted materials',
  },
  realistic_pbr_prop: {
    label: 'Realistic PBR Prop',
    shortLabel: 'Realistic PBR',
    description: 'Balanced physical shading and micro-surface detail',
    defaultTris: 20000,
    promptGuidance: 'photorealistic PBR 3D prop, authentic surface roughness, crisp material definition',
  },
  organic_anatomy: {
    label: 'Organic / Anatomy',
    shortLabel: 'Organic / Anatomy',
    description: 'Smooth organic shading, Y-up, normalized 2.0m scale',
    defaultTris: 15000,
    promptGuidance: 'anatomically accurate organic 3D sculpture, smooth sculptural contours, satin matte finish',
  },
  hard_surface_scifi: {
    label: 'Hard-Surface / Sci-Fi',
    shortLabel: 'Hard-Surface',
    description: 'Sharp mechanical edges, panels, and industrial geometry',
    defaultTris: 25000,
    promptGuidance: 'precision hard-surface sci-fi industrial 3D asset, clean beveled panels, machined satin finish',
  },
  miniature_3d_print: {
    label: 'Miniature / 3D Print',
    shortLabel: 'Miniature / Print',
    description: 'High-detail watertight sculpt tuned for fabrication',
    defaultTris: 30000,
    promptGuidance: 'solid watertight tabletop miniature 3D sculpt, thick printable details, neutral studio finish',
  },
};

export const PRESET_CONFIG = MODEL_STYLES;

export function getStyleShortLabel(preset: string): string {
  if (preset in MODEL_STYLES) {
    return MODEL_STYLES[preset as ModelStyle].shortLabel;
  }
  const legacy: Record<string, string> = {
    lamina_vet_anatomy: 'Organic / Anatomy',
    roblox_studio_asset: 'Stylized Game',
    raw_high_poly_pbr: 'Realistic PBR',
  };
  return legacy[preset] || preset;
}

export const RESOLUTION_OPTIONS: { value: ResolutionOption; label: string; tag: string }[] = [
  { value: 512, label: '512³', tag: 'Draft' },
  { value: 1024, label: '1024³', tag: 'Balanced' },
  { value: 1536, label: '1536³', tag: 'Ultra' },
];
