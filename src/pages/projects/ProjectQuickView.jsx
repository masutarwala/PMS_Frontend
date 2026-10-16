import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FolderKanban, Pencil, X } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { Drawer } from '@/components/ui/ListKit';
import { Spinner } from '@/components/ui/Loader';
import { StageBadge } from '@/components/ui/Display';
import { formatDate, formatNumber } from '@/lib/format';
import { CommentsLog } from './tabs/shared';

/** Quick view drawer (eye button on a row) – key facts and the progress comments log. */
export function ProjectQuickView({ project: p, onClose, canEdit }) {
  const reviews = useQuery({
    queryKey: ['projects', p?.id, 'reviews'],
    queryFn: () => projectsApi.reviews(p.id),
    enabled: !!p,
  });
  const comments = (reviews.data ?? []).filter((r) => r.comment);

  const facts = p
    ? [
        ['Customer', p.customerName ?? '—'],
        ['Project division', p.divisionName],
        ['Project type', p.typeName],
        ['Project owner', p.ownerName],
        ['Progress', `${p.progress}%`],
        ['Hours (logged / est.)', `${formatNumber(p.loggedHours)} / ${p.estimatedHours != null ? formatNumber(p.estimatedHours) : '—'}`],
        ['Start date', formatDate(p.startDate)],
        ['End date', formatDate(p.endDate)],
      ]
    : [];

  return (
    <Drawer
      open={!!p}
      onClose={onClose}
      title={p?.title}
      className="qv"
      bare
      footer={
        p && (
          <>
            {canEdit && (
              <Link className="btn btn-secondary" to={`/projects/${p.id}/edit`}>
                <Pencil />
                Edit
              </Link>
            )}
            <Link className="btn btn-primary" to={`/projects/${p.id}`}>
              Open details
              <ArrowRight />
            </Link>
          </>
        )
      }
    >
      {p && (
        <>
          <div className="qv-hero">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="lead">
                <FolderKanban />
              </span>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={onClose}
                title="Close"
                style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.12)', color: '#fff' }}
              >
                <X />
              </button>
            </div>
            <h2>{p.title}</h2>
            <div className="sub">{p.code}</div>
            <StageBadge name={p.stageName} status={p.status} />
          </div>
          <div className="modal-body">
            <h4 className="section-title">Key details</h4>
            <div className="qv-facts">
              {facts.map(([k, v]) => (
                <div key={k} className="qv-fact">
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <h4 className="section-title" style={{ marginTop: 22 }}>
              Comments
            </h4>
            {reviews.isLoading ? <Spinner /> : <CommentsLog reviews={comments} />}
          </div>
        </>
      )}
    </Drawer>
  );
}
