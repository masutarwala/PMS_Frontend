import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/Display';

export default function NotFoundPage({ what = 'Page' }) {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState icon={SearchX} title={`${what} not found`} action={<Link className="btn btn-secondary" to="/">Go to overview</Link>}>
        It may have been removed, or you may not have access to it.
      </EmptyState>
    </div>
  );
}
