import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 5174);
const host = process.env.API_HOST ?? '127.0.0.1';

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.JHCIS_DB_HOST ?? 'localhost',
  port: Number(process.env.JHCIS_DB_PORT ?? 3333),
  user: process.env.JHCIS_DB_USER ?? 'root',
  password: process.env.JHCIS_DB_PASSWORD ?? '123456',
  database: process.env.JHCIS_DB_NAME ?? 'jhcisdb',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

const insuranceMap = new Map([
  ['uc', ['UC', 'UCS', 'บัตรทอง', 'หลักประกัน']],
  ['social_security', ['SSS', 'ประกันสังคม']],
  ['civil_servant', ['OFC', 'ข้าราชการ', 'กรมบัญชีกลาง']],
  ['self_pay', ['ชำระเงินเอง', 'เงินสด']],
  ['private_insurance', ['ประกันเอกชน']],
]);

function statusSql() {
  return `CASE
    WHEN v.refer IS NOT NULL AND v.refer <> '' AND v.refer <> '00' THEN 'referred'
    WHEN v.flagservice = '01' THEN 'waiting'
    WHEN v.flagservice = '02' THEN 'in_progress'
    WHEN v.flagservice = '03' THEN 'completed'
    ELSE 'waiting'
  END`;
}

function patientTypeSql() {
  return `CASE
    WHEN v.refer IS NOT NULL AND v.refer <> '' AND v.refer <> '00' THEN 'refer'
    WHEN v.servicetype = '2' THEN 'emergency'
    ELSE 'opd'
  END`;
}

function insuranceSql() {
  return `CASE
    WHEN cr.rightname LIKE '%ประกันสังคม%' THEN 'social_security'
    WHEN cr.rightname LIKE '%ข้าราชการ%' OR cr.rightname LIKE '%กรมบัญชีกลาง%' THEN 'civil_servant'
    WHEN cr.rightname LIKE '%ชำระ%' OR cr.rightname LIKE '%เงินสด%' THEN 'self_pay'
    WHEN cr.rightname LIKE '%เอกชน%' THEN 'private_insurance'
    WHEN cr.rightname LIKE '%บัตรทอง%' OR cr.rightname LIKE '%หลักประกัน%' THEN 'uc'
    ELSE 'other'
  END`;
}

function buildWhere(query) {
  const where = ['v.flagservice <> "99"'];
  const params = [];

  if (query.start_date) {
    where.push('v.visitdate >= ?');
    params.push(query.start_date);
  }
  if (query.end_date) {
    where.push('v.visitdate <= ?');
    params.push(query.end_date);
  }
  if (query.department_id && query.department_id !== 'all') {
    if (query.department_id === 'unknown') {
      where.push('v.timeservice IS NULL');
    } else {
      where.push('v.timeservice = ?');
      params.push(query.department_id);
    }
  }
  if (query.patient_type && query.patient_type !== 'all') {
    where.push(`${patientTypeSql()} = ?`);
    params.push(query.patient_type);
  }
  if (query.insurance_type && query.insurance_type !== 'all') {
    where.push(`${insuranceSql()} = ?`);
    params.push(query.insurance_type);
  }
  if (query.status && query.status !== 'all') {
    where.push(`${statusSql()} = ?`);
    params.push(query.status);
  }
  if (query.search) {
    where.push(`(
      CAST(v.visitno AS CHAR) LIKE ?
      OR CAST(p.pid AS CHAR) LIKE ?
      OR CAST(p.hcode AS CHAR) LIKE ?
      OR p.fname LIKE ?
      OR p.lname LIKE ?
      OR CONCAT(COALESCE(t.titlename, ''), p.fname, ' ', p.lname) LIKE ?
    )`);
    const keyword = `%${query.search}%`;
    params.push(keyword, keyword, keyword, keyword, keyword, keyword);
  }

  return { where: where.join(' AND '), params };
}

function buildIllnessWhere(query) {
  const where = [];
  const params = [];
  const search = String(query.search ?? '').trim();

  if (search) {
    where.push(`(
      vd.diagcode LIKE ?
      OR cd.diseasenamethai LIKE ?
      OR cd.diseasename LIKE ?
    )`);
    const keyword = `%${search}%`;
    params.push(keyword, keyword, keyword);
  }
  if (query.illness_group && query.illness_group !== 'all') {
    where.push(`${illnessGroupSql()} = ?`);
    params.push(query.illness_group);
  }

  return {
    where: where.length ? ` AND ${where.join(' AND ')}` : '',
    params,
  };
}

