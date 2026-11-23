import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, KeyRound, Loader2, Server, X, XCircle } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { BackendProvider } from '../types/studio';

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen,
    setSettingsOpen,
    provider,
    apiUrl,
    falApiKey,
    geminiApiKey,
    connectionStatus,
    gpuLabel,
    mockMode,
    updateSettings,
    theme,
  } = useStudioStore();

  const [draftProvider, setDraftProvider] = useState<BackendProvider>(provider);
  const [draftUrl, setDraftUrl] = useState(apiUrl);
  const [draftFalKey, setDraftFalKey] = useState(falApiKey);
  const [draftGeminiKey, setDraftGeminiKey] = useState(geminiApiKey);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setDraftProvider(provider);
      setDraftUrl(apiUrl);
      setDraftFalKey(falApiKey);
      setDraftGeminiKey(geminiApiKey);
    }
  }, [settingsOpen, provider, apiUrl, falApiKey, geminiApiKey]);

  if (!settingsOpen) return null;

  const isDark = theme === 'dark';

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    await updateSettings({
      provider: draftProvider,
      apiUrl: draftUrl.trim(),
      falApiKey: draftFalKey.trim(),
      geminiApiKey: draftGeminiKey.trim(),
    });
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4">
      <div
        className={`w-full max-w-lg rounded-3xl border backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.28)] overflow-hidden transition-all duration-200 ${
          isDark
            ? 'bg-neutral-900/85 border-white/15 text-neutral-100'
            : 'bg-white/88 border-white/60 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-white/10' : 'border-black/[0.06]'
          }`}
        >
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em]">
              Inference Backend & API Keys
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Connect to Google Colab (Cloudflare Tunnel), Cloud Run L4, or fal.ai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className={`p-1.5 rounded-full transition-colors ${
              isDark ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/[0.06] text-neutral-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveAndTest} className="p-6 space-y-4">
          {/* Provider Switcher */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-2 opacity-60">
              Inference Provider
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDraftProvider('custom')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all duration-200 ${
                  draftProvider === 'custom'
                    ? isDark
                      ? 'border-[#0A84FF] bg-[#0A84FF]/15 text-[#0A84FF]'
                      : 'border-[#0071E3] bg-[#0071E3]/10 text-[#0071E3]'
                    : isDark
                      ? 'border-white/10 bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
                      : 'border-black/[0.07] bg-black/[0.03] text-neutral-600 hover:bg-black/[0.06]'
                }`}
              >
                <Server className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Colab / Cloud Run</div>
                  <div className="text-[11px] opacity-75">FastAPI TRELLIS.2-4B</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDraftProvider('fal')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all duration-200 ${
                  draftProvider === 'fal'
                    ? isDark
                      ? 'border-[#0A84FF] bg-[#0A84FF]/15 text-[#0A84FF]'
                      : 'border-[#0071E3] bg-[#0071E3]/10 text-[#0071E3]'
                    : isDark
                      ? 'border-white/10 bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
                      : 'border-black/[0.07] bg-black/[0.03] text-neutral-600 hover:bg-black/[0.06]'
                }`}
              >
                <Cloud className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">fal.ai Serverless</div>
                  <div className="text-[11px] opacity-75">Pay-per-generation</div>
                </div>
              </button>
            </div>
          </div>

          {draftProvider === 'custom' ? (
            <div>
              <label className="block text-xs font-medium mb-1.5 opacity-80">
                Backend Endpoint URL
              </label>
              <input
                type="url"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-white/[0.06] border-white/10 text-neutral-100 placeholder:text-neutral-500 focus:ring-[#0A84FF]/40'
                    : 'bg-white/80 border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:ring-[#0071E3]/30'
                }`}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setDraftUrl('http://localhost:8000')}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    isDark
                      ? 'border-white/10 text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.06]'
                      : 'border-black/10 text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.04]'
                  }`}
                >
                  Use Localhost (:8000)
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium mb-1.5 opacity-80">fal.ai API Key</label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 absolute left-3.5 top-3 opacity-50" />
                <input
                  type="password"
                  value={draftFalKey}
                  onChange={(e) => setDraftFalKey(e.target.value)}
                  placeholder="fal_key_..."
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-white/[0.06] border-white/10 text-neutral-100 placeholder:text-neutral-500 focus:ring-[#0A84FF]/40'
                      : 'bg-white/80 border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:ring-[#0071E3]/30'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Optional Gemini API Key */}
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80">
              Gemini API Key{' '}
              <span className="opacity-55 font-normal">(Optional — for Text-to-3D reference image)</span>
            </label>
            <input
              type="password"
              value={draftGeminiKey}
              onChange={(e) => setDraftGeminiKey(e.target.value)}
              placeholder="AIza..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/[0.06] border-white/10 text-neutral-100 placeholder:text-neutral-500 focus:ring-[#0A84FF]/40'
                  : 'bg-white/80 border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:ring-[#0071E3]/30'
              }`}
            />
          </div>

          {/* Live Status Banner */}
          <div
            className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs ${
              connectionStatus === 'connected'
                ? isDark
                  ? 'bg-emerald-500/12 border-emerald-400/25 text-emerald-300'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700'
                : isDark
                  ? 'bg-white/[0.04] border-white/10 text-neutral-400'
                  : 'bg-black/[0.03] border-black/[0.07] text-neutral-600'
            }`}
          >
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500" />
              )}
              <span>
                {connectionStatus === 'connected'
                  ? `Online — ${mockMode ? 'Mock Studio Engine' : gpuLabel}`
                  : 'Backend currently unreachable'}
              </span>
            </div>
            <span className="text-[11px] opacity-65">Saved locally</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                isDark ? 'text-neutral-300 hover:bg-white/10' : 'text-neutral-600 hover:bg-black/[0.06]'
              }`}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={testing}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white transition-all disabled:opacity-60 ${
                isDark ? 'bg-[#0A84FF] hover:bg-[#1E90FF]' : 'bg-[#0071E3] hover:bg-[#0077ED]'
              }`}
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save & Test Connection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
