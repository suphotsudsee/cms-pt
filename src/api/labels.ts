import type { InsuranceType, PatientType, UserRole, VisitStatus } from '../types/visit';

export const statusLabels: Record<VisitStatus, string> = {
  waiting: 'รอรับบริการ',
  in_progress: 'กำลังรับบริการ',
  completed: 'เสร็จสิ้น',
  referred: 'ส่งต่อ',
};

export const patientTypeLabels: Record<PatientType, string> = {
  opd: 'ผู้ป่วยนอก',
  emergency: 'ฉุกเฉิน',
  refer: 'ส่งต่อ',
  follow_up: 'ติดตามอาการ',
};

export const insuranceLabels: Record<InsuranceType, string> = {
  uc: 'บัตรทอง',
  social_security: 'ประกันสังคม',
  civil_servant: 'ข้าราชการ',
  self_pay: 'ชำระเงินเอง',
  private_insurance: 'ประกันเอกชน',
  other: 'อื่นๆ',
};

export const roleLabels: Record<UserRole, string> = {
  screening: 'เจ้าหน้าที่คัดกรอง',
  nurse: 'พยาบาลห้องตรวจ',
  manager: 'ผู้บริหาร',
};
