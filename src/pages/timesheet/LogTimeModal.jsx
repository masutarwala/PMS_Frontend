import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Info, Timer } from 'lucide-react';
import { timesheetsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { blockNonNumericKeys } from '@/lib/percent';
import { formatDayMonth } from '@/lib/format';
import { todayIso } from '@/lib/timezone';

const QUICK = [15, 30, 60];
const hm = (min) => [Math.floor(min / 60) && `${Math.floor(min / 60)} h`, min % 60 && `${min % 60} min`].filter(Boolean).join(' ');

/**
 * Quick "Add to timesheet" for a task (from the task list, the task page or the 1-3-5): a small popup where
 * everything comes from the task (shown read-only) and only the time spent, in minutes, is entered.
 *   project task  → project time (task group / type of the project estimate), billable
 *   other task    → time of its category (Personal, Activity …), no project, not billable
 * Day: the 1-3-5 day it was opened from (not in the future), else today. Opens when `job` is set:
 *   { taskId, projectId?, categoryId?, title, subtaskTitle?, minutes?, date? }
 */
export function LogTimeModal({ job, onClose }) {
  if (!job) return <Modal open={false} />;
  return <LogTimeForm key={`${job.taskId}-${job.subtaskTitle ?? ''}-${job.date ?? ''}`} job={job} onClose={onClose} />;
}

function LogTimeForm({ job, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = todayIso();
  const date = job.date && job.date <= today ? job.date : today;
  const comment = job.subtaskTitle ?? job.title ?? '';
  const isProject = Boolean(job.projectId);
  // project tasks: my projects with their estimate groups; other tasks: categories and my own tasks
  const options = useQuery({ queryKey: ['timesheets', 'options'], queryFn: timesheetsApi.options, enabled: isProject });
  const meta = useQuery({ queryKey: ['timesheets', 'meta'], queryFn: timesheetsApi.meta, enabled: !isProject });
  const loaded = isProject ? options : meta;
  const [minutes, setMinutes] = useState(job.minutes ? String(job.minutes) : '');
  const [tried, setTried] = useState(false);

  let facts = [];
  let body = null;
  let blocked = null;
  if (loaded.isSuccess && isProject) {
    const project = options.data.find((p) => p.id === job.projectId);
    const task = project?.tasks.find((t) => t.id === job.taskId);
    // the task's group / type count only when the group is in the project estimate
    const group = project?.taskGroups.find((g) => g.id === task?.taskGroupId);
    const type = group?.taskTypes.find((t) => t.id === task?.taskTypeId);
    if (!project || !task) blocked = 'Only the person the task is assigned to, on the project, can log time on it.';
    else if (!group || !type) blocked = "The task has no task group / type of the project's estimate – set them on the task first.";
    else {
      facts = [
        ['Project', project.title],
        ['Task group / type', `${group.name} · ${type.name}`],
      ];
      body = { projectId: project.id, taskGroupId: group.id, taskTypeId: type.id, isBillable: true };
    }
  } else if (loaded.isSuccess) {
    const task = meta.data.tasks.find((t) => t.id === job.taskId);
    const category = meta.data.categories.find((c) => c.id === (task?.categoryId ?? job.categoryId));
    const group = meta.data.taskGroups.find((g) => g.id === task?.taskGroupId);
    const type = group?.taskTypes.find((t) => t.id === task?.taskTypeId);
    if (!task) blocked = 'Only the person the task is assigned to can log time on it.';
    else {
      facts = [
        ['Category', category?.name ?? '—'],
        ['Task group / type', group && type ? `${group.name} · ${type.name}` : '—'],
      ];
      body = { categoryId: task.categoryId ?? job.categoryId, projectId: null, taskGroupId: group && type ? group.id : null, taskTypeId: group && type ? type.id : null, isBillable: false };
    }
  }
  const total = Number(minutes) || 0;

  const save = useMutation({
    mutationFn: () => timesheetsApi.create({ workDate: date, taskId: job.taskId, minutes: total, comment, ...body }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`${hm(saved.minutes)} added to the timesheet for ${date === today ? 'today' : formatDayMonth(date)}`);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const timeError = !total ? 'Enter the minutes spent' : total > 1440 ? 'At most 1440 minutes (24 h)' : null;
  const submit = () => {
    setTried(true);
    if (!timeError && body) save.mutate();
  };

  return (
    <Modal
      open
      title="Add to timesheet"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={save.isPending || !body} onClick={submit}>
            <Check />
            {save.isPending ? 'Adding…' : 'Add'}
          </button>
        </>
      }
    >
      <div className="t135-tm-task">
        <span className="t135-tm-ico">
          <Timer />
        </span>
        <div>
          <span className="t135-tm-label">{job.subtaskTitle ? 'Subtask' : 'Task'}</span>
          <b>{job.subtaskTitle ?? job.title}</b>
          {job.subtaskTitle && <span className="small muted">of {job.title}</span>}
        </div>
      </div>

      {loaded.isLoading ? (
        <Spinner />
      ) : loaded.isError ? (
        <div className="alert alert-warning">
          <Info />
          <div>{errorMessage(loaded.error)}</div>
        </div>
      ) : blocked ? (
        <div className="alert alert-warning">
          <Info />
          <div>{blocked}</div>
        </div>
      ) : (
        <>
          <dl className="lt-facts">
            {facts.map(([k, v]) => (
              <span key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </span>
            ))}
            <dt>Day</dt>
            <dd>{date === today ? `Today, ${formatDayMonth(date)}` : formatDayMonth(date)}</dd>
          </dl>

          <label className="lt-minutes">
            <span>Time spent (minutes)</span>
            <div className="lt-min-row">
              <div className="input-group">
                <input
                  className="input has-trail"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
                  value={minutes}
                  onKeyDown={(e) => {
                    blockNonNumericKeys(e);
                    if (e.key === '.' || e.key === ',') e.preventDefault();
                    if (e.key === 'Enter') submit();
                  }}
                  onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <span className="trail">mins</span>
              </div>
              {QUICK.map((add) => (
                <button key={add} type="button" className="t135-tm-chip" onClick={() => setMinutes(String(Math.min(1440, total + add)))}>
                  +{add}
                </button>
              ))}
            </div>
            <small className={tried && timeError ? 'lt-error' : 'muted'}>{tried && timeError ? timeError : total ? `= ${hm(total)}` : 'e.g. 90 = 1 h 30 min'}</small>
          </label>
        </>
      )}
    </Modal>
  );
}
