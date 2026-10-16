import { PROJECT_STATUS } from '@/lib/constants';

/** "Stage: Draft → Analysis" from an audit log entry (older entries only logged the status). */
export function stageChange(changes) {
  const stage = changes?.stage;
  if (stage) return `Stage: ${stage.old ?? '—'} → ${stage.new ?? '—'}`;
  const status = changes?.status;
  if (status) return `Status: ${PROJECT_STATUS[status.old]?.label ?? status.old} → ${PROJECT_STATUS[status.new]?.label ?? status.new}`;
  return null;
}
