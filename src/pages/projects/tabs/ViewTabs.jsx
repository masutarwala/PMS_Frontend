import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, Clock3, ExternalLink, Pencil, RefreshCw, Target, UserCog, Users } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { Avatar, EmptyState } from '@/components/ui/Display';
import { Spinner } from '@/components/ui/Loader';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { stageChange } from '../stageChange';
import { AccessBadge, AccessTiles, ColorDot, CommentsLog, EffortSplit, GradeTag, MemberCell, pct, ReviewGrid } from './shared';

/** "Edit" style link into the edit page on a given tab. */
function EditLink({ id, tab, icon: Icon = Pencil, children }) {
  return (
    <div className="actions">
      <Link className="btn btn-soft btn-sm" to={`/projects/${id}/edit#${tab}`}>
        <Icon />
        {children}
      </Link>
    </div>
  );
}

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

/* ------------------------------------------------------------------ Update */

export function UpdateView({ p, reviews, canEdit }) {
  const progress = reviews ? reviews.filter((r) => r.groups.length > 0) : undefined;
  const comments = reviews ? reviews.filter((r) => r.comment) : [];
  const latest = progress?.[0];
  const add = canEdit && <EditLink id={p.id} tab="update">Update progress</EditLink>;
  return (
    <>
      <div className="card card-flush" style={{ marginTop: 16 }}>
        <CardHead title="Current status" sub="From the latest review.">
          {add}
        </CardHead>
        <div style={{ padding: '16px 20px 20px' }}>
          <div className="upd-summary">
            <div>
              <span className="muted small">Stage</span>
              <b>{p.stageName ?? '—'}</b>
            </div>
            <div style={{ flex: 1.4 }}>
              <span className="muted small">Overall progress</span>
              <div className="row" style={{ gap: 10, marginTop: 4 }}>
                <div className="progress grow">
                  <span style={{ width: `${Math.min(100, p.progress)}%` }} />
                </div>
                <b className="num">{p.progress}%</b>
              </div>
            </div>
            <div>
              <span className="muted small">Last review</span>
              <b>{latest ? formatDate(latest.reviewDate) : '—'}</b>
            </div>
            <div>
              <span className="muted small">Reviewed by</span>
              <b>{latest?.reviewerName ?? '—'}</b>
            </div>
          </div>
        </div>
      </div>
      {reviews === undefined ? (
        <Spinner />
      ) : progress.length === 0 && comments.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <EmptyState icon={RefreshCw} title="No reviews yet">
            {canEdit ? 'Add the first review to track the stage and the % completed per task group.' : 'Nobody has reviewed this project yet.'}
          </EmptyState>
        </div>
      ) : (
        <div className="rv-layout">
          <div className="card card-flush" style={{ marginTop: 16 }}>
            <CardHead title="Progress by task group" sub={`${progress.length} entr${progress.length === 1 ? 'y' : 'ies'} · newest first · % completed per task group`}>
              {add}
            </CardHead>
            <div style={{ padding: '16px 20px 20px' }}>
              {progress.length ? <ReviewGrid reviews={progress} estimates={p.estimates} /> : <p className="muted small">No progress entered yet.</p>}
            </div>
          </div>
          <div className="card card-flush" style={{ marginTop: 16 }}>
            <CardHead title="Comments" sub="Latest first" />
            <div style={{ padding: '16px 20px 20px' }}>
              <CommentsLog reviews={comments} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Project */

export function ProjectView({ p, canEdit }) {
  const others = p.members.filter((m) => !m.isOwner);
  return (
    <div className="detail-layout" style={{ marginTop: 0 }}>
      <div>
        <div className="card card-flush" style={{ marginTop: 16 }}>
          <CardHead title="Project details">{canEdit && <EditLink id={p.id} tab="project">Edit</EditLink>}</CardHead>
          <div style={{ padding: '16px 20px 20px' }}>
            <dl className="kv">
              <dt>Customer</dt>
              <dd>{p.customerName ?? '—'}</dd>
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
              <dt>End date</dt>
              <dd>{formatDate(p.endDate)}</dd>
              <dt>Total estimate amount</dt>
              <dd>
                {p.estimatedAmount != null ? (
                  <>
                    {formatMoney(p.estimatedAmount, p.estimatedAmountCurrency || 'INR')} <span className="muted">{p.estimatedAmountCurrency}</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
              <dt>SharePoint link</dt>
              <dd>
                {p.sharepointLink ? (
                  <a href={p.sharepointLink} target="_blank" rel="noreferrer">
                    <ExternalLink style={{ width: 14, height: 14 }} /> Open link
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Retainer project</dt>
              <dd>
                <span className="row" style={{ gap: 6 }}>
                  {p.isRetainerProject ? <CircleCheck className="yes-ico" /> : <CircleX className="muted" />}
                  {p.isRetainerProject ? 'Yes' : 'No'}
                </span>
              </dd>
              <dt>Project details</dt>
              <dd>
                <span style={{ fontWeight: 500, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{p.detail || '—'}</span>
              </dd>
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

export function UsersView({ p, canEdit }) {
  const cur = p.estimatedAmountCurrency || 'INR';
  return (
    <div className="card card-flush" style={{ marginTop: 16 }}>
      <CardHead
        title="Project members"
        sub={`${p.members.length} ${p.members.length === 1 ? 'person' : 'people'} on this project and what they can see or do.`}
      >
        {canEdit && (
          <EditLink id={p.id} tab="users" icon={UserCog}>
            Manage members
          </EditLink>
        )}
      </CardHead>
      <div style={{ padding: '16px 20px 20px' }}>
        <AccessTiles />
        {p.members.length ? (
          <div className="editor">
            <div className="table-wrap" style={{ borderTop: 0 }}>
              <table className="data-table members-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Grade</th>
                    <th className="right">Cost per hour</th>
                    <th style={{ paddingLeft: 32 }}>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {p.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <MemberCell name={m.name} sub={memberSub(m)} />
                      </td>
                      <td>
                        <GradeTag grade={m.gradeName} team={m.teamName} />
                      </td>
                      <td className="num right">
                        {m.costPerHour != null ? (
                          <>
                            {formatMoney(m.costPerHour, m.currency || cur)}
                            <span className="muted"> /hr</span>
                          </>
                        ) : (
                          <span className="muted">Not set</span>
                        )}
                      </td>
                      <td style={{ paddingLeft: 32 }}>
                        <AccessBadge level={m.accessLevel} />
                      </td>
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

export function EstimateView({ p, canEdit }) {
  const total = p.estimates.reduce((s, e) => s + e.effortPercentage, 0);
  const full = Math.abs(total - 100) < 0.01;
  return (
    <div className="card card-flush" style={{ marginTop: 16 }}>
      <CardHead title="Estimate" sub="Share of effort per task group; hours are calculated from the total.">
        {canEdit && <EditLink id={p.id} tab="estimate">Edit</EditLink>}
      </CardHead>
      <div className="row between" style={{ padding: '16px 20px 12px' }}>
        <span>
          <span className="muted">Total estimated hours</span>{' '}
          <b style={{ fontSize: 16, marginLeft: 6 }}>{p.estimatedHours != null ? `${formatNumber(p.estimatedHours)} hrs` : 'Not set'}</b>
        </span>
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
          {canEdit ? 'Edit the estimate to split the effort across task groups.' : 'The effort split has not been set.'}
        </EmptyState>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Analysis */

function CostVsEstimate({ p, cost }) {
  const cur = p.estimatedAmountCurrency || 'INR';
  const est = p.estimatedAmount;
  const used = est ? (cost / est) * 100 : null;
  const tone = used == null ? '' : used > 100 ? 'danger' : used >= 85 ? 'warning' : 'success';
  const label = used == null ? 'No estimate amount' : used > 100 ? 'Over estimate amount' : used >= 85 ? 'Close to estimate amount' : 'Within estimate amount';
  const tile = (title, value, green) => (
    <div className="tile" style={{ boxShadow: 'none', background: green ? 'var(--green-50)' : 'var(--surface-2)' }}>
      <div className="muted small">{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: green ? 'var(--green-800)' : undefined }}>{value}</div>
    </div>
  );
  return (
    <div className="card card-lg" style={{ marginTop: 16 }}>
      <div className="row between wrap" style={{ gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16 }}>Cost vs estimate amount</h3>
          <div className="muted small">Cost of all users (hours × rate) compared with the project&apos;s total estimate amount.</div>
        </div>
        <span className={`badge${tone ? ` badge-${tone}` : ''}`}>{label}</span>
      </div>
      <div className="grid grid-4" style={{ gap: 12 }}>
        {tile('Estimate amount', est != null ? formatMoney(est, cur) : '—')}
        {tile('Cost so far', formatMoney(cost, cur))}
        {tile('Remaining', est != null ? formatMoney(est - cost, cur) : '—', est != null && est >= cost)}
        {tile('Value used', used != null ? `${formatNumber(Math.round(used * 100) / 100)}%` : '—')}
      </div>
      {est != null && (
        <>
          <div className={`progress${tone === 'success' ? '' : ` is-${tone}`}`} style={{ height: 12, marginTop: 16 }}>
            <span style={{ width: `${Math.min(100, used)}%` }} />
          </div>
          <div className="row between small muted" style={{ marginTop: 6 }}>
            <span>{formatMoney(0, cur)}</span>
            <span>Estimate amount {formatMoney(est, cur)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function AnalysisView({ p, canEdit }) {
  const totalActual = p.estimates.reduce((s, e) => s + e.actualHours, 0);
  const cur = p.estimatedAmountCurrency || 'INR';
  const mh = p.memberHours;
  const totalHours = mh.reduce((s, m) => s + m.hours, 0);
  const totalCost = mh.reduce((s, m) => s + (m.cost ?? 0), 0);
  const rated = mh.filter((m) => m.rate != null);
  const avgRate = rated.length ? rated.reduce((s, m) => s + m.rate, 0) / rated.length : null;
  return (
    <div>
      {/* cost first: what the project has cost so far against its estimate amount, then who it came from */}
      <CostVsEstimate p={p} cost={totalCost} />

      <div className="card card-flush" style={{ marginTop: 16 }}>
        <CardHead title="Hours and cost by member" sub="Hours from timesheets of this project; rate per hour of each member." />
        {mh.length ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="right">Hours</th>
                  <th className="right">Rate / hr</th>
                  <th className="right">Cost</th>
                  <th>Share of cost</th>
                </tr>
              </thead>
              <tbody>
                {mh.map((m) => {
                  const share = pct(m.cost ?? 0, totalCost);
                  return (
                    <tr key={m.id}>
                      <td>
                        <MemberCell name={m.name} />
                      </td>
                      <td className="num right">{formatNumber(m.hours)}h</td>
                      <td className="num right">{m.rate != null ? formatMoney(m.rate, cur) : <span className="muted">Not set</span>}</td>
                      <td className="num right">
                        <b>{m.cost != null ? formatMoney(m.cost, cur) : '—'}</b>
                      </td>
                      <td style={{ minWidth: 170 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <div className="progress grow">
                            <span style={{ width: `${share}%` }} />
                          </div>
                          <span className="small num">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td>
                    <b>All users ({mh.length})</b>
                  </td>
                  <td className="num right">
                    <b>{formatNumber(totalHours)}h</b>
                  </td>
                  <td className="num right muted">{avgRate != null ? `avg ${formatMoney(avgRate, cur)}` : '—'}</td>
                  <td className="num right">
                    <b>{formatMoney(totalCost, cur)}</b>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Clock3} title="No time logged yet">
            Hours and cost appear here once members log time on this project.
          </EmptyState>
        )}
      </div>

      <div className="card card-flush" style={{ marginTop: 16 }}>
        <CardHead title="Allocation vs actual" sub="Actual hours come from timesheets of this project.">
          {canEdit && <EditLink id={p.id} tab="estimate">Edit allocation</EditLink>}
        </CardHead>
        <div style={{ padding: '16px 20px 4px' }}>
          <EffortSplit estimates={p.estimates} legend={false} />
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task group</th>
                <th className="right">Allocated</th>
                <th className="right">Allocated hrs</th>
                <th className="right">Actual hrs</th>
                <th>Consumed</th>
                <th className="right">Share of actual</th>
              </tr>
            </thead>
            <tbody>
              {p.estimates.map((e, i) => {
                const consumed = e.hours ? pct(e.actualHours, e.hours) : 0;
                return (
                  <tr key={e.taskGroupId}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <ColorDot i={i} />
                        <b>{e.taskGroupName}</b>
                      </span>
                    </td>
                    <td className="num right">{e.effortPercentage}%</td>
                    <td className="num right">{e.hours != null ? formatNumber(e.hours) : '—'}</td>
                    <td className="num right">{formatNumber(e.actualHours)}</td>
                    <td style={{ minWidth: 160 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <div className={`progress grow${consumed > 100 ? ' is-danger' : consumed >= 85 ? ' is-warning' : ''}`}>
                          <span style={{ width: `${Math.min(100, consumed)}%` }} />
                        </div>
                        <span className="small num">{e.hours ? `${consumed}%` : '—'}</span>
                      </div>
                    </td>
                    <td className="num right">{pct(e.actualHours, totalActual)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ History */

const ACTION_TEXT = { create: 'Project created', update: 'Project updated', status_change: 'Stage changed', delete: 'Project deleted' };
const FIELD_LABEL = { members: 'members', estimate: 'estimate' };

export function HistoryView({ id, canEdit }) {
  const { data, isLoading } = useQuery({ queryKey: ['projects', Number(id), 'activity'], queryFn: () => projectsApi.activity(id) });
  return (
    <div className="card card-flush" style={{ marginTop: 16 }}>
      <CardHead title="History" sub="Everything that changed on this project.">
        {canEdit && <EditLink id={id} tab="project">Edit project</EditLink>}
      </CardHead>
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
