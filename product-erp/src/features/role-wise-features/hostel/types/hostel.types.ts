export type THostelType = 'boys' | 'girls' | 'mixed';
export type TRoomType = 'single' | 'double' | 'triple' | 'dormitory';
export type TRoomStatus = 'available' | 'full' | 'maintenance';
export type TAllocationStatus = 'active' | 'vacated' | 'transferred';

export interface IHostelRoom {
  _id: string;
  hostelName: string;
  roomNumber: string;
  blockName: string;
  hostelType: THostelType;
  floor: number;
  capacity: number;
  occupancy: number;
  roomType: TRoomType;
  facilities?: string[];
  status: TRoomStatus;
  monthlyFee?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface IHostelAllocation {
  _id: string;
  studentId: string | { _id: string; name?: string; rollNumber?: string };
  studentName: string;
  roomNumber: string;
  blockName: string;
  hostelType: THostelType;
  allocationDate: string;
  allotmentDate?: string;
  academicYear: string;
  monthlyFee?: number;
  messFee?: number;
  vacatingDate?: string;
  status: TAllocationStatus;
  roomId: string | IHostelRoom;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
