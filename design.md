# System & Technical Design: Hospital Patient Tracking Dashboard

## 1. ภาพรวมสถาปัตยกรรม

ระบบประกอบด้วย 3 ส่วนหลัก:

- Frontend: Web application สำหรับแดชบอร์ดและตารางผู้ป่วย
- Backend: FastAPI สำหรับ authentication, dashboard statistics, visits, departments และ export
- Database: PostgreSQL สำหรับเก็บ patients, departments และ visits

โครงสร้างการไหลของข้อมูล:

1. ผู้ใช้เข้าสู่ระบบและได้รับ access token
2. Frontend ส่ง request พร้อม token ไปยัง FastAPI
3. Backend ตรวจสอบสิทธิ์และ role
4. Backend query ข้อมูลจาก PostgreSQL ตาม filter
5. Backend ส่ง response กลับให้ Frontend แสดงผล

## 2. Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Database | PostgreSQL |
| ORM | SQLAlchemy หรือ SQLModel |
| Auth | JWT Bearer Token |
| Export | CSV writer, openpyxl หรือ xlsxwriter |

## 3. Database Schema

### 3.1 `departments`

เก็บข้อมูลแผนกหรือจุดบริการ

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name_th VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

ตัวอย่างข้อมูล:

| code | name_th |
| --- | --- |
| OPD | ผู้ป่วยนอก |
| ER | ห้องฉุกเฉิน |
| PED | กุมารเวช |
| MED | อายุรกรรม |

### 3.2 `patients`

เก็บข้อมูลผู้ป่วย

```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hn VARCHAR(30) NOT NULL UNIQUE,
    national_id VARCHAR(20),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    birth_date DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'unknown')),
    phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

ข้อควรระวัง:

- `hn` ต้อง unique
- `national_id` อาจเป็น null ได้ในกรณีไม่มีข้อมูลหรือเป็นผู้ป่วยต่างชาติ
- Frontend ไม่ควรแสดงเลขบัตรประชาชนเต็มในตารางหลัก

### 3.3 `visits`

เก็บข้อมูลการเข้ารับบริการแต่ละครั้ง

```sql
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vn VARCHAR(30) NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    patient_type VARCHAR(30) NOT NULL CHECK (
        patient_type IN ('opd', 'emergency', 'refer', 'follow_up')
    ),
    insurance_type VARCHAR(40) NOT NULL CHECK (
        insurance_type IN ('uc', 'social_security', 'civil_servant', 'self_pay', 'private_insurance', 'other')
    ),
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('waiting', 'in_progress', 'completed', 'referred')
    ),
    visit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    referred_to VARCHAR(120),
    note TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes ที่ควรมี:

```sql
CREATE INDEX idx_visits_visit_at ON visits(visit_at);
CREATE INDEX idx_visits_department_id ON visits(department_id);
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_visits_patient_type ON visits(patient_type);
CREATE INDEX idx_visits_insurance_type ON visits(insurance_type);
CREATE INDEX idx_visits_patient_id ON visits(patient_id);
```

## 4. ENUM Values

### 4.1 Visit Status

| Value | Label TH | สี UI |
| --- | --- | --- |
| `waiting` | รอรับบริการ | Orange |
| `in_progress` | กำลังรับบริการ | Blue |
| `completed` | เสร็จสิ้น | Green |
| `referred` | ส่งต่อ | Pink |

### 4.2 Patient Type

| Value | Label TH |
| --- | --- |
| `opd` | ผู้ป่วยนอก |
| `emergency` | ฉุกเฉิน |
| `refer` | ส่งต่อ |
| `follow_up` | ติดตามอาการ |

### 4.3 Insurance Type

| Value | Label TH |
| --- | --- |
| `uc` | บัตรทอง |
| `social_security` | ประกันสังคม |
| `civil_servant` | ข้าราชการ |
| `self_pay` | ชำระเงินเอง |
| `private_insurance` | ประกันเอกชน |
| `other` | อื่นๆ |

