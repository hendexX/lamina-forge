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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-[#0F172A] border-slate-700/80 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div>
            <h2 className="text-sm font-semibold">Inference Backend & API Keys</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Connect to Google Colab (Cloudflare Tunnel), Cloud Run L4, or fal.ai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveAndTest} className="p-5 space-y-4">
          {/* Provider Switcher */}
          <div>
            <label className="block text-xs font-medium mb-2 opacity-80">Inference Provider</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraftProvider('custom')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  draftProvider === 'custom'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : isDark
                      ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
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
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  draftProvider === 'fal'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : isDark
                      ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
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
                Backend Endpoint URL (Colab Tunnel, Cloud Run, or Localhost)
              </label>
              <input
                type="url"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com"
                className={`w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setDraftUrl('http://localhost:8000')}
                  className={`text-[11px] px-2 py-0.5 rounded border ${
                    isDark
                      ? 'border-slate-700 text-slate-400 hover:text-slate-200'
                      : 'border-slate-200 text-slate-600 hover:text-slate-900'
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
                <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-50" />
                <input
                  type="password"
                  value={draftFalKey}
                  onChange={(e) => setDraftFalKey(e.target.value)}
                  placeholder="fal_key_..."
                  className={`w-full pl-8 pr-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Optional Gemini / Imagen API Key */}
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80">
              Gemini / Imagen API Key{' '}
              <span className="opacity-60 font-normal">(Optional — for Text-to-3D reference image)</span>
            </label>
            <input
              type="password"
              value={draftGeminiKey}
              onChange={(e) => setDraftGeminiKey(e.target.value)}
              placeholder="AIza..."
              className={`w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* Live Status Banner */}
          <div
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
              connectionStatus === 'connected'
                ? isDark
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : isDark
                  ? 'bg-slate-900/70 border-slate-800 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
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
            <span className="font-mono text-[11px] opacity-75">localStorage</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors disabled:opacity-60"
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
