import { initials } from '@/lib/format';
import { PROJECT_STATUS } from '@/lib/constants';

export function Avatar({ name, size = 'sm' }) {
  return (
    <span className={`avatar${size === 'sm' ? ' avatar-sm' : size === 'lg' ? ' avatar-lg' : ''}`} title={name}>
      {initials(name)}
    </span>
  );
}

export function UserCell({ name, sub, to, LinkComponent }) {
  if (!name) return <span className="muted small">—</span>;
  return (
    <div className="cell-user">
      <Avatar name={name} />
      <div>
        {to && LinkComponent ? (
          <LinkComponent to={to} style={{ color: 'var(--ink)' }}>
            <b>{name}</b>
          </LinkComponent>
        ) : (
          <b>{name}</b>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function Badge({ tone, children }) {
  return <span className={`badge${tone ? ` badge-${tone}` : ''}`}>{children}</span>;
}

export const ActiveBadge = ({ active }) => (
  <Badge tone={active ? 'success' : undefined}>{active ? 'Active' : 'Inactive'}</Badge>
);

/** Project stage name, coloured by the status category the stage counts as. */
export function StageBadge({ name, status }) {
  const s = PROJECT_STATUS[status] ?? { label: status, badge: '' };
  return <span className={`badge ${s.badge}`}>{name ?? s.label}</span>;
}

export function Progress({ value }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="progress grow">
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="small num">{value}%</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="ico">
          <Icon />
        </div>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function ErrorAlert({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>
      {children}
    </div>
  );
}
