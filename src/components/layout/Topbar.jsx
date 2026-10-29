import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

/**
 * Page header: optional back button, breadcrumb, title and actions on the right.
 *   <Topbar title="Project List" breadcrumb={['Projects']} back="/projects" actions={<…/>} />
 * backState: router state passed along with the back link (e.g. where that page should go back to).
 */
export function Topbar({ title, breadcrumb = [], back, backState, actions }) {
  useEffect(() => {
    document.title = `${title} · emQube PMS`;
  }, [title]);

  return (
    <header className="topbar">
      <div className="topbar-title">
        {back && (
          <Link className="btn btn-secondary btn-icon" to={back} state={backState} title="Back">
            <ArrowLeft />
          </Link>
        )}
        <div>
          <div className="breadcrumb">
            {breadcrumb.map((c, i) => (
              <span key={c} style={{ display: 'contents' }}>
                {i > 0 && <span className="sep">/</span>}
                <span>{c}</span>
              </span>
            ))}
          </div>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </header>
  );
}
