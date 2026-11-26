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
import { RESOLUTION_OPTIONS } from '../types/studio';

const SAMPLE_PROMPTS = [
  'Equine hoof anatomical cross-section',
  'Stylized brass alchemy lantern',
  'Canine skull teaching model',
];

const PIPELINE_STAGES = [
  'Removing Background',
  'Generating O-Voxel Geometry',
  'Baking PBR Textures',
  'Optimizing Mesh',
];

const POLYCOUNT_PILLS = [
  { label: 'Low 8k', value: 8000 },
  { label: 'Balanced 15k', value: 15000 },
  { label: 'High 30k', value: 30000 },
  { label: 'Max 45k', value: 45000 },
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
      <rect width="512" height="512" fill="#FFFFFF"/>
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
      className={`w-[320px] xl:w-[344px] shrink-0 rounded-3xl border backdrop-blur-2xl flex flex-col h-full overflow-hidden transition-all duration-200 shadow-[0_20px_50px_rgba(0,0,0,0.12)] ${
        isDark
          ? 'bg-neutral-900/65 border-white/10 text-neutral-100'
          : 'bg-white/70 border-white/50 text-neutral-900'
      }`}
    >
      {/* Mode Segmented Control */}
      <div className={`p-3.5 border-b ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
        <div
          className={`grid grid-cols-2 p-1 rounded-xl ${
            isDark ? 'bg-black/35' : 'bg-black/[0.05]'
          }`}
        >
          <button
            type="button"
            onClick={() => setMode('image_to_3d')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
              mode === 'image_to_3d'
                ? isDark
                  ? 'bg-[#0A84FF] text-white shadow-sm'
                  : 'bg-[#0071E3] text-white shadow-sm'
                : isDark
                  ? 'text-neutral-400 hover:text-neutral-100'
                  : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Image-to-3D
          </button>
          <button
            type="button"
            onClick={() => setMode('text_to_3d')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
              mode === 'text_to_3d'
                ? isDark
                  ? 'bg-[#0A84FF] text-white shadow-sm'
                  : 'bg-[#0071E3] text-white shadow-sm'
                : isDark
                  ? 'text-neutral-400 hover:text-neutral-100'
                  : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Text-to-3D
          </button>
        </div>
      </div>

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Text-to-3D Prompt Box */}
        {mode === 'text_to_3d' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">
                Reference Prompt
              </label>
              <span className="text-[10px] font-medium opacity-50">Gemini Image</span>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the 3D object (e.g., stylized brass lantern, clean watertight form)..."
              className={`w-full rounded-xl border p-3 text-xs resize-none transition-all duration-200 focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/[0.05] border-white/10 text-neutral-100 placeholder:text-neutral-500 focus:ring-[#0A84FF]/40 focus:border-[#0A84FF]/60'
                  : 'bg-white/80 border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/60'
              }`}
            />
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border truncate max-w-full transition-colors duration-200 ${
                    isDark
                      ? 'bg-white/[0.04] border-white/10 text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.08]'
                      : 'bg-black/[0.03] border-black/[0.07] text-neutral-600 hover:bg-black/[0.07]'
                  }`}
                >
                  {sample}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={isGeneratingRef || !prompt.trim()}
              onClick={synthesizeReferenceImage}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all duration-200 disabled:opacity-45 ${
                isDark
                  ? 'bg-white/[0.07] border-white/15 text-[#0A84FF] hover:bg-white/[0.12]'
                  : 'bg-[#0071E3]/10 border-[#0071E3]/20 text-[#0071E3] hover:bg-[#0071E3]/15'
              }`}
            >
              {isGeneratingRef ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {isGeneratingRef ? 'Synthesizing Reference...' : 'Generate Studio Reference'}
            </button>
          </div>
        )}

        {/* Image Dropzone / Reference Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">
              {mode === 'text_to_3d' ? 'Reference Preview' : 'Source Image'}
            </label>
            {!imagePreviewUrl && mode === 'image_to_3d' && (
              <button
                type="button"
                onClick={loadSampleReference}
                className={`text-[11px] font-medium transition-colors ${
                  isDark ? 'text-[#0A84FF] hover:text-blue-300' : 'text-[#0071E3] hover:text-blue-700'
                }`}
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
            className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
              isDragging
                ? 'border-[#0A84FF] bg-[#0A84FF]/10'
                : imagePreviewUrl
                  ? isDark
                    ? 'border-white/10 bg-black/30'
                    : 'border-black/10 bg-white/80'
                  : isDark
                    ? 'border-dashed border-white/15 bg-white/[0.03] hover:border-white/30 cursor-pointer'
                    : 'border-dashed border-black/15 bg-white/50 hover:border-black/30 cursor-pointer'
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
              <div className="relative aspect-[4/3] w-full flex items-center justify-center p-2.5">
                <div
                  className="absolute inset-0 opacity-15"
                  style={
                    removeBg
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg, #8e8e93 25%, transparent 25%), linear-gradient(-45deg, #8e8e93 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #8e8e93 75%), linear-gradient(-45deg, transparent 75%, #8e8e93 75%)',
                          backgroundSize: '14px 14px',
                          backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
                        }
                      : undefined
                  }
                />
                <img
                  src={imagePreviewUrl}
                  alt="Reference preview"
                  className="relative max-h-full max-w-full object-contain rounded-xl"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageFile(null, null);
                  }}
                  aria-label="Clear image"
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/65 backdrop-blur-md text-white hover:bg-rose-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {imageFile && (
                  <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/90 truncate max-w-[82%]">
                    {imageFile.name}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-7 px-4 text-center">
                <Upload
                  className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`}
                  strokeWidth={1.8}
                />
                <p className="text-xs font-medium">Drop PNG, JPG, or WebP</p>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Click to browse or drag an image here
                </p>
              </div>
            )}
          </div>

          {/* Auto Background Removal Toggle */}
          <label
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border cursor-pointer select-none transition-colors duration-200 ${
              isDark
                ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07]'
                : 'bg-white/60 border-black/[0.07] hover:bg-white/90'
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <Eraser className={`w-3.5 h-3.5 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`} />
              Remove Background
            </span>
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
              className="accent-[#0071E3] dark:accent-[#0A84FF] w-4 h-4 rounded"
            />
          </label>
        </div>

        {/* Quality / Voxel Grid */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">
            Quality
          </label>
          <div
            className={`grid grid-cols-3 p-1 rounded-xl gap-1 ${
              isDark ? 'bg-black/35' : 'bg-black/[0.05]'
            }`}
          >
            {RESOLUTION_OPTIONS.map((opt) => {
              const active = resolution === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResolution(opt.value)}
                  className={`py-2 px-1.5 rounded-[10px] text-center transition-all duration-200 ${
                    active
                      ? isDark
                        ? 'bg-[#0A84FF] text-white shadow-sm'
                        : 'bg-[#0071E3] text-white shadow-sm'
                      : isDark
                        ? 'text-neutral-300 hover:bg-white/[0.06]'
                        : 'text-neutral-700 hover:bg-white/70'
                  }`}
                >
                  <div className="text-xs font-semibold tabular-nums">{opt.label}</div>
                  <div className={`text-[10px] mt-0.5 ${active ? 'text-white/85' : 'opacity-60'}`}>
                    {opt.tag}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Polycount (Triangles) Slider */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">
              Target Polycount
            </label>
            <span
              className={`text-xs font-semibold tabular-nums ${
                isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'
              }`}
            >
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
            className={`w-full studio-slider ${isDark ? 'bg-white/15' : 'bg-black/15'}`}
          />
          <div className="grid grid-cols-4 gap-1.5">
            {POLYCOUNT_PILLS.map((pill) => {
              const active = targetTris === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTargetTris(pill.value)}
                  className={`py-1.5 px-1 rounded-full border text-[10px] font-medium tabular-nums transition-all duration-200 ${
                    active
                      ? isDark
                        ? 'border-[#0A84FF] bg-[#0A84FF]/20 text-[#0A84FF]'
                        : 'border-[#0071E3] bg-[#0071E3]/10 text-[#0071E3]'
                      : isDark
                        ? 'border-white/10 bg-white/[0.04] text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.08]'
                        : 'border-black/[0.07] bg-white/60 text-neutral-600 hover:bg-white'
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
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">
            Seed
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className={`flex-1 px-3.5 py-2 rounded-xl border text-xs tabular-nums transition-all duration-200 focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/[0.05] border-white/10 text-neutral-100 focus:ring-[#0A84FF]/40'
                  : 'bg-white/80 border-black/10 text-neutral-900 focus:ring-[#0071E3]/30'
              }`}
            />
            <button
              type="button"
              onClick={randomizeSeed}
              title="Randomize Seed"
              className={`px-3 rounded-xl border transition-all duration-200 ${
                isDark
                  ? 'bg-white/[0.05] border-white/10 text-neutral-300 hover:text-white hover:bg-white/[0.10]'
                  : 'bg-white/80 border-black/10 text-neutral-700 hover:bg-white'
              }`}
            >
              <Dices className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/25 text-rose-500 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Generate CTA & Progress Footer */}
      <div
        className={`p-4 border-t space-y-3 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}
      >
        {isGenerating && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className={`font-medium ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`}>
                {currentStage || 'Processing...'}
              </span>
              <span className="tabular-nums opacity-70">{progress}%</span>
            </div>
            <div
              className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isDark ? 'bg-[#0A84FF]' : 'bg-[#0071E3]'
                }`}
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
                    className={`h-1 rounded-full transition-colors duration-200 ${
                      active
                        ? isDark
                          ? 'bg-[#0A84FF]'
                          : 'bg-[#0071E3]'
                        : isDark
                          ? 'bg-white/10'
                          : 'bg-black/10'
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
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-55 ${
            isDark
              ? 'bg-[#0A84FF] hover:bg-[#1E90FF] shadow-[#0A84FF]/25'
              : 'bg-[#0071E3] hover:bg-[#0077ED] shadow-[#0071E3]/25'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating 3D Asset...
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
