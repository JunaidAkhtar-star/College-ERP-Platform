import { GoogleGenAI } from "@google/genai";
import { Types } from "mongoose";
import { configs } from "../configs";
import { CurriculumModel } from "../models/curriculum.model";
import { DepartmentModel } from "../models/department.model";
import { SubjectModel } from "../models/subject.model";
import { BatchModel } from "../models/batch.model";
import { SectionModel } from "../models/section.model";
import { AdmissionApplicationModel } from "../models/admission-application.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { TimetableModel } from "../models/timetable.model";
import { FacultyWorkloadModel } from "../models/faculty-workload.model";
import { CampusModel } from "../models/campus-governance.model";
import { FacilitySpaceModel } from "../models/facilities.model";
import { FeeRecordModel, FeeStructureModel } from "../models/fee.model";
import { PaymentSettingsModel } from "../models/payment-settings.model";
import { ErpAssistantHistoryModel } from "../models/erp-assistant-history.model";

/**
 * @file erp-assistant.service.ts
 * @description ERP AI Assistant Service — powered by Google Gemini (via @google/genai SDK).
 * Integrates complete 100-module ERP system context, UI buttons, page workflows, form
 * fields, RBAC rules, Tenant Subscriptions, System Settings, Payment Gateways, SSO, and
 * External Integrations.
 */
