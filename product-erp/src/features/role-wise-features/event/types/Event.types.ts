export type TEventType =
  | 'workshop'
  | 'seminar'
  | 'cultural'
  | 'sports'
  | 'technical'
  | 'placement'
  | 'other';
export type TEventAudience = 'all' | 'student' | 'faculty';

export interface IEventPerson {
  _id: string;
  name?: string;
  email?: string;
}

export interface IEventRegistration {
  userId: IEventPerson | string;
  registeredAt: string;
  attended: boolean;
}

export interface IEvent {
  _id: string;
  title: string;
  description: string;
  eventType: TEventType;
  venue: string;
  startDate: string;
  endDate: string;
  organizingDepartment?: { _id: string; name?: string; code?: string } | string;
  coordinators: Array<IEventPerson | string>;
  targetAudience: TEventAudience[];
  maxRegistrations?: number;
  registrations: IEventRegistration[];
  myRegistration?: IEventRegistration;
  isRegistered?: boolean;
  registrationCount: number;
  isPublished: boolean;
  isCancelled: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: IEventPerson | string;
  createdBy?: IEventPerson | string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
