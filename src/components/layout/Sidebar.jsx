import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ChevronRight, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import logoFull from '@/assets/emqube-logo.svg';
import logoMark from '@/assets/emqube-mark.svg';
import { MenuIcon } from './icons';
import { SideHills, SidebarFooter } from './SidebarFooter';

const isUnder = (pathname, url) => pathname === url || pathname.startsWith(`${url}/`);
// screens shown as a tab of another screen (hidden from the menu): highlight that screen instead
const TAB_OF = { '/task-135': '/tasks' };
const menuPath = (pathname) => TAB_OF[pathname] ?? pathname;

/** A module with a single screen is a plain menu item, not a submenu. */
function NavSingle({ module, active }) {
  return (
    <div className={`nav-group${active ? ' is-active' : ''}`}>
      <Link className="nav-module" to={module.children[0].url} title={module.name} style={{ textDecoration: 'none' }}>
        <span className="nav-ico">
          <MenuIcon name={module.icon} />
        </span>
        <span className="nav-label">{module.name}</span>
      </Link>
    </div>
  );
}

function NavModule({ module, active, open, onToggle, collapsed, onExpand, here }) {
  return (
    <div className={`nav-group${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="nav-module"
        title={module.name}
        aria-expanded={open}
        onClick={() => {
          if (collapsed) onExpand();
          onToggle();
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
          <NavLink key={item.id} to={item.url} className={({ isActive }) => `nav-link${isActive || here === item.url ? ' is-active' : ''}`}>
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
  // accordion: one module open at a time – the current page's module, or the one clicked.
  // A click is remembered for the current page only, so navigating opens the new page's module.
  const activeId = session.menus.find((m) => m.children.some((c) => isUnder(menuPath(pathname), c.url)))?.id ?? null;
  const [clicked, setClicked] = useState({ path: pathname, id: activeId });
  const openId = clicked.path === pathname ? clicked.id : activeId;

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
          {session.menus.map((m) =>
            // a module with one screen is a plain menu item, otherwise a submenu
            m.children.length === 1 ? (
              <NavSingle key={m.id} module={m} active={m.id === activeId} />
            ) : (
              <NavModule
                key={m.id}
                module={m}
                active={m.id === activeId}
                open={m.id === openId}
                onToggle={() => setClicked({ path: pathname, id: openId === m.id ? null : m.id })}
                collapsed={collapsed}
                onExpand={onToggle}
                here={menuPath(pathname)}
              />
            ),
          )}
        </nav>

        <SideHills />
        <SidebarFooter />
      </div>
    </aside>
  );
}
