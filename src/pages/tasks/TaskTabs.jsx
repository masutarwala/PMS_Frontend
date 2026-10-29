import { ListOrdered, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePermissions } from '@/auth/auth-context';
import { SCREENS } from '@/lib/constants';

/**
 * The Task page tabs: My tasks / All tasks (the task list, /tasks) and 1-3-5 (the day planner, /task-135).
 * On the list, `onScope` switches the list in place; from the planner a scope tab opens the list on it.
 */
export function TaskTabs({ active, onScope }) {
  const navigate = useNavigate();
  const can135 = usePermissions(SCREENS.TASK_135).view;
  const canTasks = usePermissions(SCREENS.TASKS).view;
  const tabs = [
    ...(canTasks ? [['mine', 'My tasks', UserRound]] : []),
    ...(canTasks ? [['all', 'All tasks', Users]] : []), // everything I can see (my projects, role scope, Task Master)
    ...(can135 ? [['135', '1-3-5', ListOrdered]] : []),
  ];
  const open = (key) => {
    if (key === active) return;
    if (key === '135') navigate('/task-135');
    else if (onScope) onScope(key);
    else navigate('/tasks', { state: { scope: key } });
  };
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([key, label, Icon]) => (
        <button key={key} type="button" role="tab" aria-selected={active === key} className={`tab${active === key ? ' is-active' : ''}`} onClick={() => open(key)}>
          <span className="tab-ico">
            <Icon />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
