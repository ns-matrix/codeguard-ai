import { ReactNode, useEffect, useState } from 'react';
import { useValidationStore } from '../../stores/validationStore';
import { usePrefsStore } from '../../stores/prefsStore';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import MobileNav from './MobileNav';
import Drawer from './Drawer';
import Toaster from '../ui/Toaster';

export default function AppShell({ children }: { children: ReactNode }) {
  const { loadModels, loadConfig } = useValidationStore();
  const { sidebarCollapsed } = usePrefsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadModels();
    loadConfig();
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-dark-950 text-ink">
      <div className="hidden lg:flex shrink-0">
        <Sidebar showCollapseToggle />
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Navigation">
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader onMenuOpen={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 lg:pb-0">{children}</main>
      </div>

      <MobileNav />
      <Toaster />
    </div>
  );
}
