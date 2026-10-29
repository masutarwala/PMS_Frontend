import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { TASK_STATUS } from '@/lib/constants';
import { todayIso } from '@/lib/timezone';
import { StatusBadge } from './TaskListPage';

/**
 * Confirms a task status change. Completing asks for the completed date (required, today by default).
 *   change = { task, status } | null
 *   onConfirm({ status, completedOn })
 */
export function StatusChangeModal({ change, busy, onClose, onConfirm }) {
  // the form state starts fresh for every change (keyed by task + status)
  return change ? <Dialog key={`${change.task.id}-${change.status}`} change={change} busy={busy} onClose={onClose} onConfirm={onConfirm} /> : <Modal open={false} />;
}

function Dialog({ change, busy, onClose, onConfirm }) {
  const { task, status } = change;
  const completing = status === 'completed';
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState(null);

  const confirm = () => {
    if (completing && !date) {
      setError('Select the completed date');
      return;
    }
    onConfirm({ status, ...(completing ? { completedOn: date } : {}) });
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={completing ? 'Complete task?' : 'Change status?'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
            <Check />
            {busy ? 'Saving…' : completing ? 'Mark completed' : `Set to ${TASK_STATUS[status].label}`}
          </button>
        </>
      }
    >
      <p className="text-2" style={{ marginTop: 0 }}>
        <b>{task.name}</b>
      </p>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '12px 0' }}>
        <StatusBadge status={task.status} />
        <ArrowRight style={{ width: 16, height: 16 }} />
        <StatusBadge status={status} />
      </div>
      {completing ? (
        <Field label="Completed date" required error={error} help="the day the work was finished">
          <DatePicker
            value={date}
            clearable={false}
            max={todayIso()}
            onChange={(v) => {
              setDate(v);
              setError(null);
            }}
          />
        </Field>
      ) : (
        task.status === 'completed' && <p className="muted small">The task is reopened and its completed date is cleared.</p>
      )}
    </Modal>
  );
}
