export type TFacultyAttendanceStatus = 'present' | 'absent' | 'on_leave' | 'half_day' | 'late';

export interface IFacultyAttendanceUser {
  _id: string;
  name?: string;
  email?: string;
  employeeId?: string;
}

export interface IFacultyAttendance {
  _id: string;
  facultyId: string | IFacultyAttendanceUser;
  facultyName?: string;
  departmentId: string;
  date: string;
  status: TFacultyAttendanceStatus;
  remarks?: string;
  markedBy?: string;
  checkInTime?: string;
  checkOutTime?: string;
  isLocked?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
