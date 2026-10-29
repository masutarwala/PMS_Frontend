import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Check, ChevronDown, ChevronRight, Cloud, Info, Pencil } from 'lucide-react';
import { tasksApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { ErrorAlert } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { Checkbox } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { formatDate } from '@/lib/format';
import { formatMinutes } from './TaskListPage';

const period = (p) => `${formatDate(p.start)} – ${formatDate(p.end)}`;

/**
 * "Add tasks from the plan": every task of each planned task group – the group's template tasks, with their task
 * type – with the dates of the group's weekly plan. A group planned in several separate periods starts with the
 * first one (the others are shown for information). Tasks the project already has are left out.
 */
export function TaskPlanSection({ project, canAssign, users, onChangeMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const plan = useQuery({ queryKey: ['tasks', 'plan-groups', project.id], queryFn: () => tasksApi.planTasks(project.id) });
  const [off, setOff] = useState(() => new Set()); // groups the owner unticked
  const [open, setOpen] = useState(() => new Set()); // groups whose task list is shown
  const [assignee, setAssignee] = useState({}); // group id -> user id
  const [taskWho, setTaskWho] = useState({}); // 'group|task title' -> user id (a task given to someone else)

  const groups = useMemo(() => plan.data?.groups ?? [], [plan.data]);
  const todoOf = (g) => g.tasks.filter((t) => !t.existing);
  const addable = (g) => g.periods.length > 0 && todoOf(g).length > 0;
  const chosen = groups.filter((g) => addable(g) && !off.has(g.taskGroupId));
  const total = chosen.reduce((n, g) => n + todoOf(g).length, 0);
  const defaultAssignee = project.ownerId ?? user.id;
  const peopleOptions = (users ?? []).filter((u) => (project.peopleIds ?? []).includes(u.id)).map((u) => ({ value: u.id, label: u.name }));
  const who = (g) => assignee[g.taskGroupId] ?? defaultAssignee;
  const taskKey = (g, t) => `${g.taskGroupId}|${t.title}`;
  const whoTask = (g, t) => taskWho[taskKey(g, t)] ?? who(g); // follows the group's person until changed
  const people = canAssign && peopleOptions.length ? peopleOptions : [{ value: user.id, label: user.name }];
  const flip = (set, setter, id, on) =>
    setter((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // The groups are added one request at a time, so the page can show how far it is. A group that fails
  // leaves the earlier ones added – they show as "already created", so adding again carries on from there.
  const [progress, setProgress] = useState(null); // { done, total, group } while adding
  const busyRef = useRef(false); // read when a page change is attempted
  const doneRef = useRef(0);
  const create = useMutation({
    mutationFn: async () => {
      busyRef.current = true;
      doneRef.current = 0;
      const total = chosen.reduce((n, g) => n + todoOf(g).length, 0);
      let skipped = 0;
      for (const g of chosen) {
        setProgress({ done: doneRef.current, total, group: g.name });
        const r = await tasksApi.fromPlan({
          projectId: project.id,
          items: [
            {
              taskGroupId: g.taskGroupId,
              ownerId: project.ownerId ?? user.id,
              assignedTo: who(g),
              assignees: todoOf(g)
                .filter((t) => whoTask(g, t) !== who(g))
                .map((t) => ({ title: t.title, assignedTo: whoTask(g, t) })),
            },
          ],
        });
        doneRef.current += r.created;
        skipped += r.skipped;
      }
      setProgress({ done: doneRef.current, total, group: null });
      return { created: doneRef.current, skipped };
    },
    onSuccess: (r) => {
      busyRef.current = false; // the page may change now
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`${r.created} task${r.created === 1 ? '' : 's'} added to ${project.title}${r.skipped ? ` (${r.skipped} already existed)` : ''}`);
      navigate('/tasks');
    },
    onError: (err) => {
      busyRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.error(doneRef.current ? `${errorMessage(err)} – ${doneRef.current} task${doneRef.current === 1 ? ' was' : 's were'} added before it stopped` : errorMessage(err));
    },
    onSettled: () => setProgress(null),
  });

  // no leaving the page while the tasks are being added
  const blocker = useBlocker(() => busyRef.current);
  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset(); // stay on the page
  }, [blocker]);
  useEffect(() => {
    if (!progress) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [progress]);

  return (
    <>
      <section className="card card-lg form-card">
        <div className="fc-head">
          <span className="fc-num">2</span>
          <div style={{ flex: 1 }}>
            <div className="form-section-title">Tasks from the project plan</div>
            <div className="form-section-sub">
              Every task of each planned task group, with the group&apos;s dates from the weekly plan. A group planned in separate periods starts with the first one.
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onChangeMode}>
            <Pencil />
            Change
          </button>
        </div>

        {plan.isLoading ? (
          <Spinner />
        ) : plan.isError ? (
          <ErrorAlert>{errorMessage(plan.error)}</ErrorAlert>
        ) : !groups.length ? (
          <div className="pl-empty">
            <Info />
            <p>This project has no task groups in its estimate yet – set the effort split on the Estimate tab and place the groups in the Plan tab first.</p>
          </div>
        ) : (
          <div className="tp-list">
            {groups.map((g) => {
              const first = g.periods[0];
              const rest = g.periods.slice(1);
              const can = addable(g);
              const on = can && !off.has(g.taskGroupId);
              const todo = todoOf(g);
              const made = g.tasks.length - todo.length;
              const shown = open.has(g.taskGroupId);
              return (
                <div key={g.taskGroupId} className={`tp-row${on ? ' is-on' : ''}${can ? '' : ' is-off'}`}>
                  <Checkbox checked={on} disabled={!can} onChange={(v) => flip(off, setOff, g.taskGroupId, !v)} />
                  <div className="tp-main">
                    <div className="tp-title">
                      <b>{g.name}</b>
                      <span className="muted small">{g.effortPercentage}% of effort{g.estimatedMinutes ? ` · ${formatMinutes(g.estimatedMinutes)}` : ''}</span>
                      <span className="badge badge-info">
                        {todo.length} task{todo.length === 1 ? '' : 's'}
                      </span>
                      {made > 0 && <span className="badge badge-success">{made} already created</span>}
                      {!g.periods.length && <span className="badge badge-warning">Not planned</span>}
                    </div>
                    {first && (
                      <div className="tp-period">
                        <CalendarRange />
                        <span>
                          {period(first)} <span className="muted">({first.weeks} wk)</span>
                        </span>
                      </div>
                    )}
                    {rest.length > 0 && (
                      <div className="tp-info">
                        <Info />
                        <span>
                          Also planned: {rest.map((p) => `${period(p)} (${p.weeks} wk)`).join(' · ')}. The tasks use the first period.
                        </span>
                      </div>
                    )}
                    {g.tasks.length > 0 && (
                      <button type="button" className="tp-toggle" aria-expanded={shown} onClick={() => flip(open, setOpen, g.taskGroupId, !shown)}>
                        {shown ? <ChevronDown /> : <ChevronRight />}
                        {shown ? 'Hide the tasks' : 'Show the tasks'}
                      </button>
                    )}
                    {shown && (
                      <ul className="tp-tasks">
                        {g.tasks.map((t) => (
                          <li key={`${t.templateId}-${t.title}`} className={t.existing ? 'is-made' : undefined}>
                            <span className="tp-task-name">
                              {t.title}
                              {t.taskTypeName && <small>{t.taskTypeName}</small>}
                            </span>
                            {t.estimatedMinutes ? <span className="tp-task-est">{formatMinutes(t.estimatedMinutes)}</span> : null}
                            {t.existing ? (
                              <em>already created</em>
                            ) : (
                              <div className="tp-task-who">
                                <Dropdown
                                  search
                                  size="sm"
                                  disabled={!canAssign || !on}
                                  options={people}
                                  value={whoTask(g, t)}
                                  onChange={(v) => setTaskWho((m) => ({ ...m, [taskKey(g, t)]: v }))}
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {can && (
                    <div className="tp-who">
                      <Dropdown
                        search
                        disabled={!canAssign || !on}
                        options={people}
                        value={who(g)}
                        onChange={(v) => {
                          setAssignee((a) => ({ ...a, [g.taskGroupId]: v }));
                          // the group's person applies to all its tasks again
                          setTaskWho((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith(`${g.taskGroupId}|`))));
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {progress && (
        <div className="tp-busy" role="alertdialog" aria-modal="true" aria-live="polite" aria-label="Adding tasks">
          <div className="tp-busy-card">
            <Spinner />
            <b>Adding the tasks…</b>
            <span className="muted small">
              {progress.done} of {progress.total} added{progress.group ? ` · now ${progress.group}` : ''}
            </span>
            <div className="progress">
              <span style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
            </div>
            <span className="muted small">Please stay on this page until it finishes.</span>
          </div>
        </div>
      )}

      <div className="form-bar">
        <span className="note">
          <Cloud />
          Each task is created as To do – the group&apos;s person unless you pick another for a task
        </span>
        <div className="actions">
          <Link className="btn btn-ghost" to="/tasks">
            Cancel
          </Link>
          <button type="button" className="btn btn-primary" disabled={create.isPending || !total} onClick={() => create.mutate()}>
            <Check />
            {create.isPending ? 'Adding…' : total ? `Add ${total} task${total === 1 ? '' : 's'}` : 'Add tasks'}
          </button>
        </div>
      </div>
    </>
  );
}
