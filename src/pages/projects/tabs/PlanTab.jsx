import { Fragment, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, Cloud, Info, Plus, X } from 'lucide-react';
import { Link } from 'react-router';
import { projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useProjectAccess } from '@/auth/auth-context';
import { ErrorAlert } from '@/components/ui/Display';
import { Spinner } from '@/components/ui/Loader';
import { useConfirm } from '@/components/ui/confirm-context';
import { useToast } from '@/components/ui/toast-context';
import { todayIso } from '@/lib/timezone';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
// one colour per task group, far apart from each other (violet, orange, pink, slate, brown, magenta, charcoal, maroon) – green, blue and yellow are kept for the task statuses
const TONES = ['#7C3AED', '#EA580C', '#DB2777', '#475569', '#7C2D12', '#A21CAF', '#111827', '#9F1239'];
const cellKey = (gid, week) => `${gid}|${week}`;
const plusDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const weeksOf = (days) => Math.max(1, Math.ceil(days / 7));

/** How a task group is doing against its planned period: { tone, label, detail? }. */
function statusOf(pr, plannedStart, plannedEnd, today) {
  if (!plannedStart) return { tone: 'muted', label: pr?.total ? 'Not in the plan' : 'Not planned' };
  if (!pr || !pr.total) return { tone: 'muted', label: 'No tasks yet', detail: today >= plannedStart ? `planned from ${dm(plannedStart)}` : `planned from ${dm(plannedStart)}` };
  if (pr.completed === pr.total) {
    const late = daysBetween(plannedEnd, pr.finished ?? plannedEnd);
    return late > 0 ? { tone: 'danger', label: 'Done late', detail: `${weeksOf(late)} wk after the plan` } : { tone: 'success', label: 'Done on time' };
  }
  if (today > plannedEnd) return { tone: 'danger', label: 'Overdue', detail: `${weeksOf(daysBetween(plannedEnd, today))} wk past the plan` };
  if (!pr.started) return today > plannedStart ? { tone: 'warning', label: 'Not started', detail: `planned from ${dm(plannedStart)}` } : { tone: 'muted', label: 'Not started yet', detail: `starts ${dm(plannedStart)}` };
  const span = Math.max(1, daysBetween(plannedStart, plannedEnd) + 1);
  const elapsed = Math.min(1, Math.max(0, (daysBetween(plannedStart, today) + 1) / span));
  if (pr.completed / pr.total + 0.2 < elapsed) return { tone: 'warning', label: 'Behind the plan', detail: `${Math.round(elapsed * 100)}% of the time used, ${Math.round((pr.completed / pr.total) * 100)}% done` };
  const lateStart = daysBetween(plannedStart, pr.started);
  if (lateStart > 6) return { tone: 'warning', label: 'Started late', detail: `${weeksOf(lateStart)} wk after the plan` };
  return { tone: 'success', label: 'On track' };
}
/** One task: { key (colour), tone, label, late }. Yet to start = yellow, in progress = blue, completed = green. */
function taskStatus(t, today) {
  const overdue = Boolean(t.plannedEnd && !t.isContinuous && t.status !== 'completed' && today > t.plannedEnd);
  if (t.status === 'completed') {
    const late = Boolean(t.plannedEnd && t.finished && t.finished > t.plannedEnd);
    return { key: 'done', tone: 'success', label: 'Completed', late };
  }
  if (t.status === 'in_progress') return { key: 'progress', tone: 'info', label: 'In progress', late: overdue };
  if (t.status === 'hold') return { key: 'todo', tone: 'warning', label: 'On hold', late: overdue };
  return { key: 'todo', tone: 'warning', label: 'Yet to start', late: overdue };
}
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
/** Time for a bar: 45 min, 1.5 h, 12 h. */
const shortMin = (m) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`);
const TONE_BADGE = {
  info: 'badge-info', success: 'badge-success', danger: 'badge-danger', warning: 'badge-warning', muted: '' };

/**
 * Plan tab (project owner only): the project's task groups planned week by week, as a timeline –
 * one row per task group, one column per week. Click a free week to plan the group there; drag a bar's
 * right (or left) edge to extend it over more weeks, drag the bar to move it, × removes it.
 * Changes are kept on the page until "Save plan". A plan only – no tasks or time are created.
 */
export function PlanTab({ p }) {
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = useProjectAccess().tab('plan') === 'edit'; // View access: the plan can be looked at, not changed
  const queryClient = useQueryClient();
  const key = ['projects', p.id, 'plan'];
  const plan = useQuery({ queryKey: key, queryFn: () => projectsApi.plan(p.id) });
  const [opened, setOpened] = useState(() => new Set()); // groups whose tasks are shown (all are collapsed at first)
  const [draft, setDraft] = useState(null); // planned cells ('group|week') while editing; null = as saved
  const [preview, setPreview] = useState(null); // { gid, from, to, start, end } while a bar is dragged
  const dragRef = useRef(null);
  const colRef = useRef(null);
  const save = useMutation({
    mutationFn: async (items) => {
      try {
        return await projectsApi.planSave(p.id, items);
      } catch (err) {
        // every task made from the plan in a removed group is completed: confirm, then remove anyway
        if (err.response?.data?.code === 'CONFIRM_REQUIRED') {
          const ok = await confirm({ title: 'Remove the task group?', message: err.response.data.message, confirmLabel: 'Remove anyway' });
          if (!ok) throw Object.assign(new Error('cancelled'), { cancelled: true });
          return projectsApi.planSave(p.id, items, true);
        }
        throw err;
      }
    },
    onSuccess: async ({ applyCandidates = [], ...data }) => {
      queryClient.setQueryData(key, data);
      setDraft(null);
      toast.success('Plan saved');
      // the period of a group changed: offer it to the open tasks made from the plan in that group
      let applied = 0;
      for (const c of applyCandidates) {
        const ok = await confirm({
          title: 'Apply the new time period?',
          message: `Apply the new time period (${dm(c.start)} – ${dm(c.end)}) to the ${c.tasks} uncompleted task${c.tasks === 1 ? '' : 's'} in ${c.name}?`,
          confirmLabel: 'Apply',
          tone: 'primary',
        });
        if (!ok) continue;
        try {
          applied += (await projectsApi.planApply(p.id, [c.taskGroupId])).updated;
        } catch (err) {
          toast.error(errorMessage(err));
        }
      }
      if (applied) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast.success(`New period applied to ${applied} task${applied === 1 ? '' : 's'}`);
      }
    },
    onError: (err) => !err.cancelled && toast.error(errorMessage(err)),
  });

  const saved = useMemo(() => new Set((plan.data?.items ?? []).map((i) => cellKey(i.taskGroupId, i.weekStart))), [plan.data]);
  const cells = draft ?? saved;
  const dirty = draft !== null && (draft.size !== saved.size || [...draft].some((k) => !saved.has(k)));

  if (plan.isLoading) return <Spinner />;
  if (plan.isError) return <ErrorAlert>{errorMessage(plan.error)}</ErrorAlert>;
  const { weeks, groups, estimateGap } = plan.data;

  // the plan follows the estimate: nothing to plan until it is finished
  if (estimateGap) {
    return (
      <div className="card pl-empty">
        <Info />
        <div>
          <b>Finish the estimate to plan the project</b>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {estimateGap}
          </p>
        </div>
      </div>
    );
  }
  if (!weeks.length) {
    return (
      <div className="card pl-empty">
        <Info />
        <p>Set the project&apos;s start date (and end date) on the Project tab to plan it week by week.</p>
      </div>
    );
  }

  const n = weeks.length;
  const today = todayIso();
  // progress against the saved plan: each group's planned span (first week – Friday of the last week) and the work done
  const progressOf = new Map((plan.data.progress ?? []).map((pr) => [pr.taskGroupId, pr]));
  const tasksOf = (gid) => (plan.data.tasks ?? []).filter((t) => t.taskGroupId === gid);
  const spanOf = (gid) => {
    const ws = plan.data.items.filter((i) => i.taskGroupId === gid).map((i) => i.weekStart).sort();
    return ws.length ? { start: ws[0], end: plusDays(ws[ws.length - 1], 4) } : null;
  };
  const weekAt = (date) => {
    const i = weeks.findIndex((w) => date >= w.start && date <= w.end);
    return i >= 0 ? i : date < weeks[0].start ? 0 : n - 1;
  };
  const nowIdx = weeks.findIndex((w) => today >= w.start && today <= w.end);
  const tone = (gid) => TONES[Math.max(0, groups.findIndex((g) => g.id === gid)) % TONES.length];
  const has = (gid, i) => cells.has(cellKey(gid, weeks[i].start));

  // weeks of a group in a row → bars (runs of neighbouring weeks)
  const barsOf = (gid) => {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      if (!has(gid, i)) continue;
      let j = i;
      while (j + 1 < n && has(gid, j + 1)) j += 1;
      out.push({ gid, start: i, end: j });
      i = j;
    }
    return out;
  };

  const edit = (fn) => {
    if (!canEdit) return;
    const next = new Set(cells);
    fn(next);
    setDraft(next);
  };
  const setRange = (next, gid, a, b, on) => {
    for (let i = a; i <= b; i += 1) {
      if (on) next.add(cellKey(gid, weeks[i].start));
      else next.delete(cellKey(gid, weeks[i].start));
    }
  };

  // ---- drag a bar: its right edge / left edge extend or shrink it, the body moves it
  const begin = (e, bar, mode) => {
    if (!canEdit || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const colW = colRef.current?.getBoundingClientRect().width || 60;
    dragRef.current = { ...bar, mode, x0: e.clientX, colW, moved: false };
    setPreview({ gid: bar.gid, from: bar.start, to: bar.end, start: bar.start, end: bar.end });
  };
  const track = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x0) / d.colW);
    let start = d.start;
    let end = d.end;
    if (d.mode === 'right') end = Math.min(n - 1, Math.max(d.start, d.end + delta));
    else if (d.mode === 'left') start = Math.max(0, Math.min(d.end, d.start + delta));
    else {
      const shift = Math.max(-d.start, Math.min(n - 1 - d.end, delta));
      start = d.start + shift;
      end = d.end + shift;
    }
    if (start !== d.start || end !== d.end) d.moved = true;
    d.pv = { start, end };
    setPreview((cur) => (cur && cur.start === start && cur.end === end ? cur : { gid: d.gid, from: d.start, to: d.end, start, end }));
  };
  const finish = (e, commit) => {
    const d = dragRef.current;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setPreview(null);
    if (!d || !commit || !d.moved || !d.pv) return;
    edit((next) => {
      setRange(next, d.gid, d.start, d.end, false);
      setRange(next, d.gid, d.pv.start, d.pv.end, true);
    });
  };
  // keyboard: → extends by a week, ← shrinks by a week, Delete removes
  const keyBar = (e, bar) => {
    if (e.key === 'ArrowRight' && bar.end < n - 1) {
      e.preventDefault();
      edit((next) => setRange(next, bar.gid, bar.end + 1, bar.end + 1, true));
    } else if (e.key === 'ArrowLeft' && bar.end > bar.start) {
      e.preventDefault();
      edit((next) => setRange(next, bar.gid, bar.end, bar.end, false));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      edit((next) => setRange(next, bar.gid, bar.start, bar.end, false));
    }
  };

  // month labels over their weeks (by the week's Monday)
  const months = [];
  weeks.forEach((w, i) => {
    const m = w.start.slice(0, 7);
    if (months.length && months[months.length - 1].m === m) months[months.length - 1].len += 1;
    else months.push({ m, start: i, len: 1 });
  });

  return (
    <div className={`gp${canEdit ? '' : ' is-readonly'}`}>
      <div className="gp-card">
        <div className="gp-scroll">
          <div className="gp-grid" style={{ '--n': n }}>
            {/* header: months, then the weeks */}
            <div className="gp-row gp-months">
              <span className="gp-label" />
              {months.map((mo) => (
                <span key={mo.m} className="gp-month" style={{ gridColumn: `${mo.start + 2} / span ${mo.len}` }}>
                  {MONTHS[Number(mo.m.slice(5, 7)) - 1]}
                </span>
              ))}
            </div>
            <div className="gp-row gp-weeks">
              <span className="gp-label">Task group</span>
              {weeks.map((w, i) => (
                <span key={w.start} className={`gp-week${i === nowIdx ? ' is-now' : ''}`} title={`${dm(w.start)} – ${dm(w.end)}`}>
                  <b>W{i + 1}</b>
                  <small>{dm(w.start)}</small>
                </span>
              ))}
            </div>

            {groups.map((g) => {
              const bars = barsOf(g.id);
              const pr = progressOf.get(g.id);
              const span = spanOf(g.id);
              const st = statusOf(pr, span?.start, span?.end, today);
              const taskList = tasksOf(g.id);
              const hidden = !opened.has(g.id);
              return (
                <Fragment key={g.id}>
                <div className="gp-row gp-group" style={{ '--pl-tone': tone(g.id) }}>
                  <span className="gp-label">
                    {taskList.length ? (
                      <button
                        type="button"
                        className="gp-twist"
                        aria-expanded={!hidden}
                        title={hidden ? `Show the ${taskList.length} tasks` : 'Hide the tasks'}
                        onClick={() => setOpened((c) => { const next = new Set(c); if (next.has(g.id)) next.delete(g.id); else next.add(g.id); return next; })}
                      >
                        {hidden ? <ChevronRight /> : <ChevronDown />}
                      </button>
                    ) : null}
                    <span className="gp-gname">
                      <span className="gp-gtitle">
                        <i className="gp-dot" />
                        <b>{g.name}</b>
                        <span className={`badge ${TONE_BADGE[st.tone]}`} title={st.detail ?? undefined}>
                          {st.label}
                        </span>
                      </span>
                      <small>
                        {g.effortPercentage}% of effort{pr?.total ? ` · ${pr.completed}/${pr.total} tasks done` : ' · no tasks yet'}{pr?.loggedMinutes > 0 ? ` · ${fmtMin(pr.loggedMinutes)} logged` : ''}
                      </small>
                      {pr?.total > 0 && (
                        <span className="gp-seg" title={`${pr.completed} completed · ${pr.inProgress} in progress · ${pr.total - pr.completed - pr.inProgress} yet to start`}>
                          <i className="is-done" style={{ width: `${(pr.completed / pr.total) * 100}%` }} />
                          <i className="is-progress" style={{ width: `${(pr.inProgress / pr.total) * 100}%` }} />
                          <i className="is-todo" style={{ width: `${((pr.toDo + pr.hold) / pr.total) * 100}%` }} />
                        </span>
                      )}
                    </span>
                  </span>
                  {weeks.map((w, i) => (
                    <button
                      key={w.start}
                      type="button"
                      ref={g === groups[0] && i === 0 ? colRef : undefined}
                      className={`gp-cell${i === nowIdx ? ' is-now' : ''}${has(g.id, i) ? ' is-taken' : ''}`}
                      style={{ gridColumn: i + 2 }}
                      title={`Plan ${g.name} in ${dm(w.start)} – ${dm(w.end)}`}
                      aria-label={`Plan ${g.name} in the week of ${dm(w.start)}`}
                      onClick={() => edit((next) => setRange(next, g.id, i, i, true))}
                    >
                      <Plus />
                    </button>
                  ))}
                  {(() => {
                    const pr = progressOf.get(g.id);
                    const span = spanOf(g.id);
                    if (!pr?.started) return null;
                    const done = pr.completed === pr.total && pr.finished;
                    const a = weekAt(pr.started);
                    const e = Math.max(a, weekAt(done ? pr.finished : today));
                    const pEnd = span ? weekAt(span.end) : e;
                    const title = `Actual: ${dm(pr.started)} – ${done ? dm(pr.finished) : 'now'} · ${pr.completed}/${pr.total} tasks done`;
                    // the part inside the plan, and what ran past the planned end
                    return (
                      <>
                        {e > pEnd && <div className="gp-actual is-late" style={{ gridColumn: `${Math.max(a, pEnd + 1) + 2} / ${e + 3}` }} title={`${title} – past the planned end`} />}
                      </>
                    );
                  })()}
                  {bars.map((b) => {
                    const dragging = preview && preview.gid === b.gid && preview.from === b.start;
                    const start = dragging ? preview.start : b.start;
                    const end = dragging ? preview.end : b.end;
                    const len = end - start + 1;
                    return (
                      <div
                        key={`${b.gid}-${b.start}`}
                        className={`gp-bar${dragging ? ' is-dragging' : ''}`}
                        style={{ gridColumn: `${start + 2} / ${end + 3}` }}
                        tabIndex={0}
                        title={`${g.name} · ${dm(weeks[start].start)} – ${dm(weeks[end].end)} (${len} wk) – drag the edge to extend, drag the bar to move`}
                        onKeyDown={(e) => keyBar(e, b)}
                      >
                        <span className="gp-grip is-left" onPointerDown={(e) => begin(e, b, 'left')} onPointerMove={track} onPointerUp={(e) => finish(e, true)} onPointerCancel={(e) => finish(e, false)} />
                        <span className="gp-bar-body" onPointerDown={(e) => begin(e, b, 'move')} onPointerMove={track} onPointerUp={(e) => finish(e, true)} onPointerCancel={(e) => finish(e, false)}>
                          {len > 1 && <span className="gp-bar-len">{len} wk</span>}
                        </span>
                        <button type="button" className="gp-x" title="Remove" aria-label={`Remove ${g.name} from these weeks`} onPointerDown={(e) => e.stopPropagation()} onClick={() => edit((next) => setRange(next, b.gid, b.start, b.end, false))}>
                          <X />
                        </button>
                        <span className="gp-grip is-right" onPointerDown={(e) => begin(e, b, 'right')} onPointerMove={track} onPointerUp={(e) => finish(e, true)} onPointerCancel={(e) => finish(e, false)} />
                      </div>
                    );
                  })}
                </div>
                {!hidden &&
                  taskList.map((t) => {
                    const ts = taskStatus(t, today);
                    const dated = t.plannedStart && t.plannedEnd && !t.isContinuous;
                    // where the task is: the weeks it has been worked on (from when it started to when it was completed, or
                    // to today); a task that has not started yet shows its planned weeks
                    const worked = [t.started, ...(t.logs ?? []).map((l) => l.date)].filter(Boolean).sort();
                    let pa = null;
                    let pb = null;
                    if (worked.length) {
                      const last = worked[worked.length - 1];
                      pa = weekAt(worked[0]);
                      pb = Math.max(pa, weekAt(t.finished ?? (t.status === 'in_progress' && today > last ? today : last)));
                    } else if (dated) {
                      pa = weekAt(t.plannedStart);
                      pb = Math.max(pa, weekAt(t.plannedEnd));
                    }
                    return (
                      <div key={t.id} className="gp-row gp-task">
                        <span className="gp-label">
                          <span className="gp-tinfo">
                            <Link className="gp-tname" to={`/tasks/${t.id}`} title={t.name}>
                              {t.name}
                            </Link>
                            <span className="gp-tperson">
                              <i>{(t.assignedToName ?? '?').trim().charAt(0).toUpperCase()}</i>
                              {t.assignedToName ?? 'Unassigned'}
                            </span>
                          </span>
                          <span className={`gp-pill is-${ts.key}`}>{ts.label}</span>
                        </span>
                        {weeks.map((w, i) => (
                          <span key={w.start} className={`gp-tcell${i === nowIdx ? ' is-now' : ''}`} style={{ gridColumn: i + 2 }} />
                        ))}
                        {pa !== null && (
                          <div
                            className={`gp-tbar is-${ts.key}${ts.late ? ' is-late' : ''}`}
                            style={{ gridColumn: `${pa + 2} / ${pb + 3}` }}
                            title={`${t.name} · ${ts.label}${ts.late ? ' (past the planned end)' : ''}${dated ? ` · planned ${dm(t.plannedStart)} – ${dm(t.plannedEnd)}` : ''}${t.started ? ` · started ${dm(t.started)}` : ''}${t.finished ? ` · completed ${dm(t.finished)}` : ''}${t.loggedMinutes ? ` · ${fmtMin(t.loggedMinutes)} logged` : ''}`}
                          >
                            {ts.key === 'done' && <Check />}
                            {t.loggedMinutes > 0 && <span className="gp-thrs">{shortMin(t.loggedMinutes)}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
      <div className="gp-legend">
        <span>
          <i className="is-done" /> Completed
        </span>
        <span>
          <i className="is-progress" /> In progress
        </span>
        <span>
          <i className="is-todo" /> Yet to start
        </span>
        <span className="muted small">A task bar shows where the task is: yet to start = its planned weeks, in progress = from when it started until today, completed = from when it started until it was done. {canEdit ? 'Click a week to plan a task group · drag a group bar\'s edge to extend it, drag the bar to move it.' : 'Your role can view the plan but not change it.'}</span>
      </div>

      {canEdit && (
      <div className="form-bar">
        <span className="note">
          <Cloud />
          {dirty ? 'You have unsaved changes to the plan' : 'The plan is saved'}
        </span>
        <div className="actions">
          <button type="button" className="btn btn-secondary" disabled={!dirty || save.isPending} onClick={() => setDraft(null)}>
            Reset
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate([...cells].map((k) => ({ taskGroupId: Number(k.split('|')[0]), weekStart: k.split('|')[1] })))}
          >
            <Check />
            {save.isPending ? 'Saving…' : 'Save plan'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
