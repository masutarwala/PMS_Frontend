import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightToLine,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  Copy,
  GripVertical,
  CornerDownRight,
  Timer,
  ListPlus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { task135Api, tasksApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dropdown } from '@/components/ui/Dropdown';
import { Checkbox, Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { RowMenu } from '@/components/ui/ColumnPicker';
import { Spinner } from '@/components/ui/Loader';
import { useConfirm } from '@/components/ui/confirm-context';
import { useToast } from '@/components/ui/toast-context';
import { SCREENS, TASK_STATUS } from '@/lib/constants';
import { blockNonNumericKeys } from '@/lib/percent';
import { formatDayMonth } from '@/lib/format';
import { todayIso } from '@/lib/timezone';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMinutes, PriorityBadge, TaskTimeline } from './TaskListPage';
import { TaskTabs } from './TaskTabs';
import { LogTimeModal } from '@/pages/timesheet/LogTimeModal';

/*
 * 1-3-5 planner: plan each day as 1 big, 3 medium and 5 small things (9 slots). Add tasks from the
 * Task list (⋯ → Add to 1-3-5) or type quick items here; drag to reorder; log the time and tick done
 * (planner only – the task's own status is not changed); move or copy an item to another day.
 */

const GROUPS = [
  {
    from: 1,
    to: 1,
    size: 'big',
    label: '1 big task – the one thing that matters most today',
  },
  { from: 2, to: 4, size: 'medium', label: '3 medium tasks' },
  { from: 5, to: 9, size: 'small', label: '5 small tasks' },
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const shift = (iso, days) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dayName = (iso) => DAYS[parse(iso).getUTCDay()];
const longDate = (iso) => {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Move or copy an item to another day: pick the date (tomorrow of the shown day by default, not in the past). */
function MoveModal({ job, today, onClose, onSave, busy }) {
  const [to, setTo] = useState(() => (job ? (shift(job.from, 1) < today ? today : shift(job.from, 1)) : ''));
  if (!job) return <Modal open={false} />;
  const copy = job.mode === 'copy';
  const same = to === job.from;
  const quick = [
    ['Today', today],
    ['Tomorrow', shift(today, 1)],
    ['Day after', shift(today, 2)],
  ].filter(([, d]) => d !== job.from);
  return (
    <Modal
      open
      title={copy ? 'Copy to another day' : 'Move to another day'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !to || same} onClick={() => onSave(to)}>
            {copy ? <Copy /> : <ArrowRightToLine />}
            {busy ? (copy ? 'Copying…' : 'Moving…') : copy ? 'Copy' : 'Move'}
          </button>
        </>
      }
    >
      <div className="t135-tm-task">
        <span className="t135-tm-ico">{copy ? <Copy /> : <ArrowRightToLine />}</span>
        <div>
          <span className="t135-tm-label">
            {copy ? 'Copy' : 'Move'} from {longDate(job.from)}
          </span>
          <b>{job.item.title}</b>
        </div>
      </div>
      <label className="t135-mv-label" htmlFor="t135-move-date">
        {copy ? 'Copy to' : 'Move to'}
      </label>
      <DatePicker id="t135-move-date" value={to} min={today} clearable={false} onChange={(v) => setTo(v ?? '')} />
      <div className="t135-tm-chips" style={{ marginTop: 12 }}>
        {quick.map(([label, d]) => (
          <button key={label} type="button" className={`t135-tm-chip${to === d ? ' is-on' : ''}`} onClick={() => setTo(d)}>
            {label}
          </button>
        ))}
      </div>
      <p className="t135-tm-note">
        {same
          ? 'Pick another day – this is the day it is on.'
          : copy
            ? 'A copy goes to the end of that day (time starts at 0); this day keeps the item.'
            : 'It goes to the end of that day and leaves this day.'}
      </p>
    </Modal>
  );
}

/** Time spent on an item: hours + minutes, quick-add chips, total. */
function TimeModal({ item, onClose, onSave, busy }) {
  const [total, setTotal] = useState(item?.minutes ?? 0); // minutes
  if (!item) return <Modal open={false} />;
  return (
    <Modal
      open
      title="Time spent"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave(total)}>
            <Check />
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="t135-tm-task">
        <span className="t135-tm-ico">
          <Clock3 />
        </span>
        <div>
          <span className="t135-tm-label">Task</span>
          <b>{item.title}</b>
        </div>
      </div>

      <div className="t135-tm-grid">
        <label className="t135-tm-field">
          <span>Minutes</span>
          <input
            type="number"
            min="0"
            max="1440"
            step="1"
            inputMode="numeric"
            value={total || ''}
            placeholder="0"
            onKeyDown={(e) => {
              blockNonNumericKeys(e);
              if (e.key === '.' || e.key === ',') e.preventDefault(); // whole minutes only
            }}
            onChange={(e) => setTotal(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
            autoFocus
          />
        </label>
      </div>

      <div className="t135-tm-chips">
        {[15, 30, 60, 120].map((add) => (
          <button key={add} type="button" className="t135-tm-chip" onClick={() => setTotal((t) => Math.min(1440, t + add))}>
            +{add < 60 ? `${add} min` : `${add / 60} h`}
          </button>
        ))}
        <button type="button" className="t135-tm-chip is-clear" disabled={!total} onClick={() => setTotal(0)}>
          Clear
        </button>
      </div>

      <div className="t135-tm-total">
        <span>Total</span>
        <b>{total ? formatMinutes(total) : '0 min'}</b>
      </div>
      <p className="t135-tm-note">Only for this 1-3-5 – the task and the timesheet are not changed.</p>
    </Modal>
  );
}

/**
 * Pick my open tasks for the day (ongoing tasks are left out) – tick as many as fit, then "Add to the day".
 * The task itself can be ticked; a task with open subtasks also opens a drawer below it to tick subtasks.
 * "Add task" opens the task creation page.
 */
function TaskPicker({ open, onClose, onSave, saving, takenTasks, takenSubtasks, slotsLeft }) {
  const { user } = useAuth();
  const canCreate = usePermissions(SCREENS.TASKS).create;
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState(() => new Set()); // task ids whose subtask drawer is open
  const [picked, setPicked] = useState(() => new Map()); // 't<id>' / 's<id>' -> { body, show }
  const q = useDebounce(search.trim(), 300); // ask the server once typing stops
  // "mine" = assigned to me, owned by me or in a project I own (no need to load everyone's tasks);
  // the lists stay cached for a minute, so opening the picker again is instant
  const tasks = useQuery({
    queryKey: ['tasks', 'list', 'picker-135', q],
    queryFn: () =>
      tasksApi.list({
        scope: 'mine',
        assignedTo: [user.id],
        status: ['to_do', 'in_progress', 'hold'],
        search: q,
        pageSize: 100,
        sortBy: 'priority',
      }),
    enabled: open,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const subtasks = useQuery({
    queryKey: ['task-135-picker', 'subtasks'],
    queryFn: () => task135Api.subtasks(''),
    enabled: open,
    staleTime: 60_000,
  });
  // only tasks assigned to me go on my 1-3-5 (the project owner plans others from the Task list); not the ongoing ones
  const subsOf = (taskId) => (subtasks.data ?? []).filter((x) => x.taskId === taskId && !takenSubtasks.includes(x.id));
  const taskItems = (tasks.data?.items ?? [])
    .filter((t) => t.assignedTo === user.id && !t.isContinuous)
    .map((t) => ({ t, subs: subsOf(t.id) }))
    // a task already on the day stays only while it has a subtask left to pick
    .filter(({ t, subs }) => !takenTasks.includes(t.id) || subs.length > 0);
  const reached = picked.size >= slotsLeft;

  const toggle = (key, entry) =>
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(key)) next.delete(key);
      else if (next.size < slotsLeft) next.set(key, entry);
      return next;
    });
  const toggleOpen = (id) =>
    setOpened((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const taskEntry = (t) => ({ body: { taskId: t.id }, show: { kind: 'task', title: t.name, linkTaskId: t.id, taskPriority: t.priority, projectId: t.projectId, projectCode: t.projectCode } });
  const subEntry = (x) => ({
    body: { subtaskId: x.id },
    show: { kind: 'subtask', title: x.title, linkTaskId: x.taskId, parentTaskName: x.taskName, taskPriority: x.priority, projectCode: x.projectCode },
  });
  const stop = (e) => e.stopPropagation();
  const onKey = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <Modal
      open={open}
      size="lg"
      title="Add task"
      onClose={onClose}
      footer={
        <>
          <span className="t135-pick-count">
            {picked.size ? `${picked.size} selected` : 'Select the tasks for this day'}
            {` · ${slotsLeft} ${slotsLeft === 1 ? 'slot' : 'slots'} left`}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!picked.size || saving} onClick={() => onSave([...picked.values()])}>
            <Check />
            {saving ? 'Adding…' : 'Add to the day'}
          </button>
        </>
      }
    >
      <div className="t135-add-body">
        <div className="t135-add-tools">
          <div className="input-group search">
            <Search />
            <input className="input" placeholder="Search open tasks…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
          {canCreate && (
            <Link className="btn btn-secondary" to="/tasks/new">
              <Plus />
              Add task
            </Link>
          )}
        </div>
        <div className="t135-picker">
          {tasks.isLoading ? (
            <Spinner />
          ) : !taskItems.length ? (
            <p className="muted small">
              No open tasks assigned to you
              {search ? ` match “${search}”` : ''}.
            </p>
          ) : (
            taskItems.map(({ t, subs }) => {
              const hasSubs = subs.length > 0;
              const isOpen = hasSubs && opened.has(t.id);
              const key = `t${t.id}`;
              const chosenSubs = subs.filter((x) => picked.has(`s${x.id}`)).length;
              const onDay = takenTasks.includes(t.id);
              const on = picked.has(key) || chosenSubs > 0;
              const act = () => !onDay && toggle(key, taskEntry(t)); // the main task itself – subtasks are optional
              return (
                <div key={t.id} className={`t135-pick-group${on ? ' is-on' : ''}`}>
                  <div className="t135-pick" role="button" tabIndex={0} onClick={act} onKeyDown={onKey(act)}>
                    <span onClick={stop}>
                      <Checkbox checked={picked.has(key) || onDay} disabled={onDay || (!picked.has(key) && reached)} title={onDay ? 'Already on this day' : undefined} onChange={act} />
                    </span>
                    <span className="t135-pick-main">
                      <span className="t135-pick-title">
                        <b>{t.name}</b>
                        {hasSubs && (
                          <span className="t135-pick-subcount" title="Open subtasks">
                            <CornerDownRight />
                            {subs.length} subtask{subs.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      <span className="t135-pick-sub">{t.projectCode ? `${t.projectCode} · ${t.projectTitle}` : t.categoryName}</span>
                    </span>
                    {chosenSubs > 0 && <span className="badge badge-success">{chosenSubs} subtask{chosenSubs === 1 ? '' : 's'}</span>}
                    {t.plannedEnd && (
                      <span className="t135-pick-when">
                        <TaskTimeline task={t} />
                      </span>
                    )}
                    <PriorityBadge priority={t.priority} />
                    {hasSubs && (
                      <button
                        type="button"
                        className="t135-pick-chev"
                        aria-expanded={isOpen}
                        title={isOpen ? 'Hide the subtasks' : 'Choose subtasks'}
                        onClick={(e) => {
                          stop(e);
                          toggleOpen(t.id);
                        }}
                      >
                        {isOpen ? <ChevronDown /> : <ChevronRight />}
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="t135-subs">
                      <span className="t135-subs-label">Or pick specific subtasks</span>
                      {subs.map((x) => {
                        const sk = `s${x.id}`;
                        const toggleSub = () => toggle(sk, subEntry(x));
                        return (
                          <div key={x.id} className="t135-subrow" role="button" tabIndex={0} onClick={toggleSub} onKeyDown={onKey(toggleSub)}>
                            <span onClick={stop}>
                              <Checkbox checked={picked.has(sk)} disabled={!picked.has(sk) && reached} onChange={toggleSub} />
                            </span>
                            <span className="t135-pick-main">
                              <b>{x.title}</b>
                            </span>
                            {x.dueDate && <span className="t135-pick-when muted">Due {formatDayMonth(x.dueDate)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Task135Page() {
  const perms = usePermissions(SCREENS.TASK_135);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => todayIso());
  const [timeFor, setTimeFor] = useState(null);
  const [picking, setPicking] = useState(false);
  const canLog = usePermissions(SCREENS.TIMESHEET).create; // "Log time" on task / subtask items of a project
  const [logFor, setLogFor] = useState(null);
  const [moving, setMoving] = useState(null); // { item, mode, from } waiting for a date
  const dragId = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const key = ['task-135', date];
  const day = useQuery({
    queryKey: key,
    queryFn: () => task135Api.day(date),
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => day.data?.items ?? [], [day.data]);
  const today = day.data?.today ?? todayIso();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['task-135'] });
  const fail = (err) => toast.error(errorMessage(err));

  // add the ticked tasks / subtasks of the picker one after the other, so each gets the next slot
  const addMany = useMutation({
    mutationFn: async (entries) => {
      for (const { body } of entries) await task135Api.add({ date, ...body });
    },
    onSuccess: (_, entries) => {
      toast.success(`${entries.length} ${entries.length === 1 ? 'item' : 'items'} added to the day`);
      setPicking(false);
    },
    onError: fail,
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }) => task135Api.update(id, body),
    onSuccess: refresh,
    onError: fail,
  });
  const reorder = useMutation({
    mutationFn: (ids) => task135Api.reorder(date, ids),
    onSuccess: (d) => queryClient.setQueryData(key, d),
    onError: (e) => {
      fail(e);
      refresh();
    },
  });
  const move = useMutation({
    mutationFn: ({ id, mode, to }) => task135Api.move(id, to, mode),
    onSuccess: (r, { mode, to }) => {
      setMoving(null);
      refresh();
      toast.success(`${mode === 'copy' ? 'Copied' : 'Moved'} to ${to === shift(today, 1) ? 'tomorrow' : longDate(to)}`);
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id) => task135Api.remove(id),
    onSuccess: refresh,
    onError: fail,
  });

  const askRemove = async (it) => {
    if (
      await confirm({
        title: 'Remove from 1-3-5?',
        message: `"${it.title}" is removed from this day's 1-3-5. The task itself is not changed.`,
        confirmLabel: 'Remove',
      })
    )
      remove.mutate(it.id);
  };

  // ticking and un-ticking an item both ask first
  const toggleDone = async (it, isDone) => {
    const ok = await confirm({
      title: isDone ? 'Mark as complete?' : 'Mark as not complete?',
      message: isDone ? `"${it.title}" is marked done for this day's 1-3-5.` : `"${it.title}" goes back to pending on this day's 1-3-5.`,
      confirmLabel: isDone ? 'Mark complete' : 'Mark not complete',
      tone: 'primary',
    });
    if (ok) update.mutate({ id: it.id, isDone });
  };

  // drag a row onto another to put it there
  const dropOn = (targetId) => {
    const from = dragId.current;
    dragId.current = null;
    setDragOver(null);
    if (!from || from === targetId) return;
    const ids = items.map((i) => i.id).filter((x) => x !== from);
    ids.splice(ids.indexOf(targetId) + (items.findIndex((i) => i.id === from) < items.findIndex((i) => i.id === targetId) ? 1 : 0), 0, from);
    queryClient.setQueryData(key, {
      ...day.data,
      items: ids.map((id, i) => ({
        ...items.find((x) => x.id === id),
        position: i + 1,
      })),
    });
    reorder.mutate(ids);
  };

  const done = items.filter((i) => i.isDone).length;
  const minutes = items.reduce((s, i) => s + i.minutes, 0);
  const canEdit = perms.edit;
  const full = items.length >= 9;

  const row = (pos) => {
    const it = items[pos - 1];
    if (!it) {
      // first empty slot: type a quick item or pick a task; the others are placeholders
      // the first free slot: the Add task button (a picked / new task goes there); the others open it too
      if (pos === items.length + 1 && perms.create) {
        return (
          <div key={`e${pos}`} className="t135-row is-empty is-add">
            <span className="t135-no">{pos}</span>
            <button type="button" className="t135-add" onClick={() => setPicking(true)}>
              <Plus />
              Add task
            </button>
          </div>
        );
      }
      return (
        <div key={`e${pos}`} className={`t135-row is-empty${perms.create ? ' is-clickable' : ''}`} onClick={perms.create ? () => setPicking(true) : undefined}>
          <span className="t135-no">{pos}</span>
          <span className="t135-placeholder">Add task</span>
        </div>
      );
    }
    return (
      <div
        key={it.id}
        className={`t135-row${it.isDone ? ' is-done' : ''}${dragOver === it.id ? ' is-over' : ''}${it.pending ? ' is-pending' : ''}`}
        draggable={canEdit && !it.pending}
        onDragStart={(e) => {
          dragId.current = it.id;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(it.id));
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(it.id);
        }}
        onDragLeave={() => setDragOver((x) => (x === it.id ? null : x))}
        onDrop={(e) => {
          e.preventDefault();
          dragId.current = dragId.current ?? Number(e.dataTransfer.getData('text/plain'));
          dropOn(it.id);
        }}
      >
        {canEdit && (
          <span className="t135-grip" title="Drag to reorder">
            <GripVertical />
          </span>
        )}
        <span className="t135-no">{pos}</span>
        <Checkbox checked={it.isDone} disabled={!canEdit || it.pending} title={it.isDone ? 'Mark not done' : 'Mark done'} onChange={(v) => toggleDone(it, v)} />
        {/* item: title, and below it where it comes from */}
        <div className="t135-main">
          <div className="t135-title">
            {it.linkTaskId ? (
              <Link to={`/tasks/${it.linkTaskId}`} state={{ from: SCREENS.TASK_135 }}>
                {it.title}
              </Link>
            ) : (
              <span>{it.title}</span>
            )}
          </div>
          <div className="t135-sub">
            {it.kind === 'note' ? (
              <span>Quick item</span>
            ) : (
              <>
                <span className={`t135-kind is-${it.kind}`}>{it.kind === 'subtask' ? 'Subtask' : 'Task'}</span>
                {it.kind === 'subtask' && (
                  <span title="Parent task">
                    of <b className="t135-parent">{it.parentTaskName}</b>
                  </span>
                )}
                {(it.projectTitle ?? it.projectCode) && <span title={it.projectCode ?? undefined}>{it.projectTitle ?? it.projectCode}</span>}
              </>
            )}
            {it.addedByName && <span className="t135-added">added by {it.addedByName}</span>}
          </div>
        </div>
        <span className="t135-col is-status">
          <span className={`t135-state${it.isDone ? ' is-done' : ''}`}>
            {it.isDone ? <CheckCircle2 /> : <Circle />}
            {it.isDone ? 'Done' : 'Pending'}
          </span>
        </span>
        <span className="t135-col is-time">
          <button type="button" className={`t135-time${it.minutes ? ' has-time' : ''}`} disabled={!canEdit || it.pending} onClick={() => setTimeFor(it)} title="Time spent">
            <Clock3 />
            {it.minutes ? formatMinutes(it.minutes) : 'Add time'}
          </button>
        </span>
        {canEdit && !it.pending && (
          <RowMenu
            items={[
              {
                label: 'Move to…',
                icon: ArrowRightToLine,
                onClick: () => setMoving({ item: it, mode: 'move', from: date }),
              },
              {
                label: 'Copy to…',
                icon: Copy,
                onClick: () => setMoving({ item: it, mode: 'copy', from: date }),
              },
              {
                label: 'Add to timesheet',
                icon: Timer,
                hidden: !canLog || it.kind === 'note', // a task / subtask (quick notes have nothing to log on)
                onClick: () =>
                  setLogFor({
                    taskId: it.linkTaskId,
                    projectId: it.projectId,
                    categoryId: it.categoryId,
                    title: it.kind === 'subtask' ? it.parentTaskName : it.title,
                    subtaskTitle: it.kind === 'subtask' ? it.title : undefined,
                    minutes: it.minutes || undefined,
                    date,
                  }),
              },
              { divider: true, hidden: !perms.delete },
              {
                label: 'Remove',
                icon: Trash2,
                danger: true,
                hidden: !perms.delete,
                onClick: () => askRemove(it),
              },
            ]}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <Topbar title="Task" breadcrumb={['Task', '1-3-5']} />

      <div className="page-head">
        <TaskTabs active="135" />
      </div>

      {/* day header: back-to-today on the left, the day in the centre, the day's numbers on the right */}
      <div className="card t135-head">
        <div className="t135-head-left">
          {date !== today && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(today)}>
              <CalendarDays />
              Today
            </button>
          )}
        </div>
        <div className="t135-nav">
          <button type="button" className="icon-btn" title="Previous day" onClick={() => setDate((d) => shift(d, -1))}>
            <ChevronLeft />
          </button>
          <div className="t135-day">
            <b>{date === today ? 'Today' : date === shift(today, 1) ? 'Tomorrow' : date === shift(today, -1) ? 'Yesterday' : dayName(date)}</b>
            <span>
              {dayName(date)}, {longDate(date)}
            </span>
          </div>
          <button type="button" className="icon-btn" title="Next day" onClick={() => setDate((d) => shift(d, 1))}>
            <ChevronRight />
          </button>
        </div>
        <div className="t135-stats">
          <span>
            <b>{items.length}</b>/9 planned
          </span>
          <span>
            <b>{done}</b> done
          </span>
          <span>
            <b>{formatMinutes(minutes || null)}</b> spent
          </span>
        </div>
      </div>

      <div className="card t135-card">
        {day.isLoading ? (
          <Spinner />
        ) : (
          <>
            {/* column headings, lined up with the item rows */}
            <div className={`t135-cols-head${canEdit ? ' can-edit' : ''}`}>
              <span className="t135-col is-item">Item</span>
              <span className="t135-col is-status">Status</span>
              <span className="t135-col is-time">Effort</span>
              {canEdit && <span className="t135-col is-menu" />}
            </div>
            {/* each group (big / medium / small) has its own colour */}
            {GROUPS.map((g) => (
              <section key={g.label} className={`t135-group is-${g.size}`} title={g.label}>
                {Array.from({ length: g.to - g.from + 1 }, (_, k) => row(g.from + k))}
              </section>
            ))}
          </>
        )}
        {full && (
          <p className="muted small" style={{ margin: '10px 4px 0' }}>
            The day is full – move or remove an item to add another.
          </p>
        )}
      </div>

      <LogTimeModal job={logFor} onClose={() => setLogFor(null)} />
      <MoveModal
        key={moving ? `${moving.item.id}-${moving.mode}` : 'none'}
        job={moving}
        today={today}
        busy={move.isPending}
        onClose={() => setMoving(null)}
        onSave={(to) => move.mutate({ id: moving.item.id, mode: moving.mode, to })}
      />
      <TimeModal
        key={timeFor?.id ?? 'none'}
        item={timeFor}
        busy={update.isPending}
        onClose={() => setTimeFor(null)}
        onSave={(m) => update.mutate({ id: timeFor.id, minutes: m }, { onSuccess: () => setTimeFor(null) })}
      />
      <TaskPicker
        key={picking ? 'open' : 'closed'} // opens on Assigned tasks every time
        open={picking}
        takenTasks={items.filter((i) => i.taskId).map((i) => i.taskId)}
        takenSubtasks={items.filter((i) => i.subtaskId).map((i) => i.subtaskId)}
        onClose={() => setPicking(false)}
        slotsLeft={Math.max(0, 9 - items.length)}
        saving={addMany.isPending}
        onSave={(entries) => addMany.mutate(entries)}
      />
    </>
  );
}
