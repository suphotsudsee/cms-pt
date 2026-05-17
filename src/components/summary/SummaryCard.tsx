import type { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  variant: 'total' | 'completed' | 'waiting' | 'in_progress' | 'referred';
}

const variantClass = {
  total: 'border-slate-200 text-slate-900',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  waiting: 'border-orange-200 bg-orange-50 text-orange-900',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-900',
  referred: 'border-pink-200 bg-pink-50 text-pink-900',
};

export function SummaryCard({ label, value, hint, icon: Icon, variant }: SummaryCardProps) {
  return (
    <section className={`rounded-lg border bg-white p-4 shadow-sm ${variantClass[variant]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">{value.toLocaleString('th-TH')}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/70">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs opacity-80">{hint}</p>
    </section>
  );
}
