import { useState } from 'react';
import type { AgeDistributionItem } from '../../types/report';

interface AgeDistributionChartProps {
  data: AgeDistributionItem[];
  groupLabel: string;
  onCostBarClick: (ageGroup: string) => void;
}

export function AgeDistributionChart({ data, groupLabel, onCostBarClick }: AgeDistributionChartProps) {
  const [metric, setMetric] = useState<'patients' | 'cost'>('patients');
  const values = data.map((item) => (metric === 'patients' ? item.patient_count : item.total_cost));
  const maxValue = Math.max(...values, 0);

  const formatValue = (value: number) =>
    metric === 'patients' ? value.toLocaleString('th-TH') : `${Math.round(value).toLocaleString('th-TH')} บาท`;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">กราฟกลุ่มอายุที่เจ็บป่วย</h2>
          <p className="text-sm text-slate-500">นับจำนวนผู้ป่วยตามช่วงอายุ 0-100 ปี จาก diagnosis ที่ตรงตัวกรอง กลุ่ม: {groupLabel}</p>
        </div>
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setMetric('patients')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${metric === 'patients' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            จำนวนผู้ป่วย
          </button>
          <button
            type="button"
            onClick={() => setMetric('cost')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${metric === 'cost' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            ค่าใช้จ่าย
          </button>
        </div>
      </div>
      <div className="flex h-64 items-end gap-2 overflow-x-auto border-b border-l border-slate-200 px-2 pt-4">
        {data.map((item) => {
          const value = metric === 'patients' ? item.patient_count : item.total_cost;
          const height = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 4 : 0) : 0;
          return (
            <div key={item.age_group} className="flex min-w-16 flex-1 flex-col items-center justify-end gap-2">
              <div className="text-xs font-medium text-slate-700">{formatValue(value)}</div>
              <button
                type="button"
                disabled={metric !== 'cost' || value <= 0}
                onClick={() => onCostBarClick(item.age_group)}
                className="flex h-44 w-full items-end focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default"
                title={`${item.age_group} ปี: ${formatValue(value)}`}
              >
                <span
                  className={`w-full rounded-t-md transition-all ${metric === 'cost' && value > 0 ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600'}`}
                  style={{ height: `${height}%` }}
                />
              </button>
              <div className="whitespace-nowrap pb-2 text-xs text-slate-500">{item.age_group}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
