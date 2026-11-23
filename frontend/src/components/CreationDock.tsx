import React, { useRef, useState } from 'react';
import {
  Dices,
  Eraser,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Type,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { PRESET_CONFIG, PresetType, RESOLUTION_OPTIONS } from '../types/studio';

const SAMPLE_PROMPTS = [
  'Equine hoof anatomical cross-section, clinical studio lighting',
  'Stylized medieval alchemy lantern, clean studio backdrop',
  'Canine skull veterinary teaching model, matte ivory finish',
];

const PIPELINE_STAGES = [
  'Removing Background',
  'Generating O-Voxel Geometry',
  'Baking PBR Textures',
  'Optimizing Mesh',
];

export const CreationDock: React.FC = () => {
  const {
    theme,
    mode,
    setMode,
    imageFile,
    imagePreviewUrl,
    setImageFile,
    removeBg,
    setRemoveBg,
    prompt,
    setPrompt,
    resolution,
    setResolution,
    preset,
    setPreset,
    targetTris,
    setTargetTris,
    seed,
    setSeed,
    randomizeSeed,
    isGenerating,
    isGeneratingRef,
    currentStage,
    progress,
    error,
    synthesizeReferenceImage,
    startGeneration,
  } = useStudioStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDark = theme === 'dark';

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageFile(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const loadSampleReference = async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#F1F5F9"/>
      <ellipse cx="256" cy="404" rx="110" ry="20" fill="#94A3B8" opacity="0.35"/>
      <path d="M256 96 C340 112 384 188 358 278 C336 350 296 388 256 392 C216 388 176 350 154 278 C128 188 172 112 256 96 Z" fill="#D6C5B8" stroke="#8C7667" stroke-width="6"/>
      <ellipse cx="220" cy="186" rx="28" ry="48" fill="#FFFFFF" opacity="0.35" transform="rotate(-15 220 186)"/>
    </svg>`;
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const file = new File([blob], 'equine_anatomy_sample.svg', { type: 'image/svg+xml' });
    setImageFile(file, dataUrl);
  };

  return (
    <aside
      className={`w-[320px] xl:w-[344px] shrink-0 border-r flex flex-col h-full overflow-hidden transition-colors ${
        isDark
          ? 'bg-[#0D1526] border-slate-800/80 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Mode Switcher */}
      <div className={`p-3.5 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div
          className={`grid grid-cols-2 p-1 rounded-xl ${
            isDark ? 'bg-slate-900/90' : 'bg-slate-100'
          }`}
        >
          <button
            type="button"
            onClick={() => setMode('image_to_3d')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'image_to_3d'
                ? isDark
                  ? 'bg-slate-800 text-sky-300 shadow-sm'
                  : 'bg-white text-sky-700 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Image-to-3D
          </button>
          <button
            type="button"
            onClick={() => setMode('text_to_3d')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'text_to_3d'
                ? isDark
                  ? 'bg-slate-800 text-sky-300 shadow-sm'
                  : 'bg-white text-sky-700 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Text-to-3D
          </button>
        </div>
      </div>

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Text-to-3D Prompt Box */}
        {mode === 'text_to_3d' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
                Reference Prompt
              </label>
              <span className="text-[10px] font-mono opacity-60">Gemini / Imagen</span>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the 3D subject (e.g., equine hoof cross-section, smooth clinical lighting)..."
              className={`w-full rounded-xl border p-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                isDark
                  ? 'bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className={`text-[10px] px-2 py-1 rounded-md border truncate max-w-full transition-colors ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {sample.slice(0, 34)}...
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={isGeneratingRef || !prompt.trim()}
              onClick={synthesizeReferenceImage}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-sky-300 hover:bg-slate-800'
                  : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
              }`}
            >
              {isGeneratingRef ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {isGeneratingRef ? 'Synthesizing Reference...' : 'Generate Studio Reference Image'}
            </button>
          </div>
        )}

        {/* Image Dropzone / Reference Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
              {mode === 'text_to_3d' ? 'Reference Preview' : 'Source Image'}
            </label>
            {!imagePreviewUrl && mode === 'image_to_3d' && (
              <button
                type="button"
                onClick={loadSampleReference}
                className="text-[11px] font-medium text-sky-400 hover:text-sky-300 transition-colors"
              >
                Load sample
              </button>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !imagePreviewUrl && fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
              isDragging
                ? 'border-sky-400 bg-sky-500/10'
                : imagePreviewUrl
                  ? isDark
                    ? 'border-slate-700/80 bg-slate-900/60'
                    : 'border-slate-300 bg-slate-50'
                  : isDark
                    ? 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 cursor-pointer'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />

            {imagePreviewUrl ? (
              <div className="relative aspect-[4/3] w-full flex items-center justify-center p-2">
                {/* Checkerboard backdrop when rembg is active */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={
                    removeBg
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg, #64748b 25%, transparent 25%), linear-gradient(-45deg, #64748b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #64748b 75%), linear-gradient(-45deg, transparent 75%, #64748b 75%)',
                          backgroundSize: '14px 14px',
                          backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
                        }
                      : undefined
                  }
                />
                <img
                  src={imagePreviewUrl}
                  alt="Reference preview"
                  className="relative max-h-full max-w-full object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageFile(null, null);
                  }}
                  aria-label="Clear image"
                  className="absolute top-2 right-2 p-1 rounded-lg bg-slate-950/75 text-slate-200 hover:bg-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {imageFile && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-950/75 text-[10px] font-mono text-slate-200 truncate max-w-[82%]">
                    {imageFile.name}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-7 px-4 text-center">
                <Upload className="w-6 h-6 mx-auto mb-2 text-sky-400 opacity-85" />
                <p className="text-xs font-medium">Drop PNG, JPG, or WebP</p>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Click to browse or drag an image here
                </p>
              </div>
            )}
          </div>

          {/* Automatic Background Removal Toggle */}
          <label
            className={`flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer select-none ${
              isDark
                ? 'bg-slate-900/50 border-slate-800/90 hover:border-slate-700'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <Eraser className="w-3.5 h-3.5 text-sky-400" />
              Auto Remove Background
              <span className="text-[10px] font-mono opacity-60">(rembg)</span>
            </span>
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
              className="accent-sky-500 w-4 h-4 rounded"
            />
          </label>
        </div>

        {/* Resolution / Voxel Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
            Resolution / Voxel Grid
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {RESOLUTION_OPTIONS.map((opt) => {
              const active = resolution === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResolution(opt.value)}
                  className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                    active
                      ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                      : isDark
                        ? 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-mono font-bold">{opt.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">{opt.tag}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Use Preset */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
            Target Use Preset
          </label>
          <div className="space-y-1.5">
            {(Object.keys(PRESET_CONFIG) as PresetType[]).map((key) => {
              const cfg = PRESET_CONFIG[key];
              const active = preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                    active
                      ? 'border-sky-500 bg-sky-500/12'
                      : isDark
                        ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${active ? 'text-sky-400' : ''}`}>
                      {cfg.label}
                    </span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </div>
                  <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {cfg.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Polycount (Triangles) Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70">
              Target Polycount (Triangles)
            </label>
            <span className="text-xs font-mono font-semibold text-sky-400">
              {targetTris.toLocaleString()} tris
            </span>
          </div>
          <input
            type="range"
            min={5000}
            max={45000}
            step={1000}
            value={Math.min(Math.max(targetTris, 5000), 45000)}
            onChange={(e) => setTargetTris(Number(e.target.value))}
            className={`w-full studio-slider ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
          />
          <div className="flex justify-between text-[10px] font-mono opacity-55">
            <span>5,000</span>
            <span>45,000 max</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            {[
              { label: 'Low 8k', value: 8000 },
              { label: 'Balanced 15k', value: 15000 },
              { label: 'High 30k', value: 30000 },
              { label: 'Max 45k', value: 45000 },
            ].map((pill) => {
              const active = targetTris === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTargetTris(pill.value)}
                  className={`py-1 px-1 rounded-lg border text-[10px] font-medium transition-all ${
                    active
                      ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                      : isDark
                        ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seed */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider opacity-70">Seed</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                isDark
                  ? 'bg-slate-900/80 border-slate-700/80 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="button"
              onClick={randomizeSeed}
              title="Randomize Seed"
              className={`px-3 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Dices className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Generate CTA & Progress Footer */}
      <div className={`p-4 border-t space-y-3 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        {isGenerating && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-sky-400">{currentStage || 'Processing...'}</span>
              <span className="font-mono opacity-75">{progress}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {PIPELINE_STAGES.map((stg, idx) => {
                const threshold = (idx + 1) * 22;
                const active = currentStage === stg || progress >= threshold;
                return (
                  <div
                    key={stg}
                    className={`h-1 rounded-full ${
                      active ? 'bg-sky-400' : isDark ? 'bg-slate-800' : 'bg-slate-200'
                    }`}
                    title={stg}
                  />
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={isGenerating}
          onClick={startGeneration}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-slate-950 shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating 3D Mesh...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate 3D Asset
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
