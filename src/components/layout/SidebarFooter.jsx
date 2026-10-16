import { Link, useNavigate } from 'react-router';
import { ArrowRight, Bell, BellOff, ChevronsUpDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { ActionMenu } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Display';
import { SCREENS } from '@/lib/constants';

/** Decorative hills along the bottom of the menu (sits behind the footer) – from the design's app.js. */
export function SideHills() {
  return (
    <div className="side-hills">
      <svg viewBox="0 0 260 105" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hlBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F7FCFA" stopOpacity="0" />
            <stop offset=".45" stopColor="#F7FCFA" />
            <stop offset="1" stopColor="#F9FDFB" />
          </linearGradient>
          <linearGradient id="hlMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CDEFE1" />
            <stop offset="1" stopColor="#DCF3E9" />
          </linearGradient>
          <linearGradient id="hlLow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#B8E5D3" />
            <stop offset="1" stopColor="#D0EEE1" />
          </linearGradient>
          <linearGradient id="hlFront" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#B2E3D0" />
            <stop offset="1" stopColor="#8ED2B8" />
          </linearGradient>
        </defs>
        <rect width="260" height="105" fill="url(#hlBg)" />
        <path d="M30 26C55 30 90 45 127 65C150 77 175 77 196 71C221 63 240 53 260 51V105H30z" fill="url(#hlMid)" />
        <path d="M78 70C104 79 136 83 166 80C200 77 230 63 260 51V105H78z" fill="url(#hlLow)" />
        <path d="M0 10C20 13 37 23 57 43C77 63 100 88 128 105H0z" fill="url(#hlFront)" />
      </svg>
    </div>
  );
}

/** "Small plans, big results" card (hidden by theme.css on short screens and when collapsed). */
function SidePromo() {
  return (
    <div className="side-promo">
      <svg className="sp-art" viewBox="0 0 140 112" aria-hidden="true">
        <defs>
          <linearGradient id="spLeafA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6FCF8E" />
            <stop offset="1" stopColor="#1E8A4C" />
          </linearGradient>
          <linearGradient id="spLeafB" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9BE3A9" />
            <stop offset="1" stopColor="#2E9E5B" />
          </linearGradient>
          <linearGradient id="spLeafC" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#B7EDC1" />
            <stop offset="1" stopColor="#4DB873" />
          </linearGradient>
        </defs>
        <ellipse cx="56" cy="104" rx="30" ry="5" fill="#1E6B3E" opacity=".12" />
        <path d="M56 104C56 86 56 72 55 58" stroke="#2E8B57" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d="M55 64C36 66 20 52 18 30c22-2 38 12 37 34z" fill="url(#spLeafA)" />
        <path d="M55 64C40 56 30 44 26 34" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.4" fill="none" />
        <path d="M56 74c2-24 20-38 44-36-2 24-20 38-44 36z" fill="url(#spLeafB)" />
        <path d="M57 72c10-12 22-22 38-30" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.4" fill="none" />
        <path d="M55 50C48 38 50 22 60 12c8 12 6 28-5 38z" fill="url(#spLeafC)" />
        <path d="M112 54c4-8 12-12 20-10-3 8-11 12-20 10z" fill="url(#spLeafB)" opacity=".85" />
        <circle cx="104" cy="20" r="3" fill="#C5F06B" />
        <circle cx="124" cy="34" r="2" fill="#86EFAC" />
      </svg>
      <b>
        Small plans,
        <br />
        big results
      </b>
      <span>Plan. Track. Deliver.</span>
      {/* TODO: point to the Daily Planner once that module is built */}
      <Link className="btn sp-btn" to="/projects">
        Plan my day
        <ArrowRight />
      </Link>
    </div>
  );
}

/** Promo card + profile menu + notifications, as in the design. */
export function SidebarFooter() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="side-foot">
      <SidePromo />
      <div className="side-user">
        <ActionMenu
          alignRight={false}
          minWidth={220}
          trigger={({ toggle }) => (
            <button type="button" className="dropdown-toggle su-profile" title={`${user.name} – ${user.role.name}`} onClick={toggle}>
              <Avatar name={user.name} size="md" />
              <span className="su-who">
                <b>{user.name}</b>
                <span>{user.role.name}</span>
              </span>
              <span className="su-caret">
                <ChevronsUpDown />
              </span>
            </button>
          )}
          header={
            <>
              <div className="dropdown-option" style={{ cursor: 'default', background: 'none' }}>
                <Avatar name={user.name} />
                <span>
                  <b style={{ display: 'block', fontSize: 13 }}>{user.name}</b>
                  <span className="muted small">{user.email || user.username}</span>
                </span>
              </div>
              <div className="dropdown-divider" />
            </>
          }
          items={[
            {
              label: 'My profile',
              icon: UserRound,
              hidden: !can(SCREENS.USERS, 'edit'),
              onClick: () => navigate(`/administration/users/${user.id}/edit`),
            },
            { label: 'Change password', icon: KeyRound, onClick: () => navigate('/account/change-password') },
            { divider: true },
            { label: 'Log out', icon: LogOut, danger: true, onClick: () => logout().then(() => navigate('/login')) },
          ]}
        />
        <ActionMenu
          alignRight={false}
          minWidth={300}
          trigger={({ toggle }) => (
            <button type="button" className="dropdown-toggle su-bell" title="Notifications" aria-label="Notifications" onClick={toggle}>
              <Bell />
            </button>
          )}
          header={
            <>
              <div className="row between" style={{ padding: '6px 10px 8px' }}>
                <b style={{ fontSize: 13.5 }}>Notifications</b>
              </div>
              {/* Notifications arrive with the tasks / planner modules */}
              <div className="dropdown-empty">
                <BellOff style={{ width: 18, height: 18, display: 'block', margin: '0 auto 6px' }} />
                You&apos;re all caught up
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}
