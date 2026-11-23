import React, { useEffect } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { CreationDock } from './components/CreationDock';
import { Viewport3D } from './components/Viewport3D';
import { AssetDrawer } from './components/AssetDrawer';
import { SettingsModal } from './components/SettingsModal';
import { useStudioStore } from './store/useStudioStore';

export const App: React.FC = () => {
  const init = useStudioStore((s) => s.init);
  const toast = useStudioStore((s) => s.toast);
  const theme = useStudioStore((s) => s.theme);

  useEffect(() => {
    init();
  }, [init]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        isDark ? 'bg-[#0F172A] text-slate-100' : 'bg-[#F6F7F9] text-slate-900'
      }`}
    >
      <TopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <CreationDock />
        <Viewport3D />
        <AssetDrawer />
      </div>

      <SettingsModal />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-20 right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border shadow-xl text-xs font-medium backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};

export default App;
