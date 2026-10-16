import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Ellipsis, Pencil, Printer, Trash2 } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { ActionMenu } from '@/components/ui/Dropdown';
import { ErrorAlert } from '@/components/ui/Display';
import { FullPageLoader } from '@/components/ui/Loader';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast-context';
import { SCREENS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { ProjectHero, TabBar, tabFromHash } from './tabs/shared';
import { AnalysisView, EstimateView, HistoryView, ProjectView, UpdateView, UsersView } from './tabs/ViewTabs';

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const perms = usePermissions(SCREENS.PROJECTS);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState(() => tabFromHash('project'));

  const { data: p, isLoading, isError, error } = useQuery({ queryKey: ['projects', id], queryFn: () => projectsApi.get(id), retry: false });
  const reviews = useQuery({ queryKey: ['projects', Number(id), 'reviews'], queryFn: () => projectsApi.reviews(id), enabled: tab === 'update' && !!p });

  const remove = useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      toast.success('Project deleted');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
    onError: (err) => {
      setConfirm(false);
      toast.error(errorMessage(err));
    },
  });

  if (isLoading) return <FullPageLoader />;
  if (isError) return error?.response?.status === 404 ? <NotFoundPage what="Project" /> : <ErrorAlert>{errorMessage(error)}</ErrorAlert>;

  const selectTab = (key) => {
    setTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };

  return (
    <>
      <Topbar title="Project details" breadcrumb={['Projects', 'Project List']} back="/projects" />

      <ProjectHero
        p={p}
        actions={
          <>
            {perms.edit && (
              <Link className="btn btn-light" to={`/projects/${p.id}/edit#${tab}`}>
                <Pencil />
                Edit
              </Link>
            )}
            <ActionMenu
              minWidth={180}
              trigger={({ toggle, title }) => (
                <button type="button" className="dropdown-toggle btn btn-glass btn-icon" style={{ width: 42, padding: 0, justifyContent: 'center', border: 0 }} title={title} onClick={toggle}>
                  <Ellipsis />
                </button>
              )}
              items={[
                { label: 'Duplicate', icon: Copy, hidden: !perms.create, onClick: () => navigate('/projects/new', { state: { duplicateOf: p } }) },
                { label: 'Print', icon: Printer, onClick: () => window.print() },
                { divider: true, hidden: !perms.delete },
                { label: 'Delete', icon: Trash2, danger: true, hidden: !perms.delete, onClick: () => setConfirm(true) },
              ]}
            />
          </>
        }
      />

      <TabBar tab={tab} onSelect={selectTab} />

      {tab === 'update' && <UpdateView p={p} reviews={reviews.data} canEdit={perms.edit} />}
      {tab === 'project' && <ProjectView p={p} canEdit={perms.edit} />}
      {tab === 'users' && <UsersView p={p} canEdit={perms.edit} />}
      {tab === 'estimate' && <EstimateView p={p} canEdit={perms.edit} />}
      {tab === 'analysis' && <AnalysisView p={p} canEdit={perms.edit} />}
      {tab === 'history' && <HistoryView id={p.id} canEdit={perms.edit} />}

      <ConfirmDeleteModal
        open={confirm}
        title="Delete project?"
        message={`"${p.title}" and its template tasks will be removed. Projects with logged time cannot be deleted – set their stage to Cancelled instead.`}
        busy={remove.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
