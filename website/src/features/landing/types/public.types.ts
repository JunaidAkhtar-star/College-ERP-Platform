export interface IPlatformProduct {
  _id: string;
  name: string;
  slug: string;
  eyebrow: string;
  description: string;
  status: 'available' | 'planned' | 'retired';
  publicPath?: string;
  icon: string;
  isPublic: boolean;
  sortOrder: number;
}

export interface IProductModule {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  frontendRoute: string;
  apiRoute: string;
  features: string[];
  status: 'active' | 'maintenance' | 'planned';
  sortOrder: number;
  isPublic: boolean;
  tier: 'core' | 'standard' | 'premium' | 'ultimate';
  productSlug: string;
}

export interface ISubscriptionPlan {
  _id: string;
  name: string;
  slug: string;
  description: string;
  priceLabel: string;
  billingPeriod: 'month' | 'year' | 'one_time';
  availableBillingPeriods: ('month' | 'year' | 'one_time')[];
  monthlyAmountInPaise: number;
  moduleSlugs: string[];
  highlights: string[];
  studentLimit: number;
  employeeLimit: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  planType: 'free' | 'paid';
  amountInPaise: number;
  pricingModel: 'per_user_day' | 'fixed';
  dailyRatePaise: number;
  minimumBillableUsers: number;
  currency: 'INR';
  trialDays: number;
  graceDays: number;
  includedAddonSlugs: string[];
  productSlug: string;
  meetingLimits: {
    maxParticipants: number;
    maxDurationMinutes: number;
    monthlyMinutes: number;
    concurrentMeetings: number;
    recordingEnabled: boolean;
    recordingStorageMb: number;
    retentionDays: number;
  };
}

export interface IProductAddon {
  _id: string;
  name: string;
  slug: string;
  description: string;
  moduleSlugs: string[];
  featureKeys: string[];
  amountInPaise: number;
  currency: 'INR';
  billingPeriod: 'month' | 'year' | 'one_time';
  availableBillingPeriods: ('month' | 'year' | 'one_time')[];
  monthlyAmountInPaise: number;
  isActive: boolean;
  sortOrder: number;
  productSlug: string;
  capacityBoost?: {
    additionalStudents: number;
    additionalEmployees: number;
  };
  meetingLimitBoost?: {
    additionalParticipants: number;
    additionalMonthlyMinutes: number;
    additionalConcurrentMeetings: number;
    additionalRecordingStorageMb: number;
    additionalRetentionDays: number;
    enableRecording: boolean;
  };
}

export interface IPublicSiteConfig {
  _id?: string;
  companyName: string;
  headline: string;
  description: string;
  supportEmail: string;
  salesEmail: string;
  phone: string;
  address: string;
  socialLinks: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    x?: string;
  };
}
