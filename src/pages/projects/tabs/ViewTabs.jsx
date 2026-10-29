import { useState } from 'react';
import { Link } from 'react-router';
import { usePermissions, useProjectAccess } from '@/auth/auth-context';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, Clock3, ExternalLink, ListChecks, Target, Users } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { Avatar, EmptyState } from '@/components/ui/Display';
import { Spinner } from '@/components/ui/Loader';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { SCREENS } from '@/lib/constants';
import { PriorityBadge, StatusBadge, SubtaskCount, TaskPeople, TaskTimeline } from '@/pages/tasks/TaskListPage';
import { stageChange } from '../stageChange';
import { ColorDot, CommentsLog, EffortSplit, MemberCell } from './shared';

// One Edit button only: the header's Edit opens the edit page on the tab being viewed (no Edit per card).

function CardHead({ title, sub, children }) {
  return (
    <div className="card-head">
      <div>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Project */

export function ProjectView({ p }) {
  const others = p.members.filter((m) => !m.isOwner);
  const { field } = useProjectAccess();
  const shown = (key) => field(key) !== 'hidden'; // Roles & Permissions → Project access
  return (
    <div className="detail-layout" style={{ marginTop: 0 }}>
      <div>
        <div className="card card-flush" style={{ marginTop: 16 }}>
          <CardHead title="Project details" />
          <div style={{ padding: '16px 20px 20px' }}>
            <dl className="kv">
              {shown('customerId') && (
                <>
                  <dt>Customer</dt>
                  <dd>{p.customerName ?? '—'}</dd>
                </>
              )}
              <dt>Project owner</dt>
              <dd>
                <span className="row" style={{ gap: 8 }}>
                  <Avatar name={p.ownerName} />
                  {p.ownerName}
                </span>
              </dd>
              <dt>Project title</dt>
              <dd>{p.title}</dd>
              <dt>Project division</dt>
              <dd>{p.divisionName}</dd>
              <dt>Project type</dt>
              <dd>{p.typeName}</dd>
              <dt>Start date</dt>
              <dd>{formatDate(p.startDate)}</dd>
              {shown('endDate') && (
                <>
                  <dt>End date</dt>
                  <dd>{formatDate(p.endDate)}</dd>
                </>
              )}
              {shown('estimatedAmount') && (
                <>
                  <dt>Total amount</dt>
                  <dd>{p.estimatedAmount != null ? formatMoney(p.estimatedAmount, p.estimatedAmountCurrency || 'INR') : '—'}</dd>
                </>
              )}
              {shown('sharepointLink') && <dt>SharePoint link</dt>}
              {shown('sharepointLink') && (
              <dd>
                {p.sharepointLink ? (
                  <a href={p.sharepointLink} target="_blank" rel="noreferrer">
                    <ExternalLink style={{ width: 14, height: 14 }} /> Open link
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              )}
              {shown('isRetainerProject') && <dt>Retainer project</dt>}
              {shown('isRetainerProject') && (
              <dd>
                <span className="row" style={{ gap: 6 }}>
                  {p.isRetainerProject ? <CircleCheck className="yes-ico" /> : <CircleX className="muted" />}
                  {p.isRetainerProject ? 'Yes' : 'No'}
                </span>
              </dd>
              )}
              {shown('isBillable') && <dt>Billable project</dt>}
              {shown('isBillable') && (
              <dd>
                <span className="row" style={{ gap: 6 }}>
                  {p.isBillable ? <CircleCheck className="yes-ico" /> : <CircleX className="muted" />}
                  {p.isBillable ? 'Yes' : 'No'}
                </span>
              </dd>
              )}
              {shown('detail') && (
                <>
                  <dt>Project details</dt>
                  <dd>
                    <span style={{ fontWeight: 500, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{p.detail || '—'}</span>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="card side-card">
          <h4 className="section-title">Effort split</h4>
          <EffortSplit estimates={p.estimates} />
        </div>
        <div className="card side-card">
          <h4 className="section-title">Owner &amp; team</h4>
          <div className="col" style={{ gap: 12 }}>
            <div className="row">
              <Avatar name={p.ownerName} size="md" />
              <div>
                <b>{p.ownerName}</b>
                <div className="muted small">Project owner</div>
              </div>
            </div>
            {others.length > 0 && (
              <div className="avatar-group">
                {others.slice(0, 6).map((m) => (
                  <Avatar key={m.id} name={m.name} />
                ))}
              </div>
            )}
            <div className="muted small">
              {p.members.length} member{p.members.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="card side-card">
          <h4 className="section-title">Record</h4>
          <div className="col" style={{ gap: 14 }}>
            <div>
              <div className="muted small">Created</div>
              <div className="row" style={{ gap: 8, marginTop: 4, fontWeight: 600 }}>
                {p.createdByName && <Avatar name={p.createdByName} />} {p.createdByName ?? 'System'} · {formatDate(p.createdAt)}
              </div>
            </div>
            <div>
              <div className="muted small">Last updated</div>
              <div className="row" style={{ gap: 8, marginTop: 4, fontWeight: 600 }}>
                {p.updatedByName && <Avatar name={p.updatedByName} />} {p.updatedByName ?? 'System'} · {formatDateTime(p.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Users */

export const memberSub = (m) => m.position ?? (m.isOwner ? 'Project owner' : m.teamName);

export function UsersView({ p }) {
  return (
    <div className="card card-flush" style={{ marginTop: 16 }}>
      <CardHead
        title="Project members"
        sub={`${p.members.length} ${p.members.length === 1 ? 'person' : 'people'} on this project.`}
      />
      <div style={{ padding: '16px 20px 20px' }}>
        {p.members.length ? (
          <div className="editor">
            <div className="table-wrap" style={{ borderTop: 0 }}>
              <table className="data-table members-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="right">Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {p.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <MemberCell name={m.name} sub={memberSub(m)} />
                      </td>
                      <td className="num right">{formatNumber(m.loggedHours)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState icon={Users} title="No members yet" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Estimate */

/** Hours from the quote: total amount ÷ the division's quote rate per hour (2 decimals, as stored). */
export const quotedHours = (amount, rate) => (amount != null && amount !== '' && rate ? Math.round((Number(amount) / rate) * 100) / 100 : null);

/**
 * Total amount, quote rate and estimated hours. The quote (amount ÷ rate) is the default for the hours;
 * the hours themselves can be changed – `hoursInput` is the editable field on the edit page.
 */
export function EstimateTotals({ amount, currency, rate, hours, hoursInput }) {
  const quoted = quotedHours(amount, rate);
  const box = (label, value, sub) => (
    <div className="est-total">
      <span className="muted small">{label}</span>
      <b style={{ fontSize: 16 }}>{value}</b>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
  return (
    <div className="row" style={{ gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {box('Total amount', amount != null && amount !== '' ? formatMoney(Number(amount), currency || 'INR') : 'Not set')}
      {box('Quote rate per hour', rate ? `${formatMoney(rate, currency || 'INR')} / hr` : 'Not set', rate ? 'from the business division' : `no ${currency || ''} rate in the division`)}
      {hoursInput ??
        box(
          'Total estimated hours',
          hours != null ? `${formatNumber(hours)} hrs` : 'Not set',
          hours != null && quoted != null && hours !== quoted ? `set by hand · quote gives ${formatNumber(quoted)} hrs` : quoted != null ? 'total amount ÷ quote rate' : hours != null ? 'entered by hand' : undefined,
        )}
    </div>
  );
}

export function EstimateView({ p, canEdit }) {
  const total = p.estimates.reduce((s, e) => s + e.effortPercentage, 0);
  const full = Math.abs(total - 100) < 0.01;
  return (
    <div className="card card-flush" style={{ marginTop: 16 }}>
      <CardHead title="Estimate" sub="Share of effort per task group; hours are calculated from the total.">
      </CardHead>
      <div className="row between" style={{ padding: '16px 20px 12px' }}>
        <EstimateTotals amount={p.estimatedAmount} currency={p.estimatedAmountCurrency} rate={p.quoteRatePerHour} hours={p.estimatedHours} />
        {p.estimates.length > 0 && <span className={`badge ${full ? 'badge-success' : 'badge-danger'}`}>{formatNumber(total)}% allocated</span>}
      </div>
      {p.estimates.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task group</th>
                <th>% of effort</th>
                <th className="right">Estimated hours</th>
              </tr>
            </thead>
            <tbody>
              {p.estimates.map((e, i) => (
                <tr key={e.taskGroupId}>
                  <td>
                    <span className="row" style={{ gap: 10 }}>
                      <ColorDot i={i} />
                      <b>{e.taskGroupName}</b>
                    </span>
                  </td>
                  <td style={{ minWidth: 260 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="progress grow">
                        <span style={{ width: `${e.effortPercentage}%` }} />
                      </div>
                      <span className="small num" style={{ width: 40 }}>
                        {e.effortPercentage}%
                      </span>
                    </div>
                  </td>
                  <td className="num right">{e.hours != null ? `${formatNumber(e.hours)} hrs` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Target} title="No estimate yet">
          {canEdit ? 'Use Edit (top right) to split the effort across task groups.' : 'The effort split has not been set.'}
        </EmptyState>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Analysis */

export function AnalysisView({ p }) {
  // per task group: planned hours, actual hours (timesheets), used %, reported % (Update tab) and the variance
  const rows = p.estimates.map((e) => {
    const used = e.hours ? Math.round((e.actualHours / e.hours) * 1000) / 10 : null;
    return {
      taskGroupId: e.taskGroupId,
      name: e.taskGroupName,
      planned: e.hours,
      actual: e.actualHours,
      used,
      reported: e.reportedPercentage ?? 0,
      variance: used != null ? Math.round((used - (e.reportedPercentage ?? 0)) * 10) / 10 : null,
    };
  });
  const planned = rows.reduce((x, r) => x + (r.planned ?? 0), 0);
  const actual = rows.reduce((x, r) => x + r.actual, 0);
  // the reported % of the whole project: each group counts by its planned hours (its share of the effort when there are no hours)
  const weight = (e) => (planned ? (e.hours ?? 0) : e.effortPercentage);
  const weights = p.estimates.reduce((x, e) => x + weight(e), 0);
  const reportedAll = weights ? Math.round((p.estimates.reduce((x, e) => x + weight(e) * (e.reportedPercentage ?? 0), 0) / weights) * 10) / 10 : 0;
  const usedAll = planned ? Math.round((actual / planned) * 1000) / 10 : null;
  const totals = { planned, actual: Math.round(actual * 100) / 100, used: usedAll, reported: reportedAll, variance: usedAll != null ? Math.round((usedAll - reportedAll) * 10) / 10 : null };
  return (
    <div>
      {/* planned hours (Estimate), actual hours (timesheets), used %, reported % (Update tab) and the variance */}
      <div className="card card-flush" style={{ marginTop: 16 }}>
        <CardHead title="Analysis" sub="Planned hours come from the estimate, actual hours from the timesheets, reported % from the Update tab." />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task group</th>
                <th className="right">Planned</th>
                <th className="right">Actual</th>
                <th className="right">Used %</th>
                <th className="right">Reported %</th>
                <th className="right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.taskGroupId}>
                  <td>
                    <span className="row" style={{ gap: 8 }}>
                      <ColorDot i={i} />
                      <b>{r.name}</b>
                    </span>
                  </td>
                  <td className="num right">{r.planned != null ? formatNumber(r.planned) : '—'}</td>
                  <td className="num right">{formatNumber(r.actual)}</td>
                  <td className="num right">{r.used != null ? formatNumber(r.used) : '—'}</td>
                  <td className="num right">{formatNumber(r.reported)}</td>
                  <td className="num right">
                    <VarianceCell value={r.variance} />
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)' }}>
                <td>
                  <b>TOTAL</b>
                </td>
                <td className="num right">
                  <b>{totals.planned ? formatNumber(totals.planned) : '—'}</b>
                </td>
                <td className="num right">
                  <b>{formatNumber(totals.actual)}</b>
                </td>
                <td className="num right">
                  <b>{totals.used != null ? formatNumber(totals.used) : '—'}</b>
                </td>
                <td className="num right">
                  <b>{formatNumber(totals.reported)}</b>
                </td>
                <td className="num right">
                  <b>
                    <VarianceCell value={totals.variance} />
                  </b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ margin: '10px 20px 16px' }}>
          Used % = actual ÷ planned hours. Variance = Used % − Reported %: above 0 means more of the hours are used than the progress reported, below 0 means the reported progress is ahead of the hours used.
        </p>
      </div>
    </div>
  );
}

/** Variance: red above 0 (more hours used than progress reported), green below 0. */
function VarianceCell({ value }) {
  if (value == null) return <span className="muted">—</span>;
  const color = value > 0 ? 'var(--danger)' : value < 0 ? 'var(--green-700)' : undefined;
  return <span style={color ? { color } : undefined}>{formatNumber(value)}</span>;
}

/* ------------------------------------------------------------------ History */

const ACTION_TEXT = { create: 'Project created', update: 'Project updated', status_change: 'Stage changed', delete: 'Project deleted' };
const FIELD_LABEL = { members: 'members', estimate: 'estimate' };

/* ------------------------------------------------------------------ Tasks */

/**
 * Tasks tab: the project's tasks, the skills (task roles) each needs and the project members whose
 * role has one of those skills (Roles & Permissions → Skills).
 */
export function TasksView({ id }) {
  const { data, isLoading } = useQuery({ queryKey: ['projects', Number(id), 'tasks'], queryFn: () => projectsApi.tasks(id) });
  const canOpen = usePermissions(SCREENS.TASKS).view; // task names open the task details
  const tasks = data ?? [];
  const done = tasks.filter((t) => t.status === 'completed').length;
  const late = tasks.filter((t) => t.isOverdue).length;
  return (
    <div className="card card-flush" style={{ marginTop: 16 }}>
      <CardHead
        title="Tasks"
        sub={
          tasks.length
            ? `${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${tasks.length - done} open · ${done} completed${late ? ` · ${late} overdue` : ''} · by priority`
            : 'Tasks of this project (from the task template, Task → New task or Add from template).'
        }
      />
      {isLoading ? (
        <div style={{ padding: 20 }}>
          <Spinner />
        </div>
      ) : tasks.length ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Owner → Assigned to</th>
                <th>Priority</th>
                <th>Timeline</th>
                <th className="center">Subtasks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ minWidth: 240, maxWidth: 380 }}>
                    {canOpen ? (
                      // the task page's back button returns to this tab
                      <Link className="cell-title" to={`/tasks/${t.id}`} state={{ from: `/projects/${id}#tasks` }} style={{ color: 'var(--ink)' }}>
                        {t.name}
                      </Link>
                    ) : (
                      <div className="cell-title" style={{ color: 'var(--ink)' }}>
                        {t.name}
                      </div>
                    )}
                    <div className="cell-sub">
                      {[t.taskGroupName, t.taskTypeName].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="nowrap">
                    {t.ownerName || t.assignedToName ? <TaskPeople task={t} /> : <span className="muted small">Not assigned</span>}
                  </td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="nowrap">
                    {t.isContinuous || t.plannedEnd ? <TaskTimeline task={t} /> : <span className="muted small">No dates</span>}
                  </td>
                  <td className="center">
                    <SubtaskCount task={t} />
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={ListChecks} title="No tasks yet">
          Add tasks from Task → New task or Add from template.
        </EmptyState>
      )}
    </div>
  );
}

/** History tab: Comments (all comments and stage logs of the Update tab) and Logs (every change made to the project). */
export function HistoryView({ id, view, onView }) {
  const [own, setOwn] = useState('logs');
  const current = view ?? own;
  const select = onView ?? setOwn;
  const reviews = useQuery({ queryKey: ['projects', Number(id), 'reviews'], queryFn: () => projectsApi.reviews(id), enabled: current === 'logs' });
  const logs = (reviews.data ?? []).filter((r) => r.comment).sort((a, b) => b.id - a.id); // newest first
  return (
    <>
      <div className="subtabs" role="tablist" style={{ marginTop: 16 }}>
        {[
          ['logs', 'Comments'],
          ['history', 'Logs'],
        ].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={current === key} className={current === key ? 'is-active' : undefined} onClick={() => select(key)}>
            {label}
          </button>
        ))}
      </div>
      {current === 'logs' ? (
        <div className="card card-flush" style={{ marginTop: 12 }}>
          <CardHead title="Comments" sub="All comments and stage changes, latest first." />
          <div style={{ padding: '16px 20px 20px' }}>{reviews.isLoading ? <Spinner /> : <CommentsLog reviews={logs} />}</div>
        </div>
      ) : (
        <AuditHistory id={id} />
      )}
    </>
  );
}

function AuditHistory({ id }) {
  const { data, isLoading } = useQuery({ queryKey: ['projects', Number(id), 'activity'], queryFn: () => projectsApi.activity(id) });
  return (
    <div className="card card-flush" style={{ marginTop: 12 }}>
      <CardHead title="Logs" sub="Everything that changed on this project." />
      <div style={{ padding: '16px 20px 20px' }}>
        {isLoading ? (
          <Spinner />
        ) : data?.length ? (
          <div className="timeline">
            {data.map((a) => {
              const st = stageChange(a.changes);
              const fields = a.changes ? Object.keys(a.changes).filter((k) => k !== 'status' && k !== 'stage') : [];
              return (
                <div key={a.id} className="timeline-item">
                  <div className="when">{formatDateTime(a.loggedAt)}</div>
                  <div className="what">
                    {ACTION_TEXT[a.action] ?? a.action}
                    {a.userName ? ` by ${a.userName}` : ''}
                  </div>
                  {(a.message && a.action !== 'create') || st || fields.length ? (
                    <div className="note">
                      {st && `${st}. `}
                      {fields.length > 0 && `Changed: ${fields.map((f) => FIELD_LABEL[f] ?? f.replace(/_id$/, '').replace(/_/g, ' ')).join(', ')}. `}
                      {a.action !== 'create' && a.message}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted small">No history yet.</p>
        )}
      </div>
    </div>
  );
}
