import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsDown, ChevronsUp, Copy, Ellipsis, Pencil, Printer, Trash2 } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions, useProjectAccess } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { ActionMenu } from '@/components/ui/Dropdown';
import { ErrorAlert, StageBadge } from '@/components/ui/Display';
import { FullPageLoader } from '@/components/ui/Loader';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast-context';
import { SCREENS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { ProjectHero, TabBar, tabFromHash, usableTab } from './tabs/shared';
import { CommercialTab } from './tabs/CommercialTab';
import { AnalysisView, EstimateView, HistoryView, ProjectView, UsersView } from './tabs/ViewTabs';
import { PlanTab } from './tabs/PlanTab';
import { UpdateTab } from './tabs/EditTabs';

const CARD_KEY = 'pms.projectCard';

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const perms = usePermissions(SCREENS.PROJECTS);
  const access = useProjectAccess();
  const { user } = useAuth(); // the Plan tab is the owner's
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState(() => tabFromHash('update')); // the Update tab opens first
  const [historyView, setHistoryView] = useState('logs');
  // project card shown / hidden – remembered in this browser
  const [showCard, setShowCard] = useState(() => {
    try {
      return localStorage.getItem(CARD_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  const toggleCard = (show) => {
    setShowCard(show);
    try {
      localStorage.setItem(CARD_KEY, show ? 'shown' : 'hidden');
    } catch {
      /* storage unavailable */
    }
  };

  const { data: p, isLoading, isError, error } = useQuery({ queryKey: ['projects', id], queryFn: () => projectsApi.get(id), retry: false });

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

  // tabs hidden for the role (and Commercial for anyone but the project's manager) fall back to the first visible one
  const current = usableTab(tab, p, access.tab, user.id);
  const canEditTab = (t) => perms.edit && access.tab(t) === 'edit';
  // Edit project opens the edit page on a tab the role can change
  const editTab = ['project', 'users', 'estimate'].includes(current) && canEditTab(current) ? current : ['project', 'users', 'estimate'].find(canEditTab);
  // Edit + the ⋯ menu: light buttons on the green card, plain ones in the page header
  const actions = (onCard) => (
    <>
      {editTab && (
        <Link className={onCard ? 'btn btn-light' : 'btn btn-secondary'} to={`/projects/${p.id}/edit#${editTab}`}>
          <Pencil />
          Edit project
        </Link>
      )}
      <ActionMenu
        minWidth={180}
        trigger={({ toggle, title }) => (
          <button
            type="button"
            className={`dropdown-toggle btn btn-icon ${onCard ? 'btn-glass' : 'btn-secondary'}`}
            style={onCard ? { width: 42, padding: 0, justifyContent: 'center', border: 0 } : undefined}
            title={title}
            onClick={toggle}
          >
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
  );

  const selectTab = (key) => {
    setTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };

  return (
    <>
      {/* project card (title, tags, hours, due) – can be hidden; then the title moves to the page header */}
      <Topbar
        title={showCard ? 'Project details' : p.title}
        breadcrumb={showCard ? ['Projects', 'Project List'] : ['Projects', 'Project List', p.code]}
        back="/projects"
        actions={
          <>
            {!showCard && (
              <>
                <StageBadge name={p.stageName} status={p.status} />
                {actions(false)}
              </>
            )}
            <button type="button" className="btn btn-secondary btn-icon" title={showCard ? 'Hide project card' : 'Show project card'} onClick={() => toggleCard(!showCard)}>
              {showCard ? <ChevronsUp /> : <ChevronsDown />}
            </button>
          </>
        }
      />
      {showCard && <ProjectHero p={p} actions={actions(true)} />}

      <TabBar tab={current} onSelect={selectTab} p={p} />

      {current === 'update' && (
        <UpdateTab
          p={p}
          canEdit={canEditTab('update')}
          onShowLogs={() => {
            setHistoryView('logs');
            selectTab('history');
          }}
        />
      )}
      {current === 'project' && <ProjectView p={p} />}
      {current === 'users' && <UsersView p={p} />}
      {current === 'estimate' && <EstimateView p={p} canEdit={canEditTab('estimate')} />}
      {current === 'plan' && <PlanTab p={p} />}
      {current === 'commercial' && <CommercialTab p={p} canEdit={canEditTab('commercial')} />}
      {current === 'analysis' && <AnalysisView p={p} />}
      {current === 'history' && <HistoryView id={p.id} view={historyView} onView={setHistoryView} />}

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
