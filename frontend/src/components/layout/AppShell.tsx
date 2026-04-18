import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

type AppShellProps = {
  children: React.ReactNode;
};

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewportState = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(mobile ? false : true);
      setSidebarCollapsed(false);
    };

    updateViewportState();
    window.addEventListener('resize', updateViewportState);

    return () => window.removeEventListener('resize', updateViewportState);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen((current) => !current);
      return;
    }

    setSidebarCollapsed((current) => !current);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarCollapsed(true);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-start bg-transparent">
      {isMobile && sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {isMobile ? (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-60 transform border-r border-white/10 bg-slate-950/95 shadow-soft transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar isMobile onClose={closeSidebar} />
        </aside>
      ) : (
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-slate-950/95 shadow-soft transition-[width] duration-300 ease-in-out lg:block ${
            sidebarCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onClose={closeSidebar}
          />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuToggle={toggleSidebar} isMobile={isMobile} isSidebarCollapsed={sidebarCollapsed} />
        <main className="flex-1 min-w-0 py-4 sm:py-6 lg:py-8">
          <div className="page-container">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;