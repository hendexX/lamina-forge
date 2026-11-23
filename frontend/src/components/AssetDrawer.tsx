import React, { useState } from 'react';
import { Box, Clock, Download, FileBox, History, Loader2, Trash2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { getStyleShortLabel } from '../types/studio';
import {
  exportFbxViaBackend,
  exportGlbBuffer,
  exportObjectToObj,
  exportObjectToStl,
} from '../services/exporters';

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export const AssetDrawer: React.FC = () => {
  const {
    theme,
    assets,
    activeAssetId,
    selectAsset,
    deleteAsset,
    activeSceneObject,
    apiUrl,
    showToast,
  } = useStudioStore();

  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const isDark = theme === 'dark';
  const activeAsset = assets.find((a) => a.id === activeAssetId) || null;

  const sanitizeName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'lamina_asset';

  const handleExport = async (format: 'glb' | 'obj' | 'stl' | 'fbx') => {
    if (!activeAsset) return;
    const baseName = sanitizeName(activeAsset.name);
    setExportingFormat(format);

    try {
      if (format === 'glb') {
        exportGlbBuffer(activeAsset.glbBuffer, baseName);
        showToast('success', `Exported ${baseName}.glb`);
      } else if (format === 'obj') {
        if (!activeSceneObject) throw new Error('3D scene is still loading.');
        exportObjectToObj(activeSceneObject, baseName);
        showToast('success', `Exported ${baseName}.obj`);
      } else if (format === 'stl') {
        if (!activeSceneObject) throw new Error('3D scene is still loading.');
        exportObjectToStl(activeSceneObject, baseName);
        showToast('success', `Exported ${baseName}.stl`);
      } else if (format === 'fbx') {
        await exportFbxViaBackend(apiUrl, activeAsset.jobId, baseName);
        showToast('success', `Exported ${baseName}.fbx`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to export .${format}`;
      showToast('error', msg);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <aside
      className={`w-[280px] xl:w-[300px] shrink-0 rounded-3xl border backdrop-blur-2xl flex flex-col h-full overflow-hidden transition-all duration-200 shadow-[0_20px_50px_rgba(0,0,0,0.12)] ${
        isDark
          ? 'bg-neutral-900/65 border-white/10 text-neutral-100'
          : 'bg-white/70 border-white/50 text-neutral-900'
      }`}
    >
      {/* Export Panel */}
      <div
        className={`p-4 border-b space-y-3 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] opacity-65">
            <Download className={`w-3.5 h-3.5 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`} />
            Export Active Model
          </div>
          {activeAsset && (
            <span className="text-[11px] tabular-nums opacity-55">
              {(activeAsset.glbBuffer.byteLength / 1024).toFixed(0)} KB
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { fmt: 'glb', label: '.GLB', primary: true },
              { fmt: 'obj', label: '.OBJ', primary: false },
              { fmt: 'stl', label: '.STL', primary: false },
              { fmt: 'fbx', label: '.FBX', primary: false },
            ] as const
          ).map(({ fmt, label, primary }) => (
            <button
              key={fmt}
              type="button"
              disabled={!activeAsset || exportingFormat !== null}
              onClick={() => handleExport(fmt)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all duration-200 disabled:opacity-40 ${
                primary
                  ? isDark
                    ? 'bg-[#0A84FF]/20 border-[#0A84FF]/35 text-[#0A84FF] hover:bg-[#0A84FF]/30'
                    : 'bg-[#0071E3]/10 border-[#0071E3]/25 text-[#0071E3] hover:bg-[#0071E3]/18'
                  : isDark
                    ? 'bg-white/[0.05] border-white/10 text-neutral-200 hover:bg-white/[0.10]'
                    : 'bg-white/70 border-black/[0.07] text-neutral-700 hover:bg-white'
              }`}
            >
              {exportingFormat === fmt ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileBox className="w-3.5 h-3.5 opacity-80" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* History Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] opacity-65">
          <History className={`w-3.5 h-3.5 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`} />
          Asset History
        </div>
        <span className="text-[11px] tabular-nums opacity-50">{assets.length} saved</span>
      </div>

      {/* Asset Gallery List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {assets.length === 0 ? (
          <div
            className={`mt-4 p-5 rounded-2xl border border-dashed text-center ${
              isDark ? 'border-white/10 text-neutral-500' : 'border-black/10 text-neutral-400'
            }`}
          >
            <Box className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">No generated assets yet</p>
            <p className="text-[11px] mt-1 opacity-75 leading-relaxed">
              Generated models are cached locally in IndexedDB for instant switching.
            </p>
          </div>
        ) : (
          assets.map((asset) => {
            const active = asset.id === activeAssetId;
            return (
              <div
                key={asset.id}
                onClick={() => selectAsset(asset.id)}
                className={`group relative rounded-2xl border p-2.5 cursor-pointer transition-all duration-200 ${
                  active
                    ? isDark
                      ? 'border-[#0A84FF]/60 bg-[#0A84FF]/12'
                      : 'border-[#0071E3]/50 bg-[#0071E3]/[0.08]'
                    : isDark
                      ? 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]'
                      : 'border-black/[0.06] bg-white/60 hover:bg-white/95'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border ${
                      isDark
                        ? 'bg-black/40 border-white/10'
                        : 'bg-neutral-100 border-black/[0.06]'
                    }`}
                  >
                    {asset.thumbnailDataUrl ? (
                      <img
                        src={asset.thumbnailDataUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Box className="w-5 h-5 text-[#0A84FF] opacity-75" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate pr-5">{asset.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] tabular-nums opacity-65">
                      <span>{asset.resolution}³</span>
                      <span>•</span>
                      <span>{asset.metadata.triangles.toLocaleString()} tris</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isDark
                            ? 'bg-white/[0.08] text-neutral-300'
                            : 'bg-black/[0.05] text-neutral-600'
                        }`}
                      >
                        {getStyleShortLabel(asset.preset)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] opacity-50">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(asset.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAsset(asset.id);
                  }}
                  title="Delete from local gallery"
                  className={`absolute top-2.5 right-2.5 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                    isDark
                      ? 'hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400'
                      : 'hover:bg-rose-100 text-neutral-400 hover:text-rose-600'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
