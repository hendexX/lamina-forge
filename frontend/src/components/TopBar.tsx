import React from 'react';
import { Box, Loader2, Moon, Settings2, Sun, Wifi, WifiOff } from 'lucide-react';
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
      className={`h-14 shrink-0 rounded-2xl border backdrop-blur-2xl px-4 flex items-center justify-between select-none transition-all duration-200 shadow-[0_12px_36px_rgba(0,0,0,0.10)] ${
        isDark
          ? 'bg-neutral-900/65 border-white/10 text-neutral-100'
          : 'bg-white/70 border-white/50 text-neutral-900'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
            isDark
              ? 'bg-gradient-to-b from-[#0A84FF] to-[#0066CC]'
              : 'bg-gradient-to-b from-[#0071E3] to-[#005BB5]'
          }`}
        >
          <Box className="w-4 h-4 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-semibold tracking-[-0.02em] text-[15px]">Lamina Forge</span>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
              isDark
                ? 'bg-white/[0.06] border-white/10 text-neutral-300'
                : 'bg-black/[0.04] border-black/[0.06] text-neutral-600'
            }`}
          >
            TRELLIS.2-4B
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Live Connection Pill */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Configure Colab Tunnel, Cloud Run, or fal.ai Endpoint"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
            connectionStatus === 'connected'
              ? isDark
                ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 hover:bg-emerald-500/15'
              : connectionStatus === 'checking'
                ? isDark
                  ? 'bg-amber-500/15 border-amber-400/25 text-amber-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-700'
                : isDark
                  ? 'bg-rose-500/15 border-rose-400/25 text-rose-300 hover:bg-rose-500/20'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-700 hover:bg-rose-500/15'
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
                ? 'Connecting...'
                : 'Offline'}
          </span>
          {connectionStatus === 'connected' && <Wifi className="w-3 h-3 opacity-60" />}
        </button>

        {/* Studio Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Studio' : 'Switch to Dark Studio'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
            isDark
              ? 'bg-white/[0.06] border-white/10 text-neutral-200 hover:bg-white/[0.12]'
              : 'bg-black/[0.04] border-black/[0.07] text-neutral-700 hover:bg-black/[0.08]'
          }`}
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-neutral-600" />
          )}
          <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Backend Settings"
          className={`p-2 rounded-full border transition-all duration-200 ${
            isDark
              ? 'bg-white/[0.06] border-white/10 text-neutral-200 hover:bg-white/[0.12]'
              : 'bg-black/[0.04] border-black/[0.07] text-neutral-700 hover:bg-black/[0.08]'
          }`}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
