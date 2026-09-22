/**
 * @file platform-catalog.ts
 * @description Canonical Devvelocity product catalogue inserted into master data by seed:master.
 * @module server/scripts/data
 */

export interface IPlatformModuleSeed {
  name: string;
  slug: string;
  description: string;
  icon: string;
  frontendRoute: string;
  apiRoute: string;
  features: string[];
  tier: "core" | "standard" | "premium" | "ultimate";
}

export interface IPlatformProductSeed {
  name: string;
  slug: string;
  eyebrow: string;
  description: string;
  status: "available" | "planned";
  publicPath?: string;
  icon: string;
}

export interface IPlatformPlanSeed {
  name: string;
  slug: string;
  description: string;
  priceLabel: string;
  billingPeriod: "year" | "one_time";
  moduleSlugs: string[];
  highlights: string[];
  studentLimit: number;
  employeeLimit: number;
  isPopular: boolean;
  planType: "free" | "paid";
  amountInPaise: number;
  pricingModel: "per_user_day" | "fixed";
  dailyRatePaise: number;
  minimumBillableUsers: number;
  trialDays: number;
  graceDays: number;
  includedAddonSlugs: string[];
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

export interface IPlatformAddonSeed {
  name: string;
  slug: string;
  description: string;
  amountInPaise: number;
  billingPeriod: "year";
  moduleSlugs: string[];
  featureKeys: string[];
  capacityBoost?: {
    additionalStudents: number;
    additionalEmployees: number;
  };
  meetingLimitBoost: {
    additionalParticipants: number;
    additionalMonthlyMinutes: number;
    additionalConcurrentMeetings: number;
    additionalRecordingStorageMb: number;
    additionalRetentionDays: number;
    enableRecording: boolean;
  };
}

export const PLATFORM_PRODUCTS: IPlatformProductSeed[] = [
  {
    name: "College ERP",
    slug: "college-erp",
    eyebrow: "Education operations",
    description:
      "One connected operating system for admissions, academics, finance, people, compliance and campus services.",
    status: "available",
    publicPath: "/products/college-erp",
    icon: "GraduationCap",
  },
  {
    name: "Business Operations",
    slug: "business-operations",
    eyebrow: "In development",
    description:
      "A configurable workspace for growing organisations to connect customers, teams and operational workflows.",
    status: "planned",
    icon: "Workflow",
  },
];

export const PLATFORM_MODULES: IPlatformModuleSeed[] = [
  {
    name: "Admissions & Enrollment",
    slug: "admissions",
    description: "Digital applicant intake, verification, selection and enrollment workflows.",
    icon: "GraduationCap",
    frontendRoute: "/[tenant]/[role]/admission",
    apiRoute: "/api/v1/admission",
    features: [
      "Online applications",
      "Document verification",
      "Payment verification",
      "Merit processing",
      "Enrollment",
      "Recruitment CRM and counselor pipeline",
    ],
    tier: "core",
  },
  {
    name: "Academic Management",
    slug: "academics",
    description:
      "Academic structure, curriculum, learning delivery, governed forms and complete semester operations.",
    icon: "BookOpen",
    frontendRoute: "/[tenant]/[role]/academic-structure",
    apiRoute: "/api/v1/curriculum",
    features: [
      "Curriculum and outcome mapping",
      "Departments, courses and batches",
      "Lesson plans and study materials",
      "Assignments, quizzes and gradebook",
      "Dynamic forms and approval workflows",
      "Certificate and ID designer",
      "Discipline and student remarks",
      "Academic calendar and timetable",
      "Degree audit and graduation readiness",
      "Student success and advisor interventions",
      "Continuing education programs",
    ],
    tier: "core",
  },
  {
    name: "Attendance",
    slug: "attendance",
    description: "Student and faculty attendance with shortage monitoring and reports.",
    icon: "ClipboardCheck",
    frontendRoute: "/[tenant]/[role]/attendance",
    apiRoute: "/api/v1/attendance",
    features: [
      "Daily attendance",
      "Faculty attendance",
      "Shortage alerts",
      "Subject summaries",
      "Attendance reports",
    ],
    tier: "core",
  },
  {
    name: "LMS Integrations",
    slug: "lms-integrations",
    description:
      "Governed interoperability for Canvas, Moodle, OneRoster and approved Coursera institutional connections.",
    icon: "CloudCog",
    frontendRoute: "/[tenant]/[role]/lms-integration",
    apiRoute: "/api/v1/lms-integration",
    features: [
      "Canvas and Moodle connectors",
      "OneRoster 1.2 interoperability",
      "Coursera institutional connector",
      "Course, roster and assignment synchronization",
      "Reviewed grade and progress import",
      "LTI 1.3 trust metadata",
      "Idempotent runs and audit history",
    ],
    tier: "ultimate",
  },
  {
    name: "Examinations",
    slug: "examinations",
    description: "Exam planning, hall tickets, marks, grades and result publication.",
    icon: "FileCheck2",
    frontendRoute: "/[tenant]/[role]/examination",
    apiRoute: "/api/v1/examination",
    features: [
      "Exam scheduling",
      "Hall tickets",
      "Marks entry",
      "Grade calculation",
      "Result publishing",
      "Maker-checker marks verification",
      "Venue and invigilator conflict protection",
    ],
    tier: "core",
  },
  {
    name: "Fees & Accounts",
    slug: "fees",
    description:
      "Institutional billing, advanced fee collection, reconciliation and accounting connectivity.",
    icon: "IndianRupee",
    frontendRoute: "/[tenant]/[role]/fee",
    apiRoute: "/api/v1/fee",
    features: [
      "Fee structures",
      "Online payments",
      "Receipts",
      "Due reminders",
      "Financial reports",
      "Installment plans and adjustments",
      "Refund approval workflows",
      "Payment reconciliation",
      "Tally accounting export",
      "Tally Bridge integration",
      "QuickBooks accounting sync",
      "Online payment gateway integration",
      "Financial aid eligibility, awards and disbursement",
    ],
    tier: "core",
  },
  {
    name: "HR & Payroll",
    slug: "hr-payroll",
    description: "Employee lifecycle, attendance, leave, payroll and payslips.",
    icon: "UsersRound",
    frontendRoute: "/[tenant]/[role]/hr",
    apiRoute: "/api/v1/hr",
    features: [
      "Employee profiles",
      "Faculty onboarding",
      "Leave management",
      "Payroll",
      "Payslips",
    ],
    tier: "standard",
  },
  {
    name: "Library",
    slug: "library",
    description: "Library catalogue, circulation, fines and member operations.",
    icon: "Library",
    frontendRoute: "/[tenant]/[role]/library",
    apiRoute: "/api/v1/library",
    features: [
      "Book catalogue",
      "Issue and return",
      "Reservations",
      "Fine tracking",
      "Member history",
    ],
    tier: "standard",
  },
  {
    name: "Hostel",
    slug: "hostel",
    description: "Hostel rooms, allocations, occupancy and resident management.",
    icon: "BedDouble",
    frontendRoute: "/[tenant]/[role]/hostel",
    apiRoute: "/api/v1/hostel",
    features: [
      "Hostel blocks",
      "Room inventory",
      "Student allocation",
      "Occupancy",
      "Hostel notices",
    ],
    tier: "standard",
  },
  {
    name: "Transport",
    slug: "transport",
    description: "Routes, vehicles, stops, drivers and student transport allocation.",
    icon: "Bus",
    frontendRoute: "/[tenant]/[role]/transport",
    apiRoute: "/api/v1/transport",
    features: [
      "Route planning",
      "Vehicle registry",
      "Stops",
      "Driver records",
      "Student allocation",
    ],
    tier: "standard",
  },
  {
    name: "Placements",
    slug: "placements",
    description: "Student placement profiles, recruiters, jobs and applications.",
    icon: "BriefcaseBusiness",
    frontendRoute: "/[tenant]/[role]/placement",
    apiRoute: "/api/v1/placement",
    features: [
      "Placement profiles",
      "Recruiters",
      "Job postings",
      "Applications",
      "Placement reports",
      "Advancement, alumni campaigns and donations",
    ],
    tier: "standard",
  },
  {
    name: "Communication",
    slug: "communication",
    description:
      "Omnichannel campaigns, notices, discussions, polls, galleries and governed campus collaboration.",
    icon: "MessagesSquare",
    frontendRoute: "/[tenant]/[role]/chat",
    apiRoute: "/api/v1/chat",
    features: [
      "Direct and group chat",
      "Audience-based communication campaigns",
      "Scheduled email, push and SMS",
      "Twilio SMS integration",
      "Tenant SMTP email delivery",
      "Firebase push notifications",
      "Reusable message templates",
      "Discussions and announcements",
      "Polls and voting",
      "Institution galleries",
      "Delivery history and channel status",
    ],
    tier: "premium",
  },
  {
    name: "NAAC, NBA & IQAC",
    slug: "naac-iqac",
    description:
      "NAAC, NBA, AICTE and BPUT evidence, quality processes, mapping and compliance reporting.",
    icon: "BadgeCheck",
    frontendRoute: "/[tenant]/[role]/naac-nba",
    apiRoute: "/api/v1/naac-nba",
    features: [
      "NAAC criteria",
      "NBA records",
      "IQAC activities",
      "Evidence management",
      "Compliance exports",
      "AICTE standards tracking",
      "BPUT D-Forms",
      "Outcome and NBA mapping",
      "Evidence-based CO-PO attainment",
    ],
    tier: "premium",
  },
  {
    name: "Research & Development",
    slug: "research",
    description: "Research projects, publications, patents and funding records.",
    icon: "FlaskConical",
    frontendRoute: "/[tenant]/[role]/research-development",
    apiRoute: "/api/v1/research-development",
    features: [
      "Research projects",
      "Publications",
      "Patents",
      "Funding",
      "Faculty research profiles",
    ],
    tier: "premium",
  },
  {
    name: "Government & Regulatory Integrations",
    slug: "government-regulatory-integrations",
    description:
      "Governed onboarding, authorization and readiness workflows for DigiLocker, NAD, ABC, AISHE and NIRF.",
    icon: "Landmark",
    frontendRoute: "/[tenant]/[role]/government-integrations",
    apiRoute: "/api/v1/regulatory-integration",
    features: [
      "DigiLocker partner onboarding",
      "NAD academic award readiness",
      "ABC credit workflow readiness",
      "AISHE reporting coordination",
      "NIRF submission coordination",
      "Nodal officer and approval tracking",
      "Consent, production and audit controls",
    ],
    tier: "ultimate",
  },
  {
    name: "Multi-Campus Governance",
    slug: "multi-campus-governance",
    description:
      "Governed campus hierarchy, scoped staff access, inherited calendars, shared services and cross-campus operating metrics.",
    icon: "Building2",
    frontendRoute: "/[tenant]/[role]/campus-governance",
    apiRoute: "/api/v1/campus-governance",
    features: [
      "Campus hierarchy and lifecycle",
      "Campus-scoped role assignments",
      "Inherited academic calendars",
      "Cross-campus shared services",
      "Consolidated operating metrics",
      "Audited department-campus ownership",
    ],
    tier: "ultimate",
  },
  {
    name: "Procurement & Store",
    slug: "procurement",
    description: "Requisitions, approvals, purchase operations and institutional inventory.",
    icon: "ShoppingCart",
    frontendRoute: "/[tenant]/[role]/procurement",
    apiRoute: "/api/v1/procurement",
    features: [
      "Requisitions",
      "Approval workflow",
      "Purchase tracking",
      "Inventory",
      "Vendor records",
      "Facilities, maintenance and asset lifecycle",
    ],
    tier: "standard",
  },
  {
    name: "Clubs & Campus Life",
    slug: "clubs",
    description: "Student clubs, memberships, activities and campus events.",
    icon: "Users",
    frontendRoute: "/[tenant]/[role]/clubs",
    apiRoute: "/api/v1/club",
    features: ["Club registry", "Memberships", "Activities", "Events", "Participation"],
    tier: "standard",
  },
  {
    name: "Meetings & Virtual Rooms",
    slug: "virtual-classrooms",
    description: "Scheduled meetings, virtual rooms, lobby and host controls.",
    icon: "Video",
    frontendRoute: "/[tenant]/[role]/meeting",
    apiRoute: "/api/v1/meeting",
    features: [
      "Meeting scheduling",
      "Virtual rooms",
      "Host controls",
      "Lobby",
      "Call history",
      "Google Meet integration",
      "BigBlueButton integration",
      "Google Workspace meeting connectivity",
      "Microsoft Graph meeting connectivity",
    ],
    tier: "ultimate",
  },
  {
    name: "Security & Audit",
    slug: "security",
    description:
      "Tenant isolation, federated identity, roles, permissions, secure integrations and operational auditing.",
    icon: "ShieldCheck",
    frontendRoute: "/[tenant]/[role]/audit-log",
    apiRoute: "/api/v1/audit-log",
    features: [
      "Role and permission governance",
      "Google and Microsoft SSO",
      "Google Workspace integration",
      "Microsoft Graph integration",
      "MFA and session management",
      "Immutable audit logs",
      "Tenant-isolated encrypted credentials",
      "Connector health and circuit protection",
      "Custom webhook integration",
      "Governed data portability",
      "Secure import and migration center",
      "Responsible AI use-case governance",
    ],
    tier: "ultimate",
  },
  {
    name: "Analytics & Dashboards",
    slug: "analytics",
    description:
      "Role-aware dashboards, reusable reports, governed exports and institution-wide operational intelligence.",
    icon: "ChartNoAxesCombined",
    frontendRoute: "/[tenant]/[role]/dashboard",
    apiRoute: "/api/v1/dashboard",
    features: [
      "Role dashboards",
      "Operational KPIs",
      "Academic analytics",
      "Financial analytics",
      "Exportable reports",
      "Universal report builder",
      "Scheduled and reusable report definitions",
      "Governed JSON and NDJSON data exports",
      "Student success and intervention analytics",
    ],
    tier: "ultimate",
  },
];

/** Fixed annual institutional packages; super admins can adjust pricing after seeding. */
export const PLATFORM_PLANS: IPlatformPlanSeed[] = [
  {
    name: "Free Trial",
    slug: "free-trial",
    description:
      "A guided evaluation workspace with realistic data and the core workflows needed to validate fit.",
    priceLabel: "Free for 7 days",
    billingPeriod: "year",
    moduleSlugs: [
      "admissions",
      "academics",
      "attendance",
      "examinations",
      "fees",
      "communication",
      "security",
      "analytics",
    ],
    highlights: [
      "No payment method required",
      "Guided setup with demonstration data",
      "Secure role and permission evaluation",
    ],
    studentLimit: 200,
    employeeLimit: 20,
    isPopular: false,
    planType: "free",
    amountInPaise: 0,
    pricingModel: "fixed",
    dailyRatePaise: 0,
    minimumBillableUsers: 1,
    trialDays: 7,
    graceDays: 0,
    includedAddonSlugs: [],
    meetingLimits: {
      maxParticipants: 25,
      maxDurationMinutes: 60,
      monthlyMinutes: 250,
      concurrentMeetings: 1,
      recordingEnabled: false,
      recordingStorageMb: 0,
      retentionDays: 7,
    },
  },
  {
    name: "Starter",
    slug: "starter",
    description:
      "Essential digitisation for small colleges moving admissions, academics and finance out of spreadsheets.",
    priceLabel: "₹49,999 / year",
    billingPeriod: "year",
    moduleSlugs: [
      "admissions",
      "academics",
      "attendance",
      "examinations",
      "fees",
      "communication",
      "security",
      "analytics",
      "virtual-classrooms",
    ],
    highlights: [
      "Admissions, attendance and examinations",
      "Fee collection, receipts and reporting",
      "Unlimited live meetings in the first paid year",
      "Standard email support",
    ],
    studentLimit: 500,
    employeeLimit: 50,
    isPopular: false,
    planType: "paid",
    amountInPaise: 4999900,
    pricingModel: "fixed",
    dailyRatePaise: 0,
    minimumBillableUsers: 1,
    trialDays: 7,
    graceDays: 5,
    includedAddonSlugs: [],
    meetingLimits: {
      maxParticipants: 25,
      maxDurationMinutes: 60,
      monthlyMinutes: 1000,
      concurrentMeetings: 1,
      recordingEnabled: false,
      recordingStorageMb: 0,
      retentionDays: 7,
    },
  },
  {
    name: "Growth",
    slug: "growth",
    description:
      "Connected campus operations for growing colleges that need library, hostel and transport workflows.",
    priceLabel: "₹79,999 / year",
    billingPeriod: "year",
    moduleSlugs: [
      "admissions",
      "academics",
      "attendance",
      "examinations",
      "fees",
      "communication",
      "security",
      "analytics",
      "library",
      "hostel",
      "transport",
      "virtual-classrooms",
    ],
    highlights: [
      "Everything in Starter",
      "Library, hostel and transport operations",
      "Unlimited live meetings in the first paid year",
      "Priority email and phone support",
    ],
    studentLimit: 1500,
    employeeLimit: 150,
    isPopular: false,
    planType: "paid",
    amountInPaise: 7999900,
    pricingModel: "fixed",
    dailyRatePaise: 0,
    minimumBillableUsers: 1,
    trialDays: 7,
    graceDays: 7,
    includedAddonSlugs: [],
    meetingLimits: {
      maxParticipants: 50,
      maxDurationMinutes: 60,
      monthlyMinutes: 3000,
      concurrentMeetings: 1,
      recordingEnabled: false,
      recordingStorageMb: 0,
      retentionDays: 7,
    },
  },
  {
    name: "Professional",
    slug: "professional",
    description:
      "Complete academic and administrative control for engineering, autonomous and multi-department colleges.",
    priceLabel: "₹1,29,999 / year",
    billingPeriod: "year",
    moduleSlugs: [
      "admissions",
      "academics",
      "attendance",
      "examinations",
      "fees",
      "security",
      "analytics",
      "hr-payroll",
      "library",
      "hostel",
      "transport",
      "placements",
      "communication",
      "naac-iqac",
      "procurement",
      "virtual-classrooms",
      "lms-integrations",
    ],
    highlights: [
      "Complete college operating suite",
      "Placement, compliance and communication workflows",
      "Unlimited live meetings in the first paid year",
      "Dedicated relationship manager",
    ],
    studentLimit: 2500,
    employeeLimit: 250,
    isPopular: true,
    planType: "paid",
    amountInPaise: 12999900,
    pricingModel: "fixed",
    dailyRatePaise: 0,
    minimumBillableUsers: 1,
    trialDays: 7,
    graceDays: 10,
    includedAddonSlugs: [],
    meetingLimits: {
      maxParticipants: 100,
      maxDurationMinutes: 120,
      monthlyMinutes: 10000,
      concurrentMeetings: 5,
      recordingEnabled: true,
      recordingStorageMb: 25600,
      retentionDays: 30,
    },
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description:
      "A governed multi-campus platform for universities, educational groups and complex integration requirements.",
    priceLabel: "From ₹1,59,999 / year",
    billingPeriod: "year",
    moduleSlugs: PLATFORM_MODULES.map((productModule) => productModule.slug),
    highlights: [
      "All product module families",
      "Multi-campus, SSO and integration governance",
      "Unlimited live meetings in the first paid year",
      "Priority SLA and solution architecture support",
    ],
    studentLimit: 5000,
    employeeLimit: 500,
    isPopular: false,
    planType: "paid",
    amountInPaise: 15999900,
    pricingModel: "fixed",
    dailyRatePaise: 0,
    minimumBillableUsers: 1,
    trialDays: 7,
    graceDays: 15,
    includedAddonSlugs: [],
    meetingLimits: {
      maxParticipants: 500,
      maxDurationMinutes: 480,
      monthlyMinutes: 100000,
      concurrentMeetings: 20,
      recordingEnabled: true,
      recordingStorageMb: 102400,
      retentionDays: 180,
    },
  },
];

export const PLATFORM_ADDONS: IPlatformAddonSeed[] = [
  {
    name: "LMS Integrations",
    slug: "lms-integrations-addon",
    description:
      "Adds governed Canvas, Moodle, OneRoster and Coursera connector workflows to eligible Growth subscriptions. Provider licences and API access are separate.",
    amountInPaise: 2500000,
    billingPeriod: "year",
    moduleSlugs: ["lms-integrations"],
    featureKeys: ["module.lms-integrations", "lms.providers"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Government & Regulatory Integrations",
    slug: "government-regulatory-integrations-addon",
    description:
      "Adds the governed integration workspace to Professional plans. Authority eligibility, onboarding and third-party charges remain separate.",
    amountInPaise: 3000000,
    billingPeriod: "year",
    moduleSlugs: ["government-regulatory-integrations"],
    featureKeys: ["integration.government_regulatory"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Multi-Campus Governance",
    slug: "multi-campus-governance-addon",
    description:
      "Adds governed multi-campus hierarchy, scoped access, calendars and shared-service operations to Professional plans.",
    amountInPaise: 3500000,
    billingPeriod: "year",
    moduleSlugs: ["multi-campus-governance"],
    featureKeys: ["module.multi-campus-governance", "campus.scoped_access"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Institution Mobile App",
    slug: "institution-mobile-app",
    description:
      "Annual Devvelocity mobile app access. Store accounts, white-labelling and custom development are quoted separately.",
    amountInPaise: 2000000,
    billingPeriod: "year",
    moduleSlugs: [],
    featureKeys: ["mobile.app"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Additional 100 Students",
    slug: "student-capacity-100",
    description: "Adds 100 active student accounts without requiring a plan upgrade.",
    amountInPaise: 1000000,
    billingPeriod: "year",
    moduleSlugs: [],
    featureKeys: ["capacity.students"],
    capacityBoost: { additionalStudents: 100, additionalEmployees: 0 },
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Additional 250 Students",
    slug: "student-capacity-250",
    description: "Adds 250 active student accounts without changing included modules.",
    amountInPaise: 2000000,
    billingPeriod: "year",
    moduleSlugs: [],
    featureKeys: ["capacity.students"],
    capacityBoost: { additionalStudents: 250, additionalEmployees: 0 },
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Additional 25 Staff",
    slug: "staff-capacity-25",
    description: "Adds 25 active faculty or staff accounts to the current subscription.",
    amountInPaise: 500000,
    billingPeriod: "year",
    moduleSlugs: [],
    featureKeys: ["capacity.employees"],
    capacityBoost: { additionalStudents: 0, additionalEmployees: 25 },
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Library Operations",
    slug: "library-module",
    description: "Adds library catalogue, barcode circulation, issue/return and reporting.",
    amountInPaise: 1500000,
    billingPeriod: "year",
    moduleSlugs: ["library"],
    featureKeys: ["module.library"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Hostel & Mess",
    slug: "hostel-module",
    description: "Adds room allocation, resident operations, mess billing and hostel reporting.",
    amountInPaise: 2000000,
    billingPeriod: "year",
    moduleSlugs: ["hostel"],
    featureKeys: ["module.hostel"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Transport Operations",
    slug: "transport-module",
    description: "Adds routes, vehicles, stops, passes and fleet operations.",
    amountInPaise: 2000000,
    billingPeriod: "year",
    moduleSlugs: ["transport"],
    featureKeys: ["module.transport"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Training & Placement",
    slug: "placements-module",
    description: "Adds employer drives, student profiles, offers and placement analytics.",
    amountInPaise: 2500000,
    billingPeriod: "year",
    moduleSlugs: ["placements"],
    featureKeys: ["module.placements"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Meeting Capacity 100",
    slug: "meeting-capacity-100",
    description: "Adds 100 participants, 20,000 meeting minutes and five concurrent rooms.",
    amountInPaise: 2400000,
    billingPeriod: "year",
    moduleSlugs: ["virtual-classrooms"],
    featureKeys: ["meeting.capacity"],
    meetingLimitBoost: {
      additionalParticipants: 100,
      additionalMonthlyMinutes: 20000,
      additionalConcurrentMeetings: 5,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
  {
    name: "Secure Meeting Recording",
    slug: "meeting-secure-recording",
    description: "Enables encrypted recording storage with 50 GB capacity and 90-day retention.",
    amountInPaise: 3600000,
    billingPeriod: "year",
    moduleSlugs: ["virtual-classrooms"],
    featureKeys: ["meeting.recording", "meeting.retention"],
    meetingLimitBoost: {
      additionalParticipants: 0,
      additionalMonthlyMinutes: 0,
      additionalConcurrentMeetings: 0,
      additionalRecordingStorageMb: 51200,
      additionalRetentionDays: 90,
      enableRecording: true,
    },
  },
  {
    name: "Meeting Capacity 500",
    slug: "meeting-capacity-500",
    description: "Adds 500 participants, 75,000 meeting minutes and ten concurrent rooms.",
    amountInPaise: 7200000,
    billingPeriod: "year",
    moduleSlugs: ["virtual-classrooms"],
    featureKeys: ["meeting.webinar", "meeting.capacity"],
    meetingLimitBoost: {
      additionalParticipants: 500,
      additionalMonthlyMinutes: 75000,
      additionalConcurrentMeetings: 10,
      additionalRecordingStorageMb: 0,
      additionalRetentionDays: 0,
      enableRecording: false,
    },
  },
];
