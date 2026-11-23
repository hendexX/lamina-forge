import React, { useState } from 'react';
import { Box, Clock, Download, FileBox, History, Loader2, Trash2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { PRESET_CONFIG } from '../types/studio';
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
      className={`w-[280px] xl:w-[300px] shrink-0 border-l flex flex-col h-full overflow-hidden transition-colors ${
        isDark
          ? 'bg-[#0D1526] border-slate-800/80 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Export Panel */}
      <div className={`p-4 border-b space-y-3 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-75">
            <Download className="w-3.5 h-3.5 text-sky-400" />
            Export Active Model
          </div>
          {activeAsset && (
            <span className="text-[10px] font-mono opacity-60">
              {(activeAsset.glbBuffer.byteLength / 1024).toFixed(0)} KB
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { fmt: 'glb', label: '.GLB (Draco)', primary: true },
              { fmt: 'obj', label: '.OBJ Mesh', primary: false },
              { fmt: 'stl', label: '.STL Print', primary: false },
              { fmt: 'fbx', label: '.FBX Studio', primary: false },
            ] as const
          ).map(({ fmt, label, primary }) => (
            <button
              key={fmt}
              type="button"
              disabled={!activeAsset || exportingFormat !== null}
              onClick={() => handleExport(fmt)}
              className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                primary
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 hover:bg-sky-500/25'
                  : isDark
                    ? 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800/70'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-75">
          <History className="w-3.5 h-3.5 text-sky-400" />
          Asset History
        </div>
        <span className="text-[11px] font-mono opacity-55">{assets.length} saved</span>
      </div>

      {/* Asset Gallery List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {assets.length === 0 ? (
          <div
            className={`mt-4 p-5 rounded-xl border border-dashed text-center ${
              isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}
          >
            <Box className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">No generated assets yet</p>
            <p className="text-[11px] mt-1 opacity-75">
              Generated models are saved locally in IndexedDB for instant switching.
            </p>
          </div>
        ) : (
          assets.map((asset) => {
            const active = asset.id === activeAssetId;
            return (
              <div
                key={asset.id}
                onClick={() => selectAsset(asset.id)}
                className={`group relative rounded-xl border p-2.5 cursor-pointer transition-all ${
                  active
                    ? 'border-sky-500 bg-sky-500/10'
                    : isDark
                      ? 'border-slate-800/90 bg-slate-900/40 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Thumbnail */}
                  <div
                    className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border ${
                      isDark
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    {asset.thumbnailDataUrl ? (
                      <img
                        src={asset.thumbnailDataUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Box className="w-5 h-5 text-sky-400 opacity-75" />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate pr-5">{asset.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono opacity-70">
                      <span>{asset.resolution}³</span>
                      <span>•</span>
                      <span>{asset.metadata.triangles.toLocaleString()} tris</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-medium">
                        {PRESET_CONFIG[asset.preset]?.shortLabel || asset.preset}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] opacity-55">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(asset.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAsset(asset.id);
                  }}
                  title="Delete from local gallery"
                  className={`absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                    isDark
                      ? 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400'
                      : 'hover:bg-rose-100 text-slate-400 hover:text-rose-600'
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
