import { statusLabels } from '../../api/labels';
import type { VisitStatus } from '../../types/visit';

const statusBadgeClass: Record<VisitStatus, string> = {
  waiting: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
  in_progress: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  referred: 'bg-pink-100 text-pink-800 ring-1 ring-pink-200',
};

export function StatusBadge({ status }: { status: VisitStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
