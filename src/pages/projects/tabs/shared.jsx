import { Calculator, CalendarRange, ChartColumn, FileText, Flag, FolderKanban, History, RefreshCw, Users, Wallet } from 'lucide-react';
import { useAuth, useProjectAccess } from '@/auth/auth-context';
import { Avatar, StageBadge } from '@/components/ui/Display';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';

/*
 * Pieces shared by the project details page (read-only tabs) and the edit page (editable tabs),
 * following Screens/projects/project-list/details.html and edit.html.
 */

export const TABS = [
  { key: 'update', label: 'Update', icon: RefreshCw },
  { key: 'project', label: 'Project', icon: FileText },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'estimate', label: 'Estimate', icon: Calculator },
  { key: 'plan', label: 'Plan', icon: CalendarRange, ownerOnly: true }, // weekly plan by task group – the project owner only
  { key: 'commercial', label: 'Commercial', icon: Wallet, commercial: true }, // only when the API allows it (role's project access)
  { key: 'analysis', label: 'Analysis', icon: ChartColumn },
  { key: 'history', label: 'History', icon: History },
];

/** Tab from the URL hash (#users …), else the fallback. */
export const tabFromHash = (fallback) => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.key === h) ? h : fallback;
};


/** a as a % of b, with up to 2 decimals (not rounded to a whole number). */
export const pct = (a, b) => (b ? Math.round((a / b) * 10000) / 100 : 0);
const dueLabel = (d) => (d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(`${d}T00:00:00`)) : '—');
const shortDate = (d) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(`${d}T00:00:00`));

/** Tabs the user may see: none hidden for their role, Commercial only when the API allows it (p.canSeeCommercial), Plan only for the owner (and not hidden for the role). */
export const visibleTabs = (p, tabAccess = () => 'edit', userId = null) =>
  TABS.filter((t) => (!t.ownerOnly || p?.ownerId === userId) && tabAccess(t.key) !== 'hidden' && (!t.commercial || p?.canSeeCommercial));

/** The tab to show: the asked one, or the first one the user may see. */
export const usableTab = (tab, p, tabAccess, userId) => {
  const tabs = visibleTabs(p, tabAccess, userId);
  return tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? tab);
};