function sortDirection(query) {
  return String(query.sort_order ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

function orderBy(query, allowedSorts, fallback) {
  const sortBy = String(query.sort_by ?? '');
  const column = allowedSorts[sortBy] ?? fallback;
  return `${column} ${sortDirection(query)}`;
}

function illnessGroupSql() {
  return `CASE
    WHEN UPPER(REPLACE(vd.diagcode, '.', '')) REGEXP '^Z0[0-2]' OR UPPER(REPLACE(vd.diagcode, '.', '')) REGEXP '^Z13' THEN 'health_promotion'
    WHEN UPPER(REPLACE(vd.diagcode, '.', '')) REGEXP '^Z2[0-9]' THEN 'prevention'
    WHEN UPPER(REPLACE(vd.diagcode, '.', '')) REGEXP '^Z5[0-4]' THEN 'rehabilitation'
    ELSE 'treatment'
  END`;
}

function rowToVisit(row) {
  const departmentId = row.department_id ?? 'unknown';
  const departmentName = row.department_name ?? 'ไม่ระบุช่วงบริการ';

  return {
    id: `${row.pcucode}:${row.visitno}`,
    vn: `VN${row.visitno}`,
    hn: String(row.hn ?? row.pid ?? ''),
    patient_name: row.patient_name?.trim() || 'ไม่ระบุชื่อ',
    department: {
      id: departmentId,
      code: departmentId === 'unknown' ? 'UNK' : String(departmentId),
      name_th: departmentName,
      name_en: departmentName,
    },
    patient_type: row.patient_type,
    insurance_type: row.insurance_type,
    status: row.status,
    visit_at: `${row.visitdate}T${row.timestart ?? '00:00:00'}+07:00`,
    note: row.symptoms ?? '',
    referred_to: row.refertohos ?? '',
    completed_at: row.status === 'completed' ? `${row.visitdate}T${row.timeend ?? row.timestart ?? '00:00:00'}+07:00` : undefined,
  };
}

app.get('/api/health', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 ok');
    res.json({ ok: rows[0].ok === 1 });
  } catch (error) {
    next(error);
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    jhcis_db_host: process.env.JHCIS_DB_HOST ?? 'localhost',
    jhcis_db_port: Number(process.env.JHCIS_DB_PORT ?? 3333),
    jhcis_db_name: process.env.JHCIS_DB_NAME ?? 'jhcisdb',
  });
});