## 5. API Specification

Base URL:

```text
/api/v1
```

ทุก endpoint ยกเว้น login ต้องส่ง header:

```http
Authorization: Bearer <access_token>
```

### 5.1 Get Dashboard Summary

```http
GET /api/v1/dashboard/summary
```

Query parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `start_date` | date | no | วันที่เริ่มต้น เช่น `2026-05-01` |
| `end_date` | date | no | วันที่สิ้นสุด เช่น `2026-05-17` |
| `department_id` | uuid | no | กรองแผนก |
| `insurance_type` | string | no | กรองสิทธิการรักษา |
| `patient_type` | string | no | กรองประเภทผู้ป่วย |

Response:

```json
{
  "total": 128,
  "completed": 84,
  "waiting": 21,
  "in_progress": 17,
  "referred": 6
}
```

Backend logic:

- ใช้ filter เดียวกับตาราง visit
- `total` คือจำนวน visit ทั้งหมดหลังกรอง
- ค่า status แต่ละตัวนับด้วย conditional aggregation

ตัวอย่าง SQL:

```sql
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
    COUNT(*) FILTER (WHERE status = 'referred') AS referred
FROM visits
WHERE visit_at >= :start_date
  AND visit_at < :end_date_plus_one;
```

### 5.2 Get Visit List

```http
GET /api/v1/visits
```

Query parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | no | default `1` |
| `page_size` | integer | no | default `20`, max `100` |
| `start_date` | date | no | วันที่เริ่มต้น |
| `end_date` | date | no | วันที่สิ้นสุด |
| `department_id` | uuid | no | แผนก |
| `insurance_type` | string | no | สิทธิการรักษา |
| `patient_type` | string | no | ประเภทผู้ป่วย |
| `status` | string | no | สถานะ |
| `search` | string | no | ค้นหา HN, VN, ชื่อ หรือนามสกุล |

Response:

```json
{
  "items": [
    {
      "id": "6d2b6fa7-6f4a-46e9-ae0c-1bc68d40b312",
      "vn": "VN202605170001",
      "hn": "HN000123",
      "patient_name": "สมชาย ใจดี",
      "department": {
        "id": "0c9b1c8e-7072-4573-a23f-cde8cbffda11",
        "code": "OPD",
        "name_th": "ผู้ป่วยนอก"
      },
      "patient_type": "opd",
      "insurance_type": "uc",
      "status": "waiting",
      "visit_at": "2026-05-17T08:30:00+07:00"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total_items": 128,
  "total_pages": 7
}
```

### 5.3 Create Visit

```http
POST /api/v1/visits
```

Request:

```json
{
  "patient_id": "1c9b7ec6-91f4-4f66-8d0c-f75a6094ef22",
  "department_id": "0c9b1c8e-7072-4573-a23f-cde8cbffda11",
  "patient_type": "opd",
  "insurance_type": "uc",
  "note": "มาด้วยอาการไข้"
}
```

Response:

```json
{
  "id": "6d2b6fa7-6f4a-46e9-ae0c-1bc68d40b312",
  "vn": "VN202605170001",
  "status": "waiting",
  "visit_at": "2026-05-17T08:30:00+07:00"
}
```

Business rules:

- Backend สร้าง `vn` อัตโนมัติ
- Status เริ่มต้นต้องเป็น `waiting`
- ต้องตรวจสอบว่า `patient_id` และ `department_id` มีอยู่จริง

### 5.4 Update Visit Status

```http
PATCH /api/v1/visits/{visit_id}/status
```

Request:

```json
{
  "status": "completed",
  "note": "ตรวจเสร็จแล้ว รับยาและกลับบ้าน"
}
```

Response:

```json
{
  "id": "6d2b6fa7-6f4a-46e9-ae0c-1bc68d40b312",
  "status": "completed",
  "completed_at": "2026-05-17T10:15:00+07:00"
}
```

