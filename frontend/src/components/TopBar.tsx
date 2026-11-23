import React from 'react';
import { Box, Moon, Settings2, Sun, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';

export const TopBar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    connectionStatus,
    gpuLabel,
    mockMode,
    setSettingsOpen,
  } = useStudioStore();

  const isDark = theme === 'dark';

  return (
    <header
      className={`h-14 shrink-0 border-b px-4 flex items-center justify-between select-none transition-colors ${
        isDark
          ? 'bg-[#0B1221] border-slate-800/80 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm shadow-sky-500/20">
          <Box className="w-4 h-4 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-semibold tracking-tight text-[15px]">Lamina Forge</span>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              isDark
                ? 'bg-slate-800/80 border-slate-700 text-sky-300'
                : 'bg-slate-100 border-slate-200 text-sky-700'
            }`}
          >
            TRELLIS.2-4B
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Live Connection Pill */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Configure Colab Tunnel, Cloud Run, or fal.ai Endpoint"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            connectionStatus === 'connected'
              ? isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : connectionStatus === 'checking'
                ? isDark
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
                : isDark
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/15'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
          }`}
        >
          {connectionStatus === 'checking' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : connectionStatus === 'connected' ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span>
            {connectionStatus === 'connected'
              ? `Connected • ${mockMode ? 'Mock Mode' : gpuLabel}`
              : connectionStatus === 'checking'
                ? 'Pinging Worker...'
                : 'Offline'}
          </span>
          {connectionStatus === 'connected' && <Wifi className="w-3 h-3 opacity-60" />}
        </button>

        {/* Studio Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Studio (#F6F7F9)' : 'Switch to Dark Slate (#0F172A)'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isDark
              ? 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
          <span className="hidden sm:inline">{isDark ? 'Light Studio' : 'Dark Slate'}</span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Backend Settings"
          className={`p-2 rounded-lg border transition-colors ${
            isDark
              ? 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