app.get('/api/departments', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT COALESCE(v.timeservice, 'unknown') id,
             COALESCE(ct.timeservicedesc, 'ไม่ระบุช่วงบริการ') name_th,
             COUNT(*) total
      FROM visit v
      LEFT JOIN ctimeservice ct ON ct.timeservicecode = v.timeservice
      WHERE v.flagservice <> '99'
      GROUP BY COALESCE(v.timeservice, 'unknown'), COALESCE(ct.timeservicedesc, 'ไม่ระบุช่วงบริการ')
      ORDER BY id
    `);

    res.json(rows.map((row) => ({
      id: row.id,
      code: row.id === 'unknown' ? 'UNK' : row.id,
      name_th: row.name_th,
      name_en: row.name_th,
    })));
  } catch (error) {
    next(error);
  }
});

app.get('/api/meta', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        MIN(visitdate) min_visit_date,
        MAX(visitdate) max_visit_date,
        COUNT(*) total_visits
      FROM visit
      WHERE flagservice <> '99'
    `);
    res.json({
      min_visit_date: rows[0]?.min_visit_date ?? null,
      max_visit_date: rows[0]?.max_visit_date ?? null,
      total_visits: Number(rows[0]?.total_visits ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard/summary', async (req, res, next) => {
  try {
    const { where, params } = buildWhere(req.query);
    const status = statusSql();
    const [rows] = await pool.query(
      `SELECT
        COUNT(*) total,
        SUM(CASE WHEN ${status} = 'completed' THEN 1 ELSE 0 END) completed,
        SUM(CASE WHEN ${status} = 'waiting' THEN 1 ELSE 0 END) waiting,
        SUM(CASE WHEN ${status} = 'in_progress' THEN 1 ELSE 0 END) in_progress,
        SUM(CASE WHEN ${status} = 'referred' THEN 1 ELSE 0 END) referred
      FROM visit v
      LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
      LEFT JOIN cright cr ON cr.rightcode = v.rightcode
      LEFT JOIN ctitle t ON t.titlecode = p.prename
      WHERE ${where}`,
      params,
    );
    const summary = rows[0] ?? {};
    res.json({
      total: Number(summary.total ?? 0),
      completed: Number(summary.completed ?? 0),
      waiting: Number(summary.waiting ?? 0),
      in_progress: Number(summary.in_progress ?? 0),
      referred: Number(summary.referred ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

async function selectVisits(query, { paginated }) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.page_size ?? 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const { where, params } = buildWhere(query);
  const visitSorts = {
    vn: 'v.visitno',
    hn: 'hn',
    patient_name: 'patient_name',
    department: 'department_name',
    patient_type: 'patient_type',
    insurance_type: 'insurance_type',
    status: 'status',
    visit_at: 'v.visitdate',
  };
  const visitOrder = orderBy(query, visitSorts, 'v.visitdate');

  const baseSelect = `
    SELECT
      v.pcucode,
      v.visitno,
      v.pid,
      COALESCE(NULLIF(CAST(p.hcode AS CHAR), ''), CAST(p.pid AS CHAR)) hn,
      CONCAT(COALESCE(t.titlename, ''), p.fname, ' ', p.lname) patient_name,
      COALESCE(v.timeservice, 'unknown') department_id,
      COALESCE(ct.timeservicedesc, 'ไม่ระบุช่วงบริการ') department_name,
      ${patientTypeSql()} patient_type,
      ${insuranceSql()} insurance_type,
      ${statusSql()} status,
      v.visitdate,
      v.timestart,
      v.timeend,
      v.symptoms,
      v.refertohos
    FROM visit v
    LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
    LEFT JOIN ctitle t ON t.titlecode = p.prename
    LEFT JOIN cright cr ON cr.rightcode = v.rightcode
    LEFT JOIN ctimeservice ct ON ct.timeservicecode = v.timeservice
    WHERE ${where}
    ORDER BY ${visitOrder}, v.timestart DESC, v.visitno DESC
  `;

  if (!paginated) {
    const [rows] = await pool.query(`${baseSelect} LIMIT 10000`, params);
    return { rows };
  }

  const [[countRow], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) total
       FROM visit v
       LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
       LEFT JOIN cright cr ON cr.rightcode = v.rightcode
       LEFT JOIN ctitle t ON t.titlecode = p.prename
       WHERE ${where}`,
      params,
    ),
    pool.query(`${baseSelect} LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
  ]);

  const totalItems = Number(countRow[0]?.total ?? 0);
  return {
    rows,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

app.get('/api/visits', async (req, res, next) => {
  try {
    const result = await selectVisits(req.query, { paginated: true });
    res.json({
      items: result.rows.map(rowToVisit),
      page: result.page,
      page_size: result.pageSize,
      total_items: result.totalItems,
      total_pages: result.totalPages,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/visits/export', async (req, res, next) => {
  try {
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const result = await selectVisits(req.query, { paginated: false });
    const rows = result.rows.map(rowToVisit).map((visit) => ({
      VN: visit.vn,
      HN: visit.hn,
      PatientName: visit.patient_name,
      Department: visit.department.name_th,
      PatientType: visit.patient_type,
      Insurance: visit.insurance_type,
      Status: visit.status,
      VisitDate: visit.visit_at,
      Note: visit.note,
    }));
    const filename = `patient-visits-${req.query.start_date ?? 'all'}-to-${req.query.end_date ?? 'all'}.${format}`;

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Visits');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
});

async function selectIllnessReport(query, { paginated }) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.page_size ?? 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const visitFilterQuery = { ...query, search: '' };
  const { where, params } = buildWhere(visitFilterQuery);
  const illnessWhere = buildIllnessWhere(query);
  const illnessSorts = {
    diagnosis_code: 'diagnosis_code',
    diagnosis_name: 'diagnosis_name',
    visit_count: 'visit_count',
    patient_count: 'patient_count',
    first_visit_date: 'first_visit_date',
    last_visit_date: 'last_visit_date',
  };
  const illnessOrder = orderBy(query, illnessSorts, 'visit_count');

  const fromSql = `
    FROM visit v
    JOIN visitdiag vd ON vd.pcucode = v.pcucode AND vd.visitno = v.visitno
    LEFT JOIN cdisease cd ON cd.diseasecode = vd.diagcode
    LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
    LEFT JOIN ctitle t ON t.titlecode = p.prename
    LEFT JOIN cright cr ON cr.rightcode = v.rightcode
    WHERE ${where}
      AND vd.diagcode IS NOT NULL
      AND vd.diagcode <> ''
      ${illnessWhere.where}
  `;
  const allParams = [...params, ...illnessWhere.params];

  const groupedSql = `
    SELECT
      vd.diagcode diagnosis_code,
      COALESCE(NULLIF(cd.diseasenamethai, ''), NULLIF(cd.diseasename, ''), 'ไม่ระบุชื่อโรค') diagnosis_name,
      COUNT(DISTINCT CONCAT(v.pcucode, ':', v.visitno)) visit_count,
      COUNT(DISTINCT CONCAT(COALESCE(v.pcucodeperson, v.pcucode), ':', v.pid)) patient_count,
      MIN(v.visitdate) first_visit_date,
      MAX(v.visitdate) last_visit_date
    ${fromSql}
    GROUP BY vd.diagcode, diagnosis_name
  `;

  if (!paginated) {
    const [rows] = await pool.query(`${groupedSql} ORDER BY ${illnessOrder}, diagnosis_code ASC LIMIT 10000`, allParams);
    return { rows };
  }

  const [[countResult], [rows]] = await Promise.all([
    pool.query(`SELECT COUNT(*) total FROM (${groupedSql}) illness_groups`, allParams),
    pool.query(`${groupedSql} ORDER BY ${illnessOrder}, diagnosis_code ASC LIMIT ? OFFSET ?`, [...allParams, pageSize, offset]),
  ]);

  const totalItems = Number(countResult[0]?.total ?? 0);
  return {
    rows,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

app.get('/api/reports/illness', async (req, res, next) => {
  try {
    const result = await selectIllnessReport(req.query, { paginated: true });
    res.json({
      items: result.rows.map((row) => ({
        diagnosis_code: row.diagnosis_code,
        diagnosis_name: row.diagnosis_name,
        visit_count: Number(row.visit_count ?? 0),
        patient_count: Number(row.patient_count ?? 0),
        first_visit_date: row.first_visit_date,
        last_visit_date: row.last_visit_date,
      })),
      page: result.page,
      page_size: result.pageSize,
      total_items: result.totalItems,
      total_pages: result.totalPages,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/illness/summary', async (req, res, next) => {
  try {
    const visitFilterQuery = { ...req.query, search: '' };
    const { where, params } = buildWhere(visitFilterQuery);
    const illnessWhere = buildIllnessWhere(req.query);
    const groupCase = illnessGroupSql();

    const [rows] = await pool.query(
      `SELECT
        SUM(CASE WHEN illness_group = 'health_promotion' THEN visit_count ELSE 0 END) health_promotion,
        SUM(CASE WHEN illness_group = 'prevention' THEN visit_count ELSE 0 END) prevention,
        SUM(CASE WHEN illness_group = 'treatment' THEN visit_count ELSE 0 END) treatment,
        SUM(CASE WHEN illness_group = 'rehabilitation' THEN visit_count ELSE 0 END) rehabilitation,
        SUM(CASE WHEN illness_group = 'health_promotion' THEN total_cost ELSE 0 END) health_promotion_cost,
        SUM(CASE WHEN illness_group = 'prevention' THEN total_cost ELSE 0 END) prevention_cost,
        SUM(CASE WHEN illness_group = 'treatment' THEN total_cost ELSE 0 END) treatment_cost,
        SUM(CASE WHEN illness_group = 'rehabilitation' THEN total_cost ELSE 0 END) rehabilitation_cost
      FROM (
        SELECT
          ${groupCase} illness_group,
          COUNT(DISTINCT CONCAT(v.pcucode, ':', v.visitno)) visit_count,
          SUM(COALESCE(v.money1, 0) + COALESCE(v.money2, 0) + COALESCE(v.money3, 0) + COALESCE(v.moneynoclaim, 0)) total_cost
        FROM visit v
        JOIN visitdiag vd ON vd.pcucode = v.pcucode AND vd.visitno = v.visitno
        LEFT JOIN cdisease cd ON cd.diseasecode = vd.diagcode
        LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
        LEFT JOIN ctitle t ON t.titlecode = p.prename
        LEFT JOIN cright cr ON cr.rightcode = v.rightcode
        WHERE ${where}
          AND vd.diagcode IS NOT NULL
          AND vd.diagcode <> ''
          ${illnessWhere.where}
        GROUP BY illness_group
      ) grouped`,
      [...params, ...illnessWhere.params],
    );

    res.json({
      health_promotion: Number(rows[0]?.health_promotion ?? 0),
      prevention: Number(rows[0]?.prevention ?? 0),
      treatment: Number(rows[0]?.treatment ?? 0),
      rehabilitation: Number(rows[0]?.rehabilitation ?? 0),
      health_promotion_cost: Number(rows[0]?.health_promotion_cost ?? 0),
      prevention_cost: Number(rows[0]?.prevention_cost ?? 0),
      treatment_cost: Number(rows[0]?.treatment_cost ?? 0),
      rehabilitation_cost: Number(rows[0]?.rehabilitation_cost ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/illness/age-distribution', async (req, res, next) => {
  try {
    const visitFilterQuery = { ...req.query, search: '' };
    const { where, params } = buildWhere(visitFilterQuery);
    const illnessWhere = buildIllnessWhere(req.query);

    const [rows] = await pool.query(
      `SELECT
        CASE
          WHEN age_years >= 100 THEN '100+'
          ELSE CONCAT(FLOOR(age_years / 10) * 10, '-', FLOOR(age_years / 10) * 10 + 9)
        END age_group,
        CASE
          WHEN age_years >= 100 THEN 100
          ELSE FLOOR(age_years / 10) * 10
        END sort_age,
        COUNT(DISTINCT patient_key) patient_count,
        SUM(total_cost) total_cost
      FROM (
        SELECT
          CONCAT(COALESCE(v.pcucodeperson, v.pcucode), ':', v.pid) patient_key,
          TIMESTAMPDIFF(YEAR, p.birth, v.visitdate) age_years,
          COALESCE(v.money1, 0) + COALESCE(v.money2, 0) + COALESCE(v.money3, 0) + COALESCE(v.moneynoclaim, 0) total_cost
        FROM visit v
        JOIN visitdiag vd ON vd.pcucode = v.pcucode AND vd.visitno = v.visitno
        LEFT JOIN cdisease cd ON cd.diseasecode = vd.diagcode
        LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
        LEFT JOIN ctitle t ON t.titlecode = p.prename
        LEFT JOIN cright cr ON cr.rightcode = v.rightcode
        WHERE ${where}
          AND vd.diagcode IS NOT NULL
          AND vd.diagcode <> ''
          AND p.birth IS NOT NULL
          AND TIMESTAMPDIFF(YEAR, p.birth, v.visitdate) BETWEEN 0 AND 120
          ${illnessWhere.where}
      ) age_rows
      GROUP BY age_group, sort_age
      ORDER BY sort_age ASC`,
      [...params, ...illnessWhere.params],
    );

    const rowMap = new Map(rows.map((row) => [row.age_group, {
      patient_count: Number(row.patient_count ?? 0),
      total_cost: Number(row.total_cost ?? 0),
    }]));
    const buckets = [];
    for (let age = 0; age <= 90; age += 10) {
      const label = `${age}-${age + 9}`;
      const row = rowMap.get(label);
      buckets.push({ age_group: label, patient_count: row?.patient_count ?? 0, total_cost: row?.total_cost ?? 0 });
    }
    const row100 = rowMap.get('100+');
    buckets.push({ age_group: '100+', patient_count: row100?.patient_count ?? 0, total_cost: row100?.total_cost ?? 0 });
    res.json(buckets);
  } catch (error) {
    next(error);
  }
});

function ageGroupCondition(ageGroup) {
  if (ageGroup === '100+') return { sql: 'TIMESTAMPDIFF(YEAR, p.birth, v.visitdate) >= 100', params: [] };
  const match = /^(\d+)-(\d+)$/.exec(ageGroup);
  if (!match) return { sql: '1 = 0', params: [] };
  return {
    sql: 'TIMESTAMPDIFF(YEAR, p.birth, v.visitdate) BETWEEN ? AND ?',
    params: [Number(match[1]), Number(match[2])],
  };
}

app.get('/api/reports/illness/age-costs', async (req, res, next) => {
  try {
    const ageGroup = String(req.query.age_group ?? '').trim();
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.page_size ?? 20), 1), 100);
    const offset = (page - 1) * pageSize;
    const visitFilterQuery = { ...req.query, search: '' };
    const { where, params } = buildWhere(visitFilterQuery);
    const illnessWhere = buildIllnessWhere(req.query);
    const ageCondition = ageGroupCondition(ageGroup);
    const costSorts = {
      vn: 'v.visitno',
      hn: 'hn',
      patient_name: 'patient_name',
      diagnosis_code: 'vd.diagcode',
      diagnosis_name: 'diagnosis_name',
      visit_date: 'v.visitdate',
      age_years: 'age_years',
      total_cost: 'total_cost',
    };
    const costOrder = orderBy(req.query, costSorts, 'total_cost');

    const baseSql = `
      SELECT
        CONCAT('VN', v.visitno) vn,
        COALESCE(NULLIF(CAST(p.hcode AS CHAR), ''), CAST(p.pid AS CHAR)) hn,
        CONCAT(COALESCE(t.titlename, ''), p.fname, ' ', p.lname) patient_name,
        vd.diagcode diagnosis_code,
        COALESCE(NULLIF(cd.diseasenamethai, ''), NULLIF(cd.diseasename, ''), 'ไม่ระบุชื่อโรค') diagnosis_name,
        v.visitdate visit_date,
        v.pcucode,
        v.visitno,
        TIMESTAMPDIFF(YEAR, p.birth, v.visitdate) age_years,
        COALESCE(v.money1, 0) money1,
        COALESCE(v.money2, 0) money2,
        COALESCE(v.money3, 0) money3,
        COALESCE(v.moneynoclaim, 0) moneynoclaim,
        COALESCE(v.money1, 0) + COALESCE(v.money2, 0) + COALESCE(v.money3, 0) + COALESCE(v.moneynoclaim, 0) total_cost
      FROM visit v
      JOIN visitdiag vd ON vd.pcucode = v.pcucode AND vd.visitno = v.visitno
      LEFT JOIN cdisease cd ON cd.diseasecode = vd.diagcode
      LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
      LEFT JOIN ctitle t ON t.titlecode = p.prename
      LEFT JOIN cright cr ON cr.rightcode = v.rightcode
      WHERE ${where}
        AND vd.diagcode IS NOT NULL
        AND vd.diagcode <> ''
        AND p.birth IS NOT NULL
        AND TIMESTAMPDIFF(YEAR, p.birth, v.visitdate) BETWEEN 0 AND 120
        AND ${ageCondition.sql}
        ${illnessWhere.where}
    `;
    const allParams = [...params, ...ageCondition.params, ...illnessWhere.params];

    const [[countResult], [rows]] = await Promise.all([
      pool.query(`SELECT COUNT(*) total FROM (${baseSql}) cost_rows`, allParams),
      pool.query(`${baseSql} ORDER BY ${costOrder}, visit_date DESC LIMIT ? OFFSET ?`, [...allParams, pageSize, offset]),
    ]);
    const totalItems = Number(countResult[0]?.total ?? 0);

    res.json({
      items: rows.map((row) => ({
        vn: row.vn,
        pcucode: row.pcucode,
        visitno: Number(row.visitno),
        hn: String(row.hn ?? ''),
        patient_name: row.patient_name?.trim() || 'ไม่ระบุชื่อ',
        diagnosis_code: row.diagnosis_code,
        diagnosis_name: row.diagnosis_name,
        visit_date: row.visit_date,
        age_years: Number(row.age_years ?? 0),
        money1: Number(row.money1 ?? 0),
        money2: Number(row.money2 ?? 0),
        money3: Number(row.money3 ?? 0),
        moneynoclaim: Number(row.moneynoclaim ?? 0),
        total_cost: Number(row.total_cost ?? 0),
      })),
      page,
      page_size: pageSize,
      total_items: totalItems,
      total_pages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/visit-charge-lines', async (req, res, next) => {
  try {
    const pcucode = String(req.query.pcucode ?? '').trim();
    const visitno = Number(req.query.visitno ?? 0);
    if (!pcucode || !visitno) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'pcucode and visitno are required' } });
      return;
    }

    const [rows] = await pool.query(
      `SELECT * FROM (
        SELECT
          'ยา/เวชภัณฑ์' source,
          vd.drugcode item_code,
          COALESCE(NULLIF(cd.drugnamethai, ''), NULLIF(cd.drugname, ''), vd.drugcode) item_name,
          COALESCE(vd.unit, 1) quantity,
          COALESCE(vd.realprice, 0) unit_price,
          COALESCE(vd.realprice, 0) * COALESCE(vd.unit, 1) total_price
        FROM visitdrug vd
        LEFT JOIN cdrug cd ON cd.drugcode = vd.drugcode
        WHERE vd.pcucode = ? AND vd.visitno = ?

        UNION ALL

        SELECT
          'วัคซีน' source,
          ve.vaccinecode item_code,
          COALESCE(NULLIF(ve.nameofvaccine, ''), ve.vaccinecode) item_name,
          1 quantity,
          COALESCE(ve.realprice, ve.costprice, 0) unit_price,
          COALESCE(ve.realprice, ve.costprice, 0) total_price
        FROM visitepi ve
        WHERE ve.pcucode = ? AND ve.visitno = ?

        UNION ALL

        SELECT
          'วางแผนครอบครัว' source,
          vf.fpcode item_code,
          CONCAT('FP ', vf.fpcode) item_name,
          COALESCE(vf.unit, 1) quantity,
          COALESCE(vf.realprice, vf.costprice, 0) unit_price,
          COALESCE(vf.realprice, vf.costprice, 0) * COALESCE(vf.unit, 1) total_price
        FROM visitfp vf
        WHERE vf.pcucode = ? AND vf.visitno = ?

        UNION ALL

        SELECT
          'ฝากครรภ์' source,
          'ANC' item_code,
          'บริการฝากครรภ์' item_name,
          1 quantity,
          COALESCE(va.ancsell, va.anccost, 0) unit_price,
          COALESCE(va.ancsell, va.anccost, 0) total_price
        FROM visitanc va
        WHERE va.pcucode = ? AND va.visitno = ?

        UNION ALL

        SELECT
          'แม่หลังคลอด' source,
          'MOTHERCARE' item_code,
          'บริการแม่หลังคลอด' item_name,
          1 quantity,
          COALESCE(vm.mothercaresell, vm.mothercarecost, 0) unit_price,
          COALESCE(vm.mothercaresell, vm.mothercarecost, 0) total_price
        FROM visitancmothercare vm
        WHERE vm.pcucode = ? AND vm.visitno = ?

        UNION ALL

        SELECT
          'เด็กหลังคลอด' source,
          'BABYCARE' item_code,
          'บริการเด็กหลังคลอด' item_name,
          1 quantity,
          COALESCE(vb.babycaresell, vb.babycarecost, 0) unit_price,
          COALESCE(vb.babycaresell, vb.babycarecost, 0) total_price
        FROM visitbabycare vb
        WHERE vb.pcucode = ? AND vb.visitno = ?

        UNION ALL

        SELECT
          'LAB' source,
          'LABBLOOD' item_code,
          'ตรวจเลือด' item_name,
          1 quantity,
          COALESCE(vlb.sell, vlb.cost, 0) unit_price,
          COALESCE(vlb.sell, vlb.cost, 0) total_price
        FROM visitlabblood vlb
        WHERE vlb.pcucode = ? AND vlb.visitno = ?

        UNION ALL

        SELECT
          'LAB' source,
          'LABCANCER' item_code,
          'ตรวจคัดกรองมะเร็ง' item_name,
          1 quantity,
          COALESCE(vlc.sell, vlc.cost, 0) unit_price,
          COALESCE(vlc.sell, vlc.cost, 0) total_price
        FROM visitlabcancer vlc
        WHERE vlc.pcucode = ? AND vlc.visitno = ?

        UNION ALL

        SELECT
          'LAB' source,
          'LABSUGAR' item_code,
          'ตรวจน้ำตาลในเลือด' item_name,
          1 quantity,
          COALESCE(vls.cost, 0) unit_price,
          COALESCE(vls.cost, 0) total_price
        FROM visitlabsugarblood vls
        WHERE vls.pcucode = ? AND vls.visitno = ?
      ) charge_lines
      WHERE total_price <> 0
      ORDER BY source, item_name`,
      [
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
        pcucode, visitno,
      ],
    );

    const mapped = rows.map((row) => ({
      source: row.source,
      item_code: row.item_code,
      item_name: row.item_name,
      quantity: Number(row.quantity ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      total_price: Number(row.total_price ?? 0),
    }));

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/illness/patients', async (req, res, next) => {
  try {
    const diagnosisCode = String(req.query.diagnosis_code ?? '').trim();
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.page_size ?? 20), 1), 100);
    const offset = (page - 1) * pageSize;

    if (!diagnosisCode) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'diagnosis_code is required',
        },
      });
      return;
    }

    const visitFilterQuery = { ...req.query, search: '' };
    const { where, params } = buildWhere(visitFilterQuery);
    const illnessWhere = buildIllnessWhere(req.query);
    const patientSorts = {
      hn: 'hn',
      patient_name: 'patient_name',
      visit_count: 'visit_count',
      first_visit_date: 'first_visit_date',
      last_visit_date: 'last_visit_date',
      latest_symptoms: 'latest_symptoms',
    };
    const patientOrder = orderBy(req.query, patientSorts, 'last_visit_date');
    const groupSql = `
      SELECT
        COALESCE(NULLIF(CAST(p.hcode AS CHAR), ''), CAST(p.pid AS CHAR)) hn,
        CONCAT(COALESCE(t.titlename, ''), p.fname, ' ', p.lname) patient_name,
        COUNT(DISTINCT CONCAT(v.pcucode, ':', v.visitno)) visit_count,
        MIN(v.visitdate) first_visit_date,
        MAX(v.visitdate) last_visit_date,
        MAX(v.symptoms) latest_symptoms
      FROM visit v
      JOIN visitdiag vd ON vd.pcucode = v.pcucode AND vd.visitno = v.visitno
      LEFT JOIN person p ON p.pcucodeperson = v.pcucodeperson AND p.pid = v.pid
      LEFT JOIN ctitle t ON t.titlecode = p.prename
      LEFT JOIN cright cr ON cr.rightcode = v.rightcode
      WHERE ${where}
        AND vd.diagcode = ?
        ${illnessWhere.where}
      GROUP BY hn, patient_name
    `;
    const allParams = [...params, diagnosisCode, ...illnessWhere.params];

    const [[countResult], [rows]] = await Promise.all([
      pool.query(`SELECT COUNT(*) total FROM (${groupSql}) patient_groups`, allParams),
      pool.query(`${groupSql} ORDER BY ${patientOrder}, patient_name ASC LIMIT ? OFFSET ?`, [
        ...allParams,
        pageSize,
        offset,
      ]),
    ]);

    const totalItems = Number(countResult[0]?.total ?? 0);

    res.json({
      diagnosis_code: diagnosisCode,
      items: rows.map((row) => ({
        hn: String(row.hn ?? ''),
        patient_name: row.patient_name?.trim() || 'ไม่ระบุชื่อ',
        visit_count: Number(row.visit_count ?? 0),
        first_visit_date: row.first_visit_date,
        last_visit_date: row.last_visit_date,
        latest_symptoms: row.latest_symptoms ?? '',
      })),
      page,
      page_size: pageSize,
      total_items: totalItems,
      total_pages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/illness/export', async (req, res, next) => {
  try {
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const result = await selectIllnessReport(req.query, { paginated: false });
    const rows = result.rows.map((row) => ({
      DiagnosisCode: row.diagnosis_code,
      DiagnosisName: row.diagnosis_name,
      VisitCount: Number(row.visit_count ?? 0),
      PatientCount: Number(row.patient_count ?? 0),
      FirstVisitDate: row.first_visit_date,
      LastVisitDate: row.last_visit_date,
    }));
    const filename = `illness-report-${req.query.start_date ?? 'all'}-to-${req.query.end_date ?? 'all'}.${format}`;

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Illness');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: {
      code: 'JHCIS_DB_ERROR',
      message: err.message ?? 'Unable to query JHCIS database',
    },
  });
});

app.listen(port, host, () => {
  console.log(`JHCIS API listening on http://${host}:${port}`);
});