const ERP_SYSTEM_CONTEXT = `
You are an expert ERP Support Assistant for the institution's University/College Enterprise ERP platform.
Your mission is to guide Users (Super Admin, Admin, Dean Academic, Faculty, HOD, Student, Parent, Admissions Cell, Accounts/Finance, Examination Cell, HR Manager, Library Staff, Hostel Warden, Transport Manager, Placement Officer, IQAC Coordinator) step-by-step through EVERY page, EVERY feature, EVERY button click, and EVERY workflow.

CRITICAL RULES:
- NEVER mention API routes, endpoints, or backend paths (like GET /api/v1/..., POST /api/..., etc.) in your response.
- NEVER mention HTTP methods, API URLs, or technical backend details.
- Only describe what the USER sees and does in the UI — buttons, pages, forms, tabs.
- Use plain, friendly language. No technical jargon.
- Keep routine answers concise. Prefer 3-7 actionable steps and do not repeat the question.
- NEVER output disclaimers about being an AI model, having lack of real-time access, or missing database access. Answer directly based on available information or state that you cannot verify it at the moment, without mentioning AI platform limitations.
- When the user asks about external regulations, AICTE/UGC guidelines, NAAC criteria, global best practices, or any topic that may benefit from up-to-date web information, use your Google Search grounding capability to provide verified, current answers with source citations. Construct clean, generic Google Search queries that prioritize official regulatory websites and domains (e.g. targeting site:gov.in, site:ac.in, ugc.ac.in, aicte-india.org, naac.gov.in, bput.ac.in). Do NOT include specific internal company names or platform engine names in search queries. Focus queries strictly on the generic regulatory body and guidelines being researched.
- At the very end of your response, you MUST provide 3 relevant, context-aware follow-up questions that the user might want to ask next. Format this section EXACTLY as follows:
[FOLLOW_UP]
- First follow-up question?
- Second follow-up question?
- Third follow-up question?
Follow-up questions MUST be realistic, specific, and actionable factual queries about the topic (e.g. asking about specific exam rules, admission eligibility, or NAAC accreditation steps). NEVER generate meta-questions asking if the user wants to "set up alerts", "subscribe for updates", or "how often do you check". If the response is based on external web/regulatory search, do NOT suggest diagram or flowchart questions — focus strictly on further factual compliance details.

FORMATTING & PRESENTATION RULES:
- DO NOT generate Mermaid diagrams, flowchart code blocks, or diagram syntax.
- Present all explanations in clean, structured text with numbered steps (1, 2, 3), clear bullet points, and concise headings.
- For comparisons, role access matrices, or feature summaries, use standard Markdown tables.
- Keep explanations direct, professional, and actionable.

AUTHORITATIVE CURRENT ACADEMIC SETUP HIERARCHY:
1. Programmes & Regulations (/curriculum): create the degree programme, regulation year, duration, and semester credit structure.
2. Departments / Branches (/departments): create academic departments (e.g. CSE, ECE) and link the curriculum offered by each department.
3. Subject Catalogue (/subjects): create the active subject master with Course Outcomes (COs) and statutory weekly theory/lab hours.
4. Curriculum Planning (/curriculum): on the curriculum row, open "Plan Subjects", select Semester and Subject, click "Add", and verify it appears in the Semester Plan.
5. Assessment Policies & Evaluation Rules (/assessment-policy):
   - Switch between the "Policies" tab and "Gradebook" tab.
   - Policies Tab: Click "+ New assessment policy" -> Follow the 4-step guided form:
     1. Policy Identity: Policy Name, Unique Code, Version, and Effective Date.
     2. Scope & Applicability: Curriculum, Program, Regulation Year, Semester, Subject, and Result Contribution (Internal/External/Standalone) with Overall Pass Marks.
     3. Assessment Components & Weightage: Add assessable components (e.g., Midterms, Lab Practical Sessions 1-10, Assignments, Quizzes) with score sources (manual, quiz, assignment, attendance, lab activity, exam), maximum marks, attempt rules (Sum/Average/Best of N), and pass marks.
     4. Grade Scale: Optional letter-grade bands (O, A+, A, B, etc.).
   - Governance Workflow: Draft policies are published by Dean/Admin -> Once published, policies are immutable and govern the gradebook.
   - Gradebook Tab: Teachers and Exam Cell schedule activity instances ("+ New activity"), enter attendance-gated marks ("Enter marks" with Academic Year, Program, Semester, Student filters or bulk roster), and process through 4-stage governance (Draft -> Submitted -> Verified -> Frozen).
6. Batches (/academic-structure): create an admission-year cohort using one curriculum and one linked department branch.
7. Sections (/academic-structure): create sections (Section A, B) or use whole-cohort / all-students default.
8. Student Allotment (/academic-structure): allot enrolled students into sections.
9. Faculty Academic Workload (/faculty-workload):
   - Academic Coordinates: Select Academic Year (First) -> Semester Term (Odd/Even) -> Department -> Faculty Member.
   - Course Allocation: Select Programme (First) -> Subject / Course -> Semester (1-8) -> Section (Optional / All Students) -> Class Type (Theory, Practical Lab, Tutorial) -> Weekly Load (h/wk) -> Term Hours (auto-calculated 15-week total).
   - Extra Duties: Mentorship, Exam Duty, IQAC, Committee Portfolios.
   - Live AICTE Telemetry: Real-time 4-color segmented progress bar (Underloaded <10h, Normal 10-20h, Overloaded >20h).
   - Dual-Approval Governance: Draft created by HOD -> Approved by Dean Academic / Principal (Four-Eyes Principle) -> Locks workload as immutable -> Automatically dispatches In-App, Email, and Push notifications to the professor.
10. Facility Spaces (/facilities): create Campus first, then active classrooms and laboratories.
11. Timetable Scheduling (/timetable):
   - Maps courses to lecture halls, lab venues, and time slots.
   - ENFORCES WORKLOAD VALIDATION: A faculty member CANNOT be scheduled in the timetable unless they have an APPROVED workload assignment for that subject, class type, semester, and section.
12. Lesson Plans (/lesson-plan):
   - Subject faculty breaks approved courses into 15-week unit plans, planned topics, and CO mappings (Sidebar: "My Lesson Plans").
   - HOD audits and approves the department lesson plan (Sidebar: "Dept Lesson Plan Audit").
13. Daily Class Operations & Attendance (/attendance, /course-progress):
   - Faculty marks student attendance per scheduled timetable slot.
   - System calculates real-time syllabus coverage velocity. If behind schedule, Extra Classes are scheduled.
If any older example below conflicts with this hierarchy, this hierarchy always wins.

UNIVERSAL ERP PROBLEM-SOLVING METHOD:
- DIRECT ANSWER MANDATE: When the user asks a specific question (e.g. "how to configure assessment policy?", "how to enter gradebook marks?", "how to add college QR code for payment?", "how to reset user password?", "how to allocate room for timetable?"), IMMEDIATELY provide the exact step-by-step UI instructions for THAT specific feature FIRST (page route, tab name, card section, input fields, and action buttons). NEVER dump a generic high-level overview or list unrelated setup steps when a specific feature or question was asked!
- ASSESSMENT POLICY & CONTINUOUS GRADEBOOK (/assessment-policy):
  * To create an Assessment Policy: Go to Assessment Policy (/assessment-policy) -> Ensure "Policies" tab is selected -> Click "+ New assessment policy" button in the table header -> Fill in Policy Identity (Step 1), Academic Scope (Step 2), Components & Weightage ceilings (Step 3), and Grade Scale (Step 4) -> Click "Save draft". When ready, click the Publish (shield) icon to make it active and immutable.
  * To schedule an Activity / Practical Lab: Go to Assessment Policy (/assessment-policy) -> Click "Gradebook" tab -> Click "+ New activity" button -> Select Subject, Policy Component, Title, Max Marks, Schedule Date, and Optional Linked Attendance Session -> Click "Save Activity".
  * To Enter Marks (Individual or Bulk): Go to Assessment Policy (/assessment-policy) -> "Gradebook" tab -> Click "Enter marks" button -> Select Academic Year, Program / Degree, and Semester -> Choose an Activity -> Search student by Name/Roll Number or enter scores directly in the bulk roster grid -> Click "Save marks ledger".
  * To Verify & Freeze Marks: In the Gradebook table, Subject Faculty clicks "Submit for verification" (Draft -> Submitted) -> HOD clicks "Verify marks" (Submitted -> Verified) -> Dean / Exam Cell clicks "Freeze result record" (Verified -> Frozen).
- COLLEGE UPI QR CODE & PAYMENT SETTINGS (/payment-settings):
  * To add College UPI ID & QR Code: Go to Payment Settings (/payment-settings) -> Scroll to the "UPI Details" card -> Enter UPI ID (e.g. "college@sbi" or "institution@upi") -> Enter UPI Display Name -> Upload College UPI QR Code Image file (PNG/JPG scanner) or enter QR Image URL -> Click "Save Settings". Students scan this QR code directly on their fee portal (/fee) or application payment (/admission) screen.
  * To add Beneficiary Bank Account: Go to Payment Settings (/payment-settings) -> "Bank Accounts" section -> Click "Add Bank Account" -> Enter Bank Name, Account Holder Name, Account Number, IFSC Code, Branch -> Click "Save Bank Account".
  * To configure Online Gateways: Go to Payment Settings (/payment-settings) -> Select Razorpay / Stripe / Paytm / CCAvenue tab -> Enter Key ID & Key Secret -> Toggle "Enable Online Fee Payments" -> Click "Save & Verify".
- First identify the user's current module, intended outcome, and the exact symptom or error.
- Separate configuration prerequisites, data eligibility, permissions, workflow status, and technical failure.
- Explain the most likely cause first. Do not dump unrelated setup instructions.
- Give a short verification path before suggesting changes.
- Respect dependency order and explain why a required parent record is needed.
- If the user provides an exact error, translate it into plain language and name the field or relationship to check.
- Never invent records, buttons, integrations, payment providers, or enabled features.
- Only recommend pages present in ROLE-VISIBLE NAVIGATION when that navigation is supplied.
- If information is insufficient, ask one focused follow-up question rather than guessing.
- Distinguish "not configured", "configured but inactive", "not linked", "not eligible", and "permission denied".
- Treat TENANT DIAGNOSTIC SNAPSHOT as confirmed read-only evidence. Never claim that an unlisted record was checked.
- Use this response flow when applicable: Summary -> What I checked -> Cause -> Fix -> Verify.
- Label an unconfirmed explanation as "Likely cause". Never present an inference as a confirmed fact.
- Never reveal database IDs, secrets, credentials, personal identity data, or other users' private information.

CROSS-MODULE DEPENDENCY MAP:
- Tenant foundation: subscription/status -> institution settings -> primary campus auto-creation -> roles/RBAC -> users -> departments/scopes.
- Campus resources: campus governance -> facility spaces -> assets/bookings/maintenance -> timetable rooms.
- Academic delivery: curriculum -> branch link -> subjects/semester plans -> assessment policies -> batch -> section -> allotment -> teaching assignments -> timetable -> attendance/lesson plan/assignment/gradebook/exam.
- Admissions: programme open for admission -> branch preference -> application -> documents/payment verification -> approval/enrollment -> student profile -> batch/section allotment.
- Faculty/HR: user account -> faculty onboarding/profile -> department/designation -> teaching assignments -> timetable/attendance/payroll.
- Finance: fee heads -> fee structure -> student applicability -> invoice/ledger -> payment verification -> receipt/refund/reporting.
- Examination: curriculum subjects -> assessment policy -> gradebook -> exam event -> eligibility/hall ticket -> marks -> moderation -> result/SGPA/CGPA.
- LMS: curriculum subject + section + faculty assignment -> material/lesson/assignment/quiz -> student access/submission/grading.
- Communication & Chat: universal chat (/chat) -> role-scoped directory + cross-branch club members -> real-time voice/video calls -> in-app & FCM mobile push notifications.
- Library: catalogue/title -> copy/accession -> member eligibility -> issue/return -> fine/payment.
- Hostel/transport: hostel room allocation -> complaint/visitor modal -> transport capacity/stops -> student pass -> fee where applicable.
- Placement: company -> job posting -> eligibility rule -> student placement profile -> application/drive -> result/offer.
- Compliance: framework -> cycle/criteria -> evidence ownership -> review -> score/report.
- Data operations: integration credentials -> connection verification -> sync/import -> validation exceptions -> audit/report.

Always answer with extreme precision:
1. State the exact page/route path to navigate to (e.g. "Go to Settings → Institution Settings").
2. State the required RBAC role permissions.
3. List prerequisite steps if any.
4. Give exact button names, tab names, and form field instructions.

================================================================================
SECTION 1: TENANT SUBSCRIPTIONS, SETTINGS, SSO & INTEGRATIONS
================================================================================

1. TENANT SUBSCRIPTION & PLAN MANAGEMENT (/tenant-subscription)
   - Roles: Super Admin, Tenant Owner
   - UI Layout: Active Plan Summary Card | License Seat Meter | Upgrade Options Grid | Billing Receipts Table
   - Buttons & Actions:
     * "View Subscription Status" -> Go to /tenant-subscription -> Check active tier (Starter, Growth, Enterprise), renewal date, and total user licenses used vs total quota.
     * "Upgrade Plan / Buy Licenses" -> Click "Upgrade Plan" -> Choose target plan tier (e.g. Enterprise) or add extra student/faculty license packs -> Review price calculation.
     * "Proceed to Checkout" -> Click "Pay with Razorpay/Stripe" -> Complete payment -> Plan and license limits auto-expand immediately.
     * "Download Billing Invoices" -> Go to Invoices tab -> Click "Download PDF Invoice" for tax receipts.

2. INSTITUTION SETTINGS & BRANDING (/institution-setting)
   - Roles: Super Admin, Admin
   - Tabs: [ General Info | Branding & Logo | Academic Rules | Security & Passwords ]
   - Buttons & Actions:
     * "Update General Details" -> Go to /institution-setting -> General tab -> Input Institution Name, Registration Code, Official Email, Phone, Postal Address, Timezone -> Click "Save Details".
     * "Upload Logo & Colors" -> Branding tab -> Upload High-Res Logo (PNG/SVG) and Favicon -> Set Primary Brand Accent Color (HEX) -> Click "Apply Branding".
     * "Set Academic Grading Policy" -> Academic Rules tab -> Define Minimum Passing Marks %, Attendance Shortage Gate %, Default Semester Credit Limit -> Click "Save Academic Policy".
     * "Configure Security Rules" -> Security tab -> Enable "Enforce 2FA for Admin/Faculty", Set Password Expiry (Days), Set Max Inactive Session Timeout (Minutes) -> Click "Update Security Policy".

3. CAMPUS GOVERNANCE & FACILITY SPACES (/campus-governance, /facilities)
   - Roles: Super Admin, Admin, Facilities Officer
   - Primary Campus Auto-Creation: Newly onboarded institutions auto-provision a Primary Main Campus (e.g. "MAIN-01").
   - Buttons & Actions:
     * "Add Campus Location" -> Go to /campus-governance -> Click "Add Campus" -> Fill spacious guided form (Campus Code, Name, Primary Contact, Address, Coordinates) -> Save.
     * "Manage Facility Spaces" -> Go to /facilities -> Click "Add Facility Space" -> Map space to Campus -> Set Building, Floor, Room Number, Capacity, and Type (Classroom, Lab, Auditorium) -> Save.

4. USER MANAGEMENT & CREDENTIAL RESETS (/users)
   - Roles: Super Admin, Admin
   - Buttons & Actions:
     * "Reset User Password" -> Go to /users -> Click "Reset Password" on user row -> Confirm temporary password generation -> System displays exact Institution Portal URL (e.g. "https://mit.devvelocity.com/login"), Login ID, and Temporary Password -> Click "Copy All" to securely copy complete credentials.

5. SSO (SINGLE SIGN-ON) & DIRECTORY INTEGRATION (/sso)
   - Roles: Super Admin, System Administrator
   - Tabs: [ Google Workspace | Microsoft Entra / Azure AD | LDAP Directory ]
   - Buttons & Actions:
     * "Configure Google SSO" -> Go to /sso -> Select Google tab -> Input OAuth Client ID & Client Secret -> Enable "Allow Google Sign-In for @institution.edu domain" -> Click "Save & Test Connection".
     * "Configure Microsoft Entra ID" -> Select Microsoft tab -> Input Tenant ID, Application (Client) ID, Secret Key -> Map SAML claims to ERP roles -> Click "Enable Microsoft SSO".
     * "Configure LDAP Server" -> Select LDAP tab -> Input LDAP Host (ldap.institution.edu), Port (636 SSL), Base DN (dc=institution,dc=edu), Service Account Bind DN & Password -> Click "Test LDAP Bind" -> Enable Sync.

6. PAYMENT SETTINGS, UPI QR CODE & GATEWAY INTEGRATIONS (/payment-settings, /tenant-integrations)
   - Roles: Super Admin, Accounts Manager
   - UI Layout: Institution Details | UPI Details (UPI ID, Display Name, QR Code Upload) | Bank Accounts Grid | Payment Gateway Tabs (Razorpay, Stripe, Paytm, CCAvenue) | Verification Rules
   - Buttons & Actions:
     * "Add / Upload College UPI QR Code & UPI ID" -> Go to Payment Settings (/payment-settings) -> Scroll to "UPI Details" card -> Enter UPI ID (e.g. "college@sbi" or "institution@upi") and UPI Display Name -> Upload College QR Code Image file or paste image URL -> Click "Save & Update Settings". Instant QR code scanning activates for student fee payment on /fee and admission fee on /admission.
     * "Add Beneficiary Bank Account" -> Go to /payment-settings -> "Bank Accounts" section -> Click "Add Bank Account" -> Fill Bank Name, Account Holder Name, Account Number, IFSC Code, Branch -> Click "Save Bank Account".
     * "Configure Razorpay Gateway" -> Go to /payment-settings -> Select Razorpay tab -> Enter Key ID (e.g. "rzp_live_xxx"), Key Secret, Webhook Secret -> Toggle "Enable Online Student Fee Payment" -> Click "Save & Verify".
     * "Configure Stripe Gateway" -> Select Stripe tab -> Enter Publishable Key, Secret Key (sk_live_xxx), Webhook Signing Secret -> Set Currency -> Click "Save Connector".
     * "Set Verification Rules" -> Toggle "Require Screenshot Upload", Toggle "Require UTR Number", set Max Grace Days -> Click "Save Rules".

7. REAL-TIME CHAT & VIDEO/VOICE CALLS (/chat)
   - Roles: All Authenticated Roles (Super Admin, Principal, HOD, Faculty, Student, Parent, Staff)
   - Directory Scoping: Leadership sees full directory; Faculty/Students see academic network + Cross-Branch Club & Committee peers.
   - Buttons & Actions:
     * "Start Direct or Group Chat" -> Go to /chat -> Click contact or group -> Send text, attachments, photos, or voice notes.
     * "Make Audio / Video Call" -> Click Video or Phone icon in Chat Header -> Supports 1-on-1 and Group Calls with Agora WebRTC, screen sharing, minimization, and hardware microphone mute control.
     * "Notifications & Push" -> Active messages trigger in-app bell notifications and Firebase FCM mobile/web push notifications.

================================================================================
SECTION 2: INSTITUTIONAL ACADEMIC & STUDENT LIFECYCLE
================================================================================

1. ACADEMIC CALENDAR MANAGEMENT (/academic-calendar)
   - Roles: Super Admin, Principal, Dean Academic
   - UI Layout: Year Selector Header | Interactive Calendar Grid | Holiday Drawer | Term Config Bar
   - Buttons & Actions:
     * "Create Academic Year" -> Opens Modal: Fill Start Date, End Date, Year Label (e.g. "2026-2027"), Status (Draft/Active).
     * "Add Semester Term" -> Select Academic Year, choose Term (Odd/Even), start/end dates.
     * "Mark Institutional Holiday" -> Click date on calendar grid -> Select Category (National, Festival, Exam Break) -> Enter Holiday Name -> Click "Save Holiday".
     * "Publish Calendar" -> Locks active calendar and propagates dates to Timetable, Attendance, and Exam modules.

2. DEPARTMENT & PROGRAM CURRICULUM SETUP (/department, /curriculum)
   - Roles: Super Admin, Dean Academic, HOD
   - UI Layout: Department Cards Grid | Degree Program Tree | Subject Matrix | HOD Assign Drawer
   - Buttons & Actions:
     * "Add Department" -> Input Code (e.g. "CSE"), Full Name ("Computer Science & Engineering"), Appoint HOD.
     * "Create Curriculum" -> In Programmes & Regulations, click the create action -> Set programme, duration, semester count, regulation year and required credits -> Save.
     * "Add Subject" -> Open Subject Catalogue -> Click "Add Subject" -> Enter the subject master details and owning department -> Click "Add Subject". This does not attach it to a curriculum.
     * "Plan Subjects" -> Return to Programmes & Regulations -> On the curriculum row, open "Plan Subjects" -> Select Semester and Subject -> Click "Add" -> Verify the subject appears under that semester.

3. ADMISSION BATCHES & CLASS SECTIONS (/batch, /section)
   - Roles: Super Admin, Dean Academic, Admin
   - UI Layout: Batch Intake Grid | Section Allocation Table | Mentor Assignment Bar
   - Buttons & Actions:
     * "Create Batch" -> Open the Batches tab -> Select Curriculum, linked Department and Admission Year -> Set Intake -> Click "Create Batch".
     * "Create Section" -> Open the Sections tab -> Select Batch and an available Semester -> Academic Year derives automatically -> Enter Section Name and Capacity -> Click "Create Section".
     * "Assign Class Advisor / Mentor" -> Select Section row -> Click "Assign Advisor" -> Search & Select Faculty Member -> Save.

4. ADMISSIONS & SEAT MATRIX (/admission, /admission/seat-matrix, /admission/initiate)
   - Roles: Super Admin, Admission Incharge, Counselor
   - UI Layout: Intake Metrics Header | Application Master List Table | 7-Step Application Reviewer | Seat Matrix Editor
   - Buttons & Actions:
     * "Configure Seat Matrix" -> Go to /admission/seat-matrix -> Define quota seats (General, SC, ST, OBC, EWS, Management) per program.
     * "Initiate ERP ID" -> Click button on /admission -> Enter Candidate Name, Email, Mobile, Program -> Submit -> System generates permanent ERP ID and emails temporary login credentials.
     * "7-Step Application Review" -> Open application row -> Review Step 1 (Personal), Step 2 (Academic), Step 3 (Docs), Step 4 (Fee Receipt), Step 5 (Quota), Step 6 (Preview), Step 7 (Approval).
     * "Verify Document" -> On Document Verifier Drawer, inspect certificate -> Click "Verify Document" or "Reject with Reason".
     * "Approve & Allot Section" -> Click "Approve Admission" -> Select Batch & Section -> Confirm Enrollment.

5. TIMETABLE GENERATION & SCHEDULING (/timetable)
   - Roles: Super Admin, Principal, Dean Academic, HOD, Timetable Coordinator
   - UI Layout: Filter Bar (Dept/Semester/Section) | Weekly Grid (Mon-Sat periods) | Classroom & Lab Venue Map | Room Conflict Matrix
   - Workflow & Workload Enforcement:
     * When scheduling a teaching slot, the system enforces that the selected faculty MUST have an APPROVED workload assignment for that subject, class type, semester, and section.
     * Prevents teacher collisions (same professor scheduled in two rooms at the same time) and room collisions (two classes in the same lecture hall).
     * "Publish Timetable" -> Click "Publish" -> Activates weekly schedule across Faculty & Student dashboards and unlocks daily attendance.

6. FEE STRUCTURE & ACCOUNTS LEDGER (/fee, /accounts)
   - Roles: Super Admin, Accounts Manager, Finance Officer
   - UI Layout: Collection Summary Metrics | Fee Head Builder | Student Ledger Sheet | Receipt Drawer
   - Buttons & Actions:
     * "Add Fee Head" -> Go to /accounts -> Click "New Fee Head" -> Enter Title (Tuition, Library, Hostel, Transport, Development) -> Assign GL Bank Account.
     * "Create Fee Structure" -> Go to /fee -> Select Program & Batch -> Set Installment Breakdown (Sem 1 Due Date, Amount) -> Save Structure.
     * "Apply Scholarship / Concession" -> Search Student -> Click "Apply Concession" -> Enter Discount Amount / Category Waiver.
     * "Record Payment Receipt" -> Search Student Ledger -> Enter Offline DD/Cheque details or verify Online Transaction ID -> Click "Generate Official Receipt".

7. EXAMINATION CELL & GRADEBOOKS (/examination, /question-bank)
   - Roles: Super Admin, Controller of Examinations, Exam Cell Staff
   - UI Layout: Exam Event Manager | Seating Planner | Internal Score Collector | CGPA Ledger
   - Buttons & Actions:
     * "Create Exam Event" -> Click "New Exam Event" -> Title ("End Sem Exams Nov 2026"), Select Academic Session & Dates.
     * "Generate Hall Tickets" -> Click "Hall Tickets" -> Gate checks fee clearance -> Click "Publish Hall Tickets".
     * "Enter Internal Assessment Marks" -> Select Exam Event & Subject -> Enter Marks Spreadsheet -> Click "Submit to Exam Cell".
     * "Calculate SGPA / CGPA" -> Click "Compute CGPA" -> System applies credit weights -> Click "Publish Marksheets".

================================================================================
SECTION 3: FACULTY & TEACHING WORKFLOWS
================================================================================

1. FACULTY ACADEMIC WORKLOAD & STATUTORY COMPLIANCE (/faculty-workload)
   - Roles: Super Admin, Principal, Dean Academic, HOD, Faculty
   - Sidebar: Academics -> Faculty Workload (Dean/HOD: "Faculty Teaching Workload" | Faculty: "My Teaching Workload")
   - Coordinates Selection: Academic Year (First) -> Semester Term (Odd/Even) -> Department -> Faculty Member.
   - Course Allocation: Select Programme (First) -> Subject / Course -> Semester (1-8) -> Section (Optional / All Students) -> Class Type (Theory, Practical Lab, Tutorial) -> Weekly Load (h/wk) -> Term Hours (auto-calculated 15-week total).
   - Extra Duties: Mentorship, Exam Duty, IQAC, Committee Portfolios.
   - Live AICTE Telemetry: Real-time horizontal 4-segment progress bar with compliance status badges (Underloaded <10h, Normal 10-20h, Overloaded >20h).
   - Dual-Approval Governance: Draft created by HOD -> Approved by Dean Academic / Principal (Four-Eyes Principle) -> Locks workload as immutable -> Dispatches In-App, Email, and Push notifications to the professor.

2. MY TEACHING SCHEDULE (/timetable)
   - Roles: Faculty, HOD
   - Action: View daily/weekly lecture periods, allotted lecture halls/laboratories, and subject codes.

3. LESSON PLAN MANAGER (/lesson-plan)
   - Roles: Faculty (Creates), HOD (Audits & Approves), Dean Academic / Principal (Monitors)
   - Sidebar: Academics -> Lesson Plans (Faculty: "My Lesson Plans" | HOD: "Dept Lesson Plan Audit")
   - Action: Select course -> Divide 15-week semester into unit plans -> Add planned topics, teaching methodology, target lecture dates, and Course Outcome (CO) mappings -> Submit for HOD audit.

4. COURSE PROGRESS TRACKER & EXTRA CLASSES (/course-progress)
   - Roles: Faculty, HOD, Dean Academic
   - Sidebar: Academics -> Course Progress ("Class Progress Tracker")
   - Action: Tracks real-time topic delivery velocity. Displays completed vs planned lectures %. If syllabus lags behind schedule, faculty or HOD schedules Extra Compensation Classes.

5. DAILY ATTENDANCE MARKING (/attendance)
   - Roles: Faculty
   - Action: Select Date & Timetable Period -> View student roster with photos -> Mark Present/Absent -> Click "Submit Attendance".

6. LMS STUDY MATERIALS (/study-material)
   - Roles: Faculty
   - Action: Click "Upload Material" -> Attach PDF slides, lecture notes, syllabus -> Select target subject and section -> Publish.

7. ASSIGNMENTS & QUIZZES (/assignment, /quiz)
   - Roles: Faculty
   - Action: Create assignment with due date and total marks -> Grade student submission uploads online -> Build auto-graded MCQ quizzes.

8. FACULTY LEAVE & SUBSTITUTE MANAGEMENT (/leave, /faculty-attendance)
   - Roles: Faculty
   - Action: Apply for Casual/Medical Leave -> Choose date range & assign substitute teacher -> Submit for HOD approval.

================================================================================
SECTION 4: STUDENT & PARENT WORKFLOWS
================================================================================

1. STUDENT PROFILE VERIFICATION (/student-profile)
   - Roles: Student, Parent
   - Action: Review personal details, guardian mobile number, blood group, upload passport photo and ID proof.
2. SEMESTER COURSE REGISTRATION (/semester-registration)
   - Roles: Student
   - Action: Review core subjects -> Pick elective choices -> Click "Submit Registration" for HOD verification.
3. CLASS TIMETABLE (/timetable)
   - Roles: Student
   - Action: View daily class schedule, faculty names, and venue room numbers.
4. E-LEARNING CENTER (/study-material)
   - Roles: Student
   - Action: Download lecture PDF notes, reference books, lab manuals, and syllabus outlines.
5. FEE PAYMENT PORTAL (/fee)
   - Roles: Student, Parent
   - Action: View pending installment dues -> Click "Pay Dues Online" -> Select UPI / Card / NetBanking -> Download instant tax receipt.
6. ATTENDANCE & GRADE CARD (/attendance, /examination)
   - Roles: Student, Parent
   - Action: Track subject-wise attendance percentage (maintain > 75%) -> View internal scores, SGPA, CGPA, and download grade marksheets.
7. HOSTEL & TRANSPORT (/hostel, /transport)
   - Roles: Student
   - Action: Apply for hostel room allocation -> Submit complaint/visitor request -> Book bus transport route and view pass details.

================================================================================
SECTION 5: HR, PLACEMENT, LIBRARY & OTHER DEPARTMENTS
================================================================================

1. HR & PAYROLL (/hr, /payroll)
   - Action: Process staff onboarding -> Sync verified attendance -> Compute monthly salary, PF/ESI, tax -> Disburse payslips.
2. TRAINING & PLACEMENT (/placement, /job-posting)
   - Action: Post campus job drives -> Filter eligible student profiles -> Record interview results and job offer letters.
3. LIBRARY MANAGEMENT (/library)
   - Action: Catalog books & e-journals -> Issue / Return books using barcode -> Track overdue fines.
4. IQAC & NAAC ACCREDITATION (/iqac, /naac-nba)
   - Action: Upload evidence files for NAAC Criteria 1 to 7 -> Conduct internal quality audits -> Generate SSR reports.

Answer any question thoroughly with exact steps, page routes, button names, and prerequisite setup logic. NEVER mention API endpoints, HTTP methods, or backend technical details.
`;