export function TabBar({ tab, onSelect, p }) {
  const access = useProjectAccess();
  const { user } = useAuth();
  return (
    <div className="tabs" role="tablist" style={{ marginTop: 20 }}>
      {visibleTabs(p, access.tab, user.id).map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' is-active' : ''}`} onClick={() => onSelect(t.key)}>
          <span className="tab-ico">
            <t.icon />
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Green project header. `edit` mode is the compact one of the edit page (no metrics). */
export function ProjectHero({ p, edit = false, actions }) {
  const consumed = pct(p.loggedHours, p.estimatedHours);
  return (
    <div className="detail-hero" style={edit ? { padding: '20px 24px' } : undefined}>
      <span className="deco d1" />
      {!edit && <span className="deco d2" />}
      <div className="hero-top">
        <div className="hero-id">
          <span className="lead">
            <FolderKanban />
          </span>
          <div>
            <div className="hero-kicker">
              {edit ? 'Edit project' : 'Project'} · {p.code}
            </div>
            <h2 className="hero-name">{p.title}</h2>
            <div className="hero-tags">
              {p.customerName && <span>{p.customerName}</span>}
              <span>{p.divisionName}</span>
              <span>{p.typeName}</span>
              {p.isRetainerProject && <span>Retainer</span>}
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <StageBadge name={p.stageName} status={p.status} />
          {actions}
        </div>
      </div>
      {!edit && (
        <div className="hero-metrics">
          <div className="hm hi">
            <b>
              {p.estimatedHours != null ? formatNumber(p.estimatedHours) : '—'}
              <small>hrs</small>
            </b>
            <span>Estimated</span>
          </div>
          <div className="hm">
            <b>
              {formatNumber(p.loggedHours)}
              <small>hrs</small>
            </b>
            <span>Logged</span>
          </div>
          <div className="hm">
            <b>
              {p.estimatedHours ? consumed : '—'}
              <small>%</small>
            </b>
            <span>Consumed</span>
          </div>
          <div className="hm">
            <b>{dueLabel(p.endDate)}</b>
            <span>Due</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const ColorDot = ({ i }) => <i className={`c${(i % 8) + 1}`} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, flex: 'none' }} />;

/** Coloured effort split bar (+ legend). */
export function EffortSplit({ estimates, legend = true }) {
  if (!estimates.length) return <p className="muted small">No effort split yet.</p>;
  return (
    <>
      <div className="alloc-bar">
        {estimates.map((e, i) => (
          <span key={e.taskGroupId} className={`c${(i % 8) + 1}`} style={{ width: `${e.effortPercentage}%` }} />
        ))}
      </div>
      {legend && (
        <div className="alloc-legend" style={{ marginTop: 12 }}>
          {estimates.map((e, i) => (
            <span key={e.taskGroupId}>
              <i className={`c${(i % 8) + 1}`} />
              {e.taskGroupName} {e.effortPercentage}%
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function GradeTag({ grade, team }) {
  if (!grade) return <span className="muted small">—</span>;
  return (
    <span className="grade-tag" title={team ?? undefined}>
      <b>{grade}</b>
      {team}
    </span>
  );
}

export function MemberCell({ name, sub }) {
  return (
    <div className="cell-user">
      <Avatar name={name} />
      <div>
        <b>{name}</b>
        {sub && <span className="pos-sub">{sub}</span>}
      </div>
    </div>
  );
}

/**
 * % completed per task group across reviews, newest first.
 * `entry` adds an input column in front for a new review: { head, cell(taskGroupId), total }.
 */
export function ReviewGrid({ reviews, estimates, entry }) {
  // the highlighted column is the one being entered, else the latest review
  const hi = (i) => (!entry && i === 0 ? ' is-latest' : '');
  const valueOf = (r, groupId) => r.groups.find((g) => g.taskGroupId === groupId)?.completionPercentage ?? 0;
  const cell = (r, i, value) => {
    return (
      <td key={r.id} className={`center${hi(i)}`}>
        <div className={`rv-cell${value >= 100 ? ' is-done' : ''}${value === 0 ? ' is-zero' : ''}`}>
          <b>{formatNumber(value)}%</b>
        </div>
        <div className="rv-bar">
          <span style={{ width: `${Math.min(100, value)}%` }} />
        </div>
      </td>
    );
  };
  return (
    <div className="editor">
      <div className="table-wrap" style={{ borderTop: 0 }}>
        <table className="data-table review-grid">
          <thead>
            <tr>
              <th className="rv-sticky">Task group</th>
              {entry && <th className="center is-latest rv-entry">{entry.head}</th>}
              {reviews.map((r, i) => (
                <th key={r.id} className={`center${hi(i)}`}>
                  <div>{shortDate(r.reviewDate)}</div>
                  {r.stage && <span className="rv-stage">{r.stage}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estimates.map((e) => (
              <tr key={e.taskGroupId}>
                <td className="rv-sticky">
                  <b>{e.taskGroupName}</b>
                  <span>{e.effortPercentage}% of effort</span>
                </td>
                {entry && <td className="center is-latest rv-entry">{entry.cell(e.taskGroupId)}</td>}
                {reviews.map((r, i) => cell(r, i, valueOf(r, e.taskGroupId)))}
              </tr>
            ))}
            <tr className="rv-total">
              <td className="rv-sticky">
                <b>Overall</b>
                <span>weighted by effort</span>
              </td>
              {entry && <td className="center is-latest rv-entry">{entry.total}</td>}
              {reviews.map((r, i) => (
                <td key={r.id} className={`center${hi(i)}`}>
                  <b>{r.overall}%</b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Comments and system logs (stage changes): who, when and the text, latest first. */
export function CommentsLog({ reviews }) {
  if (!reviews.length) return <p className="muted small">No comments yet.</p>;
  return (
    <ol className="cmt-log">
      {reviews.map((r) => {
        const who = r.reviewerName ?? 'System';
        return (
          <li key={r.id} className={`cmt-item${r.isSystem ? ' is-system' : ''}`}>
            {r.isSystem ? (
              <span className="cmt-sys-ico" title="Logged by the system">
                <Flag />
              </span>
            ) : (
              <Avatar name={who} />
            )}
            <div className="cmt-body">
              <div className="cmt-who">
                <span>{r.isSystem ? `System · by ${who}` : who}</span>
                <time dateTime={r.createdAt}>{formatDateTime(r.createdAt)}</time>
              </div>
              <p className="cmt-text">{r.comment}</p>
              {r.isSystem && r.reviewDate && <span className="cmt-meta">Stage date {formatDate(r.reviewDate)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
