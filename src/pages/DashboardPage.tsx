import {
  Activity,
  BarChart3,
  Database,
  Download,
  FileSpreadsheet,
  HeartPulse,
  Hourglass,
  ListChecks,
  Send,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  canExport,
  emptyFilters,
  exportIllnessReport,
  exportVisits,
  fetchAppConfig,
  fetchAgePatients,
  fetchDashboardSummary,
  fetchDepartments,
  fetchAgeCostReport,
  fetchVisitChargeLines,
  fetchIllnessAgeDistribution,
  fetchIllnessGroupSummary,
  fetchIllnessPatients,
  fetchIllnessReport,
  fetchJhcisMeta,
  fetchVisits,
} from '../api/client';
import type { AppConfig } from '../api/client';
import { roleLabels } from '../api/labels';
import { users } from '../api/mockData';
import { DashboardFilters } from '../components/filters/DashboardFilters';
import { AgeDistributionChart } from '../components/reports/AgeDistributionChart';
import { AgeCostReportTable } from '../components/reports/AgeCostReportTable';
import { AgePatientsPanel } from '../components/reports/AgePatientsPanel';
import { ChargeLinesPanel } from '../components/reports/ChargeLinesPanel';
import { IllnessPatientsPanel } from '../components/reports/IllnessPatientsPanel';
import { IllnessReportTable } from '../components/reports/IllnessReportTable';
import { SummaryCard } from '../components/summary/SummaryCard';
import { VisitTable } from '../components/visits/VisitTable';
import type { DashboardSummary } from '../types/dashboard';
import type {
  AgeDistributionItem,
  AgePatientsResponse,
  AgeCostItem,
  ChargeLineItem,
  IllnessGroupSummary,
  IllnessPatientsResponse,
  IllnessReportItem,
  PaginatedIllnessReport,
  PaginatedAgeCostReport,
} from '../types/report';
import type { CurrentUser, Department, PaginatedVisits, SortState, UserRole, VisitFilters, VisitStatus } from '../types/visit';

const defaultPageSize = 20;
const emptySummary: DashboardSummary = { total: 0, completed: 0, waiting: 0, in_progress: 0, referred: 0 };
const emptyIllnessGroupSummary: IllnessGroupSummary = {
  health_promotion: 0,
  prevention: 0,
  treatment: 0,
  rehabilitation: 0,
  health_promotion_cost: 0,
  prevention_cost: 0,
  treatment_cost: 0,
  rehabilitation_cost: 0,
};
const emptyTable: PaginatedVisits = { items: [], page: 1, page_size: defaultPageSize, total_items: 0, total_pages: 1 };
const emptyIllnessReport: PaginatedIllnessReport = { items: [], page: 1, page_size: defaultPageSize, total_items: 0, total_pages: 1 };
const emptyIllnessPatients: IllnessPatientsResponse = {
  diagnosis_code: '',
  items: [],
  page: 1,
  page_size: defaultPageSize,
  total_items: 0,
  total_pages: 1,
};
const emptyAgeCostReport: PaginatedAgeCostReport = { items: [], page: 1, page_size: defaultPageSize, total_items: 0, total_pages: 1 };
const emptyAgePatients: AgePatientsResponse = { age_group: '', items: [], page: 1, page_size: defaultPageSize, total_items: 0, total_pages: 1 };

