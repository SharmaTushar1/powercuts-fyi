import type { CutType, CutStatus } from '../types';

export function StatusBadge({ type, status }: { type: CutType; status: CutStatus }) {
  if (status === 'resolved') {
    return <span className="badge badge-resolved">✓ RESOLVED</span>;
  }
  return (
    <span className={type === 'unexpected' ? 'badge badge-unexpected' : 'badge badge-planned'}>
      {type === 'unexpected' ? 'UNEXPECTED' : 'PLANNED'}
    </span>
  );
}
