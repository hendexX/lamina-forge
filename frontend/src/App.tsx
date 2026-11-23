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
      className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-200 ${
        isDark
          ? 'bg-gradient-to-b from-[#111113] to-[#1C1C1E] text-neutral-100'
          : 'bg-gradient-to-b from-[#F5F5F7] to-[#E8E8ED] text-neutral-900'
      }`}
    >
      <div className="px-3 pt-3 shrink-0 z-20">
        <TopBar />
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden p-3 gap-3">
        <CreationDock />
        <Viewport3D />
        <AssetDrawer />
      </div>

      <SettingsModal />

      {/* Apple-style Frosted Glass Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-xs font-medium backdrop-blur-2xl transition-all duration-200 ${
            isDark
              ? 'bg-neutral-900/80 border-white/15 text-neutral-100'
              : 'bg-white/85 border-white/60 text-neutral-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : toast.type === 'error' ? (
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#0A84FF] shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};

export default App;
