/**
 * @file super-admin.types.ts
 * @description Global type definitions and interfaces for the SaaS Control Center.
 * @module features/super-admin/types
 */

export interface ITenant {
  _id: string;
  tenantId: string;
  name: string;
  databaseName: string;
  status:
    | 'pending_payment'
    | 'pending_approval'
    | 'provisioning'
    | 'active'
    | 'suspended'
    | 'expired'
    | 'provisioning_failed';
  subscriptionExpiresAt: string;
  maxStudents?: number;
  maxEmployees?: number;
  planId?: string;
  enabledModuleSlugs?: string[];
  entitlementEnforced?: boolean;
  billingStatus?:
    | 'trialing'
    | 'pending_payment'
    | 'pending_approval'
    | 'active'
    | 'past_due'
    | 'free'
    | 'cancelled';
  billingEmail?: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  enabledAddonSlugs?: string[];
  customDomain?: string;
  customDomainStatus?: 'pending' | 'verified' | 'active' | 'failed';
  sslStatus?: 'pending' | 'active' | 'failed';
  createdAt: string;
  updatedAt?: string;
}

export interface ITenantUsage {
  tenantId: string;
  students: number;
  employees: number;
  databaseReachable: boolean;
  planName?: string;
  enabledModuleCount: number;
  measuredAt: string;
}

export interface IMonthlyPlatformMetric {
  month: string;
  tenants: number;
  leads: number;
  conversions: number;
}

export interface IPlatformOverview {
  tenants: ITenant[];
  leads: ILead[];
  modules: IProductModule[];
  plans: ISubscriptionPlan[];
  publicProfile?: IPublicSiteConfig;
  tenantUsage: ITenantUsage[];
  measuredAt: string;
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
  capacityBoost?: {
    additionalStudents: number;
    additionalEmployees: number;
  };
}

export interface IPlatformBillingRecord {
  _id: string;
  checkoutId?: string;
  tenantId: { _id: string; name: string; tenantId: string; billingEmail?: string } | string | null;
  planId:
    | { _id: string; name: string; slug: string; billingPeriod: 'month' | 'year' | 'one_time' }
    | string
    | null;
  addonSlugs: string[];
  lineItems?: Array<{
    kind: 'plan' | 'addon';
    slug: string;
    description: string;
    billingLabel: string;
    amountInPaise: number;
  }>;
  invoiceNumber: string;
  amountInPaise: number;
  subtotalInPaise?: number;
  listPriceInPaise?: number;
  discountInPaise?: number;
  couponCode?: string;
  couponDiscountInPaise?: number;
  taxRatePercent?: number;
  taxAmountInPaise?: number;
  currency: 'INR';
  status: 'created' | 'submitted' | 'paid' | 'rejected' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod: 'bank_transfer';
  transferReference?: string;
  paymentChannel?: 'neft' | 'rtgs' | 'imps' | 'upi';
  paymentProofUrl?: string;
  paymentProofMimeType?: string;
  paymentDate?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  refundAmountInPaise?: number;
  failureCode?: string;
  failureDescription?: string;
  billingEmail: string;
  billingPeriod: 'month' | 'year' | 'one_time';
  purchaseKind?: 'plan' | 'addon';
  licensedUserCount?: number;
  reviewedBy?: { _id: string; name?: string; email?: string } | string;
  paidAt?: string;
  failedAt?: string;
  refundedAt?: string;
  successEmailSentAt?: string;
  failureEmailSentAt?: string;
  refundEmailSentAt?: string;
  agreement?: {
    acceptanceId?: string;
    email: string;
    signatoryName: string;
    signatoryDesignation: string;
    signatoryAuthorityConfirmed: boolean;
    ndaAccepted: boolean;
    termsAccepted: boolean;
    ndaTitle: string;
    ndaVersion: string;
    ndaHash: string;
    termsTitle: string;
    termsVersion: string;
    termsHash: string;
    otpSentAt?: string;
    otpVerifiedAt?: string;
    acceptedAt?: string;
    otpAttempts: number;
    userAgent?: string;
  };
  createdAt: string;
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

export interface ILead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  collegeName: string;
  designation: string;
  studentCount: number;
  status: 'pending' | 'contacted' | 'converted' | 'rejected';
  notes?: string;
  createdAt: string;
}

export type TActiveTab =
  | 'dashboard'
  | 'tenants'
  | 'leads'
  | 'licenses'
  | 'products'
  | 'plans'
  | 'billing'
  | 'notifications'
  | 'public-site'
  | 'settings'
  | 'customer-operations'
  | 'profile';
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
