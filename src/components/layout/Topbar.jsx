import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

/**
 * Page header: optional back button, breadcrumb, title and actions on the right.
 *   <Topbar title="Project List" breadcrumb={['Projects']} back="/projects" actions={<…/>} />
 */
export function Topbar({ title, breadcrumb = [], back, actions }) {
  useEffect(() => {
    document.title = `${title} · emQube PMS`;
  }, [title]);

  return (
    <header className="topbar">
      <div className="topbar-title">
        {back && (
          <Link className="btn btn-secondary btn-icon" to={back} title="Back">
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