export interface IErpAssistantQuestionInput {
  question: string;
  conversationId?: string;
  userRoles?: string[];
  history?: Array<{ role: "user" | "model"; text: string }>;
  context?: {
    currentPath?: string;
    visibleModules?: Array<{ label: string; path: string; group?: string }>;
  };
}

export interface IErpAssistantAnswerOutput {
  answer: string;
  mentionedModules: string[];
  webSources?: Array<{ title: string; uri: string }>;
}

export class ErpAssistantService {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = configs.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("AI assistant is not configured. Contact administrator.");
    }
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  private getGenerationModels(): string[] {
    return ["gemini-3.6-flash"];
  }

  private isUnavailableModelError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /(?:404|429|resource_exhausted|quota|rate limit|too many requests|overloaded|not found|no longer available|model.*unavailable)/i.test(
      message,
    );
  }

  private buildSystemInstruction(
    userRoles: string[],
    context?: IErpAssistantQuestionInput["context"],
    diagnosticContext = "",
  ): string {
    const activeRolesText = userRoles.length > 0 ? userRoles.join(", ") : "unknown";
    const currentPathText = context?.currentPath || "unknown";
    const visibleNavText = context?.visibleModules?.length
      ? context.visibleModules
          .slice(0, 150)
          .map((m) => `- ${m.group ? `${m.group} > ` : ""}${m.label}: ${m.path}`)
          .join("\n")
      : "Not supplied";

    return [
      ERP_SYSTEM_CONTEXT,
      `Active logged-in user roles: ${activeRolesText}`,
      `Current page: ${currentPathText}`,
      `ROLE-VISIBLE NAVIGATION:\n${visibleNavText}`,
      `TENANT DIAGNOSTIC SNAPSHOT:\n${diagnosticContext}`,
    ].join("\n\n");
  }

  async recordHistory(
    userId: string,
    input: IErpAssistantQuestionInput,
    output: IErpAssistantAnswerOutput,
  ) {
    const expiresAt = new Date(
      Date.now() + configs.ERP_ASSISTANT_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    return ErpAssistantHistoryModel.create({
      userId,
      conversationId: input.conversationId || `legacy-${Date.now()}`,
      question: input.question,
      answer: output.answer,
      contextPath: input.context?.currentPath,
      mentionedModules: output.mentionedModules,
      expiresAt,
    });
  }

  async listHistory(userId: string) {
    const rows = await ErpAssistantHistoryModel.find({ userId, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(250)
      .select("conversationId question answer contextPath mentionedModules createdAt expiresAt")
      .lean();
    return rows.reverse();
  }

  async clearHistory(userId: string): Promise<number> {
    const result = await ErpAssistantHistoryModel.deleteMany({ userId });
    return result.deletedCount ?? 0;
  }

  async deleteConversation(userId: string, conversationId: string): Promise<number> {
    const legacyId = conversationId.startsWith("legacy-") ? conversationId.slice(7) : "";
    const filter =
      legacyId && Types.ObjectId.isValid(legacyId)
        ? {
            userId,
            $or: [{ _id: new Types.ObjectId(legacyId) }, { conversationId }],
          }
        : { userId, conversationId };
    const result = await ErpAssistantHistoryModel.deleteMany(filter);
    return result.deletedCount ?? 0;
  }

  async purgeExpiredHistory(): Promise<number> {
    const result = await ErpAssistantHistoryModel.deleteMany({ expiresAt: { $lte: new Date() } });
    return result.deletedCount ?? 0;
  }

  private async buildTenantDiagnosticContext(input: IErpAssistantQuestionInput): Promise<string> {
    const signal = `${input.question} ${input.context?.currentPath ?? ""}`.toLowerCase();
    const checks: Array<Promise<string>> = [];
    const count = async (
      label: string,
      model: { countDocuments: (filter?: Record<string, unknown>) => Promise<number> },
      filter: Record<string, unknown> = {},
    ) => `${label}: ${await model.countDocuments(filter)}`;

    if (
      /(curricul|program|department|branch|subject|batch|section|allot|academic|semester)/.test(
        signal,
      )
    ) {
      checks.push(
        count("Active curricula", CurriculumModel, { isActive: true }),
        count("Departments", DepartmentModel),
        count("Active subjects", SubjectModel, { isActive: true }),
        count("Batches", BatchModel),
        count("Sections", SectionModel),
      );
    }
    if (/(admission|applicant|enroll|student)/.test(signal)) {
      checks.push(
        count("Admission applications", AdmissionApplicationModel),
        count("Student profiles", StudentProfileModel),
      );
    }
    if (/(timetable|slot|faculty workload|schedule|classroom|laborator|room)/.test(signal)) {
      checks.push(
        count("Timetables", TimetableModel),
        count("Published active timetables", TimetableModel, { isApproved: true, isActive: true }),
        count("Faculty workload records", FacultyWorkloadModel),
      );
    }
    if (/(campus|facilit|classroom|laborator|room|asset)/.test(signal)) {
      checks.push(
        count("Campuses", CampusModel),
        count("Active facility spaces", FacilitySpaceModel, { status: "active" }),
      );
    }
    if (/(fee|invoice|ledger|payment|receipt|refund|gateway|razorpay|stripe|upi|qr)/.test(signal)) {
      checks.push(
        count("Fee structures", FeeStructureModel),
        count("Student fee records", FeeRecordModel),
        count("Configured payment settings", PaymentSettingsModel),
      );
    }

    if (checks.length === 0) {
      return "No module-specific datastore check was selected for this question. Use the current page and role-visible navigation, and ask one focused question if evidence is insufficient.";
    }

    const results = await Promise.allSettled(checks);
    return results
      .map((result) =>
        result.status === "fulfilled"
          ? `- ${result.value}`
          : "- One safe diagnostic check was unavailable",
      )
      .join("\n");
  }

  async askQuestionStream(
    input: IErpAssistantQuestionInput,
    onChunk: (chunk: string) => void,
    onStatus?: (status: { stage: string; message: string }) => void,
  ): Promise<IErpAssistantAnswerOutput> {
    const { question, userRoles = [], history = [], context } = input;
    const ai = this.getClient();

    onStatus?.({ stage: "analyzing", message: "Analyzing ERP context & page scope…" });
    const diagnosticContext = await this.buildTenantDiagnosticContext(input);

    onStatus?.({ stage: "grounding", message: "Searching web & verifying live setup…" });

    const systemInstruction = this.buildSystemInstruction(userRoles, context, diagnosticContext);

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const h of history.slice(-10)) {
      contents.push({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h.text }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: question }],
    });

    const providers = ["gemini", "openrouter", "groq"] as const;
    let fullText = "";
    let generationError: unknown;
    let webSources: Array<{ title: string; uri: string }> = [];

    for (const [index, provider] of providers.entries()) {
      try {
        if (provider === "gemini") {
          onStatus?.({ stage: "generating", message: "Generating response…" });

          let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>> | undefined;
          let geminiError: unknown;

          try {
            // First attempt: Gemini 3.6 Flash with Search Grounding
            stream = await ai.models.generateContentStream({
              model: "gemini-3.6-flash",
              contents,
              config: {
                systemInstruction,
                maxOutputTokens: 8192,
                tools: [{ googleSearch: {} }],
              },
            });
          } catch (err: unknown) {
            geminiError = err;
            // Immediate fallback: Gemini 3.6 Flash without Search tool (if search tool quota / rate limit is reached)
            try {
              stream = await ai.models.generateContentStream({
                model: "gemini-3.6-flash",
                contents,
                config: {
                  systemInstruction,
                  maxOutputTokens: 8192,
                },
              });
              geminiError = undefined;
            } catch (directErr: unknown) {
              geminiError = directErr;
            }
          }

          if (geminiError) throw geminiError;
          if (!stream) throw new Error("Gemini stream was not initialised");

          let groundingWebSources: Array<{ title: string; uri: string }> = [];

          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              fullText += text;
              onChunk(text);
            }
            const meta = (chunk as unknown as Record<string, unknown>).candidates;
            if (Array.isArray(meta)) {
              for (const candidate of meta) {
                const gm = (candidate as Record<string, unknown>)?.groundingMetadata as
                  | Record<string, unknown>
                  | undefined;
                const chunks = gm?.groundingChunks as Array<Record<string, unknown>> | undefined;
                if (Array.isArray(chunks)) {
                  for (const gc of chunks) {
                    const web = gc.web as Record<string, unknown> | undefined;
                    if (web?.uri) {
                      groundingWebSources.push({
                        title: String(web.title ?? web.uri),
                        uri: String(web.uri),
                      });
                    }
                  }
                }
              }
            }
          }
          groundingWebSources = Array.from(
            new Map(groundingWebSources.map((s) => [s.uri, s])).values(),
          ).slice(0, 6);
          webSources = groundingWebSources;
        } else {
          fullText = ""; // Reset since a new provider starts
          fullText = await this.generateStreamFromFallback(
            provider,
            systemInstruction,
            history,
            question,
            onChunk,
          );
        }
        generationError = undefined;
        break;
      } catch (error) {
        generationError = error;
        const hasFallback = index < providers.length - 1;
        if (fullText || !hasFallback || !this.isUnavailableModelError(error)) throw error;
      }
    }

    if (generationError) throw generationError;

    const answer =
      fullText.trim() ||
      "I'm sorry, I could not generate a response. Please try rephrasing your question.";

    const textWithoutUrls = answer.replace(/https?:\/\/[^\s]+/g, "");
    const routeMatches = textWithoutUrls.match(/\/([\w-]+)/g) ?? [];
    const knownModules = [
      "academic-calendar",
      "department",
      "batch",
      "section",
      "curriculum",
      "admission",
      "timetable",
      "fee",
      "examination",
      "attendance",
      "study-material",
      "assignment",
      "quiz",
      "lesson-plan",
      "faculty-profile",
      "student-profile",
      "hostel",
      "transport",
      "placement",
      "library",
      "payroll",
      "accounts",
      "hr",
      "leave",
      "iqac",
      "naac-nba",
      "notice",
      "event",
      "grievance",
      "semester-registration",
      "faculty-onboarding",
      "procurement",
      "question-bank",
      "tenant-subscription",
      "institution-setting",
      "sso",
      "payment-settings",
      "tenant-integrations",
      "data-portability",
      "tenant-backup",
      "campus-governance",
      "facilities",
      "club",
      "communication-hub",
      "compliance-workspace",
      "continuing-education",
      "degree-audit",
      "discipline",
      "document-template",
      "advancement",
      "alumni",
      "counseling",
      "course-progress",
      "iic",
      "import-center",
      "mentor",
      "report-center",
      "research-development",
      "scholarship",
      "student-success",
      "store",
      "procure-to-pay",
      "faculty-attendance",
      "faculty-workload",
      "financial-aid",
      "gatepass",
      "job-posting",
      "meeting",
      "recruitment-crm",
      "regulatory-integration",
    ];

    const mentionedModules = Array.from(
      new Set(routeMatches.map((r) => r.replace("/", "")).filter((r) => knownModules.includes(r))),
    ).slice(0, 3);

    return { answer, mentionedModules, webSources };
  }

  async askQuestion(input: IErpAssistantQuestionInput): Promise<IErpAssistantAnswerOutput> {
    const { question, userRoles = [], history = [], context } = input;
    const ai = this.getClient();
    const diagnosticContext = await this.buildTenantDiagnosticContext(input);

    // Build conversation contents for generateContent.
    // System instruction is passed separately, not as a turn.
    const systemInstruction = this.buildSystemInstruction(userRoles, context, diagnosticContext);

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add prior conversation history (last 10 entries).
    for (const h of history.slice(-10)) {
      contents.push({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h.text }],
      });
    }

    // Add the current user question.
    contents.push({
      role: "user",
      parts: [{ text: question }],
    });

    const providers = ["gemini", "openrouter", "groq"] as const;
    let answerText = "";
    let generationError: unknown;

    for (const [index, provider] of providers.entries()) {
      try {
        if (provider === "gemini") {
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents,
            config: {
              systemInstruction,
              maxOutputTokens: 4096,
            },
          });
          answerText = response.text || "";
        } else {
          answerText = await this.generateFromFallback(
            provider,
            systemInstruction,
            history,
            question,
          );
        }
        generationError = undefined;
        break;
      } catch (error) {
        generationError = error;
        const hasFallback = index < providers.length - 1;
        if (!hasFallback || !this.isUnavailableModelError(error)) throw error;
      }
    }

    if (generationError) throw generationError;

    const answer =
      answerText.trim() ||
      "I'm sorry, I could not generate a response. Please try rephrasing your question.";

    const textWithoutUrls = answer.replace(/https?:\/\/[^\s]+/g, "");
    const routeMatches = textWithoutUrls.match(/\/([\w-]+)/g) ?? [];
    const knownModules = [
      "academic-calendar",
      "department",
      "batch",
      "section",
      "curriculum",
      "admission",
      "timetable",
      "fee",
      "examination",
      "attendance",
      "study-material",
      "assignment",
      "quiz",
      "lesson-plan",
      "faculty-profile",
      "student-profile",
      "hostel",
      "transport",
      "placement",
      "library",
      "payroll",
      "accounts",
      "hr",
      "leave",
      "iqac",
      "naac-nba",
      "notice",
      "event",
      "grievance",
      "semester-registration",
      "faculty-onboarding",
      "procurement",
      "question-bank",
      "tenant-subscription",
      "institution-setting",
      "sso",
      "payment-settings",
      "tenant-integrations",
      "data-portability",
      "tenant-backup",
    ];

    const mentionedModules = Array.from(
      new Set(routeMatches.map((r) => r.replace("/", "")).filter((r) => knownModules.includes(r))),
    ).slice(0, 3);

    return {
      answer,
      mentionedModules,
    };
  }

  private async generateStreamFromFallback(
    provider: "groq" | "openrouter",
    systemInstruction: string,
    history: Array<{ role: "user" | "model"; text: string }>,
    question: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const apiKey = provider === "groq" ? configs.GROQ_API_KEY : configs.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(`${provider} API key is not configured.`);
    }

    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

    let model =
      provider === "groq" ? "qwen/qwen3.6-27b" : configs.OPENROUTER_MODEL || "z-ai/glm-5.2:free";

    const messages = [
      { role: "system", content: systemInstruction },
      ...history.map((h) => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: question },
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (provider === "openrouter") {
      headers["HTTP-Referer"] = configs.PLATFORM_WEBSITE_URL || "https://devvelocity.in";
      headers["X-Title"] = configs.APP_NAME || "Devvelocity";
    }

    let response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok && provider === "groq" && response.status === 404) {
      model = "openai/gpt-oss-20b";
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${provider} stream request failed: ${response.statusText} - ${errText}`);
    }

    if (!response.body) {
      throw new Error(`Failed to get response body for ${provider}`);
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      const chunkStr = decoder.decode(chunk, { stream: true });
      buffer += chunkStr;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === "data: [DONE]") continue;

        if (cleanLine.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(cleanLine.slice(6));
            const chunkText = parsed.choices?.[0]?.delta?.content || "";
            if (chunkText) {
              fullText += chunkText;
              onChunk(chunkText);
            }
          } catch {
            // ignore JSON parse errors on partial streams
          }
        }
      }
    }

    return fullText;
  }

  private async generateFromFallback(
    provider: "groq" | "openrouter",
    systemInstruction: string,
    history: Array<{ role: "user" | "model"; text: string }>,
    question: string,
  ): Promise<string> {
    const apiKey = provider === "groq" ? configs.GROQ_API_KEY : configs.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(`${provider} API key is not configured.`);
    }

    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

    let model =
      provider === "groq" ? "qwen/qwen3.6-27b" : configs.OPENROUTER_MODEL || "z-ai/glm-5.2:free";

    const messages = [
      { role: "system", content: systemInstruction },
      ...history.map((h) => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: question },
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (provider === "openrouter") {
      headers["HTTP-Referer"] = configs.PLATFORM_WEBSITE_URL || "https://devvelocity.in";
      headers["X-Title"] = configs.APP_NAME || "Devvelocity";
    }

    let response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok && provider === "groq" && response.status === 404) {
      model = "openai/gpt-oss-20b";
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
        }),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${provider} request failed: ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

export const erpAssistantService = new ErpAssistantService();
