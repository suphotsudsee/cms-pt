import type { DashboardSummary } from '../types/dashboard';
import type {
  AgeDistributionItem,
  ChargeLineItem,
  IllnessGroupSummary,
  IllnessPatientsResponse,
  PaginatedIllnessReport,
  PaginatedAgeCostReport,
  SortState as ReportSortState,
} from '../types/report';
import type { CurrentUser, Department, PaginatedVisits, SortState, VisitFilters, VisitStatus } from '../types/visit';

export interface JhcisMeta {
  min_visit_date: string | null;
  max_visit_date: string | null;
  total_visits: number;
}

export interface AppConfig {
  jhcis_db_host: string;
  jhcis_db_port: number;
  jhcis_db_name: string;
}

export function emptyFilters(today = '2026-01-21'): VisitFilters {
  return {
    startDate: today,
    endDate: today,
    departmentId: 'all',
    insuranceType: 'all',
    patientType: 'all',
    status: 'all',
    search: '',
  };
}

function toSearchParams(filters: VisitFilters, extra?: Record<string, string | number>) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate) params.set('end_date', filters.endDate);
  if (filters.departmentId !== 'all') params.set('department_id', filters.departmentId);
  if (filters.insuranceType !== 'all') params.set('insurance_type', filters.insuranceType);
  if (filters.patientType !== 'all') params.set('patient_type', filters.patientType);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.search.trim()) params.set('search', filters.search.trim());
  Object.entries(extra ?? {}).forEach(([key, value]) => params.set(key, String(value)));
  return params;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchDepartments(): Promise<Department[]> {
  return apiGet<Department[]>('/api/departments');
}

export async function fetchJhcisMeta(): Promise<JhcisMeta> {
  return apiGet<JhcisMeta>('/api/meta');
}

export async function fetchAppConfig(): Promise<AppConfig> {
  return apiGet<AppConfig>('/api/config');
}

export async function fetchDashboardSummary(filters: VisitFilters): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>(`/api/dashboard/summary?${toSearchParams(filters).toString()}`);
}

export async function fetchVisits(filters: VisitFilters, page: number, pageSize: number, sort: SortState): Promise<PaginatedVisits> {
  return apiGet<PaginatedVisits>(
    `/api/visits?${toSearchParams(filters, { page, page_size: pageSize, sort_by: sort.sortBy, sort_order: sort.sortOrder }).toString()}`,
  );
}

export async function fetchIllnessReport(
  filters: VisitFilters,
  page: number,
  pageSize: number,
  sort: ReportSortState,
  illnessGroup = 'all',
): Promise<PaginatedIllnessReport> {
  return apiGet<PaginatedIllnessReport>(
    `/api/reports/illness?${toSearchParams(filters, { page, page_size: pageSize, sort_by: sort.sortBy, sort_order: sort.sortOrder, illness_group: illnessGroup }).toString()}`,
  );
}

export async function fetchIllnessGroupSummary(filters: VisitFilters, illnessGroup = 'all'): Promise<IllnessGroupSummary> {
  return apiGet<IllnessGroupSummary>(`/api/reports/illness/summary?${toSearchParams(filters, { illness_group: illnessGroup }).toString()}`);
}

export async function fetchIllnessAgeDistribution(filters: VisitFilters, illnessGroup = 'all'): Promise<AgeDistributionItem[]> {
  return apiGet<AgeDistributionItem[]>(`/api/reports/illness/age-distribution?${toSearchParams(filters, { illness_group: illnessGroup }).toString()}`);
}

export async function fetchAgeCostReport(
  filters: VisitFilters,
  illnessGroup: string,
  ageGroup: string,
  page: number,
  pageSize: number,
  sort: ReportSortState,
): Promise<PaginatedAgeCostReport> {
  return apiGet<PaginatedAgeCostReport>(
    `/api/reports/illness/age-costs?${toSearchParams(filters, {
      illness_group: illnessGroup,
      age_group: ageGroup,
      page,
      page_size: pageSize,
      sort_by: sort.sortBy,
      sort_order: sort.sortOrder,
    }).toString()}`,
  );
}

export async function fetchVisitChargeLines(pcucode: string, visitno: number): Promise<ChargeLineItem[]> {
  const params = new URLSearchParams({ pcucode, visitno: String(visitno) });
  return apiGet<ChargeLineItem[]>(`/api/reports/visit-charge-lines?${params.toString()}`);
}

export async function fetchIllnessPatients(
  filters: VisitFilters,
  diagnosisCode: string,
  page: number,
  pageSize: number,
  sort: ReportSortState,
  illnessGroup = 'all',
): Promise<IllnessPatientsResponse> {
  return apiGet<IllnessPatientsResponse>(
    `/api/reports/illness/patients?${toSearchParams(filters, { diagnosis_code: diagnosisCode, page, page_size: pageSize, sort_by: sort.sortBy, sort_order: sort.sortOrder, illness_group: illnessGroup }).toString()}`,
  );
}

export function canExport(_user: CurrentUser) {
  return true;
}

export function canUpdateStatus(_status: VisitStatus, _user: CurrentUser) {
  return false;
}

export function exportVisits(filters: VisitFilters, format: 'csv' | 'xlsx') {
  const url = `/api/reports/visits/export?${toSearchParams(filters, { format }).toString()}`;
  window.location.href = url;
}

export function exportIllnessReport(filters: VisitFilters, format: 'csv' | 'xlsx') {
  const url = `/api/reports/illness/export?${toSearchParams(filters, { format }).toString()}`;
  window.location.href = url;
}
