import { CheckCircle2, PlayCircle, Send, Undo2 } from 'lucide-react';
import type { CurrentUser, VisitListItem, VisitStatus } from '../../types/visit';

interface VisitActionsProps {
  visit: VisitListItem;
  currentUser: CurrentUser;
  onUpdateStatus: (visitId: string, status: VisitStatus, note?: string) => void;
}

const actionClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';

export function VisitActions({ visit, currentUser, onUpdateStatus }: VisitActionsProps) {
  const actions: Array<{ status: VisitStatus; label: string; icon: typeof PlayCircle; note?: string }> = [
    { status: 'in_progress', label: 'เริ่มตรวจ', icon: PlayCircle },
    { status: 'completed', label: 'เสร็จสิ้น', icon: CheckCircle2 },
    { status: 'referred', label: 'ส่งต่อ', icon: Send, note: 'ส่งต่อเพื่อประเมินเพิ่มเติม' },
    { status: 'waiting', label: 'ย้อนกลับเป็นรอรับบริการ', icon: Undo2 },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {actions.map((action) => {
        const Icon = action.icon;
        const disabled = true;
        return (
          <button
            key={action.status}
            type="button"
            title={action.label}
            aria-label={`${action.label} ${visit.vn}`}
            disabled={disabled}
            onClick={() => onUpdateStatus(visit.id, action.status, action.note)}
            className={actionClass}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