Business rules:

- หาก status เป็น `completed` ให้ set `completed_at`
- หาก status เป็น `referred` สามารถบันทึก `referred_to` เพิ่มได้
- ต้องตรวจ role และ department ก่อนอัปเดต

### 5.5 Export Report

```http
GET /api/v1/reports/visits/export
```

Query parameters:

- ใช้ชุดเดียวกับ `GET /api/v1/visits`
- เพิ่ม `format=csv` หรือ `format=xlsx`

Response:

- `text/csv` สำหรับ CSV
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` สำหรับ XLSX

ชื่อไฟล์แนะนำ:

```text
patient-visits-2026-05-01-to-2026-05-17.csv
```

## 6. Authorization Matrix

| Feature | Screening | Nurse | Manager |
| --- | --- | --- | --- |
| View dashboard summary | Own area | Own department | All departments |
| View visit list | Own area | Own department | All departments |
| Create visit | Yes | No | Optional |
| Update visit status | Limited | Yes | Optional admin only |
| Export report | No | Own department | All departments |
| Manage departments | No | No | Admin only |

Backend ต้อง enforce สิทธิ์ทุกครั้ง ห้ามพึ่งการซ่อนปุ่มใน Frontend เพียงอย่างเดียว

## 7. Frontend Structure

โครงสร้างไฟล์แนะนำ:

```text
src/
  api/
    client.ts
    dashboard.ts
    visits.ts
    reports.ts
  components/
    filters/
      DashboardFilters.tsx
    summary/
      SummaryCard.tsx
    visits/
      VisitTable.tsx
      StatusBadge.tsx
      VisitActions.tsx
  pages/
    DashboardPage.tsx
  types/
    dashboard.ts
    visit.ts
```

## 8. TypeScript Types

```ts
export type VisitStatus = 'waiting' | 'in_progress' | 'completed' | 'referred';

export type PatientType = 'opd' | 'emergency' | 'refer' | 'follow_up';

export type InsuranceType =
  | 'uc'
  | 'social_security'
  | 'civil_servant'
  | 'self_pay'
  | 'private_insurance'
  | 'other';

export interface DashboardSummary {
  total: number;
  completed: number;
  waiting: number;
  in_progress: number;
  referred: number;
}

export interface VisitListItem {
  id: string;
  vn: string;
  hn: string;
  patient_name: string;
  department: {
    id: string;
    code: string;
    name_th: string;
  };
  patient_type: PatientType;
  insurance_type: InsuranceType;
  status: VisitStatus;
  visit_at: string;
}
```

## 9. Tailwind UI Guide

### 9.1 Layout

Page container:

```text
min-h-screen bg-slate-50 text-slate-900
```

Content wrapper:

```text
mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8
```

Filter bar:

```text
flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm
```

Table wrapper:

```text
overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm
```

### 9.2 Summary Cards

Shared card classes:

```text
rounded-lg border bg-white p-4 shadow-sm
```

Total:

```text
border-slate-200 text-slate-900
```

Completed:

```text
border-emerald-200 bg-emerald-50 text-emerald-900
```

Waiting:

```text
border-orange-200 bg-orange-50 text-orange-900
```

In-Progress:

```text
border-blue-200 bg-blue-50 text-blue-900
```

Referred:

```text
border-pink-200 bg-pink-50 text-pink-900
```

### 9.3 Status Badges

Base badge:

```text
inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
```

Status variants:

```ts
const statusBadgeClass: Record<VisitStatus, string> = {
  waiting: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
  in_progress: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  referred: 'bg-pink-100 text-pink-800 ring-1 ring-pink-200',
};
```

### 9.4 Buttons

Primary:

```text
inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

Secondary:

