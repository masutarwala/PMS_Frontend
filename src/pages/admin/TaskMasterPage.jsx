import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Lock, Search, Users } from 'lucide-react';
import { taskAccessApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { Avatar, ErrorAlert } from '@/components/ui/Display';
import { Checkbox } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { SCREENS } from '@/lib/constants';

const match = (u, q) => !q || `${u.name} ${u.username} ${u.roleName ?? ''}`.toLowerCase().includes(q.toLowerCase());

/**
 * Task Master: per person, the employees whose tasks and timesheet entries they may see (view only).
 * Pick a person on the left, tick the people they can see on the right, save.
 * Personal tasks / time of those people show as "Personal" without the details.
 */
export default function TaskMasterPage() {
  const perms = usePermissions(SCREENS.TASK_MASTER);
  const toast = useToast();
  const queryClient = useQueryClient();
  const access = useQuery({ queryKey: ['task-access'], queryFn: taskAccessApi.list });
  const [viewerId, setViewerId] = useState(null);
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [draft, setDraft] = useState(null); // ticked ids while editing (null = saved list)

  const users = useMemo(() => access.data ?? [], [access.data]);
  const viewer = users.find((u) => u.id === viewerId) ?? null;
  const ticked = draft ?? viewer?.userIds ?? [];
  const dirty = draft !== null && (draft.length !== viewer?.userIds.length || draft.some((id) => !viewer.userIds.includes(id)));
  const others = users.filter((u) => u.id !== viewerId && match(u, right));

  const save = useMutation({
    mutationFn: () => taskAccessApi.save(viewerId, ticked),
    onSuccess: (saved) => {
      queryClient.setQueryData(['task-access'], (list) => list.map((u) => (u.id === saved.id ? saved : u)));
      queryClient.invalidateQueries({ queryKey: ['task-access', 'visible-users'] });
      setDraft(null);
      toast.success(`${saved.name} can see ${saved.userIds.length} ${saved.userIds.length === 1 ? 'person' : 'people'}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const pick = (id) => {
    setViewerId(id);
    setDraft(null);
    setRight('');
  };
  const toggle = (id, on) => setDraft((d) => {
    const cur = d ?? viewer.userIds;
    return on ? [...cur, id] : cur.filter((x) => x !== id);
  });
  const name = (id) => users.find((u) => u.id === id)?.name;

  return (
    <>
      <Topbar title="Task Master" breadcrumb={['Administration', 'Task Master']} />
      <p className="muted small tm-intro">
        Choose who can see whose tasks and timesheets. Access is view only and one-way. Personal tasks and time of those people show only as
        “Personal”, without the details.
      </p>
      {access.isError && <ErrorAlert>{errorMessage(access.error)}</ErrorAlert>}
      {access.isLoading ? (
        <Spinner />
      ) : (
        <div className="tm-layout">
          <section className="tile tm-people">
            <div className="tile-head">
              <span className="ti">
                <Users />
              </span>
              <h4>People</h4>
            </div>
            <div className="input-group search tm-search">
              <Search />
              <input className="input" placeholder="Search people…" value={left} onChange={(e) => setLeft(e.target.value)} />
            </div>
            <div className="tm-list">
              {users
                .filter((u) => match(u, left))
                .map((u) => (
                  <button key={u.id} type="button" className={`tm-person${u.id === viewerId ? ' is-active' : ''}`} onClick={() => pick(u.id)}>
                    <Avatar name={u.name} />
                    <span className="tm-who">
                      <b>{u.name}</b>
                      <small>{u.roleName ?? u.username}</small>
                    </span>
                    {u.userIds.length > 0 && (
                      <span className="tm-count" title={`Can see ${u.userIds.length} ${u.userIds.length === 1 ? 'person' : 'people'}`}>
                        <Eye />
                        {u.userIds.length}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </section>

          <section className="tile tm-access">
            {!viewer ? (
              <div className="tm-empty">
                <Eye />
                <p>Pick a person to choose whose tasks and timesheets they can see.</p>
              </div>
            ) : (
              <>
                <div className="tm-access-head">
                  <Avatar name={viewer.name} size="md" />
                  <div>
                    <b>{viewer.name}</b>
                    <span className="muted small">
                      can see the tasks and timesheets of <b>{ticked.length}</b> {ticked.length === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  {perms.edit && (
                    <button type="button" className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                      <Check />
                      {save.isPending ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
                {ticked.length > 0 && (
                  <div className="tm-chips">
                    {ticked.map((id) => (
                      <span key={id} className="tm-chip">
                        {name(id)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="tm-tools">
                  <div className="input-group search tm-search">
                    <Search />
                    <input className="input" placeholder="Search people…" value={right} onChange={(e) => setRight(e.target.value)} />
                  </div>
                  {perms.edit && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft([...new Set([...ticked, ...others.map((u) => u.id)])])}>
                        Select all
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!ticked.length} onClick={() => setDraft([])}>
                        Clear
                      </button>
                    </>
                  )}
                </div>
                <div className="tm-grid">
                  {others.map((u) => (
                    <label key={u.id} className={`tm-option${ticked.includes(u.id) ? ' is-on' : ''}`}>
                      <Checkbox checked={ticked.includes(u.id)} disabled={!perms.edit} onChange={(v) => toggle(u.id, v)} />
                      <Avatar name={u.name} />
                      <span className="tm-who">
                        <b>{u.name}</b>
                        <small>{u.roleName ?? u.username}</small>
                      </span>
                    </label>
                  ))}
                  {!others.length && <p className="muted small">No one matches.</p>}
                </div>
                <p className="tm-note">
                  <Lock />
                  View only: {viewer.name} can open these tasks and time entries but not change them. Personal work shows as “Personal”.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
