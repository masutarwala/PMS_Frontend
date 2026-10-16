import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ChevronRight, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import logoFull from '@/assets/emqube-logo.svg';
import logoMark from '@/assets/emqube-mark.svg';
import { MenuIcon } from './icons';
import { SideHills, SidebarFooter } from './SidebarFooter';

const isUnder = (pathname, url) => pathname === url || pathname.startsWith(`${url}/`);

function NavModule({ module, collapsed, onExpand }) {
  const { pathname } = useLocation();
  const active = module.children.some((c) => isUnder(pathname, c.url));
  const [open, setOpen] = useState(active);

  return (
    <div className={`nav-group${active ? ' is-active' : ''}${open || active ? ' is-open' : ''}`}>
      <button
        type="button"
        className="nav-module"
        title={module.name}
        onClick={() => {
          if (collapsed) onExpand();
          setOpen((o) => !o);
        }}
      >
        <span className="nav-ico">
          <MenuIcon name={module.icon} />
        </span>
        <span className="nav-label">{module.name}</span>
        <span className="chev">
          <ChevronRight />
        </span>
      </button>
      <div className="nav-items">
        {module.children.map((item) => (
          <NavLink key={item.id} to={item.url} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
            <span className="nav-label">{item.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

/** Left menu built from the server: only modules / screens the role can view. */
export function Sidebar({ collapsed, onToggle }) {
  const { session } = useAuth();
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="brand">
          <Link className="brand-link" to="/">
            <img className="brand-logo-full" src={logoFull} alt="emQube – Powered by Thought" />
            <img className="brand-logo-mark" src={logoMark} alt="emQube" />
          </Link>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>

        <nav className="nav">
          <div className={`nav-group${pathname === '/' ? ' is-active' : ''}`}>
            <Link className="nav-module" to="/" style={{ textDecoration: 'none' }}>
              <span className="nav-ico">
                <LayoutDashboard />
              </span>
              <span className="nav-label">Overview</span>
            </Link>
          </div>
          {session.menus.map((m) => (
            <NavModule key={m.id} module={m} collapsed={collapsed} onExpand={onToggle} />
          ))}
        </nav>

        <SideHills />
        <SidebarFooter />
      </div>
    </aside>
  );
}
