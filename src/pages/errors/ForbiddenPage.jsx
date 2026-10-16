import { Link } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/Display';

export default function ForbiddenPage() {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        action={<Link className="btn btn-secondary" to="/">Go to overview</Link>}
      >
        Ask your administrator to grant your role permission for this screen.
      </EmptyState>
    </div>
  );
}
