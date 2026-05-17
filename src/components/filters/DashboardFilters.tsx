import { Search, SlidersHorizontal } from 'lucide-react';
import { insuranceLabels, patientTypeLabels, statusLabels } from '../../api/labels';
import type { CurrentUser, Department, InsuranceType, PatientType, VisitFilters, VisitStatus } from '../../types/visit';

interface DashboardFiltersProps {
  filters: VisitFilters;
  currentUser: CurrentUser;
  departments: Department[];
  searchMode?: 'patient' | 'illness';
  onChange: (filters: VisitFilters) => void;
}

const patientTypes = Object.keys(patientTypeLabels) as PatientType[];
const insuranceTypes = Object.keys(insuranceLabels) as InsuranceType[];
const statuses = Object.keys(statusLabels) as VisitStatus[];

function updateFilter<K extends keyof VisitFilters>(
  filters: VisitFilters,
  key: K,
  value: VisitFilters[K],
  onChange: (filters: VisitFilters) => void,
) {
  onChange({ ...filters, [key]: value });
}

export function DashboardFilters({ filters, currentUser, departments, searchMode = 'patient', onChange }: DashboardFiltersProps) {
  const departmentOptions = departments;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        ตัวกรองข้อมูล
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">วันที่เริ่มต้น</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter(filters, 'startDate', event.target.value, onChange)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">วันที่สิ้นสุด</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter(filters, 'endDate', event.target.value, onChange)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">แผนก</span>
          <select
            value={filters.departmentId}
            onChange={(event) => updateFilter(filters, 'departmentId', event.target.value, onChange)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">ทุกแผนก</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} - {department.name_th}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">สิทธิการรักษา</span>
          <select
            value={filters.insuranceType}
            onChange={(event) => updateFilter(filters, 'insuranceType', event.target.value as VisitFilters['insuranceType'], onChange)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">ทุกสิทธิ</option>
            {insuranceTypes.map((type) => (
              <option key={type} value={type}>
                {insuranceLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">ประเภทผู้ป่วย</span>
          <select
            value={filters.patientType}
            onChange={(event) => updateFilter(filters, 'patientType', event.target.value as VisitFilters['patientType'], onChange)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">ทุกประเภท</option>
            {patientTypes.map((type) => (
              <option key={type} value={type}>
                {patientTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">สถานะ</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter(filters, 'status', event.target.value as VisitFilters['status'], onChange)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">ทุกสถานะ</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block space-y-1">
        <span className="text-xs font-medium text-slate-600">ค้นหา</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter(filters, 'search', event.target.value, onChange)}
            placeholder={searchMode === 'illness' ? 'ค้นหา ICD หรือชื่อโรค' : 'ค้นหา HN, VN, ชื่อ หรือนามสกุล'}
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </span>
      </label>
    </section>
  );
}