type ViewMode = 'dashboard' | 'illness' | 'illnessPatients' | 'agePatients' | 'ageCosts' | 'chargeLines';
type IllnessGroup = 'all' | 'health_promotion' | 'prevention' | 'treatment' | 'rehabilitation';

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [currentUser, setCurrentUser] = useState<CurrentUser>(users[2]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [filters, setFilters] = useState<VisitFilters>(emptyFilters());
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [illnessGroupSummary, setIllnessGroupSummary] = useState<IllnessGroupSummary>(emptyIllnessGroupSummary);
  const [ageDistribution, setAgeDistribution] = useState<AgeDistributionItem[]>([]);
  const [tableData, setTableData] = useState<PaginatedVisits>(emptyTable);
  const [illnessReport, setIllnessReport] = useState<PaginatedIllnessReport>(emptyIllnessReport);
  const [illnessPatients, setIllnessPatients] = useState<IllnessPatientsResponse>(emptyIllnessPatients);
  const [agePatients, setAgePatients] = useState<AgePatientsResponse>(emptyAgePatients);
  const [ageCostReport, setAgeCostReport] = useState<PaginatedAgeCostReport>(emptyAgeCostReport);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<IllnessReportItem | null>(null);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [selectedCostVisit, setSelectedCostVisit] = useState<AgeCostItem | null>(null);
  const [chargeLines, setChargeLines] = useState<ChargeLineItem[]>([]);
  const [chargeLinesLoading, setChargeLinesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [illnessPage, setIllnessPage] = useState(1);
  const [illnessPageSize, setIllnessPageSize] = useState(defaultPageSize);
  const [illnessPatientsPage, setIllnessPatientsPage] = useState(1);
  const [illnessPatientsPageSize, setIllnessPatientsPageSize] = useState(defaultPageSize);
  const [agePatientsPage, setAgePatientsPage] = useState(1);
  const [agePatientsPageSize, setAgePatientsPageSize] = useState(defaultPageSize);
  const [ageCostPage, setAgeCostPage] = useState(1);
  const [ageCostPageSize, setAgeCostPageSize] = useState(defaultPageSize);
  const [selectedIllnessGroup, setSelectedIllnessGroup] = useState<IllnessGroup>('all');
  const [visitSort, setVisitSort] = useState<SortState>({ sortBy: 'visit_at', sortOrder: 'desc' });
  const [illnessSort, setIllnessSort] = useState<SortState>({ sortBy: 'visit_count', sortOrder: 'desc' });
  const [illnessPatientsSort, setIllnessPatientsSort] = useState<SortState>({ sortBy: 'last_visit_date', sortOrder: 'desc' });
  const [agePatientsSort, setAgePatientsSort] = useState<SortState>({ sortBy: 'last_visit_date', sortOrder: 'desc' });
  const [ageCostSort, setAgeCostSort] = useState<SortState>({ sortBy: 'total_cost', sortOrder: 'desc' });
  const [loading, setLoading] = useState(true);
  const [illnessPatientsLoading, setIllnessPatientsLoading] = useState(false);
  const [agePatientsLoading, setAgePatientsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFilters = useMemo(() => filters, [filters]);
  const isIllnessMode = viewMode === 'illness' || viewMode === 'illnessPatients' || viewMode === 'agePatients' || viewMode === 'ageCosts' || viewMode === 'chargeLines';
  const selectedIllnessGroupLabel = {
    all: 'ทุกกลุ่ม',
    health_promotion: 'ส่งเสริมสุขภาพ',
    prevention: 'ป้องกันโรค',
    treatment: 'รักษาโรค',
    rehabilitation: 'ฟื้นฟู',
  }[selectedIllnessGroup];
  const money = (value: number) => `(${Math.round(value).toLocaleString('th-TH')} บาท)`;

  useEffect(() => {
    let ignore = false;
    fetchAppConfig()
      .then((config) => {
        if (!ignore) setAppConfig(config);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchDepartments(), fetchJhcisMeta()])
      .then(([items, meta]) => {
        if (ignore) return;
        setDepartments(items);
        if (meta.max_visit_date) {
          setFilters((current) => ({
            ...current,
            startDate: meta.max_visit_date ?? current.startDate,
            endDate: meta.max_visit_date ?? current.endDate,
          }));
        }
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    const tableRequest =
      viewMode === 'dashboard'
        ? fetchVisits(activeFilters, page, pageSize, visitSort).then((nextTable) => {
            if (!ignore) setTableData(nextTable);
          })
        : fetchIllnessReport(activeFilters, illnessPage, illnessPageSize, illnessSort, selectedIllnessGroup).then((nextReport) => {
            if (!ignore) setIllnessReport(nextReport);
          });

    const summaryRequest =
      viewMode === 'dashboard'
        ? fetchDashboardSummary(activeFilters).then((nextSummary) => {
            if (!ignore) setSummary(nextSummary);
          })
        : Promise.all([fetchDashboardSummary(activeFilters), fetchIllnessGroupSummary(activeFilters)]).then(
            ([nextSummary, nextIllnessSummary]) => {
              if (ignore) return;
              setSummary(nextSummary);
              setIllnessGroupSummary(nextIllnessSummary);
            },
          );

    Promise.all([
      summaryRequest,
      tableRequest,
    ])
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeFilters, page, pageSize, visitSort, illnessPage, illnessPageSize, illnessSort, selectedIllnessGroup, viewMode]);

  useEffect(() => {
    if (!isIllnessMode) return;

    let ignore = false;
    fetchIllnessAgeDistribution(activeFilters, selectedIllnessGroup)
      .then((nextAgeDistribution) => {
        if (!ignore) setAgeDistribution(nextAgeDistribution);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, [activeFilters, isIllnessMode, selectedIllnessGroup]);

  useEffect(() => {
    if (viewMode !== 'illnessPatients' || !selectedDiagnosis) return;

    let ignore = false;
    setIllnessPatientsLoading(true);
    setError(null);

    fetchIllnessPatients(
      activeFilters,
      selectedDiagnosis.diagnosis_code,
      illnessPatientsPage,
      illnessPatientsPageSize,
      illnessPatientsSort,
      selectedIllnessGroup,
    )
      .then((result) => {
        if (!ignore) setIllnessPatients(result);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setIllnessPatientsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeFilters, selectedDiagnosis, illnessPatientsPage, illnessPatientsPageSize, illnessPatientsSort, selectedIllnessGroup, viewMode]);

  useEffect(() => {
    if (viewMode !== 'agePatients' || !selectedAgeGroup) return;

    let ignore = false;
    setAgePatientsLoading(true);
    setError(null);

    fetchAgePatients(activeFilters, selectedIllnessGroup, selectedAgeGroup, agePatientsPage, agePatientsPageSize, agePatientsSort)
      .then((result) => {
        if (!ignore) setAgePatients(result);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setAgePatientsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeFilters, selectedIllnessGroup, selectedAgeGroup, agePatientsPage, agePatientsPageSize, agePatientsSort, viewMode]);

  useEffect(() => {
    if (viewMode !== 'ageCosts' || !selectedAgeGroup) return;

    let ignore = false;
    setError(null);

    fetchAgeCostReport(activeFilters, selectedIllnessGroup, selectedAgeGroup, ageCostPage, ageCostPageSize, ageCostSort)
      .then((result) => {
        if (!ignore) setAgeCostReport(result);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, [activeFilters, selectedIllnessGroup, selectedAgeGroup, ageCostPage, ageCostPageSize, ageCostSort, viewMode]);

  const handleFilterChange = (nextFilters: VisitFilters) => {
    setFilters(nextFilters);
    setPage(1);
    setIllnessPage(1);
    setIllnessPatientsPage(1);
    setAgePatientsPage(1);
    setSelectedDiagnosis(null);
    setSelectedAgeGroup(null);
    setSelectedCostVisit(null);
    setChargeLines([]);
    setIllnessPatients(emptyIllnessPatients);
    setAgePatients(emptyAgePatients);
    setAgeCostReport(emptyAgeCostReport);
    setSelectedIllnessGroup('all');
    if (viewMode === 'illnessPatients' || viewMode === 'agePatients' || viewMode === 'ageCosts' || viewMode === 'chargeLines') setViewMode('illness');
  };

  const handleRoleChange = (role: UserRole) => {
    const nextUser = users.find((user) => user.role === role);
    if (!nextUser) return;
    setCurrentUser(nextUser);
    setPage(1);
    setIllnessPage(1);
    setIllnessPatientsPage(1);
    setAgePatientsPage(1);
  };

  const handleUpdateStatus = (_visitId: string, _status: VisitStatus, _note?: string) => {
    setError('โหมด JHCIS ตอนนี้อ่านข้อมูลจริงเท่านั้น ยังไม่อัปเดตสถานะกลับฐานข้อมูล');
  };

  const handlePatientCountClick = (diagnosis: IllnessReportItem) => {
    setSelectedDiagnosis(diagnosis);
    setIllnessPatients(emptyIllnessPatients);
    setIllnessPatientsPage(1);
    setViewMode('illnessPatients');
  };

  const handleIllnessGroupClick = (group: IllnessGroup) => {
    setSelectedIllnessGroup((current) => (current === group ? 'all' : group));
    setIllnessPage(1);
    setIllnessPatientsPage(1);
    setAgePatientsPage(1);
    setSelectedDiagnosis(null);
    setIllnessPatients(emptyIllnessPatients);
    setSelectedAgeGroup(null);
    setAgePatients(emptyAgePatients);
    setSelectedCostVisit(null);
    setChargeLines([]);
    setAgeCostReport(emptyAgeCostReport);
    setViewMode('illness');
  };

  const handlePatientBarClick = (ageGroup: string) => {
    setSelectedAgeGroup(ageGroup);
    setAgePatients(emptyAgePatients);
    setAgePatientsPage(1);
    setSelectedDiagnosis(null);
    setSelectedCostVisit(null);
    setChargeLines([]);
    setViewMode('agePatients');
  };

  const handleCostBarClick = (ageGroup: string) => {
    setSelectedAgeGroup(ageGroup);
    setAgeCostReport(emptyAgeCostReport);
    setAgeCostPage(1);
    setAgePatients(emptyAgePatients);
    setAgePatientsPage(1);
    setSelectedCostVisit(null);
    setChargeLines([]);
    setViewMode('ageCosts');
  };

  const handleTotalCostClick = (item: AgeCostItem) => {
    setSelectedCostVisit(item);
    setChargeLines([]);
    setChargeLinesLoading(true);
    setError(null);

    fetchVisitChargeLines(item.pcucode, item.visitno)
      .then((result) => setChargeLines(result))
      .catch((err: Error) => setError(err.message))
      .finally(() => setChargeLinesLoading(false));
    setViewMode('chargeLines');
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
              Hospital Patient Tracking
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">แดชบอร์ดติดตามสถานะผู้ป่วย</h1>
            <p className="mt-1 text-sm text-slate-600">
              {appConfig
                ? `อ่านข้อมูลจากฐาน JHCIS_DB_NAME=${appConfig.jhcis_db_name} บน JHCIS_DB_HOST=${appConfig.jhcis_db_host} JHCIS_DB_PORT=${appConfig.jhcis_db_port}`
                : 'กำลังโหลดค่าเชื่อมต่อ JHCIS...'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">บทบาทผู้ใช้</span>
              <select
                value={currentUser.role}
                onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                className="w-52 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.role}>
                    {roleLabels[user.role]}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <p className="text-sm font-medium text-slate-900">{currentUser.name}</p>
              <p className="text-xs text-slate-500">{roleLabels[currentUser.role]}</p>
            </div>
          </div>
        </header>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                viewMode === 'dashboard' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              รายการ visit
            </button>
            <button
              type="button"
              onClick={() => setViewMode('illness')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                viewMode === 'illness' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
              รายงานการเจ็บป่วย
            </button>
            {selectedDiagnosis ? (
              <button
                type="button"
                onClick={() => setViewMode('illnessPatients')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  viewMode === 'illnessPatients' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                รายชื่อผู้ป่วย ICD {selectedDiagnosis.diagnosis_code}
              </button>
            ) : null}
            {selectedAgeGroup ? (
              <button
                type="button"
                onClick={() => setViewMode('agePatients')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  viewMode === 'agePatients' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                รายชื่ออายุ {selectedAgeGroup}
              </button>
            ) : null}
            {selectedAgeGroup ? (
              <button
                type="button"
                onClick={() => setViewMode('ageCosts')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  viewMode === 'ageCosts' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                ค่าใช้จ่ายอายุ {selectedAgeGroup}
              </button>
            ) : null}
            {selectedCostVisit ? (
              <button
                type="button"
                onClick={() => setViewMode('chargeLines')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  viewMode === 'chargeLines' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                รายการคิดเงิน {selectedCostVisit.vn}
              </button>
            ) : null}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <Database className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {isIllnessMode
                ? 'รายงานการเจ็บป่วยนับจาก visitdiag และ cdisease โดยใช้ตัวกรองชุดเดียวกับ dashboard'
                : 'ข้อมูลมาจาก JHCIS จริงโดย map visit.flagservice เป็นสถานะ dashboard และใช้ visit.timeservice เป็นตัวกรองหน่วยบริการ/ช่วงบริการ'}
            </p>
          </div>

          {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div> : null}

          <DashboardFilters
            filters={activeFilters}
            currentUser={currentUser}
            departments={departments}
            searchMode={isIllnessMode ? 'illness' : 'patient'}
            onChange={handleFilterChange}
          />

          {isIllnessMode ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => handleIllnessGroupClick('health_promotion')}
                className={`rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${selectedIllnessGroup === 'health_promotion' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                <SummaryCard
                  label="ส่งเสริมสุขภาพ"
                  value={illnessGroupSummary.health_promotion}
                  hint={`${money(illnessGroupSummary.health_promotion_cost)} Z00-Z02, Z13`}
                  icon={HeartPulse}
                  variant="total"
                />
              </button>
              <button
                type="button"
                onClick={() => handleIllnessGroupClick('prevention')}
                className={`rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${selectedIllnessGroup === 'prevention' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                <SummaryCard
                  label="ป้องกันโรค"
                  value={illnessGroupSummary.prevention}
                  hint={`${money(illnessGroupSummary.prevention_cost)} Z20-Z29 เช่นวัคซีน/ป้องกันก่อนสัมผัส`}
                  icon={ShieldCheck}
                  variant="completed"
                />
              </button>
              <button
                type="button"
                onClick={() => handleIllnessGroupClick('treatment')}
                className={`rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${selectedIllnessGroup === 'treatment' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                <SummaryCard
                  label="รักษาโรค"
                  value={illnessGroupSummary.treatment}
                  hint={`${money(illnessGroupSummary.treatment_cost)} A-T และ Z บางรหัส เช่น Z48.0`}
                  icon={Stethoscope}
                  variant="in_progress"
                />
              </button>
              <button
                type="button"
                onClick={() => handleIllnessGroupClick('rehabilitation')}
                className={`rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${selectedIllnessGroup === 'rehabilitation' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                <SummaryCard
                  label="ฟื้นฟู"
                  value={illnessGroupSummary.rehabilitation}
                  hint={`${money(illnessGroupSummary.rehabilitation_cost)} Z50-Z54`}
                  icon={Activity}
                  variant="referred"
                />
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard label="Total" value={summary.total} hint="visit ทั้งหมดตามตัวกรอง" icon={Users} variant="total" />
              <SummaryCard label="Completed" value={summary.completed} hint="เสร็จสิ้นการรับบริการ" icon={ListChecks} variant="completed" />
              <SummaryCard label="Waiting" value={summary.waiting} hint="รอรับบริการ" icon={Hourglass} variant="waiting" />
              <SummaryCard label="In-Progress" value={summary.in_progress} hint="กำลังรับบริการ" icon={Activity} variant="in_progress" />
              <SummaryCard label="Referred" value={summary.referred} hint="ส่งต่อ" icon={Send} variant="referred" />
            </div>
          )}

          {isIllnessMode ? (
            <AgeDistributionChart
              data={ageDistribution}
              groupLabel={selectedIllnessGroupLabel}
              onPatientBarClick={handlePatientBarClick}
              onCostBarClick={handleCostBarClick}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">
              {loading
                ? 'กำลังโหลดข้อมูลจาก JHCIS...'
                : isIllnessMode
                  ? `รายงานนี้แสดงว่าผู้ป่วยมารับบริการด้วยการวินิจฉัยหรือบริการอะไรบ้าง กลุ่ม: ${selectedIllnessGroupLabel}`
                  : 'การส่งออกใช้ตัวกรองเดียวกับตารางและสรุปผลปัจจุบัน'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canExport(currentUser)}
                onClick={() => (viewMode === 'dashboard' ? exportVisits(activeFilters, 'csv') : exportIllnessReport(activeFilters, 'csv'))}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </button>
              <button
                type="button"
                disabled={!canExport(currentUser)}
                onClick={() => (viewMode === 'dashboard' ? exportVisits(activeFilters, 'xlsx') : exportIllnessReport(activeFilters, 'xlsx'))}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Export XLSX
              </button>
            </div>
          </div>

          {viewMode === 'illness' ? (
            <IllnessReportTable
              data={illnessReport}
              pageSize={illnessPageSize}
              sort={illnessSort}
              onPatientCountClick={handlePatientCountClick}
              onSortChange={(nextSort) => {
                setIllnessSort(nextSort);
                setIllnessPage(1);
              }}
              onPageChange={setIllnessPage}
              onPageSizeChange={(nextPageSize) => {
                setIllnessPageSize(nextPageSize);
                setIllnessPage(1);
              }}
            />
          ) : viewMode === 'illnessPatients' && selectedDiagnosis ? (
            <IllnessPatientsPanel
              diagnosis={selectedDiagnosis}
              data={illnessPatients}
              pageSize={illnessPatientsPageSize}
              sort={illnessPatientsSort}
              loading={illnessPatientsLoading}
              onSortChange={(nextSort) => {
                setIllnessPatientsSort(nextSort);
                setIllnessPatientsPage(1);
              }}
              onPageChange={setIllnessPatientsPage}
              onPageSizeChange={(nextPageSize) => {
                setIllnessPatientsPageSize(nextPageSize);
                setIllnessPatientsPage(1);
              }}
            />
          ) : viewMode === 'agePatients' && selectedAgeGroup ? (
            <AgePatientsPanel
              ageGroup={selectedAgeGroup}
              data={agePatients}
              pageSize={agePatientsPageSize}
              sort={agePatientsSort}
              loading={agePatientsLoading}
              onSortChange={(nextSort) => {
                setAgePatientsSort(nextSort);
                setAgePatientsPage(1);
              }}
              onPageChange={setAgePatientsPage}
              onPageSizeChange={(nextPageSize) => {
                setAgePatientsPageSize(nextPageSize);
                setAgePatientsPage(1);
              }}
            />
          ) : viewMode === 'ageCosts' && selectedAgeGroup ? (
            <AgeCostReportTable
              ageGroup={selectedAgeGroup}
              data={ageCostReport}
              pageSize={ageCostPageSize}
              sort={ageCostSort}
              onSortChange={(nextSort) => {
                setAgeCostSort(nextSort);
                setAgeCostPage(1);
              }}
              onTotalCostClick={handleTotalCostClick}
              onPageChange={setAgeCostPage}
              onPageSizeChange={(nextPageSize) => {
                setAgeCostPageSize(nextPageSize);
                setAgeCostPage(1);
              }}
            />
          ) : viewMode === 'chargeLines' && selectedCostVisit ? (
            <ChargeLinesPanel
              title={`รายการคิดเงิน ${selectedCostVisit.vn} - ${selectedCostVisit.patient_name}`}
              items={chargeLines}
              loading={chargeLinesLoading}
            />
          ) : (
            <VisitTable
              data={tableData}
              currentUser={currentUser}
              pageSize={pageSize}
              sort={visitSort}
              onSortChange={(nextSort) => {
                setVisitSort(nextSort);
                setPage(1);
              }}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        </div>
      </div>
    </main>
  );
}
