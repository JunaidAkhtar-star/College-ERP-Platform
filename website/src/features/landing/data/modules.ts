/**
 * @file modules.ts
 * @description Centralized ERP module data shared across all public pages.
 * @module src/app/(public)/data
 */

export interface ModuleFeature {
  title: string;
  description: string;
}

export interface ModuleSection {
  heading: string;
  body: string;
  items?: string[];
}

export interface ErpModule {
  id: string;
  title: string;
  tagline: string;
  description: string;
  longDescription: string;
  color: string;
  accentColor: string;
  bg: string;
  iconName: string;
  features: ModuleFeature[];
  sections: ModuleSection[];
  stats: { label: string; value: string }[];
  relatedModules: string[];
}

export const ALL_MODULES: ErpModule[] = [
  {
    id: 'admissions',
    title: 'Admissions & Enrollment',
    tagline: 'End-to-end student enrollment automation',
    description:
      'Digitize the entire admission journey — from online applications and document collection to merit-based shortlisting and final seat allotment.',
    longDescription:
      "Devvelocity's Admissions module replaces paper-heavy chaos with an intelligent digital pipeline. Applicants submit forms online, upload documents, and track their application status in real-time. The merit-list engine auto-ranks candidates based on configurable criteria. Counselors get a dedicated dashboard to manage schedules and interviews. Every step is logged for NAAC audit compliance.",
    color: '#4f46e5',
    accentColor: '#6366f1',
    bg: '#eef2ff',
    iconName: 'GraduationCap',
    features: [
      {
        title: 'Online Application Portal',
        description: 'Mobile-friendly application forms with document upload and auto-save.',
      },
      {
        title: 'Merit List Generation',
        description:
          'Configurable ranking rules auto-produce merit lists per program and category.',
      },
      {
        title: 'Seat Allotment Engine',
        description: 'Automated round-based seat allotment respecting category quotas and cutoffs.',
      },
      {
        title: 'Counselor Dashboard',
        description: 'Assign counselors to applicants, schedule interviews, and record feedback.',
      },
      {
        title: 'NAAC Admission Reports',
        description: 'One-click export of enrollment statistics for accreditation submissions.',
      },
      {
        title: 'Applicant Communication',
        description: 'Automated email and SMS notifications at every application milestone.',
      },
      {
        title: 'Recruitment CRM',
        description:
          'Manage prospects, counselor ownership, follow-ups, campaigns and applicant conversion through a governed recruitment pipeline.',
      },
    ],
    sections: [
      {
        heading: 'Streamlined Application Experience',
        body: 'Students apply from any device. The multi-step wizard guides applicants through personal details, academic history, document uploads, and payment — with progress automatically saved between sessions.',
      },
      {
        heading: 'Intelligent Merit Ranking',
        body: 'Configure weightage rules per program: percentage marks, entrance exam scores, sports quotas, and category reservations. The engine instantly generates ranked merit lists the moment the application window closes.',
        items: [
          'Configurable ranking formulas',
          'Category-wise sub-lists',
          'Tie-breaking rules',
          'Export to Excel/PDF',
        ],
      },
      {
        heading: 'Round-Based Seat Allotment',
        body: 'Run multiple counseling rounds, track seat acceptance/rejection, and automatically freeze confirmed admissions. Spot admissions can be added directly by admin staff.',
        items: [
          'Unlimited counseling rounds',
          'Freeze/upgrade status tracking',
          'Spot admission management',
          'Real-time seat availability',
        ],
      },
    ],
    stats: [
      { label: 'Enrollment Speed', value: '3× faster' },
      { label: 'Application Processing', value: 'Paperless' },
      { label: 'NAAC Ready', value: '100%' },
    ],
    relatedModules: ['academics', 'fees', 'communication'],
  },
  {
    id: 'academics',
    title: 'Academic Management & LMS',
    tagline: 'Govern the complete teaching and learning lifecycle',
    description:
      'Design courses, allocate faculty, upload study materials, launch quizzes, and track student progress — all in one unified academic management hub.',
    longDescription:
      'The LMS module is the academic heartbeat of Devvelocity. Curriculum designers map programs to batches, allocate subjects to faculty, and publish study materials. Students get a personalized academic portal with upcoming deadlines, submitted assignments, quiz attempts, and grade summaries.',
    color: '#0891b2',
    accentColor: '#06b6d4',
    bg: '#ecfeff',
    iconName: 'BookOpen',
    features: [
      {
        title: 'Dynamic Lesson Plans',
        description:
          'Author weekly lesson plans with learning objectives and cross-links to resources.',
      },
      {
        title: 'Quiz & Assessment Engine',
        description:
          'Timed quizzes with auto-grading, randomized question banks, and result analytics.',
      },
      {
        title: 'Assignment Management',
        description:
          'Create assignments, set deadlines, accept file submissions, and grade inline.',
      },
      {
        title: 'Study Material Repository',
        description:
          'Upload PDFs, videos, and presentations with version control and access control.',
      },
      {
        title: 'Syllabus Coverage Tracking',
        description:
          'Track and report syllabus completion progress against NAAC benchmark timelines.',
      },
      {
        title: 'Grade Book',
        description:
          'Faculty grade submissions inline; students see cumulative grade history in real-time.',
      },
      {
        title: 'Forms & Approval Workflows',
        description:
          'Build versioned institutional forms with role-aware reviews, evidence and approvals.',
      },
      {
        title: 'Certificate & ID Designer',
        description:
          'Create tenant-branded certificates and identity cards from reusable dynamic templates.',
      },
      {
        title: 'Degree Audit & Academic Progress',
        description:
          'Compare completed and planned credits against curriculum requirements, prerequisites and graduation readiness.',
      },
      {
        title: 'Student Success & Intervention',
        description:
          'Detect explainable risk indicators, assign advisor-owned cases and track interventions through closure.',
      },
      {
        title: 'Continuing Education',
        description:
          'Operate short courses, cohorts, instructors, enrollment and completion credentials beyond regular degree programs.',
      },
    ],
    sections: [
      {
        heading: 'Structured Course Delivery',
        body: 'Map curricula to batches and sections. Faculty get structured lesson-by-lesson delivery plans aligned with the academic calendar. Every session is logged for workload compliance reporting.',
      },
      {
        heading: 'Assessment & Feedback Loop',
        body: 'Launch timed quizzes with question banks that randomize per attempt. Automatic grading reduces faculty workload. Students receive instant feedback with answer explanations.',
        items: [
          'Multiple question types',
          'Randomized question pools',
          'Instant auto-grading',
          'Result analytics dashboard',
        ],
      },
    ],
    stats: [
      { label: 'Academic Modules', value: '18+' },
      { label: 'Assessment Types', value: '8+' },
      { label: 'Grading Speed', value: 'Instant' },
    ],
    relatedModules: ['attendance', 'examinations', 'naac-iqac'],
  },
  {
    id: 'attendance',
    title: 'Attendance Management',
    tagline: 'Automated presence and absence tracking',
    description:
      'Real-time attendance marking with automated SMS alerts for low-attendance students and comprehensive reports for faculty workload compliance.',
    longDescription:
      "Devvelocity's Attendance module is purpose-built for high-volume institutions. Faculty mark session-wise attendance from any device. The system instantly calculates cumulative percentages, flags students below the configured threshold, and triggers parent notifications automatically.",
    color: '#059669',
    accentColor: '#10b981',
    bg: '#ecfdf5',
    iconName: 'ClipboardList',
    features: [
      {
        title: 'Session-wise Attendance Marking',
        description: 'Mark attendance subject-wise per lecture, lab, or tutorial session.',
      },
      {
        title: 'Low Attendance Alerts',
        description:
          'Automatic SMS and push alerts when a student falls below the minimum attendance percentage.',
      },
      {
        title: 'Faculty Attendance & On-Duty',
        description:
          'Track faculty attendance with on-duty and special leave marking for compliance.',
      },
      {
        title: 'Monthly Attendance Reports',
        description: 'Generate student-wise, subject-wise, and class-wise attendance summaries.',
      },
      {
        title: 'Mobile-Friendly Marking',
        description: 'Faculty mark attendance from mobile browsers without installing any app.',
      },
      {
        title: 'Biometric Integration Hooks',
        description: 'REST API hooks for biometric device integration for automated marking.',
      },
    ],
    sections: [
      {
        heading: 'Real-time Attendance Dashboard',
        body: 'Principal and HODs see a live institution-wide attendance heatmap. Department-level and class-level drilldowns help identify at-risk cohorts before the semester progresses too far.',
      },
      {
        heading: 'Proactive Student Alerting',
        body: 'The alert engine fires automated messages to students and parents when attendance drops below 75% or any configurable threshold. Escalation levels can be customized per program.',
      },
    ],
    stats: [
      { label: 'Alert Accuracy', value: '99.9%' },
      { label: 'Marking Time', value: '<2 min/class' },
      { label: 'Compliance Ready', value: '100%' },
    ],
    relatedModules: ['academics', 'examinations', 'hr-payroll'],
  },
  {
    id: 'examinations',
    title: 'Examinations & Grading',
    tagline: 'End-to-end exam lifecycle management',
    description:
      'Schedule exams, allocate halls, process marks, and publish results — with online proctored exam capabilities and automatic backlog tracking.',
    longDescription:
      'From setting the exam timetable to digitally publishing mark sheets, Devvelocity manages every step of the examination lifecycle. Online proctored exams include webcam monitoring, tab-switch logging, and AI-powered suspicious behavior alerts.',
    color: '#d97706',
    accentColor: '#f59e0b',
    bg: '#fffbeb',
    iconName: 'Trophy',
    features: [
      {
        title: 'Exam Scheduling & Hall Allocation',
        description:
          'Generate conflict-free timetables and automatically assign students to exam halls.',
      },
      {
        title: 'Online Proctored Exams',
        description:
          'Browser-based exams with webcam snapshots, tab-switch detection, and session logging.',
      },
      {
        title: 'Mark Entry & Moderation',
        description:
          'Faculty enter marks digitally; HOD and exam cell moderate before result publication.',
      },
      {
        title: 'Grade Configuration',
        description: 'Configure grade boundaries, pass marks, and grace mark policies per program.',
      },
      {
        title: 'Backlog & Supplementary Tracking',
        description: 'Automatically track students with arrears and schedule supplementary exams.',
      },
      {
        title: 'Marksheet & Transcript Generation',
        description: 'One-click generation of formatted marksheets and consolidated transcripts.',
      },
      {
        title: 'Maker-Checker Result Governance',
        description:
          'Separate marks entry, verification, approval and publication with venue, invigilator and timetable conflict protection.',
      },
    ],
    sections: [
      {
        heading: 'Intelligent Timetable Generation',
        body: 'The scheduling engine generates conflict-free exam timetables respecting subject clashes, faculty assignments, and hall capacities. Manual overrides are always available.',
      },
      {
        heading: 'Online Examination Engine',
        body: 'Deploy proctored exams to students anywhere. The browser-based interface monitors webcam feeds, logs tab switches, and auto-submits when time expires.',
        items: [
          'Webcam monitoring',
          'Tab-switch logging',
          'Auto-submit on timeout',
          'Question shuffling',
          'Result analytics',
        ],
      },
    ],
    stats: [
      { label: 'Grading Speed', value: '5× faster' },
      { label: 'Exam Types', value: '6+' },
      { label: 'Proctoring', value: 'AI-Powered' },
    ],
    relatedModules: ['academics', 'attendance', 'naac-iqac'],
  },
  {
    id: 'fees',
    title: 'Fee & Financial Management',
    tagline: 'Collection, control and reconciliation in one ledger',
    description:
      'Structure complex fee slabs, generate student invoices, verify digital or offline payments, manage scholarships, and process payroll — all in one financial hub.',
    longDescription:
      "Devvelocity's financial module connects fee structures, scholarship waivers, invoices, verified collections, balanced journal posting, trial balance reporting, and faculty payroll in one workflow.",
    color: '#7c3aed',
    accentColor: '#8b5cf6',
    bg: '#f5f3ff',
    iconName: 'CreditCard',
    features: [
      {
        title: 'Flexible Fee Slab Configuration',
        description: 'Configure program-wise, semester-wise, and installment-based fee structures.',
      },
      {
        title: 'Automated Invoice Generation',
        description:
          'Auto-generate student invoices at the start of each semester or on admission.',
      },
      {
        title: 'Verified Digital Payments',
        description:
          'Verify UPI and bank-transfer references with payment proof before atomic ledger posting.',
      },
      {
        title: 'Scholarship & Waiver Management',
        description:
          'Define scholarship categories and apply proportional waivers to eligible students.',
      },
      {
        title: 'Payroll Processing',
        description:
          'Configure salary slabs, allowances, tax deductions, and generate monthly payslips.',
      },
      {
        title: 'Revenue Dashboard',
        description:
          'Real-time collection vs. outstanding reports with student-level fee status visibility.',
      },
      {
        title: 'Advanced Fees & Refunds',
        description:
          'Manage installments, governed adjustments, refund approvals and reconciliation exceptions.',
      },
      {
        title: 'Tally Accounting Export',
        description:
          'Map ERP ledgers and export verified, balanced vouchers for Tally Prime workflows.',
      },
      {
        title: 'Tally Bridge Integration',
        description:
          'Connect tenant accounting workflows to Tally through encrypted, monitored bridge credentials.',
      },
      {
        title: 'QuickBooks Accounting Sync',
        description:
          'Synchronize approved accounting records with QuickBooks using traceable connector executions.',
      },
      {
        title: 'Online Payment Gateway Integration',
        description:
          'Support verified online collections, payment status updates, webhooks, and reconciliation.',
      },
      {
        title: 'Financial Aid Governance',
        description:
          'Govern aid programs, applications, eligibility reviews, awards, disbursements and reconciliation with complete evidence.',
      },
    ],
    sections: [
      {
        heading: 'Multi-Tier Fee Structure',
        body: 'Design fees at program, branch, batch, and category levels. Support one-time admission fees, semester tuition, hostel charges, transport fees, and miscellaneous levies — all in one configuration.',
      },
      {
        heading: 'Digital Payment Pipeline',
        body: 'Students submit UPI or bank-transfer references with proof. Accounts verifies each collection before the invoice and balanced ledger are updated atomically.',
        items: [
          'UPI reference verification',
          'Bank transfer verification',
          'Offline payment recording',
          'Receipt generation',
          'Due reminders',
        ],
      },
    ],
    stats: [
      { label: 'Revenue Visibility', value: '100%' },
      { label: 'Posting Control', value: 'Verified + balanced' },
      { label: 'Collection Reports', value: 'Real-time' },
    ],
    relatedModules: ['hr-payroll', 'admissions', 'analytics'],
  },
  {
    id: 'hr-payroll',
    title: 'HR & Payroll',
    tagline: 'Complete human resource automation',
    description:
      'Manage faculty and staff onboarding, service records, leave applications, payslip generation, and income tax declarations from a single integrated HR control center.',
    longDescription:
      'From the day a new faculty member joins to their retirement, Devvelocity HR manages the complete lifecycle. Onboarding checklists, document collection, department assignment, increment tracking, leave management, and automated payroll processing — all in one unified system.',
    color: '#db2777',
    accentColor: '#ec4899',
    bg: '#fdf2f8',
    iconName: 'Briefcase',
    features: [
      {
        title: 'Faculty & Staff Onboarding',
        description:
          'Structured onboarding checklists with document collection and department assignment.',
      },
      {
        title: 'Service Record Management',
        description:
          'Track designations, increments, promotions, and service history chronologically.',
      },
      {
        title: 'Leave Management',
        description:
          'Submit, approve, and track leave applications with earned leave balance calculation.',
      },
      {
        title: 'Payslip Generation',
        description:
          'Auto-generate monthly payslips with configurable components, deductions, and tax.',
      },
      {
        title: 'Appraisal & Review Tracking',
        description:
          'Schedule annual appraisals, record performance ratings, and link to increment decisions.',
      },
      {
        title: 'Retirement & Exit Management',
        description:
          'Process retirements, resignations, and terminations with proper clearance workflows.',
      },
    ],
    sections: [
      {
        heading: 'Complete Employee Lifecycle',
        body: 'From joining formalities to exit interviews — every HR touchpoint is managed within Devvelocity. No separate HRMS software needed.',
      },
      {
        heading: 'Automated Payroll Engine',
        body: 'Configure salary components, HRA slabs, PF contributions, and TDS deductions once. Every month, the engine computes net pay for every employee and generates formatted payslips.',
        items: [
          'Component-wise salary structure',
          'PF / PT / TDS auto-computation',
          'Payslip PDF generation',
          'Bank transfer statement export',
        ],
      },
    ],
    stats: [
      { label: 'HR Processes Automated', value: '28+' },
      { label: 'Payslip Generation', value: 'Instant' },
      { label: 'Payroll Rules', value: 'Effective-dated policies' },
    ],
    relatedModules: ['fees', 'attendance', 'analytics'],
  },
  {
    id: 'hostel',
    title: 'Hostel Management',
    tagline: 'End-to-end residential campus operations',
    description:
      'Allocate rooms, manage mess billing, track warden logs, handle student check-in/out, and generate occupancy reports from one integrated hostel management dashboard.',
    longDescription:
      "Managing thousands of residential students across multiple hostels is complex. Devvelocity's hostel module handles it all — room allocation by category and gender, daily mess roll-call, warden duty roster, maintenance request tracking, and monthly hostel fee billing.",
    color: '#0284c7',
    accentColor: '#0ea5e9',
    bg: '#f0f9ff',
    iconName: 'Building2',
    features: [
      {
        title: 'Room Allocation & Occupancy',
        description:
          'Assign students to rooms with category, gender, and preference filters. Track real-time occupancy.',
      },
      {
        title: 'Mess Fee Billing',
        description:
          'Configure mess fee slabs and auto-generate monthly mess invoices per student.',
      },
      {
        title: 'Warden Duty Roster',
        description:
          'Schedule warden duties and log incident reports with timestamp and action taken.',
      },
      {
        title: 'Student Check-in/Check-out',
        description:
          'Log gate pass requests and check-in/check-out times linked to the gatepass module.',
      },
      {
        title: 'Maintenance Request Management',
        description:
          'Students raise maintenance tickets; hostel staff resolve and close with remarks.',
      },
      {
        title: 'Occupancy Trend Reports',
        description: 'Track bed occupancy trends across blocks, floors, and academic years.',
      },
    ],
    sections: [
      {
        heading: 'Smart Room Allocation',
        body: 'The allocation engine considers student preferences, program, gender, and category reservations. Automatic waitlist management handles room changes across the academic year.',
      },
      {
        heading: 'Integrated Mess Operations',
        body: 'Track daily meal attendance, configure meal plans, and auto-bill students for mess charges. Special diet requests and rebate processing are fully supported.',
      },
    ],
    stats: [
      { label: 'Rooms Manageable', value: '10,000+' },
      { label: 'Hostel Blocks', value: 'Unlimited' },
      { label: 'Mess Billing', value: 'Automated' },
    ],
    relatedModules: ['fees', 'security', 'communication'],
  },
  {
    id: 'transport',
    title: 'Transport Management',
    tagline: 'Campus vehicle and route tracking',
    description:
      'Configure bus routes, assign students and faculty to vehicles, manage transport fees, and maintain driver and vehicle records from one centralized transport dashboard.',
    longDescription:
      "Devvelocity's transport module brings order to campus vehicle operations. Define routes, stops, and schedules. Assign students to buses, collect transport fees automatically, track driver information, and schedule vehicle maintenance.",
    color: '#ea580c',
    accentColor: '#f97316',
    bg: '#fff7ed',
    iconName: 'Bus',
    features: [
      {
        title: 'Route & Stop Configuration',
        description:
          'Define bus routes with named stops, schedules, and assigned vehicles per route.',
      },
      {
        title: 'Student Transport Billing',
        description:
          'Auto-generate transport fee invoices per student based on their assigned route.',
      },
      {
        title: 'Driver Management',
        description:
          'Maintain driver profiles, license details, duty schedules, and attendance records.',
      },
      {
        title: 'Vehicle Maintenance Scheduling',
        description:
          'Log service records, schedule periodic maintenance, and track insurance renewals.',
      },
      {
        title: 'Route-wise Student Roster',
        description: 'Generate bus-wise student lists with pickup point and contact details.',
      },
      {
        title: 'GPS Integration Hooks',
        description: 'REST API hooks for GPS device integration to display live vehicle location.',
      },
    ],
    sections: [
      {
        heading: 'Route Planning & Assignment',
        body: 'Map routes geographically, define pickup stops with estimated times, and assign students by their residence area. The system auto-calculates transport fee per student based on route distance tier.',
      },
    ],
    stats: [
      { label: 'Routes', value: 'Unlimited' },
      { label: 'Billing', value: 'Automated' },
      { label: 'GPS Ready', value: 'API Hooks' },
    ],
    relatedModules: ['fees', 'security', 'analytics'],
  },
  {
    id: 'library',
    title: 'Library Management',
    tagline: 'Digital library operations and catalog management',
    description:
      'Maintain complete book catalogs, track issue and return transactions, manage memberships, automate overdue reminders, and generate utilization reports.',
    longDescription:
      "Devvelocity's Library module transforms traditional libraries into smart digital resource hubs. Librarians maintain the catalog with ISBN lookup, process issue/return transactions, manage membership tiers, and auto-compute overdue fines.",
    color: '#0d9488',
    accentColor: '#14b8a6',
    bg: '#f0fdfa',
    iconName: 'BookOpen',
    features: [
      {
        title: 'Book Catalog Management',
        description:
          'Maintain catalog with ISBN lookup, author, publisher, edition, and location data.',
      },
      {
        title: 'Issue & Return Processing',
        description:
          'Barcode/manual book issue and return with due date tracking per membership tier.',
      },
      {
        title: 'Member Tier Management',
        description:
          'Configure different membership tiers with custom issue limits and loan durations.',
      },
      {
        title: 'Overdue Fine Computation',
        description: 'Automatically compute and record overdue fines per student for recovery.',
      },
      {
        title: 'Reservation Queue',
        description:
          'Students reserve unavailable books; system notifies when the book is returned.',
      },
      {
        title: 'Library Usage Analytics',
        description:
          'Track most-borrowed titles, peak usage periods, and collection utilization rates.',
      },
    ],
    sections: [
      {
        heading: 'Smart Catalog Management',
        body: 'Scan ISBN barcodes to auto-populate book details from online databases. Manage multiple copies, track location codes, and handle periodicals and digital resources.',
      },
    ],
    stats: [
      { label: 'Books Supported', value: 'Unlimited' },
      { label: 'Fines', value: 'Auto-computed' },
      { label: 'Reservations', value: 'Queue-based' },
    ],
    relatedModules: ['academics', 'naac-iqac', 'analytics'],
  },
  {
    id: 'placements',
    title: 'Placement & Career Center',
    tagline: 'Campus recruitment and career management',
    description:
      'Coordinate campus recruitment drives, post job openings, manage student placement profiles, and generate placement statistics for NAAC and NIRF rankings.',
    longDescription:
      'The Placement module connects students with opportunities and the institution with corporate recruiters. Post jobs, shortlist students based on eligibility criteria, schedule interview rounds, record offer details, and generate NAAC-compliant placement statistics.',
    color: '#2563eb',
    accentColor: '#3b82f6',
    bg: '#eff6ff',
    iconName: 'TrendingUp',
    features: [
      {
        title: 'Company Job Postings',
        description:
          'Companies or placement team post job openings with eligibility filters and deadlines.',
      },
      {
        title: 'Student Placement Profiles',
        description:
          'Students build comprehensive placement profiles with projects, skills, and resume links.',
      },
      {
        title: 'Interview Scheduling',
        description: 'Multi-round interview scheduling with venue, panel, and result recording.',
      },
      {
        title: 'Offer Tracking',
        description:
          'Record offer letters, CTC details, joining dates, and acceptance status per student.',
      },
      {
        title: 'NAAC/NIRF Statistics Export',
        description: 'Auto-generate placement statistics in NAAC SSR and NIRF submission formats.',
      },
      {
        title: 'Training Session Management',
        description:
          'Schedule soft skills, aptitude, and technical training sessions pre-placement.',
      },
      {
        title: 'Advancement & Alumni Engagement',
        description:
          'Manage alumni relationships, campaigns, pledges, donations and institutional advancement activity with traceable stewardship.',
      },
    ],
    sections: [
      {
        heading: 'End-to-End Recruitment Coordination',
        body: 'From posting job openings to recording final placements, every step is tracked. Eligibility filters auto-shortlist students, saving hours of manual work for the placement team.',
      },
      {
        heading: 'Placement Analytics Dashboard',
        body: 'Track placement rates, average CTC, top recruiting companies, and program-wise placement performance across academic years.',
        items: [
          'Year-wise comparison',
          'Branch-wise analytics',
          'Company visit history',
          'NIRF data export',
        ],
      },
    ],
    stats: [
      { label: 'Placement Rate Impact', value: '+30%' },
      { label: 'NIRF Ready', value: 'Yes' },
      { label: 'Report Generation', value: 'One-click' },
    ],
    relatedModules: ['academics', 'naac-iqac', 'communication'],
  },
  {
    id: 'research',
    title: 'Research & Development',
    tagline: 'Academic research and innovation tracking',
    description:
      'Track research projects, patent filings, publication records, grant applications, and industry collaborations — covering every NAAC research indicator.',
    longDescription:
      "Devvelocity's R&D module is purpose-built for institutions serious about research output. Faculty log ongoing projects, submit publications for approval, track patent filing stages, apply for research grants, and collaborate with industry partners.",
    color: '#9333ea',
    accentColor: '#a855f7',
    bg: '#faf5ff',
    iconName: 'FlaskConical',
    features: [
      {
        title: 'Research Project Tracking',
        description:
          'Log faculty research projects with funding source, timeline, team members, and status.',
      },
      {
        title: 'Publication Records',
        description:
          'Track journal and conference publications with impact factor and citation index data.',
      },
      {
        title: 'Patent Management',
        description:
          'Log patent filings at national and international levels with stage-wise status tracking.',
      },
      {
        title: 'Grant Application Tracking',
        description:
          'Track grant applications submitted to DST, UGC, AICTE, and industry sponsors.',
      },
      {
        title: 'Industry Collaboration Tracking',
        description:
          'Record MOU and collaboration details with industry and research organizations.',
      },
      {
        title: 'NAAC Research Dashboard',
        description: 'Real-time R&D metrics mapped to NAAC criteria 3 sub-indicators.',
      },
    ],
    sections: [
      {
        heading: 'Research Output Repository',
        body: 'All faculty publications, patents, and funded projects are centrally stored with supporting documents. HODs and the Research Cell get a live output dashboard.',
      },
    ],
    stats: [
      { label: 'NAAC Criteria 3', value: '100% Covered' },
      { label: 'Publications', value: 'Unlimited' },
      { label: 'Grant Tracking', value: 'Live Status' },
    ],
    relatedModules: ['naac-iqac', 'academics', 'analytics'],
  },
  {
    id: 'naac-iqac',
    title: 'Accreditation & Compliance',
    tagline: 'NAAC, NBA, AICTE, BPUT and IQAC governance',
    description:
      'Monitor all 7 NAAC criteria in real-time, generate SSR data automatically, prepare IQAC action plans, and document quality improvement initiatives.',
    longDescription:
      "Devvelocity's NAAC/IQAC module is the institutional command center for quality assurance. All 7 NAAC criteria are populated automatically from live module data — admissions, academics, research, placements, and more — dramatically reducing the effort to compile SSR documents.",
    color: '#ca8a04',
    accentColor: '#eab308',
    bg: '#fefce8',
    iconName: 'BadgeCheck',
    features: [
      {
        title: '7-Criteria NAAC Dashboard',
        description:
          'Live NAAC criteria dashboard with auto-populated data from integrated modules.',
      },
      {
        title: 'IQAC Action Plan Module',
        description:
          'Author, track, and document IQAC action plans and quality improvement initiatives.',
      },
      {
        title: 'SSR Data Export',
        description:
          'One-click export of SSR data in NAAC-specified formats for direct submission.',
      },
      {
        title: 'Best Practices Documentation',
        description:
          'Structured module to record and showcase institutional best practices for assessors.',
      },
      {
        title: 'Academic Audit Scheduling',
        description:
          'Schedule internal and external academic audits with checklist-based reporting.',
      },
      {
        title: 'NBA Criteria Compliance',
        description: 'Track NBA program-level criteria for engineering and technical programs.',
      },
      {
        title: 'AICTE Standards Tracking',
        description:
          'Maintain governed institutional standards, evidence and readiness status for AICTE review.',
      },
      {
        title: 'BPUT D-Forms',
        description:
          'Prepare structured BPUT D-Form data from authoritative academic and institutional records.',
      },
      {
        title: 'Evidence-Based OBE Attainment',
        description:
          'Calculate CO-PO attainment from question-level assessment evidence and course-exit feedback with independent approval.',
      },
    ],
    sections: [
      {
        heading: 'Auto-Populated NAAC Criteria',
        body: 'Instead of manually compiling data from 10 different departments, Devvelocity auto-populates NAAC indicators from live module data. Admissions data feeds Criterion 2, academic data feeds Criterion 4, placement data feeds Criterion 5, and research data feeds Criterion 3.',
      },
    ],
    stats: [
      { label: 'SSR Preparation Time', value: '10× faster' },
      { label: 'NAAC Criteria', value: 'All 7 Covered' },
      { label: 'Assessor Ready', value: 'Always' },
    ],
    relatedModules: ['research', 'academics', 'placements'],
  },
  {
    id: 'clubs',
    title: 'Clubs & Student Activities',
    tagline: 'Extracurricular and student life management',
    description:
      'Register student clubs and committees, manage event calendars, track participation and achievements, and generate activity reports for holistic development records.',
    longDescription:
      "Student life beyond academics is central to holistic development — and to NAAC Criterion 5. Devvelocity's Clubs module lets institutions register clubs, committees, and cells; manage event approvals and budgets; and track student participation and awards.",
    color: '#e11d48',
    accentColor: '#f43f5e',
    bg: '#fff1f2',
    iconName: 'Heart',
    features: [
      {
        title: 'Club Registration',
        description:
          'Register student clubs with faculty advisors, office bearers, and membership lists.',
      },
      {
        title: 'Event Management',
        description:
          'Create events with approval workflows, venue booking, and participant enrollment.',
      },
      {
        title: 'Achievement Tracking',
        description: 'Record student and club-level awards, recognitions, and achievements.',
      },
      {
        title: 'Budget Allocation',
        description:
          'Allocate and track event budgets with expense submission and approval workflows.',
      },
      {
        title: 'Student Activity Report',
        description:
          'Per-student extracurricular activity report linked to holistic development records.',
      },
      {
        title: 'IIC Innovation Cell Management',
        description:
          'Dedicated workflows for IIC activities, idea submissions, and innovation milestones.',
      },
    ],
    sections: [
      {
        heading: 'Rich Student Life Platform',
        body: 'Students browse and join clubs, register for events, and build their extracurricular portfolio — all from the same portal they use for academics and fee payments.',
      },
    ],
    stats: [
      { label: 'Clubs Supported', value: 'Unlimited' },
      { label: 'NAAC Criterion 5', value: 'Fully Covered' },
      { label: 'IIC Workflows', value: 'Dedicated' },
    ],
    relatedModules: ['communication', 'naac-iqac', 'analytics'],
  },
  {
    id: 'communication',
    title: 'Communication & Collaboration',
    tagline: 'Targeted campaigns and governed campus engagement',
    description:
      'Socket-powered real-time messaging, department group channels, digital notice board broadcasts, push notification alerts, and video meeting scheduling.',
    longDescription:
      "Devvelocity's communication infrastructure is built on Socket.io for zero-latency real-time messaging. Faculty, students, and administrative staff communicate through structured group channels and direct messages. The notice board broadcasts announcements institution-wide.",
    color: '#0369a1',
    accentColor: '#0284c7',
    bg: '#f0f9ff',
    iconName: 'MessageSquare',
    features: [
      {
        title: 'Real-time Campus Chat',
        description: 'Socket.io-powered instant messaging with delivery and read receipts.',
      },
      {
        title: 'Department Group Channels',
        description:
          'Structured group channels for departments, batch, and section-wise communication.',
      },
      {
        title: 'Digital Notice Board',
        description: 'Admin broadcasts announcements with file attachments across the institution.',
      },
      {
        title: 'Push Notification Alerts',
        description:
          'Firebase-powered push notifications for critical alerts, exam schedules, and events.',
      },
      {
        title: 'Video Meeting Scheduling',
        description: 'Schedule and join video meetings directly from the communication module.',
      },
      {
        title: 'Message Search & Archive',
        description: 'Full-text search across message history with date-range filtering.',
      },
      {
        title: 'Omnichannel Campaign Hub',
        description:
          'Target real tenant audiences through scheduled in-app, email, push and SMS campaigns.',
      },
      {
        title: 'Twilio SMS Integration',
        description:
          'Configure tenant-owned Twilio credentials for governed transactional and campaign SMS.',
      },
      {
        title: 'Tenant SMTP Email Delivery',
        description:
          'Send institutional email through each tenant’s verified SMTP identity and reply-to settings.',
      },
      {
        title: 'Firebase Push Notifications',
        description:
          'Deliver tenant-configured browser and device notifications through Firebase Cloud Messaging.',
      },
      {
        title: 'Discussions, Polls & Galleries',
        description:
          'Run role-aware discussions, institutional polls, announcements and moderated galleries.',
      },
    ],
    sections: [
      {
        heading: 'Structured Communication Hierarchy',
        body: 'Channels are organized by institution → department → batch → section hierarchy. Admins control who can post to broadcast channels, keeping communication organized.',
      },
    ],
    stats: [
      { label: 'Message Delivery', value: 'Real-time' },
      { label: 'Channels', value: 'Unlimited' },
      { label: 'Push Delivery', value: 'Firebase FCM' },
    ],
    relatedModules: ['academics', 'hostel', 'clubs'],
  },
  {
    id: 'security',
    title: 'Access Control & Security',
    tagline: 'Enterprise identity, tenant isolation and integration governance',
    description:
      'Granular two-tier RBAC with 24+ system roles, dynamic permission matrices, JWT token rotation, audit trail logging, and instant session invalidation.',
    longDescription:
      "Security is non-negotiable for institutions handling sensitive student and financial data. Devvelocity's IAM layer enforces role-based access at every API route. Roles are predefined per system but permissions are fully customizable per institution through the admin UI.",
    color: '#dc2626',
    accentColor: '#ef4444',
    bg: '#fef2f2',
    iconName: 'ShieldAlert',
    features: [
      {
        title: '24+ Predefined System Roles',
        description:
          'Principal, HOD, Faculty, Student, Parent, Exam Cell, Accounts, HR, and 16+ more.',
      },
      {
        title: 'Module-Level Permission Control',
        description:
          'Configure read/create/update/delete permissions per module per role via admin UI.',
      },
      {
        title: 'JWT Token Rotation',
        description:
          'Short-lived access tokens with refresh token rotation for maximum session security.',
      },
      {
        title: 'Instant Session Invalidation',
        description:
          'Role changes immediately terminate all active sessions for the affected user.',
      },
      {
        title: 'Audit Trail Logging',
        description:
          'Every sensitive action is logged with timestamp, user identity, and IP address.',
      },
      {
        title: 'IP & Device Restrictions',
        description: 'Configure IP whitelist and trusted device policies per role or user.',
      },
      {
        title: 'Google & Microsoft SSO',
        description:
          'Tenant-controlled OpenID Connect login with PKCE, domain restrictions and safe provisioning.',
      },
      {
        title: 'Google Workspace Integration',
        description:
          'Connect governed document and meeting workflows to tenant-controlled Google Workspace services.',
      },
      {
        title: 'Microsoft Graph Integration',
        description:
          'Connect Microsoft document and meeting operations with encrypted tenant credentials.',
      },
      {
        title: 'Secure Connector Center',
        description:
          'Encrypt external credentials and monitor provider health, idempotency and circuit protection.',
      },
      {
        title: 'Custom Webhook Integration',
        description:
          'Send signed workflow events to approved HTTPS endpoints with execution tracking and retries.',
      },
      {
        title: 'Governed Data Portability',
        description:
          'Prepare expiring, audit-tracked institution exports without exposing protected credentials.',
      },
      {
        title: 'Responsible AI Governance',
        description:
          'Register AI use cases, classify impact, document human oversight and govern approval, monitoring and retirement.',
      },
    ],
    sections: [
      {
        heading: 'Two-Tier Permission Architecture',
        body: 'System roles define the baseline access scope. Administrators can further customize permissions per role within their tenant, without affecting other institutions on the platform.',
      },
    ],
    stats: [
      { label: 'System Roles', value: '24+' },
      { label: 'Audit Logs', value: 'Every Action' },
      { label: 'Token Security', value: 'JWT Rotation' },
    ],
    relatedModules: ['admissions', 'fees', 'analytics'],
  },
  {
    id: 'analytics',
    title: 'Reports & Analytics',
    tagline: 'Reusable reports and governed institutional intelligence',
    description:
      'Institution-wide dashboards with actionable insights across student performance, fee collection, faculty workload, and operational efficiency. One-click compliance exports.',
    longDescription:
      "Devvelocity's analytics engine aggregates data across all modules into meaningful institutional intelligence. KPI dashboards update in real-time. Custom report configurations save institutional-specific views. One-click data exports satisfy regulatory requirements.",
    color: '#0891b2',
    accentColor: '#06b6d4',
    bg: '#ecfeff',
    iconName: 'BarChart3',
    features: [
      {
        title: 'Institution KPI Dashboard',
        description:
          'Real-time KPI cards for enrollment, fee collection, attendance rates, and more.',
      },
      {
        title: 'Student Performance Analytics',
        description:
          'Track grade distributions, top performers, at-risk students, and trend analysis.',
      },
      {
        title: 'Fee Collection Reports',
        description: 'Live fee collection vs. outstanding analytics with student-level drill-down.',
      },
      {
        title: 'Faculty Workload Reports',
        description: 'Workload compliance reports per faculty for UGC norms verification.',
      },
      {
        title: 'NAAC Data Export',
        description: 'Auto-generate indicator-mapped data exports for accreditation submissions.',
      },
      {
        title: 'Custom Report Builder',
        description: 'Configure and save custom report templates with filter combinations.',
      },
      {
        title: 'Universal Report Center',
        description:
          'Create reusable cross-functional reports with governed datasets, filters and export formats.',
      },
      {
        title: 'Import & Migration Center',
        description:
          'Preview, validate and import institutional CSV data with row-level error reporting.',
      },
      {
        title: 'Student Success Analytics',
        description:
          'Surface explainable academic-risk trends, intervention workload and overdue advisor actions without opaque scoring.',
      },
    ],
    sections: [
      {
        heading: 'Executive Dashboard',
        body: 'The Principal and Management get a single-screen view of institutional health — enrollment numbers, fee collection percentages, attendance averages, placement rates, and research output metrics.',
      },
    ],
    stats: [
      { label: 'Report Templates', value: '50+' },
      { label: 'Dashboard Refresh', value: 'Real-time' },
      { label: 'Export Formats', value: 'Excel + PDF' },
    ],
    relatedModules: ['fees', 'academics', 'naac-iqac'],
  },
  {
    id: 'lms-integrations',
    title: 'LMS Integrations',
    tagline: 'Governed learning-system interoperability',
    description:
      'Connect approved Canvas, Moodle, OneRoster and Coursera environments through reviewed, traceable synchronization workflows.',
    longDescription:
      'Devvelocity connects the institutional ERP with external learning platforms without turning synchronization into an uncontrolled background process. Administrators govern provider readiness, mappings and execution; academic teams review imported grades and progress before they affect authoritative records.',
    color: '#0369a1',
    accentColor: '#0ea5e9',
    bg: '#f0f9ff',
    iconName: 'CloudCog',
    features: [
      {
        title: 'Canvas & Moodle Connectors',
        description:
          'Configure tenant-owned connections and synchronize approved course, roster and assignment data.',
      },
      {
        title: 'OneRoster 1.2 Interoperability',
        description:
          'Exchange standards-aligned academic structures and enrollments through governed runs.',
      },
      {
        title: 'Coursera Institutional Connector',
        description:
          'Coordinate institutional course enrollment, progress and credential evidence where provider access permits.',
      },
      {
        title: 'Reviewed Grade Import',
        description:
          'Stage external grades and progress for authorized review before committing them to ERP records.',
      },
      {
        title: 'LTI 1.3 Trust Metadata',
        description:
          'Maintain deployment, issuer and key metadata needed for controlled learning-tool trust.',
      },
      {
        title: 'Idempotent Sync History',
        description:
          'Prevent duplicate processing and retain execution results, failures and operator-visible audit history.',
      },
    ],
    sections: [
      {
        heading: 'Controlled Academic Synchronization',
        body: 'Every provider connection is tenant-owned and every synchronization run is traceable. Imported academic results remain staged until an authorized user reviews the source, mapping and outcome.',
        items: [
          'Provider readiness checks',
          'Mapping validation',
          'Review queues',
          'Retry-safe runs',
        ],
      },
      {
        heading: 'Standards Without Data Ambiguity',
        body: 'OneRoster and LTI metadata are connected to authoritative ERP courses, batches and users so integrations do not create parallel identities or duplicate academic records.',
      },
    ],
    stats: [
      { label: 'Providers', value: '4+' },
      { label: 'OneRoster', value: '1.2' },
      { label: 'Execution', value: 'Audited' },
    ],
    relatedModules: ['academics', 'security', 'analytics'],
  },
  {
    id: 'government-regulatory-integrations',
    title: 'Government & Regulatory Integrations',
    tagline: 'Readiness and authorization before production connectivity',
    description:
      'Govern institutional onboarding and production readiness for DigiLocker, NAD, ABC, AISHE and NIRF workflows.',
    longDescription:
      'Government connectivity requires more than an API key. Devvelocity records institutional eligibility, nodal ownership, consent, documentation, provider authorization and production approval so teams can distinguish readiness coordination from a live authority-approved integration.',
    color: '#1d4ed8',
    accentColor: '#3b82f6',
    bg: '#eff6ff',
    iconName: 'Landmark',
    features: [
      {
        title: 'DigiLocker Partner Onboarding',
        description:
          'Track issuer or requester onboarding evidence, ownership, authorization and environment readiness.',
      },
      {
        title: 'NAD Award Readiness',
        description:
          'Coordinate academic-award schemas, verification responsibilities and production enablement evidence.',
      },
      {
        title: 'ABC Credit Workflow Readiness',
        description:
          'Prepare governed credit identity, consent and transfer workflows without claiming unapproved connectivity.',
      },
      {
        title: 'AISHE & NIRF Coordination',
        description:
          'Assign reporting ownership, readiness milestones, evidence and submission review responsibilities.',
      },
      {
        title: 'Nodal Officer Governance',
        description:
          'Record accountable institutional contacts, approvals, escalation status and provider correspondence.',
      },
      {
        title: 'Consent & Production Controls',
        description:
          'Prevent premature production enablement until required consent, security and authority approvals exist.',
      },
    ],
    sections: [
      {
        heading: 'Truthful Integration Status',
        body: 'Dashboards clearly separate planned, onboarding, authorized, sandbox-ready and production-enabled states. This prevents readiness work from being mistaken for active government connectivity.',
      },
      {
        heading: 'Evidence for Every Approval',
        body: 'Nodal ownership, consent, security review, provider communication and production decisions remain linked to the integration record for institutional audit and continuity.',
      },
    ],
    stats: [
      { label: 'Workflows', value: '5' },
      { label: 'Readiness', value: 'Stage-based' },
      { label: 'Approvals', value: 'Audited' },
    ],
    relatedModules: ['naac-iqac', 'academics', 'security'],
  },
  {
    id: 'multi-campus-governance',
    title: 'Multi-Campus Governance',
    tagline: 'One institution group with controlled campus autonomy',
    description:
      'Model campus hierarchy, scoped staff authority, inherited calendars, shared services and consolidated operating metrics.',
    longDescription:
      'Devvelocity gives universities and education groups a governed operating model across campuses. Institutional policy can flow downward while campus teams retain explicitly scoped responsibility. Shared services and consolidated reporting work from one hierarchy without weakening tenant or role boundaries.',
    color: '#0f766e',
    accentColor: '#14b8a6',
    bg: '#f0fdfa',
    iconName: 'Building2',
    features: [
      {
        title: 'Campus Hierarchy & Lifecycle',
        description:
          'Create governed parent, child and operating-campus records with controlled activation and ownership.',
      },
      {
        title: 'Campus-Scoped Access',
        description:
          'Limit staff authority to assigned campuses while retaining institution-level oversight where authorized.',
      },
      {
        title: 'Inherited Academic Calendars',
        description:
          'Publish common calendar policy with explicit campus-level inheritance and approved exceptions.',
      },
      {
        title: 'Shared Service Operations',
        description:
          'Coordinate approved central services across campuses with accountable provider and consumer ownership.',
      },
      {
        title: 'Consolidated Operating Metrics',
        description:
          'Compare campus activity and aggregate institution-group performance from governed source records.',
      },
      {
        title: 'Audited Department Ownership',
        description:
          'Bind departments and responsibilities to campuses with traceable changes and scope validation.',
      },
    ],
    sections: [
      {
        heading: 'Scoped Authority by Design',
        body: 'Role assignments carry campus scope, allowing central leadership, regional teams and campus operators to work in the same platform without accidental cross-campus access.',
      },
      {
        heading: 'Shared Policy, Local Execution',
        body: 'Institution-wide calendars and services can be inherited consistently while approved local variations remain explicit and auditable.',
        items: ['Hierarchy controls', 'Scoped roles', 'Calendar inheritance', 'Shared services'],
      },
    ],
    stats: [
      { label: 'Campus Levels', value: 'Flexible' },
      { label: 'Access', value: 'Scope-aware' },
      { label: 'Reporting', value: 'Consolidated' },
    ],
    relatedModules: ['security', 'analytics', 'academics'],
  },
  {
    id: 'procurement',
    title: 'Procurement & Store',
    tagline: 'Institutional asset and inventory management',
    description:
      'Raise purchase requisitions, manage vendor quotes, track GRN receipts, maintain store inventory, and track asset lifecycle from procurement to disposal.',
    longDescription:
      "Devvelocity's Procurement module brings transparency and efficiency to institutional purchasing. The approval workflow ensures every purchase goes through proper authorization. Store inventory tracks stock levels and auto-alerts on low stock.",
    color: '#78350f',
    accentColor: '#92400e',
    bg: '#fef3c7',
    iconName: 'Package',
    features: [
      {
        title: 'Purchase Requisition Workflow',
        description:
          'Staff raise requisitions; HOD and Admin approve through structured multi-level workflow.',
      },
      {
        title: 'Vendor Management',
        description:
          'Maintain vendor registry with contact, categories, and past transaction history.',
      },
      {
        title: 'GRN & Invoice Matching',
        description: 'Record goods receipts and match with purchase orders and vendor invoices.',
      },
      {
        title: 'Store Inventory Management',
        description:
          'Track item-wise stock levels with low-stock alerts and reorder point configuration.',
      },
      {
        title: 'Asset Lifecycle Tracking',
        description:
          'Tag and track institutional assets from procurement to disposal or write-off.',
      },
      {
        title: 'Budget vs. Actual Reports',
        description: 'Compare procurement expenditure against department-wise budget allocations.',
      },
      {
        title: 'Facilities & Asset Lifecycle',
        description:
          'Govern buildings, rooms, maintenance work orders, inspections and asset lifecycle from commissioning to disposal.',
      },
    ],
    sections: [
      {
        heading: 'Approval-Driven Procurement',
        body: 'Every purchase begins with a requisition that routes through department and administration approval. Approved orders are tracked through vendor quotation, purchase order, GRN, and payment.',
      },
    ],
    stats: [
      { label: 'Cost Savings', value: 'Up to 20%' },
      { label: 'Approval Levels', value: 'Configurable' },
      { label: 'Asset Tagging', value: 'Supported' },
    ],
    relatedModules: ['fees', 'analytics', 'security'],
  },
  {
    id: 'virtual-classrooms',
    title: 'Virtual Classrooms',
    tagline: 'WebRTC-powered live teaching engine',
    description:
      'Browser-based video lectures with screen sharing, digital whiteboard, automatic attendance logging from session join, and lecture recording.',
    longDescription:
      "Devvelocity's Virtual Classroom module brings high-quality video teaching to every campus, eliminating the need for external video conferencing tools. Faculty start sessions directly from their class schedule. Students join with one click. Attendance is marked automatically.",
    color: '#4338ca',
    accentColor: '#4f46e5',
    bg: '#eef2ff',
    iconName: 'Video',
    features: [
      {
        title: 'Browser-based WebRTC',
        description: 'No plugin installation needed. Faculty and students join from any browser.',
      },
      {
        title: 'Screen Sharing & Whiteboard',
        description:
          'Share screen or use the collaborative digital whiteboard for visual teaching.',
      },
      {
        title: 'Auto-Attendance Logging',
        description:
          'Student join/leave times are recorded and auto-converted to attendance entries.',
      },
      {
        title: 'Hand-raising & Moderation',
        description: 'Students raise virtual hands; faculty grant or revoke speaking permissions.',
      },
      {
        title: 'Session Recording',
        description:
          'Record lectures with faculty consent; stored recordings linked to the course material.',
      },
      {
        title: 'Adaptive Bitrate',
        description:
          'Video quality adapts automatically to student internet speed to minimize disruption.',
      },
      {
        title: 'Google Meet Integration',
        description:
          'Create and manage Google Meet sessions through encrypted tenant connector credentials.',
      },
      {
        title: 'BigBlueButton Integration',
        description:
          'Launch governed BigBlueButton classrooms with host controls and tracked meeting execution.',
      },
      {
        title: 'Google Workspace Meeting Connectivity',
        description:
          'Connect course and timetable workflows with Google Workspace meeting services.',
      },
      {
        title: 'Microsoft Graph Meeting Connectivity',
        description:
          'Provision Microsoft-connected meeting workflows from institutional schedules.',
      },
    ],
    sections: [
      {
        heading: 'Zero Friction Live Teaching',
        body: 'Faculty click "Start Class" from their timetable. A WebRTC room is created instantly. Students see a join button on their dashboard the moment their faculty starts the session.',
      },
    ],
    stats: [
      { label: 'Session Latency', value: '<100ms' },
      { label: 'Attendance', value: 'Auto-logged' },
      { label: 'Recording', value: 'Built-in' },
    ],
    relatedModules: ['academics', 'attendance', 'communication'],
  },
];

export function getModuleById(id: string): ErpModule | undefined {
  return ALL_MODULES.find((m) => m.id === id);
}

export function getModulesByIds(ids: string[]): ErpModule[] {
  return ids
    .map((id) => ALL_MODULES.find((m) => m.id === id))
    .filter((m): m is ErpModule => m !== undefined);
}
