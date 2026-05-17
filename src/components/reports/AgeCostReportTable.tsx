import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AgeCostItem, PaginatedAgeCostReport, SortState } from '../../types/report';

interface AgeCostReportTableProps {
  ageGroup: string;
  data: PaginatedAgeCostReport;
  pageSize: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onTotalCostClick: (item: AgeCostItem) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const pageSizeOptions = [10, 20, 50, 100];
const columns = [
  { label: 'VN', key: 'vn' },
  { label: 'HN', key: 'hn' },
  { label: 'ชื่อผู้ป่วย', key: 'patient_name' },
  { label: 'ICD', key: 'diagnosis_code' },
  { label: 'รายการเจ็บป่วย / บริการ', key: 'diagnosis_name' },
  { label: 'วันที่รับบริการ', key: 'visit_date' },
  { label: 'อายุ', key: 'age_years' },
  { label: 'รวมค่าใช้จ่าย', key: 'total_cost' },
];

function getVisiblePages(currentPage: number, totalPages: number) {
  const pages: Array<number | 'ellipsis'> = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis');
  }
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
  }
  return pages;
}

function nextSort(current: SortState, key: string): SortState {
  return { sortBy: key, sortOrder: current.sortBy === key && current.sortOrder === 'asc' ? 'desc' : 'asc' };
}

function sortMark(sort: SortState, key: string) {
  if (sort.sortBy !== key) return '↕';
  return sort.sortOrder === 'asc' ? '↑' : '↓';
}

function money(value: number) {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

function formatDate(value: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T00:00:00+07:00`));
}

export function AgeCostReportTable({ ageGroup, data, pageSize, sort, onSortChange, onTotalCostClick, onPageChange, onPageSizeChange }: AgeCostReportTableProps) {
  const firstItem = data.total_items === 0 ? 0 : (data.page - 1) * data.page_size + 1;
  const lastItem = Math.min(data.page * data.page_size, data.total_items);
  const visiblePages = getVisiblePages(data.page, data.total_pages);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-blue-50 px-4 py-3">
        <h2 className="text-base font-semibold text-blue-950">รายการค่าใช้จ่ายช่วงอายุ {ageGroup} ปี</h2>
        <p className="mt-1 text-sm text-blue-800">แสดงรายการค่าใช้จ่ายทั้งหมดในแท่งกราฟที่เลือก</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSortChange(nextSort(sort, column.key))}
                    className="inline-flex items-center gap-1 rounded-sm hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {column.label}
                    <span aria-hidden="true">{sortMark(sort, column.key)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((item) => (
              <tr key={`${item.vn}-${item.diagnosis_code}`} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{item.vn}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.hn}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.patient_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.diagnosis_code}</td>
                <td className="min-w-[320px] px-4 py-3 text-sm text-slate-700">{item.diagnosis_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(item.visit_date)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.age_years}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">
                  <button
                    type="button"
                    onClick={() => onTotalCostClick(item)}
                    className="rounded-md px-2 py-1 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    title={`ดูรายการคิดเงิน ${item.vn}`}
                  >
                    {money(item.total_cost)}
                  </button>
                </td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">ไม่พบรายการค่าใช้จ่ายในช่วงอายุนี้</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-500">แสดง {firstItem.toLocaleString('th-TH')}-{lastItem.toLocaleString('th-TH')} จาก {data.total_items.toLocaleString('th-TH')} รายการ</p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            ต่อหน้า
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />ก่อนหน้า
          </button>
          {visiblePages.map((page, index) => page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="inline-flex h-9 w-9 items-center justify-center text-sm text-slate-400">...</span>
          ) : (
            <button key={page} type="button" aria-current={page === data.page ? 'page' : undefined} onClick={() => onPageChange(page)} className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${page === data.page ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {page.toLocaleString('th-TH')}
            </button>
          ))}
          <button type="button" disabled={data.page >= data.total_pages} onClick={() => onPageChange(data.page + 1)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
            ถัดไป<ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