```text
inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

Danger:

```text
inline-flex items-center justify-center rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
```

### 9.5 Table

Header cells:

```text
bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600
```

Body cells:

```text
whitespace-nowrap px-4 py-3 text-sm text-slate-700
```

Rows:

```text
border-t border-slate-100 hover:bg-slate-50
```

## 10. Backend Implementation Notes

### 10.1 Filter Builder

ควรสร้าง helper กลางสำหรับประกอบ filter เพื่อให้ summary, visit list และ export ใช้ logic เดียวกัน

Pseudo-code:

```py
def apply_visit_filters(query, filters, current_user):
    if filters.start_date:
        query = query.where(Visit.visit_at >= filters.start_date_start)
    if filters.end_date:
        query = query.where(Visit.visit_at < filters.end_date_plus_one)
    if filters.department_id:
        query = query.where(Visit.department_id == filters.department_id)
    if filters.insurance_type:
        query = query.where(Visit.insurance_type == filters.insurance_type)
    if filters.patient_type:
        query = query.where(Visit.patient_type == filters.patient_type)
    if filters.status:
        query = query.where(Visit.status == filters.status)
    return apply_role_scope(query, current_user)
```

### 10.2 Pagination

สูตร:

```text
offset = (page - 1) * page_size
```

ข้อกำหนด:

- `page` ต้องไม่น้อยกว่า 1
- `page_size` ต้องอยู่ระหว่าง 1 ถึง 100
- Response ต้องมี `total_items` และ `total_pages`

### 10.3 Date Handling

- Frontend ส่งวันที่เป็น `YYYY-MM-DD`
- Backend แปลงเป็นช่วงเวลา timezone ของโรงพยาบาล
- `end_date` ต้องใช้หลัก exclusive upper bound เช่น `visit_at < end_date + 1 day`
- หลีกเลี่ยง `DATE(visit_at)` ใน WHERE เพราะทำให้ index ทำงานได้ไม่เต็มที่

## 11. Error Response Format

ใช้รูปแบบเดียวกันทุก endpoint:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status value",
    "details": {
      "field": "status"
    }
  }
}
```

ตัวอย่าง code:

| Code | HTTP Status | ใช้เมื่อ |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | parameter หรือ body ไม่ถูกต้อง |
| `UNAUTHORIZED` | 401 | ไม่มี token หรือ token หมดอายุ |
| `FORBIDDEN` | 403 | role ไม่มีสิทธิ์ |
| `NOT_FOUND` | 404 | ไม่พบ resource |
| `CONFLICT` | 409 | HN หรือ VN ซ้ำ |

## 12. Testing Checklist

Backend:

- ทดสอบ filter ตาม date range
- ทดสอบ filter ตาม department
- ทดสอบ search ด้วย HN, VN และชื่อ
- ทดสอบ role scope ของแต่ละ role
- ทดสอบ summary count ให้ตรงกับ visit list
- ทดสอบ export CSV/XLSX ตาม filter

Frontend:

- เปลี่ยน filter แล้วข้อมูลโหลดใหม่
- Summary cards แสดงเลขถูกต้อง
- Status badge สีถูกต้อง
- Pagination ทำงานถูกต้อง
- Export button ส่ง query parameters ถูกต้อง
- หน้าจอ tablet และ desktop ไม่ล้น

## 13. Implementation Order สำหรับ Junior Developer

1. สร้าง database tables และ seed departments
2. สร้าง model และ schema ของ departments, patients, visits
3. ทำ endpoint `GET /departments`
4. ทำ endpoint `POST /visits`
5. ทำ endpoint `GET /visits` พร้อม filter และ pagination
6. ทำ endpoint `GET /dashboard/summary`
7. ทำ endpoint `PATCH /visits/{visit_id}/status`
8. ทำ endpoint export CSV/XLSX
9. สร้างหน้า Dashboard และ filter bar
10. สร้าง summary cards
11. สร้าง visit table และ status badge
12. เชื่อมปุ่ม export
13. เพิ่ม test ตาม checklist

