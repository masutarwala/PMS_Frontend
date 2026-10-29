import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, CheckCircle2, CircleDot, Clock3, ClipboardList, History, ListChecks, ListOrdered, Lock, Pause, Pencil, Play, RotateCcw, Timer } from 'lucide-react';
import { task135Api, tasksApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { Avatar, ErrorAlert } from '@/components/ui/Display';
import { Checkbox } from '@/components/ui/Field';
import { RowMenu } from '@/components/ui/ColumnPicker';
import { FullPageLoader, Spinner } from '@/components/ui/Loader';
import { useConfirm } from '@/components/ui/confirm-context';
import { useToast } from '@/components/ui/toast-context';
import { SCREENS, TASK_STATUS } from '@/lib/constants';
import { formatDateTime, formatDayMonth, formatDayMonthTime } from '@/lib/format';
import { todayIso, zonedParts } from '@/lib/timezone';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { formatMinutes, PriorityBadge, StatusBadge } from './TaskListPage';
import { StatusChangeModal } from './StatusChangeModal';
import { LogTimeModal } from '@/pages/timesheet/LogTimeModal';

// dates / times in the user's time zone
const day = formatDayMonth;
const dayTime = formatDayMonthTime;
const full = formatDateTime;
const mins = (m) => (m ? formatMinutes(m) : '0 min');

/** "8 days left" / "due today" / "2 days overdue" for the end before date. */
function dueText(t) {
  if (t.isContinuous) return 'Continuous – no end date';
  if (!t.plannedEnd) return 'No end date';
  if (t.status === 'completed') return dayTime(t.plannedEnd);
  // whole days between today and the end date, both in the user's zone
  const days = Math.round((Date.parse(zonedParts(t.plannedEnd).date) - Date.parse(todayIso())) / 86400000);
  const rel = days > 1 ? `${days} days left` : days === 1 ? '1 day left' : days === 0 ? 'due today' : `${-days} day${days === -1 ? '' : 's'} overdue`;
  return `${dayTime(t.plannedEnd)} (${rel})`;
}

/** The next step offered as the main button, by status. */
const NEXT = {
  to_do: { status: 'in_progress', label: 'Start', icon: Play, primary: true },
  in_progress: { status: 'completed', label: 'Mark completed', icon: Check, primary: true },
  hold: { status: 'in_progress', label: 'Resume', icon: Play, primary: true },
  completed: { status: 'in_progress', label: 'Reopen', icon: RotateCcw, primary: false },
};
const STATUS_ICON = { to_do: CircleDot, in_progress: Play, hold: Pause, completed: CheckCircle2 };
const REACHED = ['done', 'current', 'hold'];

/** Created → (In progress | On hold | Completed) → Due */
function Timeline({ t }) {
  const middle =
    t.status === 'completed'
      ? { state: 'done', label: 'Completed', sub: `${day(t.completedOn)}${t.completedByName ? `, by ${t.completedByName}` : ''}` }
      : t.status === 'in_progress'
        ? { state: 'current', label: 'In progress', sub: t.startedAt ? `since ${day(t.startedAt)}` : 'started' }
        : t.status === 'hold'
          ? { state: 'hold', label: 'On hold', sub: t.startedAt ? `started ${day(t.startedAt)}` : 'paused' }
          : { state: 'todo', label: 'Not started', sub: 'to do' };
  const steps = [
    { state: 'done', label: 'Created', sub: `${day(t.createdAt)}${t.createdByName ? `, by ${t.createdByName}` : ''}` },
    middle,
    { state: t.isOverdue ? 'late' : 'todo', label: t.isContinuous ? 'Ongoing' : 'Due', sub: dueText(t) },
  ];
  return (
    <div className="td-timeline">
      {steps.map((s, i) => (
        <div key={s.label} className={`td-step is-${s.state}`}>
          <div className="td-dot-row">
            <span className="td-dot">{s.state === 'done' && <Check />}</span>
            {i < steps.length - 1 && <span className={`td-line${REACHED.includes(steps[i + 1].state) ? ' is-done' : ''}`} />}
          </div>
          <b>{s.label}</b>
          <span className="td-sub">{s.sub}</span>
        </div>
      ))}
    </div>
  );
}

function Activity({ id }) {
  const q = useQuery({ queryKey: ['tasks', 'activity', id], queryFn: () => tasksApi.activity(id) });
  if (q.isLoading) return <Spinner />;
  if (!q.data?.length) return <p className="muted small">No activity yet.</p>;
  // same look as the project Logs: "<what> by <who>" + a note with the details
  const entry = (a) => {
    const msg = a.message ?? '';
    const status = /^Status:? (.+?) → (.+)$/.exec(msg); // "Status: In progress → Completed" (older: "Status in_progress → hold")
    if (a.action === 'create') return { what: 'Task created', note: null };
    if (status) return { what: 'Status changed', note: `${TASK_STATUS[status[1]]?.label ?? status[1]} → ${TASK_STATUS[status[2]]?.label ?? status[2]}` };
    if (msg.startsWith('Subtask')) return { what: 'Subtask updated', note: msg };
    if (a.action === 'delete') return { what: 'Task deleted', note: null };
    return { what: 'Task updated', note: msg && msg !== 'Task details updated' ? msg : 'Task details changed.' };
  };
  return (
    <div className="timeline td-scroll">
      {q.data.map((a) => {
        const e = entry(a);
        return (
          <div key={a.id} className="timeline-item">
            <div className="when">{full(a.at)}</div>
            <div className="what">
              {e.what}
              {a.userName ? ` by ${a.userName}` : ''}
            </div>
            {e.note && <div className="note">{e.note}</div>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Efforts: the time people logged in the timesheet against this task –
 * a total against the estimate, then the daily log with the work done.
 */
function Efforts({ e }) {
  if (!e.entries.length) {
    return (
      <p className="muted small">
        No time logged yet. When people log time in the timesheet against this task, it shows here{e.seesAll ? ' for everyone working on it' : ''}.
      </p>
    );
  }
  const est = e.estimatedMinutes;
  const pct = est ? Math.round((e.totalMinutes / est) * 100) : null;
  return (
    <div className="td-scroll">
      {!e.seesAll && <div className="td-note td-eff-mine">Only your own time is shown.</div>}

      <div className="td-eff-total">
        <div className="td-eff-big">
          <b>{mins(e.totalMinutes)}</b>
          <span>logged{est ? ` of ${formatMinutes(est)} estimate` : ''}</span>
        </div>
        {est ? (
          <>
            <div className={`progress${pct > 100 ? ' is-danger' : pct > 85 ? ' is-warning' : ''}`}>
              <span style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="td-eff-left">
              <span>{pct}% used</span>
              <span className={pct > 100 ? 'is-over' : ''}>{pct > 100 ? `${formatMinutes(e.totalMinutes - est)} over estimate` : pct === 100 ? 'Estimate reached' : `${formatMinutes(est - e.totalMinutes)} left`}</span>
            </div>
          </>
        ) : (
          <div className="td-eff-left">
            <span>No estimate set for this task</span>
          </div>
        )}
      </div>

      <h5 className="td-eff-h">Daily log</h5>
      <div className="td-eff-table">
        <div className="td-eff-tr is-head is-log">
          <span>Date</span>
          <span>Person</span>
          <span>Work done</span>
          <span>Time</span>
        </div>
        {e.entries.map((x) => (
          <div key={x.id} className="td-eff-tr is-log">
            <span>{day(x.date)}</span>
            <span>{x.userName}</span>
            <span className="td-eff-name">{x.comment || '—'}</span>
            <span>{formatMinutes(x.minutes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Task details – a read view for the people doing the work: the assignee moves the status along
 * and ticks subtasks; a subtask assignee ticks their own. The owner / creator also get Edit.
 */
export default function TaskViewPage() {
  const { id } = useParams();
  // opened from another page (e.g. a project's Tasks tab)? go back there
  const from = useLocation().state?.from;
  const { user } = useAuth();
  const perms = usePermissions(SCREENS.TASKS);
  // subtasks assigned to me can go on today's 1-3-5
  const can135 = usePermissions(SCREENS.TASK_135).create;
  const today135 = useQuery({ queryKey: ['task-135', 'today'], queryFn: () => task135Api.day(), enabled: can135 });
  const subsToday = new Set((today135.data?.items ?? []).filter((i) => i.subtaskId).map((i) => i.subtaskId));
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('subtasks');
  const canLog = usePermissions(SCREENS.TIMESHEET).create; // "Log time" on a project task
  const [logFor, setLogFor] = useState(null);
  const [statusChange, setStatusChange] = useState(null); // { task, status } waiting for confirmation
  const task = useQuery({ queryKey: ['tasks', 'item', id], queryFn: () => tasksApi.get(id), retry: false });
  const efforts = useQuery({ queryKey: ['tasks', 'efforts', id], queryFn: () => tasksApi.efforts(id), enabled: task.isSuccess });

  const onSaved = (t) => {
    queryClient.setQueryData(['tasks', 'item', id], t);
    queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'activity', id] });
  };
  const setStatus = useMutation({
    mutationFn: ({ status, completedOn }) => tasksApi.update(id, { status, ...(completedOn ? { completedOn } : {}) }),
    onSuccess: (t) => {
      setStatusChange(null);
      onSaved(t);
      toast.success(`Status: ${TASK_STATUS[t.status].label}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const add135 = useMutation({
    mutationFn: (sub) => task135Api.add({ subtaskId: sub.id }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['task-135'] });
      toast.success(`Added to today's 1-3-5 – slot ${item.position} (${item.size})`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const tick = useMutation({
    mutationFn: ({ sub, isDone }) => tasksApi.subtaskDone(id, sub.id, isDone),
    onSuccess: (t, { sub, isDone }) => {
      onSaved(t);
      toast.success(`"${sub.title}" ${isDone ? 'done' : 'reopened'}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (task.isLoading) return <FullPageLoader />;
  if (task.isError) return task.error?.response?.status === 404 ? <NotFoundPage what="Task" /> : <ErrorAlert>{errorMessage(task.error)}</ErrorAlert>;

  const t = task.data;
  const canStatus = perms.edit && t.canEdit;
  const canTick = (s) => t.canEdit || s.assignedTo === user.id;
  const next = NEXT[t.status];
  const openSubs = t.subtaskCount - t.subtaskDone;
  const today = todayIso();
  const askTick = async (s, isDone) => {
    const ok = await confirm({
      title: isDone ? 'Mark subtask done?' : 'Mark subtask not done?',
      message: isDone ? `"${s.title}" will be marked as done.` : `"${s.title}" will be opened again.`,
      confirmLabel: isDone ? 'Mark done' : 'Reopen',
      tone: 'primary',
    });
    if (ok) tick.mutate({ sub: s, isDone });
  };

  return (
    <>
      <Topbar title="Task details" breadcrumb={from?.startsWith('/projects') ? ['Projects', 'Tasks'] : ['Task', 'Task']} back={from ?? '/tasks'} />

      <div className="card td-page">
        <div className="td-head">
          <span className="td-lead">
            <ClipboardList />
          </span>
          <div className="td-id">
            <div className="td-kicker">
              {t.projectCode ? `${t.projectCode} · ${t.projectTitle}` : t.categoryName}
              {t.projectCode && t.categoryName ? <span className="muted"> · {t.categoryName}</span> : null}
            </div>
            <h2 className="td-title">{t.name}</h2>
            {t.description && <p className="td-desc">{t.description}</p>}
          </div>
          <div className="td-actions">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
            {canStatus && (
              <button type="button" className={`btn ${next.primary ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusChange({ task: t, status: next.status })}>
                <next.icon />
                {next.label}
              </button>
            )}
            {/* only the person working on the task (assignee / a subtask assignee) logs time on it */}
            {canLog && (t.assignedTo === user.id || t.mySubtaskCount > 0) && (
              <button type="button" className="btn btn-secondary" onClick={() => setLogFor({ taskId: t.id, projectId: t.projectId, categoryId: t.categoryId, title: t.name })}>
                <Timer />
                Add to timesheet
              </button>
            )}
            {perms.edit && t.canManage && (
              <Link className="btn btn-secondary" to={`/tasks/${t.id}/edit`} state={{ from: `/tasks/${t.id}`, viewFrom: from }}>
                <Pencil />
                Edit
              </Link>
            )}
            {canStatus && (
              <RowMenu
                items={Object.keys(TASK_STATUS)
                  .filter((s) => s !== t.status && s !== next.status)
                  .map((s) => ({ label: `Set to ${TASK_STATUS[s].label}`, icon: STATUS_ICON[s], onClick: () => setStatusChange({ task: t, status: s }) }))}
              />
            )}
          </div>
        </div>

        {/* timeline (left) and the people (right) in one row */}
        <div className="td-status-row">
          <Timeline t={t} />
          <div className="td-people">
            {[
              ["Owner", t.ownerName, "is-owner"],
              ["Assigned to", t.assignedToName, "is-assignee"],
            ].map(([label, name, tone]) => (
              <div key={label} className={`td-person ${tone}`}>
                {name ? <Avatar name={name} size="md" /> : <span className="avatar td-avatar-empty">?</span>}
                <div>
                  <span className="td-person-label">{label}</span>
                  <b>{name ?? "—"}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        {t.isMasked ? (
          <section className="tile td-main">
            <div className="td-private">
              <Lock />
              <b>Personal task</b>
              <p className="muted small">This is {t.assignedToName ?? t.ownerName}&apos;s personal task – only they can see its details, subtasks and history.</p>
            </div>
          </section>
        ) : (
        <section className="tile td-main">
          <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
            {[
              ['subtasks', 'Subtasks', ListChecks, t.subtaskCount],
              ['efforts', 'Efforts', Timer, efforts.data?.totalMinutes ? formatMinutes(efforts.data.totalMinutes) : undefined],
              ['activity', 'Activity', History],
            ].map(([key, label, Icon, count]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>
                <span className="tab-ico">
                  <Icon />
                </span>
                {label}
                {count !== undefined && <span className="count">{count}</span>}
              </button>
            ))}
          </div>

          {tab === 'subtasks' ? (
            t.subtaskCount === 0 ? (
              <p className="muted small">No subtasks.</p>
            ) : (
              <>
                <div className="td-progress">
                  <div className="progress grow">
                    <span style={{ width: `${Math.round((t.subtaskDone / t.subtaskCount) * 100)}%` }} />
                  </div>
                  <span className="small">
                    <b>{t.subtaskDone}</b> of {t.subtaskCount} done
                  </span>
                </div>
                <div className="td-subtasks td-scroll">
                  {t.subtasks.map((s) => {
                    const mine = s.assignedTo === user.id;
                    const late = !s.isDone && s.dueDate && s.dueDate < today;
                    return (
                      <div key={s.id} className={`td-subtask${s.isDone ? ' is-done' : ''}${mine ? ' is-mine' : ''}`}>
                        <Checkbox
                          checked={s.isDone}
                          disabled={!canTick(s) || tick.isPending}
                          title={canTick(s) ? (s.isDone ? 'Mark not done' : 'Mark done') : 'Only the person the task is assigned to can tick it'}
                          onChange={(v) => askTick(s, v)}
                        />
                        <div className="td-st-title">
                          {s.title}
                          {s.isDone && <span className="badge badge-success">Done</span>}
                          {mine && !s.isDone && can135 &&
                            (subsToday.has(s.id) ? (
                              <span className="badge badge-success" title="On today's 1-3-5">
                                In today&apos;s 1-3-5
                              </span>
                            ) : (
                              <button type="button" className="td-st-135" disabled={add135.isPending} onClick={() => add135.mutate(s)} title="Add to today's 1-3-5">
                                <ListOrdered />
                                Add to 1-3-5
                              </button>
                            ))}
                        </div>
                        <div className="td-st-meta">
                          <span className={`td-st-due${late ? ' is-late' : ''}`}>
                            <CalendarClock />
                            {s.dueDate ? day(s.dueDate) : 'No due date'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {t.status === 'completed' && openSubs > 0 && (
                  <div className="td-note">
                    The task is completed, but {openSubs === 1 ? 'this subtask is' : `${openSubs} subtasks are`} still open.
                  </div>
                )}
              </>
            )
          ) : tab === 'efforts' ? (
            efforts.isLoading ? <Spinner /> : efforts.data ? <Efforts e={efforts.data} /> : <ErrorAlert>{errorMessage(efforts.error)}</ErrorAlert>
          ) : (
            <Activity id={id} />
          )}
        </section>
        )}

        <aside>
          <section className="tile side-card">
            <div className="tile-head">
              <span className="ti">
                <Clock3 />
              </span>
              <h4>Time</h4>
            </div>
            <dl className="kv">
              <dt>Estimate</dt>
              <dd>{formatMinutes(t.estimatedMinutes)}</dd>
              {efforts.data && (
                <>
                  <dt>Logged{efforts.data.seesAll ? '' : ' (you)'}</dt>
                  <dd>
                    <button type="button" className="link-btn" onClick={() => setTab('efforts')}>
                      {mins(efforts.data.totalMinutes)}
                    </button>
                  </dd>
                </>
              )}
              {t.isContinuous ? (
                <>
                  <dt>Schedule</dt>
                  <dd>Continuous</dd>
                </>
              ) : (
                <>
                  <dt>Earliest start</dt>
                  <dd>{dayTime(t.plannedStart)}</dd>
                  <dt>End before</dt>
                  <dd style={t.isOverdue ? { color: 'var(--danger)' } : undefined}>{dayTime(t.plannedEnd)}</dd>
                </>
              )}
              {t.completedOn && (
                <>
                  <dt>Completed on</dt>
                  <dd>{day(t.completedOn)}</dd>
                </>
              )}
            </dl>
            <div className="td-updated">Last updated {full(t.updatedAt)}</div>
          </section>
        </aside>
      </div>

      <LogTimeModal job={logFor} onClose={() => setLogFor(null)} />
      <StatusChangeModal change={statusChange} busy={setStatus.isPending} onClose={() => setStatusChange(null)} onConfirm={(b) => setStatus.mutate(b)} />
    </>
  );
}
