import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { trackNavigation } from '@/hooks/useSessionState';
import { Spinner } from '@/components/ui/Loader';
import { Sidebar } from './Sidebar';

const STORAGE_KEY = 'pms.sidebar';
const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
};

/** Sidebar + main area. Each page renders its own <Topbar> and content. */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // lists restore their filters only when coming back from one of their records
  trackNavigation(useLocation().pathname);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? 'open' : 'collapsed');
      } catch {
        /* storage unavailable – keep in memory only */
      }
      return !c;
    });

  return (
    <div className={`app${collapsed ? ' is-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="main">
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
