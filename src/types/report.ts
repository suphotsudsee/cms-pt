export interface IllnessReportItem {
  diagnosis_code: string;
  diagnosis_name: string;
  visit_count: number;
  patient_count: number;
  first_visit_date: string;
  last_visit_date: string;
}

export interface IllnessGroupSummary {
  health_promotion: number;
  prevention: number;
  treatment: number;
  rehabilitation: number;
  health_promotion_cost: number;
  prevention_cost: number;
  treatment_cost: number;
  rehabilitation_cost: number;
}

export interface AgeDistributionItem {
  age_group: string;
  patient_count: number;
  total_cost: number;
}

export interface PaginatedIllnessReport {
  items: IllnessReportItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface SortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface IllnessPatientItem {
  hn: string;
  patient_name: string;
  visit_count: number;
  first_visit_date: string;
  last_visit_date: string;
  latest_symptoms: string;
}

export interface IllnessPatientsResponse {
  diagnosis_code: string;
  items: IllnessPatientItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface AgeCostItem {
  pcucode: string;
  visitno: number;
  vn: string;
  hn: string;
  patient_name: string;
  diagnosis_code: string;
  diagnosis_name: string;
  visit_date: string;
  age_years: number;
  money1: number;
  money2: number;
  money3: number;
  moneynoclaim: number;
  total_cost: number;
}

export interface ChargeLineItem {
  source: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PaginatedAgeCostReport {
  items: AgeCostItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}
