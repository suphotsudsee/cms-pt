export type VisitStatus = 'waiting' | 'in_progress' | 'completed' | 'referred';

export type PatientType = 'opd' | 'emergency' | 'refer' | 'follow_up';

export type InsuranceType =
  | 'uc'
  | 'social_security'
  | 'civil_servant'
  | 'self_pay'
  | 'private_insurance'
  | 'other';

export type UserRole = 'screening' | 'nurse' | 'manager';

export interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  department_id: string;
}

export interface VisitListItem {
  id: string;
  vn: string;
  hn: string;
  patient_name: string;
  department: Department;
  patient_type: PatientType;
  insurance_type: InsuranceType;
  status: VisitStatus;
  visit_at: string;
  note?: string;
  referred_to?: string;
  completed_at?: string;
}

export interface VisitFilters {
  startDate: string;
  endDate: string;
  departmentId: string;
  insuranceType: InsuranceType | 'all';
  patientType: PatientType | 'all';
  status: VisitStatus | 'all';
  search: string;
}

export interface PaginatedVisits {
  items: VisitListItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface SortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface CreateVisitInput {
  hn: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  patientType: PatientType;
  insuranceType: InsuranceType;
  note?: string;
}
