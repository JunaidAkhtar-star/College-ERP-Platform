# RITE ERP — Backend API

**RITE College of Engineering — Enterprise Resource Planning System**
Full-stack college ERP backend built with **Node.js + TypeScript + Express + MongoDB**.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Authentication & Authorization](#authentication--authorization)
7. [User Roles](#user-roles)
8. [API Base URL](#api-base-url)
9. [Response Format](#response-format)
10. [Error Codes](#error-codes)
11. [API Reference — All Modules](#api-reference--all-modules)
    - [Auth](#1-auth)
    - [Admin — User Management](#2-admin--user-management)
    - [Dashboard](#3-dashboard)
    - [Admission](#4-admission)
    - [Student Profile](#5-student-profile)
    - [Faculty Profile](#6-faculty-profile)
    - [Department](#7-department)
    - [Subject](#8-subject)
    - [Academic Calendar](#9-academic-calendar)
    - [Curriculum](#10-curriculum)
    - [Timetable](#11-timetable)
    - [Attendance](#12-attendance)
    - [Faculty Attendance](#13-faculty-attendance)
    - [Course Progress](#14-course-progress)
    - [Lesson Plan](#15-lesson-plan)
    - [Faculty Workload](#16-faculty-workload)
    - [Examination](#17-examination)
    - [Question Bank](#18-question-bank)
    - [Quiz / Online Test](#19-quiz--online-test)
    - [Assignment](#20-assignment)
    - [Study Material](#21-study-material)
    - [Fee Management](#22-fee-management)
    - [Accounts](#23-accounts)
    - [Payroll](#24-payroll)
    - [Scholarship](#25-scholarship)
    - [Leave Management](#26-leave-management)
    - [Mentor](#27-mentor)
    - [Counseling](#28-counseling)
    - [Grievance](#29-grievance)
    - [Notice Board](#30-notice-board)
    - [Event](#31-event)
    - [Document Management](#32-document-management)
    - [Library](#33-library)
    - [Hostel](#34-hostel)
    - [Transport](#35-transport)
    - [Placement](#36-placement)
    - [Alumni](#37-alumni)
    - [HR](#38-hr)
    - [Chat / Messaging](#39-chat--messaging)
    - [Notification](#40-notification)
    - [Parent Portal](#41-parent-portal)
    - [Semester Registration](#42-semester-registration)
    - [IQAC](#43-iqac)
    - [NAAC / NBA](#44-naac--nba)
    - [Audit Log](#45-audit-log)
    - [Role Management](#46-role-management)
    - [Health Check](#47-health-check)
    - [Meeting Management](#48-meeting-management)
12. [Real-Time Events (Socket.IO)](#real-time-events-socketio)
13. [Background Jobs (Cron)](#background-jobs-cron)
14. [PDF Generation](#pdf-generation)
15. [File Upload (Cloudinary)](#file-upload-cloudinary)
16. [Caching Strategy (Redis)](#caching-strategy-redis)
17. [Security Controls](#security-controls)
18. [Workflow Walkthroughs](#workflow-walkthroughs)
19. [Development Scripts](#development-scripts)

---

## Architecture Overview

```
Client (Next.js / Mobile)
        │  HTTPS
        ▼
   Express App  ─── Helmet / CORS / Rate Limit / HPP / Sanitize
        │
   JWT Middleware  ─── Role Guard  ─── Input Validation
        │
   Controller  ─────── Service  ─────── Repository
                                              │
                                         Mongoose
                                              │
                                          MongoDB Atlas

   Async side channels:
     Redis (cache)  ·  Socket.IO (real-time)  ·  Nodemailer (email)
     Firebase FCM (push)  ·  Cloudinary (files)  ·  Puppeteer (PDF)
```

**Layer responsibilities:**

| Layer          | Responsibility                                              |
| -------------- | ----------------------------------------------------------- |
| **Controller** | Parse HTTP request, call service, send response             |
| **Service**    | Business logic, orchestrate repositories, fire side-effects |
| **Repository** | All MongoDB queries; no business logic                      |
| **Model**      | Mongoose schema + TypeScript interface                      |

---

## Tech Stack

| Category     | Technology                                   |
| ------------ | -------------------------------------------- |
| Runtime      | Node.js ≥ 17, TypeScript 5                   |
| Framework    | Express 4                                    |
| Database     | MongoDB (Mongoose 9)                         |
| Cache        | Redis (ioredis)                              |
| Auth         | JWT (access 15 min / refresh 7 d) + TOTP MFA |
| Real-time    | Socket.IO 4                                  |
| Push         | Firebase Admin SDK (FCM)                     |
| File Storage | Cloudinary                                   |
| PDF          | Puppeteer-core + Handlebars                  |
| Email        | Nodemailer (SMTP)                            |
| Scheduler    | node-cron                                    |
| Validation   | express-validator                            |
| Password     | bcryptjs (rounds = 12)                       |

---

## Project Structure

```
backend/
├── server/
│   ├── server.ts              # App entry point; registers all routes
│   ├── configs/               # Environment config (index.ts)
│   ├── constants/
│   │   ├── roles.ts           # SystemRole enum + role groups
│   │   └── permissions.ts     # Module enum for audit logs
│   ├── models/                # Mongoose schemas + TypeScript interfaces
│   ├── repositories/          # Database query layer
│   ├── services/              # Business logic layer
│   ├── controllers/           # HTTP handler layer
│   ├── routes/                # Express routers (one file per module)
│   ├── middlewares/           # auth, validation, rate-limit, CORS, etc.
│   ├── plugins/
│   │   └── audit.plugin.ts    # Adds isDeleted, createdBy, updatedBy to all models
│   ├── email/                 # Nodemailer templates + email.service.ts
│   ├── pdf/
│   │   ├── pdf.service.ts     # Puppeteer PDF generator
│   │   └── templates/         # Handlebars HTML templates
│   ├── socket/
│   │   └── socket.gateway.ts  # Socket.IO setup + event emitters
│   ├── jobs/                  # node-cron background jobs
│   ├── utils/                 # logger, redis, response, crypto, etc.
│   └── types/                 # Global TypeScript augmentations
├── tsconfig.json
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 9+ (`npm i -g pnpm`)
- MongoDB Atlas cluster (or local mongod)
- Redis (local or Redis Cloud)

### Install & Run

```bash
# Install dependencies
pnpm install

# Development (hot-reload with ts-node-dev)
pnpm server

# Production build
pnpm build        # Compiles TypeScript → build/
pnpm start        # Runs build/server.js

# Code quality
pnpm lint         # ESLint
pnpm lint:fix     # ESLint auto-fix
pnpm check        # format + lint + tsc --noEmit
```

### Environment Setup

Copy `.env.example` to `.env` and fill in all values (see [Environment Variables](#environment-variables) below).

---

## Environment Variables

Create a `.env` file in `backend/`:

```env
# ── Server ───────────────────────────────────────────────────────────────────
PORT=5000
HOST=localhost
NODE_ENV=development            # development | production
API_VERSION=api/v1

# ── Database ─────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/rite-erp

# ── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Cloudinary ───────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ── Email (SMTP) ─────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@rite.edu.in
SMTP_PASS=your-app-password
SMTP_FROM=RITE ERP <noreply@rite.edu.in>

# ── Firebase (FCM push) ───────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_CLIENT_EMAIL=<firebase-service-account-email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── App ───────────────────────────────────────────────────────────────────────
FRONTEND_URL=https://erp.example.com
APP_NAME=Devvelocity
COLLEGE_NAME=Institution

# ── Security ─────────────────────────────────────────────────────────────────
ENCRYPTION_KEY=<64-hex-chars>             # AES-256 key
ALLOWED_ORIGINS=https://erp.example.com
ADMIN_IP_WHITELIST=192.168.1.0/24,10.0.0.1
DASHBOARD_USERNAME=<operations-user>
DASHBOARD_PASSWORD=<long-random-password>
TRUST_PROXY_HOPS=1                       # Set to trusted reverse-proxy hop count

# ── PDF (Puppeteer) ───────────────────────────────────────────────────────────
# Leave blank in production (uses @sparticuz/chromium)
PUPPETEER_EXEC_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

---

## Authentication & Authorization

### Login Flow

```
POST /api/v1/auth/login
  → 200 { accessToken, refreshToken, user }

  If MFA enabled:
  → 200 { mfaRequired: true, mfaToken }
  → POST /api/v1/auth/mfa/verify { mfaToken, totp }
  → 200 { accessToken, refreshToken, user }
```

### Token Usage

All protected endpoints require the **access token** in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Refresh tokens are stored **httpOnly cookie** and also returned in the response body. Rotate using:

```
POST /api/v1/auth/refresh   (sends refreshToken in body or cookie)
→ 200 { accessToken }
```

### Token Lifetimes

| Token         | Lifetime   |
| ------------- | ---------- |
| Access Token  | 15 minutes |
| Refresh Token | 7 days     |

---

## User Roles

The system uses **Role-Based Access Control (RBAC)**. Every user has exactly one `SystemRole`.

| Role                  | Key                   | Dashboard                   | Description                |
| --------------------- | --------------------- | --------------------------- | -------------------------- |
| `SUPER_ADMIN`         | `super_admin`         | ERP health + audit log      | Full system access         |
| `PRINCIPAL`           | `principal`           | College-wide overview       | Institution head           |
| `DEAN_ACADEMIC`       | `dean_academic`       | Academic health comparison  | Academic administration    |
| `HOD`                 | `hod`                 | Department KPIs + workload  | Head of Department         |
| `FACULTY`             | `faculty`             | Today's schedule + courses  | Teaching staff             |
| `STUDENT`             | `student`             | Today's classes + academics | Enrolled student           |
| `PARENT`              | `parent`              | Ward's academic status      | Student's parent/guardian  |
| `ADMISSION_COUNSELOR` | `admission_counselor` | Application pipeline        | Admission cell staff       |
| `EXAMINATION_CELL`    | `examination_cell`    | Upcoming exams overview     | Exam administration        |
| `IQAC_TEAM`           | `iqac_team`           | Feedback ratings summary    | Quality assurance cell     |
| `SCHOLARSHIP_CELL`    | `scholarship_cell`    | Applications by status      | Scholarship administration |
| `LIBRARY_STAFF`       | `library_staff`       | Active issues + overdue     | Library management         |
| `PLACEMENT_CELL`      | `placement_cell`      | Drives + placement stats    | Training & Placement cell  |
| `HR_DEPARTMENT`       | `hr_department`       | Employee & leave summary    | Human resources            |
| `ACCOUNTS_DEPARTMENT` | `accounts_department` | Revenue & dues summary      | Finance & accounts team    |

---

## API Base URL

```
https://erp.rite.ac.in/api/v1
```

All routes below are relative to this base URL.

---

## Response Format

### Success

```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

### Paginated List

```json
{
  "success": true,
  "data": [ ... ],
  "total": 245,
  "page": 1,
  "limit": 20,
  "pages": 13
}
```

### Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

---

## Error Codes

| HTTP Status | Meaning                                 |
| ----------- | --------------------------------------- |
| `200`       | OK                                      |
| `201`       | Created                                 |
| `400`       | Bad Request / Validation Error          |
| `401`       | Unauthenticated (missing/invalid token) |
| `403`       | Forbidden (valid token but wrong role)  |
| `404`       | Resource Not Found                      |
| `409`       | Conflict (duplicate entry)              |
| `422`       | Unprocessable Entity                    |
| `429`       | Too Many Requests (rate limited)        |
| `500`       | Internal Server Error                   |

---

## API Reference — All Modules

---

### 1. Auth

**Base path:** `/auth`

| Method   | Path                    | Auth   | Description                             |
| -------- | ----------------------- | ------ | --------------------------------------- |
| `POST`   | `/auth/register`        | Public | Register new user account               |
| `POST`   | `/auth/login`           | Public | Login; returns tokens                   |
| `POST`   | `/auth/refresh`         | Public | Rotate access token using refresh token |
| `POST`   | `/auth/logout`          | ✓      | Revoke current refresh token            |
| `POST`   | `/auth/forgot-password` | Public | Send password reset OTP to email        |
| `POST`   | `/auth/reset-password`  | Public | Reset password with OTP                 |
| `POST`   | `/auth/change-password` | ✓      | Change own password (old + new)         |
| `POST`   | `/auth/mfa/setup`       | ✓      | Get TOTP QR code and secret             |
| `POST`   | `/auth/mfa/verify`      | ✓      | Activate MFA with first TOTP code       |
| `POST`   | `/auth/mfa/disable`     | ✓      | Disable MFA (requires TOTP)             |
| `GET`    | `/auth/sessions`        | ✓      | List all active sessions                |
| `DELETE` | `/auth/sessions`        | ✓      | Revoke all sessions (logout everywhere) |
| `DELETE` | `/auth/sessions/:jti`   | ✓      | Revoke specific session                 |

**Login Request:**

```json
POST /auth/login
{
  "email": "student@rite.edu.in",
  "password": "Password@123"
}
```

**Login Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "_id": "64a1...",
      "name": "Rajesh Kumar",
      "email": "student@rite.edu.in",
      "role": "student",
      "mfaEnabled": false
    }
  }
}
```

---

### 2. Admin — User Management

**Base path:** `/admin`
**Access:** IP-whitelisted (`ADMIN_IP_WHITELIST` env var)

| Method  | Path                              | Roles                         | Description                |
| ------- | --------------------------------- | ----------------------------- | -------------------------- |
| `GET`   | `/admin/me`                       | Any authenticated             | Get own profile            |
| `PUT`   | `/admin/me`                       | Any authenticated             | Update own profile         |
| `GET`   | `/admin/users`                    | Admin / Principal / Dean / HR | List all users (paginated) |
| `GET`   | `/admin/users/:id`                | Admin / Principal / Dean / HR | Get user by ID             |
| `POST`  | `/admin/users`                    | Admin / Principal / Dean / HR | Create new user            |
| `PUT`   | `/admin/users/:id`                | Admin / Principal / Dean / HR | Update user                |
| `PATCH` | `/admin/users/:id/status`         | Admin / Principal / Dean / HR | Activate / deactivate user |
| `POST`  | `/admin/users/:id/reset-password` | SUPER_ADMIN only              | Force reset user password  |

**Create User Request:**

```json
POST /admin/users
{
  "name": "Dr. Priya Sharma",
  "email": "priya.sharma@rite.edu.in",
  "role": "faculty",
  "departmentId": "64a1...",
  "phone": "9876543210"
}
```

---

### 3. Dashboard

**Base path:** `/dashboard`

| Method | Path         | Auth | Description              |
| ------ | ------------ | ---- | ------------------------ |
| `GET`  | `/dashboard` | ✓    | Role-based KPI dashboard |

The response varies by the caller's active role. Each role gets a dedicated set of metrics:

| Role                  | Dashboard Method                 | Key Data Returned                                                                                                                                                    |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `super_admin`         | `getSuperAdminDashboard`         | Total users/students/faculty, revenue, active events, upcoming meetings, user breakdown by role, audit log summary (last 24 h by module), 10 recent audit entries    |
| `principal`           | `getAdminDashboard`              | College-wide enrollment, fee collection, active admissions, events, notices, upcoming meetings, user breakdown, recent 5 applications                                |
| `dean_academic`       | `getDeanAcademicDashboard`       | College-wide course completion %, dept-wise attendance averages & shortage count, faculty workload comparison, upcoming exams & meetings                             |
| `hod`                 | `getHodDashboard`                | Dept faculty & student count, pending leaves, upcoming events, scheduled meetings, 30-day attendance trend, course completion stats, faculty workload overload count |
| `faculty`             | `getFacultyDashboard`            | Today's timetable slots, pending leaves, recent attendance records, upcoming exams, notices, upcoming meetings, course completion % per subject                      |
| `student`             | `getStudentDashboard`            | Today's timetable, attendance summary per subject, pending fees, upcoming exams, notices, upcoming meetings, recent semester results                                 |
| `parent`              | `getParentDashboard`             | Ward's attendance, pending fees, upcoming exams, recent results, notices                                                                                             |
| `placement_cell`      | `getPlacementDashboard`          | Active drives, total placed students, companies visited, top recruiters, recent drives                                                                               |
| `library_staff`       | `getLibraryDashboard`            | Active book issues, overdue count, fine collection, recent issues                                                                                                    |
| `hr_department`       | `getHrDashboard`                 | Total employees, pending leave requests, leave breakdown by type, recent employees                                                                                   |
| `accounts_department` | `getAccountsDashboard`           | Total collected, pending dues, overdue count, monthly collection trend, recent fee payments                                                                          |
| `examination_cell`    | `getExaminationDashboard`        | Upcoming exams, pending halls, recent schedules, upcoming exam count                                                                                                 |
| `iqac_team`           | `getIqacDashboard`               | Feedback counts, average rating, recent feedback entries                                                                                                             |
| `scholarship_cell`    | `getScholarshipDashboard`        | Applications by status, total disbursed, recent applications                                                                                                         |
| `admission_counselor` | `getAdmissionCounselorDashboard` | Application pipeline (5 status counts), stage-wise aggregation, program-wise seat fill %, recent applications                                                        |

---

### 4. Admission

**Base path:** `/admission`

| Method  | Path                                    | Auth   | Roles                   | Description                             |
| ------- | --------------------------------------- | ------ | ----------------------- | --------------------------------------- |
| `POST`  | `/admission/apply`                      | Public | —                       | Submit admission application            |
| `GET`   | `/admission/status/:appNo`              | Public | —                       | Check application status by number      |
| `GET`   | `/admission/dashboard`                  | ✓      | Admission cell          | Admission pipeline dashboard            |
| `GET`   | `/admission/applications`               | ✓      | Admission cell          | List all applications (paginated)       |
| `GET`   | `/admission/applications/:id`           | ✓      | Admission cell          | Get application details                 |
| `PATCH` | `/admission/applications/:id/documents` | ✓      | Admission cell          | Update document verification checklist  |
| `PATCH` | `/admission/applications/:id/status`    | ✓      | Admission cell          | Update application status               |
| `POST`  | `/admission/applications/:id/enroll`    | ✓      | SUPER_ADMIN / Principal | Convert application to enrolled student |
| `POST`  | `/admission/applications/:id/allot`     | ✓      | Admission cell          | Allot branch/program                    |
| `GET`   | `/admission/merit-list`                 | ✓      | Admission cell          | Generate merit list                     |
| `GET`   | `/admission/seat-matrix`                | ✓      | Admission cell          | Current seat availability               |

**Application Status Values:** `draft`, `submitted`, `under_review`, `shortlisted`, `allotted`, `enrolled`, `waitlisted`, `rejected`, `withdrawn`

---

### 5. Student Profile

**Base path:** `/student-profile`

| Method | Path                           | Auth | Roles                  | Description                           |
| ------ | ------------------------------ | ---- | ---------------------- | ------------------------------------- |
| `GET`  | `/student-profile`             | ✓    | Staff/Admin            | List all student profiles (paginated) |
| `GET`  | `/student-profile/my`          | ✓    | STUDENT                | Own profile                           |
| `GET`  | `/student-profile/:id`         | ✓    | Staff/Admin            | Profile by ID                         |
| `POST` | `/student-profile`             | ✓    | Admin/HOD              | Create profile                        |
| `PUT`  | `/student-profile/:id`         | ✓    | Admin/HOD/Student(own) | Update profile                        |
| `GET`  | `/student-profile/:id/id-card` | ✓    | Any                    | Generate ID card PDF                  |

---

### 6. Faculty Profile

**Base path:** `/faculty-profile`

| Method | Path                   | Auth | Roles                 | Description           |
| ------ | ---------------------- | ---- | --------------------- | --------------------- |
| `GET`  | `/faculty-profile`     | ✓    | Staff/Admin           | List faculty profiles |
| `GET`  | `/faculty-profile/my`  | ✓    | FACULTY               | Own profile           |
| `GET`  | `/faculty-profile/:id` | ✓    | Any                   | Profile by ID         |
| `POST` | `/faculty-profile`     | ✓    | Admin/HR              | Create profile        |
| `PUT`  | `/faculty-profile/:id` | ✓    | Admin/HR/Faculty(own) | Update profile        |

---

### 7. Department

**Base path:** `/department`

| Method   | Path              | Auth   | Roles                          | Description                 |
| -------- | ----------------- | ------ | ------------------------------ | --------------------------- |
| `GET`    | `/department`     | Public | —                              | List all active departments |
| `GET`    | `/department/:id` | Public | —                              | Get department details      |
| `POST`   | `/department`     | ✓      | SUPER_ADMIN / Principal / Dean | Create department           |
| `PUT`    | `/department/:id` | ✓      | SUPER_ADMIN / Principal / Dean | Update department           |
| `DELETE` | `/department/:id` | ✓      | SUPER_ADMIN                    | Soft-delete department      |

---

### 8. Subject

**Base path:** `/subject`

| Method | Path           | Auth | Roles          | Description                                |
| ------ | -------------- | ---- | -------------- | ------------------------------------------ |
| `GET`  | `/subject`     | ✓    | Any            | List subjects (filter by program/semester) |
| `GET`  | `/subject/:id` | ✓    | Any            | Get subject details                        |
| `POST` | `/subject`     | ✓    | Admin/Dean/HOD | Create subject                             |
| `PUT`  | `/subject/:id` | ✓    | Admin/Dean/HOD | Update subject                             |

**Query Parameters for List:**

- `program` — e.g., `B.Tech`
- `semester` — 1–8
- `branch` — e.g., `CSE`
- `academicYear` — e.g., `2024-25`

---

### 9. Academic Calendar

**Base path:** `/academic-calendar`

| Method   | Path                                     | Auth | Roles                | Description                 |
| -------- | ---------------------------------------- | ---- | -------------------- | --------------------------- |
| `GET`    | `/academic-calendar`                     | ✓    | Any                  | List all academic calendars |
| `GET`    | `/academic-calendar/:id`                 | ✓    | Any                  | Get calendar details        |
| `POST`   | `/academic-calendar`                     | ✓    | Admin/Principal/Dean | Create calendar             |
| `PUT`    | `/academic-calendar/:id`                 | ✓    | Admin/Principal/Dean | Update calendar             |
| `POST`   | `/academic-calendar/:id/events`          | ✓    | Admin/Principal/Dean | Add event to calendar       |
| `DELETE` | `/academic-calendar/:id/events/:eventId` | ✓    | Admin/Principal/Dean | Remove event                |

---

### 10. Curriculum

**Base path:** `/curriculum`

| Method | Path              | Auth | Roles          | Description       |
| ------ | ----------------- | ---- | -------------- | ----------------- |
| `GET`  | `/curriculum`     | ✓    | Any            | List curricula    |
| `GET`  | `/curriculum/:id` | ✓    | Any            | Get curriculum    |
| `POST` | `/curriculum`     | ✓    | Admin/Dean/HOD | Create curriculum |
| `PUT`  | `/curriculum/:id` | ✓    | Admin/Dean/HOD | Update curriculum |

---

### 11. Timetable

**Base path:** `/timetable`

| Method | Path             | Auth | Roles     | Description      |
| ------ | ---------------- | ---- | --------- | ---------------- |
| `GET`  | `/timetable`     | ✓    | Any       | List timetables  |
| `GET`  | `/timetable/:id` | ✓    | Any       | Get timetable    |
| `POST` | `/timetable`     | ✓    | Admin/HOD | Create timetable |
| `PUT`  | `/timetable/:id` | ✓    | Admin/HOD | Update timetable |

---

### 12. Attendance

**Base path:** `/attendance`

| Method | Path                             | Auth | Roles                      | Description                  |
| ------ | -------------------------------- | ---- | -------------------------- | ---------------------------- |
| `POST` | `/attendance/mark`               | ✓    | FACULTY/HOD                | Mark attendance for a class  |
| `GET`  | `/attendance/summary/:studentId` | ✓    | Faculty/Admin/Student(own) | Attendance summary           |
| `GET`  | `/attendance/report`             | ✓    | HOD/Admin                  | Department attendance report |
| `GET`  | `/attendance/defaulters`         | ✓    | HOD/Admin                  | Students below threshold     |
| `POST` | `/attendance/bulk`               | ✓    | FACULTY                    | Bulk mark from array         |
| `PUT`  | `/attendance/:id`                | ✓    | FACULTY/HOD                | Correct attendance record    |

**Mark Attendance Request:**

```json
POST /attendance/mark
{
  "subjectId": "64a1...",
  "subjectCode": "CS301",
  "date": "2024-09-01",
  "session": "morning",
  "semester": 3,
  "section": "A",
  "academicYear": "2024-25",
  "records": [
    { "studentId": "64b2...", "status": "present" },
    { "studentId": "64b3...", "status": "absent" }
  ]
}
```

---

### 13. Faculty Attendance

**Base path:** `/faculty-attendance`

| Method | Path                     | Auth | Roles     | Description                     |
| ------ | ------------------------ | ---- | --------- | ------------------------------- |
| `POST` | `/faculty-attendance`    | ✓    | HOD/Admin | Mark faculty attendance         |
| `GET`  | `/faculty-attendance`    | ✓    | HOD/Admin | List faculty attendance records |
| `GET`  | `/faculty-attendance/my` | ✓    | FACULTY   | Own attendance records          |

---

### 14. Course Progress

**Base path:** `/course-progress`

| Method | Path                          | Auth | Roles             | Description                  |
| ------ | ----------------------------- | ---- | ----------------- | ---------------------------- |
| `GET`  | `/course-progress`            | ✓    | Any               | List course progress records |
| `GET`  | `/course-progress/:id`        | ✓    | Any               | Get record                   |
| `POST` | `/course-progress`            | ✓    | Faculty/HOD/Admin | Create progress record       |
| `PUT`  | `/course-progress/:id`        | ✓    | Faculty/HOD/Admin | Update record                |
| `POST` | `/course-progress/:id/topics` | ✓    | Faculty/HOD/Admin | Add covered topic            |

---

### 15. Lesson Plan

**Base path:** `/lesson-plan`

| Method  | Path                       | Auth | Roles             | Description         |
| ------- | -------------------------- | ---- | ----------------- | ------------------- |
| `GET`   | `/lesson-plan`             | ✓    | Faculty/HOD/Admin | List lesson plans   |
| `GET`   | `/lesson-plan/:id`         | ✓    | Any               | Get lesson plan     |
| `POST`  | `/lesson-plan`             | ✓    | FACULTY           | Create lesson plan  |
| `PUT`   | `/lesson-plan/:id`         | ✓    | FACULTY/HOD       | Update lesson plan  |
| `PATCH` | `/lesson-plan/:id/approve` | ✓    | HOD/Admin         | Approve lesson plan |

---

### 16. Faculty Workload

**Base path:** `/faculty-workload`

| Method | Path                    | Auth | Roles     | Description           |
| ------ | ----------------------- | ---- | --------- | --------------------- |
| `GET`  | `/faculty-workload`     | ✓    | HOD/Admin | List workload records |
| `GET`  | `/faculty-workload/my`  | ✓    | FACULTY   | Own workload          |
| `POST` | `/faculty-workload`     | ✓    | HOD/Admin | Assign workload       |
| `PUT`  | `/faculty-workload/:id` | ✓    | HOD/Admin | Update workload       |

---

### 17. Examination

**Base path:** `/examination`

| Method | Path                                                 | Auth | Roles             | Description                 |
| ------ | ---------------------------------------------------- | ---- | ----------------- | --------------------------- |
| `GET`  | `/examination/schedules`                             | ✓    | Staff             | List exam schedules         |
| `GET`  | `/examination/schedules/:id`                         | ✓    | Staff             | Get schedule                |
| `POST` | `/examination/schedules`                             | ✓    | Admin/Exam Cell   | Create exam schedule        |
| `PUT`  | `/examination/schedules/:id`                         | ✓    | Admin/Exam Cell   | Update schedule             |
| `POST` | `/examination/hall-ticket`                           | ✓    | Admin/Exam Cell   | Generate hall ticket PDF    |
| `POST` | `/examination/marks`                                 | ✓    | Faculty/Exam Cell | Enter marks                 |
| `GET`  | `/examination/marks/student/:studentId`              | ✓    | Any               | Student marks               |
| `POST` | `/examination/results/compile`                       | ✓    | Admin/Exam Cell   | Compile semester result     |
| `POST` | `/examination/results/publish`                       | ✓    | Admin/Exam Cell   | Publish results             |
| `GET`  | `/examination/results`                               | ✓    | Admin/Exam Cell   | List all results            |
| `GET`  | `/examination/results/ranklist`                      | ✓    | Admin/Exam Cell   | Department rank list        |
| `GET`  | `/examination/results/student/:studentId`            | ✓    | Any               | Student's all results       |
| `GET`  | `/examination/results/student/:studentId/semester`   | ✓    | Any               | Specific semester result    |
| `GET`  | `/examination/results/student/:studentId/marksheet`  | ✓    | Any               | **Download marksheet PDF**  |
| `GET`  | `/examination/results/student/:studentId/transcript` | ✓    | Any               | **Download transcript PDF** |
| `POST` | `/examination/schedules/:id/seating`                 | ✓    | Admin/Exam Cell   | Generate seating plan       |
| `POST` | `/examination/recheck`                               | ✓    | STUDENT           | Submit recheck request      |
| `GET`  | `/examination/recheck`                               | ✓    | Staff             | List recheck requests       |
| `PUT`  | `/examination/recheck/:id/review`                    | ✓    | Admin/Exam Cell   | Review recheck              |
| `PUT`  | `/examination/recheck/:id/fee-paid`                  | ✓    | Admin/Exam Cell   | Mark recheck fee paid       |

**Marksheet PDF Download:**

```
GET /examination/results/student/64a1.../marksheet?semester=3&academicYear=2024-25
Authorization: Bearer <token>

→ Content-Type: application/pdf
→ Content-Disposition: attachment; filename="marksheet_64a1..._sem3.pdf"
```

**Transcript Download:**

```
GET /examination/results/student/64a1.../transcript
Authorization: Bearer <token>

→ Returns PDF with all published semesters consolidated
```

---

### 18. Question Bank

**Base path:** `/question-bank`

| Method   | Path                 | Auth | Roles             | Description     |
| -------- | -------------------- | ---- | ----------------- | --------------- |
| `GET`    | `/question-bank`     | ✓    | Faculty/HOD/Admin | List questions  |
| `GET`    | `/question-bank/:id` | ✓    | Faculty/HOD/Admin | Get question    |
| `POST`   | `/question-bank`     | ✓    | Faculty/HOD       | Add question    |
| `PUT`    | `/question-bank/:id` | ✓    | Faculty/HOD       | Update question |
| `DELETE` | `/question-bank/:id` | ✓    | Faculty/HOD/Admin | Soft-delete     |

---

### 19. Quiz / Online Test

**Base path:** `/quiz`

| Method | Path                      | Auth | Roles             | Description                               |
| ------ | ------------------------- | ---- | ----------------- | ----------------------------------------- |
| `GET`  | `/quiz`                   | ✓    | Any               | List quizzes (filter by subject/semester) |
| `GET`  | `/quiz/:id`               | ✓    | Any               | Get quiz details                          |
| `POST` | `/quiz`                   | ✓    | Faculty/HOD/Admin | Create quiz                               |
| `PUT`  | `/quiz/:id`               | ✓    | Faculty/HOD/Admin | Update quiz                               |
| `POST` | `/quiz/:id/submit`        | ✓    | STUDENT           | Submit quiz attempt                       |
| `GET`  | `/quiz/:id/my-attempt`    | ✓    | STUDENT           | View own attempt result                   |
| `POST` | `/quiz/:id/proctor-event` | ✓    | STUDENT           | **Report proctoring violation**           |
| `GET`  | `/quiz/:id/proctor-log`   | ✓    | Faculty/HOD/Admin | **View all proctoring events**            |

**Create Quiz (with proctoring):**

```json
POST /quiz
{
  "title": "Unit Test 1 — Data Structures",
  "subjectId": "64a1...",
  "subjectCode": "CS301",
  "semester": 3,
  "section": "A",
  "program": "B.Tech",
  "academicYear": "2024-25",
  "durationMinutes": 60,
  "startDateTime": "2024-09-10T10:00:00Z",
  "endDateTime": "2024-09-10T11:00:00Z",
  "shuffleQuestions": true,
  "shuffleOptions": true,
  "proctoringEnabled": true,
  "proctoringConfig": {
    "fullscreenRequired": true,
    "copyPasteDisabled": true,
    "tabSwitchLimit": 3,
    "screenshotIntervalSec": 0,
    "webcamRequired": false
  },
  "questions": [
    {
      "questionText": "Which data structure uses LIFO?",
      "questionType": "mcq",
      "options": [
        { "optionText": "Queue", "isCorrect": false },
        { "optionText": "Stack", "isCorrect": true },
        { "optionText": "Tree", "isCorrect": false }
      ],
      "marks": 2
    }
  ]
}
```

**Report Proctoring Event (called by frontend):**

```json
POST /quiz/:id/proctor-event
{
  "eventType": "tab_switch",
  "metadata": { "fromUrl": "https://erp.rite.ac.in/quiz/...", "timestamp": "2024-09-10T10:15:00Z" }
}
```

> If `tabSwitchLimit` is reached, the attempt is **auto-submitted** and `autoSubmitted: true` is returned.

---

### 20. Assignment

**Base path:** `/assignment`

| Method | Path                                     | Auth | Roles             | Description       |
| ------ | ---------------------------------------- | ---- | ----------------- | ----------------- |
| `GET`  | `/assignment`                            | ✓    | Any               | List assignments  |
| `GET`  | `/assignment/:id`                        | ✓    | Any               | Get assignment    |
| `POST` | `/assignment`                            | ✓    | Faculty/HOD/Admin | Create assignment |
| `PUT`  | `/assignment/:id`                        | ✓    | Faculty/HOD/Admin | Update assignment |
| `POST` | `/assignment/:id/submit`                 | ✓    | STUDENT           | Submit assignment |
| `GET`  | `/assignment/:id/submissions`            | ✓    | Faculty/HOD       | List submissions  |
| `PUT`  | `/assignment/:id/submissions/:sid/grade` | ✓    | Faculty/HOD       | Grade submission  |

---

### 21. Study Material

**Base path:** `/study-material`

| Method   | Path                  | Auth | Roles             | Description            |
| -------- | --------------------- | ---- | ----------------- | ---------------------- |
| `GET`    | `/study-material`     | ✓    | Any               | List materials         |
| `GET`    | `/study-material/:id` | ✓    | Any               | Download/view material |
| `POST`   | `/study-material`     | ✓    | Faculty/HOD/Admin | Upload material        |
| `PUT`    | `/study-material/:id` | ✓    | Faculty/HOD/Admin | Update metadata        |
| `DELETE` | `/study-material/:id` | ✓    | Faculty/HOD/Admin | Remove material        |

---

### 22. Fee Management

**Base path:** `/fee`

| Method | Path                      | Auth | Roles          | Description                          |
| ------ | ------------------------- | ---- | -------------- | ------------------------------------ |
| `GET`  | `/fee/structures`         | ✓    | Any            | List fee structures                  |
| `POST` | `/fee/structures`         | ✓    | Admin/Accounts | Create fee structure                 |
| `PUT`  | `/fee/structures/:id`     | ✓    | Admin/Accounts | Update fee structure                 |
| `POST` | `/fee/generate`           | ✓    | Admin/Accounts | Generate fee records for batch       |
| `GET`  | `/fee`                    | ✓    | Accounts/Admin | List all fee records                 |
| `GET`  | `/fee/my`                 | ✓    | STUDENT        | Own fee records                      |
| `GET`  | `/fee/:id`                | ✓    | Any            | Get fee record                       |
| `POST` | `/fee/:id/pay`            | ✓    | Accounts       | Record fee payment                   |
| `GET`  | `/fee/:id/receipt`        | ✓    | Any            | Download fee receipt PDF             |
| `GET`  | `/fee/:id/invoice`        | ✓    | Any            | Download fee invoice PDF             |
| `POST` | `/fee/payment-submission` | ✓    | STUDENT        | Upload payment proof (online portal) |

**Record Payment Request:**

```json
POST /fee/:id/pay
{
  "amountPaid": 35000,
  "paymentMode": "UPI",
  "paymentDate": "2024-09-01",
  "upiId": "student@upi",
  "collectedBy": "staff-user-id",
  "collectedByName": "Mr. Ramesh",
  "studentEmail": "student@rite.edu.in",
  "studentName": "Rajesh Kumar",
  "fatherName": "Suresh Kumar"
}
```

**FeePaymentMode values:** `Cash`, `Demand Draft`, `NEFT`, `RTGS`, `UPI`, `Net Banking`, `Card`, `Cheque`, `Online Portal`

---

### 23. Accounts

**Base path:** `/accounts`

| Method | Path                                        | Auth | Roles          | Description                      |
| ------ | ------------------------------------------- | ---- | -------------- | -------------------------------- |
| `GET`  | `/accounts`                                 | ✓    | Accounts/Admin | List transactions                |
| `GET`  | `/accounts/summary`                         | ✓    | Accounts/Admin | Financial summary                |
| `GET`  | `/accounts/monthly-flow`                    | ✓    | Accounts/Admin | Monthly income/expense flow      |
| `GET`  | `/accounts/balance`                         | ✓    | Accounts/Admin | Current balance                  |
| `GET`  | `/accounts/:id`                             | ✓    | Accounts/Admin | Transaction details              |
| `POST` | `/accounts`                                 | ✓    | Accounts/Admin | Create transaction               |
| `PUT`  | `/accounts/:id`                             | ✓    | Accounts/Admin | Update transaction               |
| `GET`  | `/accounts/payment-submissions`             | ✓    | Accounts/Admin | List student payment submissions |
| `GET`  | `/accounts/payment-submissions/counts`      | ✓    | Accounts/Admin | Submission status counts         |
| `GET`  | `/accounts/payment-submissions/:id`         | ✓    | Accounts/Admin | Submission details               |
| `PUT`  | `/accounts/payment-submissions/:id/review`  | ✓    | Accounts       | Mark under review                |
| `PUT`  | `/accounts/payment-submissions/:id/approve` | ✓    | Accounts       | Approve & record payment         |
| `PUT`  | `/accounts/payment-submissions/:id/reject`  | ✓    | Accounts       | Reject with reason               |

---

### 24. Payroll

**Base path:** `/payroll`

| Method | Path                    | Auth | Roles             | Description              |
| ------ | ----------------------- | ---- | ----------------- | ------------------------ |
| `GET`  | `/payroll`              | ✓    | HR/Accounts/Admin | List payroll records     |
| `GET`  | `/payroll/my`           | ✓    | FACULTY / Staff   | Own payroll records      |
| `POST` | `/payroll/generate`     | ✓    | HR/Admin          | Generate monthly payroll |
| `GET`  | `/payroll/:id`          | ✓    | HR/Admin          | Get payroll record       |
| `PUT`  | `/payroll/:id`          | ✓    | HR/Admin          | Update payroll           |
| `POST` | `/payroll/:id/disburse` | ✓    | Accounts/Admin    | Mark salary disbursed    |
| `GET`  | `/payroll/:id/slip`     | ✓    | Any               | Download salary slip PDF |

---

### 25. Scholarship

**Base path:** `/scholarship`

| Method  | Path                        | Auth | Roles          | Description        |
| ------- | --------------------------- | ---- | -------------- | ------------------ |
| `GET`   | `/scholarship`              | ✓    | Admin/Accounts | List scholarships  |
| `GET`   | `/scholarship/my`           | ✓    | STUDENT        | Own scholarships   |
| `POST`  | `/scholarship`              | ✓    | Admin/Accounts | Create scholarship |
| `PUT`   | `/scholarship/:id`          | ✓    | Admin/Accounts | Update             |
| `PATCH` | `/scholarship/:id/disburse` | ✓    | Accounts/Admin | Mark disbursed     |

---

### 26. Leave Management

**Base path:** `/leave`

| Method  | Path                 | Auth | Roles     | Description         |
| ------- | -------------------- | ---- | --------- | ------------------- |
| `GET`   | `/leave`             | ✓    | HOD/Admin | List leave requests |
| `GET`   | `/leave/my`          | ✓    | Any       | Own leave requests  |
| `POST`  | `/leave`             | ✓    | Any       | Apply for leave     |
| `GET`   | `/leave/:id`         | ✓    | Any       | Get leave details   |
| `PATCH` | `/leave/:id/approve` | ✓    | HOD/Admin | Approve leave       |
| `PATCH` | `/leave/:id/reject`  | ✓    | HOD/Admin | Reject leave        |
| `PATCH` | `/leave/:id/cancel`  | ✓    | Requester | Cancel own leave    |

---

### 27. Mentor

**Base path:** `/mentor`

| Method | Path                  | Auth | Roles             | Description              |
| ------ | --------------------- | ---- | ----------------- | ------------------------ |
| `GET`  | `/mentor`             | ✓    | Faculty/HOD/Admin | List mentor assignments  |
| `POST` | `/mentor`             | ✓    | HOD/Admin         | Assign mentor to student |
| `PUT`  | `/mentor/:id`         | ✓    | HOD/Admin         | Update assignment        |
| `GET`  | `/mentor/my-mentees`  | ✓    | FACULTY           | List own mentees         |
| `POST` | `/mentor/:id/meeting` | ✓    | FACULTY           | Log meeting              |

---

### 28. Counseling

**Base path:** `/counseling`

| Method  | Path                                                 | Auth | Roles             | Description             |
| ------- | ---------------------------------------------------- | ---- | ----------------- | ----------------------- |
| `POST`  | `/counseling/sessions`                               | ✓    | Faculty/HOD/Admin | Schedule session        |
| `GET`   | `/counseling/sessions`                               | ✓    | HOD/Faculty/Admin | List sessions           |
| `GET`   | `/counseling/stats`                                  | ✓    | Staff             | Counseling statistics   |
| `GET`   | `/counseling/sessions/:id`                           | ✓    | Any               | Get session details     |
| `GET`   | `/counseling/students/:studentId/sessions`           | ✓    | Any               | Student sessions        |
| `PATCH` | `/counseling/sessions/:id/conduct`                   | ✓    | Faculty/HOD/Admin | Record session outcome  |
| `PATCH` | `/counseling/sessions/:id/cancel`                    | ✓    | Faculty/HOD/Admin | Cancel session          |
| `PATCH` | `/counseling/sessions/:id/follow-up/:index/complete` | ✓    | Faculty/HOD/Admin | Complete follow-up item |

---

### 29. Grievance

**Base path:** `/grievance`

| Method  | Path                         | Auth | Roles          | Description                  |
| ------- | ---------------------------- | ---- | -------------- | ---------------------------- |
| `POST`  | `/grievance`                 | ✓    | STUDENT        | Submit new grievance         |
| `GET`   | `/grievance/mine`            | ✓    | STUDENT        | Own grievances               |
| `GET`   | `/grievance/ref/:ref`        | ✓    | Any            | Look up by reference number  |
| `GET`   | `/grievance/stats`           | ✓    | Staff/IQAC     | Analytics summary            |
| `GET`   | `/grievance`                 | ✓    | HOD/Admin/IQAC | All grievances (paginated)   |
| `GET`   | `/grievance/:id`             | ✓    | Any            | Grievance details            |
| `PATCH` | `/grievance/:id/acknowledge` | ✓    | HOD/Admin      | Acknowledge grievance        |
| `PATCH` | `/grievance/:id/respond`     | ✓    | HOD/Admin      | Respond / resolve            |
| `PATCH` | `/grievance/:id/escalate`    | ✓    | HOD/Admin      | Escalate to higher authority |
| `PATCH` | `/grievance/:id/close`       | ✓    | STUDENT        | Close own grievance          |
| `PATCH` | `/grievance/:id/rate`        | ✓    | STUDENT        | Rate satisfaction (1–5)      |

**Grievance Types:** `academic`, `examination`, `faculty`, `facility`, `hostel`, `transport`, `fee`, `scholarship`, `library`, `ragging`, `harassment`, `other`

> ⚠️ **Ragging / Harassment** types are automatically escalated to `URGENT` priority.

**Submit Grievance:**

```json
POST /grievance
{
  "studentName": "Rajesh Kumar",
  "rollNumber": "2021CSE001",
  "program": "B.Tech",
  "branch": "CSE",
  "semester": 5,
  "departmentId": "64a1...",
  "type": "facility",
  "title": "Lab projector not working in Room 201",
  "description": "The projector in Lab Room 201 has been non-functional for 2 weeks affecting practical classes.",
  "attachments": ["https://res.cloudinary.com/..."]
}
```

**Response includes `referenceNumber`** (e.g., `GRV-M2X1K-ABC`) for tracking.

---

### 30. Notice Board

**Base path:** `/notice`

| Method   | Path          | Auth | Roles                    | Description            |
| -------- | ------------- | ---- | ------------------------ | ---------------------- |
| `GET`    | `/notice`     | ✓    | Any                      | List published notices |
| `GET`    | `/notice/:id` | ✓    | Any                      | Get notice             |
| `POST`   | `/notice`     | ✓    | Admin/Principal/Dean/HOD | Create notice          |
| `PUT`    | `/notice/:id` | ✓    | Admin/Principal/Dean/HOD | Update notice          |
| `DELETE` | `/notice/:id` | ✓    | Admin/Principal/Dean/HOD | Archive notice         |

---

### 31. Event

**Base path:** `/event`

| Method | Path                  | Auth | Roles     | Description        |
| ------ | --------------------- | ---- | --------- | ------------------ |
| `GET`  | `/event`              | ✓    | Any       | List events        |
| `GET`  | `/event/:id`          | ✓    | Any       | Get event details  |
| `POST` | `/event`              | ✓    | Admin/HOD | Create event       |
| `PUT`  | `/event/:id`          | ✓    | Admin/HOD | Update event       |
| `POST` | `/event/:id/register` | ✓    | STUDENT   | Register for event |

---

### 32. Document Management

**Base path:** `/document`

| Method | Path                       | Auth | Roles | Description                   |
| ------ | -------------------------- | ---- | ----- | ----------------------------- |
| `GET`  | `/document/my`             | ✓    | Any   | Own uploaded documents        |
| `POST` | `/document/upload`         | ✓    | Any   | Upload document (multipart)   |
| `PUT`  | `/document/:id/reupload`   | ✓    | Any   | Re-upload rejected document   |
| `GET`  | `/document/:id`            | ✓    | Any   | Get document details          |
| `GET`  | `/document`                | ✓    | Admin | List all documents            |
| `GET`  | `/document/owner/:ownerId` | ✓    | Admin | Documents by owner            |
| `PUT`  | `/document/:id/verify`     | ✓    | Admin | Mark document verified        |
| `PUT`  | `/document/:id/reject`     | ✓    | Admin | Reject with reason            |
| `GET`  | `/document/expiring/soon`  | ✓    | Admin | Documents expiring in 30 days |

---

### 33. Library

**Base path:** `/library`

| Method | Path                 | Auth | Roles           | Description            |
| ------ | -------------------- | ---- | --------------- | ---------------------- |
| `GET`  | `/library/books`     | ✓    | Any             | Search/list books      |
| `GET`  | `/library/books/:id` | ✓    | Any             | Book details           |
| `POST` | `/library/books`     | ✓    | Librarian/Admin | Add book               |
| `PUT`  | `/library/books/:id` | ✓    | Librarian/Admin | Update book            |
| `POST` | `/library/issue`     | ✓    | Librarian       | Issue book to member   |
| `POST` | `/library/return`    | ✓    | Librarian       | Return book            |
| `GET`  | `/library/issued`    | ✓    | Librarian/Admin | Currently issued books |
| `GET`  | `/library/overdue`   | ✓    | Librarian/Admin | Overdue returns        |
| `GET`  | `/library/my`        | ✓    | STUDENT/FACULTY | Own issued books       |

---

### 34. Hostel

**Base path:** `/hostel`

| Method | Path                 | Auth | Roles        | Description           |
| ------ | -------------------- | ---- | ------------ | --------------------- |
| `GET`  | `/hostel`            | ✓    | Warden/Admin | List hostel records   |
| `GET`  | `/hostel/my`         | ✓    | STUDENT      | Own allotment         |
| `POST` | `/hostel`            | ✓    | Warden/Admin | Create hostel record  |
| `PUT`  | `/hostel/:id`        | ✓    | Warden/Admin | Update                |
| `POST` | `/hostel/:id/allot`  | ✓    | Warden/Admin | Allot room to student |
| `POST` | `/hostel/:id/vacate` | ✓    | Warden/Admin | Vacate room           |

---

### 35. Transport

**Base path:** `/transport`

| Method   | Path                               | Auth | Roles           | Description               |
| -------- | ---------------------------------- | ---- | --------------- | ------------------------- |
| `GET`    | `/transport`                       | ✓    | Any             | List routes               |
| `GET`    | `/transport/:id`                   | ✓    | Any             | Route details             |
| `POST`   | `/transport`                       | ✓    | Transport/Admin | Create route              |
| `PUT`    | `/transport/:id`                   | ✓    | Transport/Admin | Update route              |
| `POST`   | `/transport/:id/enroll`            | ✓    | Transport/Admin | Enroll student in route   |
| `DELETE` | `/transport/:id/enroll/:studentId` | ✓    | Transport/Admin | Remove student from route |

---

### 36. Placement

**Base path:** `/placement`

| Method | Path                                      | Auth | Roles           | Description              |
| ------ | ----------------------------------------- | ---- | --------------- | ------------------------ |
| `GET`  | `/placement/drives`                       | ✓    | Any             | List placement drives    |
| `GET`  | `/placement/drives/:id`                   | ✓    | Any             | Drive details            |
| `POST` | `/placement/drives`                       | ✓    | Placement/Admin | Create drive             |
| `PUT`  | `/placement/drives/:id`                   | ✓    | Placement/Admin | Update drive             |
| `POST` | `/placement/drives/:id/apply`             | ✓    | STUDENT         | Apply for drive          |
| `GET`  | `/placement/applications/my`              | ✓    | STUDENT         | Own applications         |
| `GET`  | `/placement/job-postings`                 | ✓    | Any             | List job postings        |
| `POST` | `/placement/job-postings`                 | ✓    | Placement/Admin | Create job posting       |
| `GET`  | `/placement/training-sessions`            | ✓    | Any             | List training sessions   |
| `POST` | `/placement/training-sessions`            | ✓    | Placement/Admin | Create training session  |
| `POST` | `/placement/training-sessions/:id/enroll` | ✓    | STUDENT         | Enroll in training       |
| `GET`  | `/placement/student-profile/my`           | ✓    | STUDENT         | Own placement profile    |
| `PUT`  | `/placement/student-profile/my`           | ✓    | STUDENT         | Update placement profile |

---

### 37. Alumni

**Base path:** `/alumni`

| Method | Path                        | Auth | Roles                                | Description          |
| ------ | --------------------------- | ---- | ------------------------------------ | -------------------- |
| `GET`  | `/alumni`                   | ✓    | Any                                  | List alumni          |
| `GET`  | `/alumni/:id`               | ✓    | Any                                  | Alumni profile       |
| `POST` | `/alumni`                   | ✓    | Alumni Coordinator/Admin             | Create alumni record |
| `PUT`  | `/alumni/:id`               | ✓    | Alumni Coordinator/Admin/Alumni(own) | Update profile       |
| `POST` | `/alumni/:id/contributions` | ✓    | Alumni/Admin                         | Log contribution     |

---

### 38. HR

**Base path:** `/hr`

| Method  | Path                                   | Auth | Roles    | Description                     |
| ------- | -------------------------------------- | ---- | -------- | ------------------------------- |
| `GET`   | `/hr/employees`                        | ✓    | HR/Admin | List all employees              |
| `GET`   | `/hr/employees/:id`                    | ✓    | HR/Admin | Employee details                |
| `POST`  | `/hr/employees`                        | ✓    | HR/Admin | Onboard employee                |
| `PUT`   | `/hr/employees/:id`                    | ✓    | HR/Admin | Update employee                 |
| `PATCH` | `/hr/employees/:id/status`             | ✓    | HR/Admin | Change employment status        |
| `POST`  | `/hr/employees/:id/experience-letter`  | ✓    | HR/Admin | Generate experience letter PDF  |
| `POST`  | `/hr/employees/:id/appointment-letter` | ✓    | HR/Admin | Generate appointment letter PDF |

---

### 39. Chat / Messaging

**Base path:** `/chat`

| Method   | Path                              | Auth | Description                          |
| -------- | --------------------------------- | ---- | ------------------------------------ |
| `GET`    | `/chat`                           | ✓    | List own conversations               |
| `POST`   | `/chat/direct`                    | ✓    | Start 1-on-1 conversation            |
| `POST`   | `/chat/group`                     | ✓    | Create group conversation            |
| `GET`    | `/chat/:id/messages`              | ✓    | Get conversation messages            |
| `POST`   | `/chat/:id/messages`              | ✓    | Send message                         |
| `POST`   | `/chat/:id/read`                  | ✓    | Mark messages as read                |
| `DELETE` | `/chat/:id/messages/:msgId`       | ✓    | Delete message (self / everyone)     |
| `POST`   | `/chat/:id/messages/:msgId/react` | ✓    | React to message (emoji)             |
| `PUT`    | `/chat/:id/group`                 | ✓    | Update group info                    |
| `POST`   | `/chat/:id/members`               | ✓    | Add group members                    |
| `DELETE` | `/chat/:id/members/:userId`       | ✓    | Remove member                        |
| `POST`   | `/chat/:id/leave`                 | ✓    | Leave group                          |
| `POST`   | `/chat/:id/admins/:userId`        | ✓    | Make member admin                    |
| `DELETE` | `/chat/:id/admins/:userId`        | ✓    | Remove admin                         |
| `POST`   | `/chat/:id/invite-link`           | ✓    | Generate invite link                 |
| `POST`   | `/chat/join/:token`               | ✓    | Join group by invite link            |
| `GET`    | `/chat/online/users`              | ✓    | List currently online user IDs       |
| `GET`    | `/chat/search?q=`                 | ✓    | Search messages across conversations |

Real-time messages are also pushed over **Socket.IO** — see [Real-Time Events](#real-time-events-socketio).

---

### 40. Notification

**Base path:** `/notification`

| Method   | Path                         | Auth | Roles               | Description                     |
| -------- | ---------------------------- | ---- | ------------------- | ------------------------------- |
| `GET`    | `/notification`              | ✓    | Any                 | Own notifications (paginated)   |
| `GET`    | `/notification/unread-count` | ✓    | Any                 | Unread count                    |
| `POST`   | `/notification`              | ✓    | Admin/HOD/Principal | Create & broadcast notification |
| `PATCH`  | `/notification/:id/read`     | ✓    | Any                 | Mark as read                    |
| `PATCH`  | `/notification/read-all`     | ✓    | Any                 | Mark all as read                |
| `DELETE` | `/notification/:id`          | ✓    | Admin               | Delete notification             |
| `GET`    | `/notification/:id`          | ✓    | Any                 | Get notification details        |

**Create Notification:**

```json
POST /notification
{
  "title": "Exam Schedule Released",
  "body": "Mid-semester examination schedule for Semester 5 has been published.",
  "type": "exam",
  "channels": ["in_app", "email", "push"],
  "audience": "targeted",
  "targetSemesters": [5],
  "targetPrograms": ["B.Tech"]
}
```

---

### 41. Parent Portal

**Base path:** `/parent`

| Method | Path                   | Auth | Roles  | Description                    |
| ------ | ---------------------- | ---- | ------ | ------------------------------ |
| `GET`  | `/parent/ward`         | ✓    | PARENT | Ward's basic profile           |
| `GET`  | `/parent/attendance`   | ✓    | PARENT | Ward's attendance summary      |
| `GET`  | `/parent/results`      | ✓    | PARENT | Ward's exam results            |
| `GET`  | `/parent/fees`         | ✓    | PARENT | Ward's fee records             |
| `POST` | `/parent/fees/pay`     | ✓    | PARENT | **Pay fee on behalf of ward**  |
| `GET`  | `/parent/fees/history` | ✓    | PARENT | Payment history                |
| `GET`  | `/parent/notices`      | ✓    | PARENT | Published notices for parents  |
| `POST` | `/parent/messages`     | ✓    | PARENT | Send message to faculty/mentor |
| `GET`  | `/parent/messages`     | ✓    | PARENT | View conversations             |

**Parent Fee Payment:**

```json
POST /parent/fees/pay
{
  "feeRecordId": "64a1...",
  "amountPaid": 35000,
  "paymentMode": "UPI",
  "upiId": "parent@phonepe",
  "remarks": "Semester 5 fee"
}
```

> The system validates that `feeRecordId` belongs to the parent's own ward, preventing unauthorized payments.

---

### 42. Semester Registration

**Base path:** `/semester-registration`

| Method  | Path                                    | Auth | Roles                 | Description                       |
| ------- | --------------------------------------- | ---- | --------------------- | --------------------------------- |
| `POST`  | `/semester-registration`                | ✓    | STUDENT               | Save draft or submit registration |
| `GET`   | `/semester-registration/mine`           | ✓    | STUDENT               | Own all registrations             |
| `GET`   | `/semester-registration/mine/:semester` | ✓    | STUDENT               | Specific semester registration    |
| `GET`   | `/semester-registration/stats`          | ✓    | HOD/Admin             | Registration statistics           |
| `GET`   | `/semester-registration`                | ✓    | HOD/Admin             | All registrations (paginated)     |
| `PATCH` | `/semester-registration/:id/approve`    | ✓    | HOD/Admin             | Approve registration              |
| `PATCH` | `/semester-registration/:id/reject`     | ✓    | HOD/Admin             | Reject registration               |
| `POST`  | `/semester-registration/bulk-approve`   | ✓    | HOD/Admin             | Bulk approve department           |
| `POST`  | `/semester-registration/freeze`         | ✓    | HOD/Admin/SUPER_ADMIN | Freeze after add/drop period      |

**Submit Registration:**

```json
POST /semester-registration
{
  "rollNumber": "2021CSE001",
  "studentName": "Rajesh Kumar",
  "program": "B.Tech",
  "branch": "CSE",
  "departmentId": "64a1...",
  "targetSemester": 5,
  "academicYear": "2024-25",
  "submit": true,
  "registeredSubjects": [
    {
      "subjectId": "64b1...",
      "subjectCode": "CS501",
      "subjectName": "Compiler Design",
      "credits": 4,
      "type": "theory",
      "isBacklog": false
    },
    {
      "subjectId": "64b2...",
      "subjectCode": "CS502",
      "subjectName": "Computer Networks",
      "credits": 4,
      "type": "theory",
      "isBacklog": false
    }
  ]
}
```

**Credit Limits:** Minimum **12**, Maximum **30** credits per semester.  
**Status flow:** `draft` → `submitted` → `approved` → `frozen`

---

### 43. IQAC

**Base path:** `/iqac`

| Method | Path            | Auth | Roles      | Description            |
| ------ | --------------- | ---- | ---------- | ---------------------- |
| `GET`  | `/iqac`         | ✓    | IQAC/Admin | List IQAC records      |
| `POST` | `/iqac`         | ✓    | IQAC/Admin | Create record          |
| `PUT`  | `/iqac/:id`     | ✓    | IQAC/Admin | Update record          |
| `GET`  | `/iqac/reports` | ✓    | IQAC/Admin | Generate AQAR/SSR data |

---

### 44. NAAC / NBA

**Base path:** `/naac-nba`

| Method | Path                  | Auth | Roles      | Description             |
| ------ | --------------------- | ---- | ---------- | ----------------------- |
| `GET`  | `/naac-nba`           | ✓    | IQAC/Admin | List criteria entries   |
| `POST` | `/naac-nba`           | ✓    | IQAC/Admin | Add criterion data      |
| `PUT`  | `/naac-nba/:id`       | ✓    | IQAC/Admin | Update                  |
| `GET`  | `/naac-nba/dashboard` | ✓    | IQAC/Admin | Accreditation dashboard |

---

### 45. Audit Log

**Base path:** `/audit-log`

| Method | Path             | Auth | Roles       | Description                 |
| ------ | ---------------- | ---- | ----------- | --------------------------- |
| `GET`  | `/audit-log`     | ✓    | SUPER_ADMIN | List audit logs (paginated) |
| `GET`  | `/audit-log/:id` | ✓    | SUPER_ADMIN | Get log entry               |

> Audit logs are **immutable** — they cannot be updated or deleted (no soft-delete plugin applied). Retained for 2 years via TTL index.

---

### 46. Role Management

**Base path:** `/role`

| Method   | Path        | Auth | Roles       | Description             |
| -------- | ----------- | ---- | ----------- | ----------------------- |
| `GET`    | `/role`     | ✓    | Admin       | List all roles          |
| `GET`    | `/role/:id` | ✓    | Admin       | Get role details        |
| `POST`   | `/role`     | ✓    | SUPER_ADMIN | Create custom role      |
| `PUT`    | `/role/:id` | ✓    | SUPER_ADMIN | Update role permissions |
| `DELETE` | `/role/:id` | ✓    | SUPER_ADMIN | Delete role             |

---

### 47. Health Check

**Base path:** `/health`

| Method | Path           | Auth   | Description                                 |
| ------ | -------------- | ------ | ------------------------------------------- |
| `GET`  | `/health`      | Public | Basic liveness check                        |
| `GET`  | `/health/full` | Public | Full system status (DB, Redis, memory, CPU) |

**Full Health Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-09-01T10:00:00Z",
  "uptime": 86400,
  "database": "connected",
  "redis": "connected",
  "memory": { "used": "256MB", "total": "512MB" },
  "cpu": 12.5
}
```

---

### 48. Meeting Management

**Base path:** `/meeting`  
**Conductors:** Only `principal` and `hod` can schedule or manage meetings.

| Method   | Path                      | Auth | Roles                     | Description                                 |
| -------- | ------------------------- | ---- | ------------------------- | ------------------------------------------- |
| `GET`    | `/meeting`                | ✓    | Principal / HOD / Faculty | List all meetings (filterable)              |
| `GET`    | `/meeting/my`             | ✓    | FACULTY                   | Meetings where current user is an invitee   |
| `GET`    | `/meeting/student`        | ✓    | STUDENT                   | Student batch meetings (by dept + year)     |
| `GET`    | `/meeting/:id`            | ✓    | Any                       | Meeting details                             |
| `POST`   | `/meeting`                | ✓    | Principal / HOD           | Schedule new meeting                        |
| `PUT`    | `/meeting/:id`            | ✓    | Principal / HOD           | Update meeting details                      |
| `PATCH`  | `/meeting/:id/status`     | ✓    | Principal / HOD           | Change meeting status                       |
| `POST`   | `/meeting/:id/remarks`    | ✓    | Principal / HOD           | Submit concluding remarks (marks completed) |
| `POST`   | `/meeting/:id/attendance` | ✓    | Any                       | Mark own / specific user attendance         |
| `DELETE` | `/meeting/:id`            | ✓    | Principal only            | Soft-delete meeting                         |

**Meeting Types:**

| `meetingType` | Audience            | Notification Target                     |
| ------------- | ------------------- | --------------------------------------- |
| `faculty`     | Selected faculty    | `invitees[]` — specific user IDs        |
| `student`     | Batch (dept + year) | `targetDepartments[]` + `targetYears[]` |

**Meeting Modes:**

| `mode`     | Required fields         |
| ---------- | ----------------------- |
| `physical` | `venue`                 |
| `online`   | `meetingLink`           |
| `hybrid`   | `venue` + `meetingLink` |

**Status Flow:** `scheduled` → `ongoing` → `completed` / `cancelled`

**Schedule Faculty Meeting:**

```json
POST /meeting
{
  "title": "Monthly Faculty Review",
  "meetingType": "faculty",
  "agenda": "Review of semester syllabus completion and student progress.",
  "scheduledAt": "2026-06-10T10:00:00Z",
  "durationMinutes": 90,
  "mode": "physical",
  "venue": "Conference Hall, Block A",
  "departmentId": "64a1...",
  "invitees": ["64b1...", "64b2...", "64b3..."]
}
```

> Invitees receive an **in-app notification** immediately after creation with the agenda, date/time, and venue.

**Schedule Student Batch Meeting:**

```json
POST /meeting
{
  "title": "Pre-Placement Briefing — Final Year",
  "meetingType": "student",
  "agenda": "Placement drive schedule, eligibility criteria, and mock interview dates.",
  "scheduledAt": "2026-06-15T14:00:00Z",
  "durationMinutes": 60,
  "mode": "hybrid",
  "venue": "Seminar Hall, Ground Floor",
  "meetingLink": "https://meet.google.com/abc-defg-hij",
  "targetDepartments": ["64a1...", "64a2..."],
  "targetYears": [4]
}
```

> Leave `targetDepartments` or `targetYears` as empty arrays `[]` to target **all departments / all years**.

**Submit Concluding Remarks:**

```json
POST /meeting/:id/remarks
{
  "remarks": "Syllabus is 85% complete. Faculty advised to complete remaining topics by 20th June. Next review scheduled for 1st July."
}
```

> This automatically sets `status` to `completed` and records `concludingRemarksSubmittedAt`.

---

## Real-Time Events (Socket.IO)

**Endpoint:** `wss://erp.rite.ac.in`

### Connection

```javascript
import { io } from "socket.io-client";

const socket = io("wss://erp.rite.ac.in", {
  auth: { token: "<accessToken>" },
  transports: ["websocket"],
});
```

### Events

| Event                | Direction       | Payload                                  | Description                    |
| -------------------- | --------------- | ---------------------------------------- | ------------------------------ |
| `connect`            | Server → Client | —                                        | Connection established         |
| `disconnect`         | Server → Client | `{ reason }`                             | Connection closed              |
| `new_message`        | Server → Client | `{ conversationId, message }`            | New chat message               |
| `message_read`       | Server → Client | `{ conversationId, readBy, messageIds }` | Messages read                  |
| `new_notification`   | Server → Client | `{ notification }`                       | Push notification              |
| `user_online`        | Server → Client | `{ userId }`                             | User came online               |
| `user_offline`       | Server → Client | `{ userId }`                             | User went offline              |
| `join_conversation`  | Client → Server | `{ conversationId }`                     | Subscribe to conversation room |
| `leave_conversation` | Client → Server | `{ conversationId }`                     | Unsubscribe                    |
| `typing`             | Client → Server | `{ conversationId }`                     | User is typing                 |
| `stop_typing`        | Client → Server | `{ conversationId }`                     | User stopped typing            |
| `typing_indicator`   | Server → Client | `{ conversationId, userId, isTyping }`   | Typing broadcast               |

---

## Background Jobs (Cron)

The following jobs run automatically after the database connects:

| Job                          | Schedule             | Description                             |
| ---------------------------- | -------------------- | --------------------------------------- |
| **Attendance Alert**         | Daily 08:00          | Notifies students with < 75% attendance |
| **Fee Reminder**             | Daily 09:00          | Sends reminder for overdue fees         |
| **Payroll Processing**       | 1st of month 07:00   | Auto-generates monthly payroll          |
| **Quiz / Assignment Expiry** | Every 15 min         | Marks overdue quizzes/assignments       |
| **Semester End Sync**        | 30th June & 30th Nov | Archives semester data                  |
| **Alumni Sync**              | Weekly Sunday 02:00  | Syncs graduated students to alumni      |
| **Notification Cleanup**     | Daily 00:00          | Removes expired notifications           |

---

## PDF Generation

PDFs are generated server-side using **Puppeteer + Handlebars** templates.

| Template               | Generator                                  | Description                |
| ---------------------- | ------------------------------------------ | -------------------------- |
| `fee-receipt`          | `pdfService.generateFeeReceipt()`          | Payment receipt with QR    |
| `fee-invoice`          | `pdfService.generateFeeInvoice()`          | Demand letter / proforma   |
| `hall-ticket`          | `pdfService.generateHallTicket()`          | Exam admit card with photo |
| `marksheet`            | `pdfService.generateMarksheet()`           | Semester result marksheet  |
| `marksheet`            | `pdfService.generateTranscript()`          | Consolidated transcript    |
| `bonafide-certificate` | `pdfService.generateBonafide()`            | Bonafide certificate       |
| `transfer-certificate` | `pdfService.generateTransferCertificate()` | Transfer certificate       |
| `salary-slip`          | `pdfService.generateSalarySlip()`          | Monthly pay slip           |
| `experience-letter`    | `pdfService.generateExperienceLetter()`    | Experience letter          |
| `appointment-letter`   | `pdfService.generateAppointmentLetter()`   | Joining letter             |
| `seating-plan`         | `pdfService.generateSeatingPlan()`         | Exam hall seating          |
| `id-card`              | —                                          | Student/staff ID card      |

All PDFs include a **QR code** linking to a verification URL:

```
https://erp.rite.ac.in/verify/<verification-id>
```

---

## File Upload (Cloudinary)

Files are uploaded to Cloudinary via `POST /document/upload` or directly within module-specific endpoints (profile photo, study material, etc.).

**File validation:**

- Magic-byte check (file content matches extension)
- Max size enforced per type
- Virus scan hook (configurable)

**Supported types:** PDF, JPEG, PNG, DOCX, XLSX

---

## Caching Strategy (Redis)

The system uses a **cache-aside** pattern via `redisUtil.remember(key, ttl, fetchFn)`.

| Data                | TTL    | Key Pattern                           |
| ------------------- | ------ | ------------------------------------- |
| Fee structures      | 10 min | `fee:struct:<program>:<branch>:...`   |
| Student results     | 10 min | `exam:results:<studentId>`            |
| Attendance summary  | 5 min  | `attendance:<studentId>:<sem>:<year>` |
| Parent ward         | 2 min  | `parent:ward:<parentUserId>`          |
| Notifications count | 1 min  | `notif:unread:<userId>`               |

Redis is **optional** — if unavailable, the system falls back to direct database queries (graceful no-op).

---

## Security Controls

| Control                 | Implementation                                                   |
| ----------------------- | ---------------------------------------------------------------- |
| **Password Hashing**    | bcryptjs, rounds = 12                                            |
| **JWT**                 | RS256 / HS256, 15-minute access tokens                           |
| **MFA**                 | TOTP (RFC 6238) via otplib                                       |
| **Rate Limiting**       | express-rate-limit, 100 req/15 min per IP (Redis-backed)         |
| **Input Sanitization**  | express-mongo-sanitize, hpp (HTTP Parameter Pollution)           |
| **XSS / Headers**       | helmet (CSP, HSTS, X-Frame-Options, etc.)                        |
| **CORS**                | Allowlist via `ALLOWED_ORIGINS` env var                          |
| **IP Whitelist**        | Admin routes restricted by `ADMIN_IP_WHITELIST`                  |
| **SQL/NoSQL Injection** | Mongoose parameter binding + sanitize middleware                 |
| **Audit Trail**         | Every write operation logs to `AuditLog` collection              |
| **Soft Delete**         | `auditPlugin` adds `isDeleted`, auto-filters in all find queries |
| **HTTPS**               | Enforced in production via reverse proxy (nginx / Cloudflare)    |
| **Data Encryption**     | AES-256 for sensitive fields (encryption key in env)             |

---

## Workflow Walkthroughs

### Student Admission → Enrollment

```
1. Admission Counselor creates a user account  →  POST /admin/users (role: admission_counselor)
2. Student submits online application          →  POST /admission/apply
3. Counselor reviews application               →  GET  /admission/applications
4. Documents verified physically               →  PATCH /admission/applications/:id/documents
5. Application shortlisted                     →  PATCH /admission/applications/:id/status { status: "shortlisted" }
6. Branch allotted                             →  POST /admission/applications/:id/allot
7. Student enrolled, account created           →  POST /admission/applications/:id/enroll
8. Fee record generated                        →  POST /fee/generate
9. Student pays fee (at counter)               →  POST /fee/:id/pay
10. Fee receipt emailed automatically
```

---

### Faculty Marks Entry → Result Publication

```
1. Exam schedule created          →  POST /examination/schedules
2. Hall tickets generated         →  POST /examination/hall-ticket
3. Seating plan generated         →  POST /examination/schedules/:id/seating
4. Faculty enters marks           →  POST /examination/marks
5. Result compiled                →  POST /examination/results/compile { studentId, semester, academicYear }
6. Recheck requests accepted      →  POST /examination/recheck
7. Results published              →  POST /examination/results/publish
8. Students download marksheet    →  GET  /examination/results/student/:id/marksheet?semester=5&academicYear=2024-25
9. Transcript available           →  GET  /examination/results/student/:id/transcript
```

---

### Student Grievance Lifecycle

```
1. Student submits grievance      →  POST /grievance
   ← Returns: { referenceNumber: "GRV-M2X1K-ABC" }

2. Student tracks by ref          →  GET  /grievance/ref/GRV-M2X1K-ABC

3. HOD acknowledges               →  PATCH /grievance/:id/acknowledge

4. HOD responds                   →  PATCH /grievance/:id/respond { response: "...", resolve: false }

5a. If resolved:                  →  PATCH /grievance/:id/respond { response: "...", resolve: true }
5b. If needs escalation:          →  PATCH /grievance/:id/escalate { escalatedToId, note }

6. Student rates satisfaction     →  PATCH /grievance/:id/rate { rating: 4, feedback: "Quick resolution" }

7. Student closes                 →  PATCH /grievance/:id/close
```

---

### Quiz with Proctoring

```
1. Faculty creates proctored quiz →  POST /quiz { proctoringEnabled: true, proctoringConfig: { tabSwitchLimit: 3 } }

2. Student starts quiz            →  (frontend enters fullscreen, copies are blocked)

3. Tab switch detected            →  POST /quiz/:id/proctor-event { eventType: "tab_switch" }
   ← If limit reached: { autoSubmitted: true }

4. Student submits normally       →  POST /quiz/:id/submit { answers: [...], score, maxScore }

5. Faculty reviews violations     →  GET  /quiz/:id/proctor-log
```

---

### Parent Fee Payment

```
1. Parent logs in                 →  POST /auth/login { email, password }

2. View ward's fee status         →  GET  /parent/fees

3. Pay fee online                 →  POST /parent/fees/pay
   {
     "feeRecordId": "<id>",
     "amountPaid": 35000,
     "paymentMode": "UPI",
     "upiId": "parent@upi"
   }
   ← Receipt PDF emailed to both parent and student

4. View payment history           →  GET  /parent/fees/history
```

---

### Semester Registration

```
1. Student saves draft            →  POST /semester-registration { submit: false, registeredSubjects: [...] }

2. Student submits                →  POST /semester-registration { submit: true, ... }
   ← Validates: 12 ≤ total credits ≤ 30

3. HOD reviews list               →  GET  /semester-registration?departmentId=&status=submitted

4. HOD approves individually      →  PATCH /semester-registration/:id/approve
   OR bulk approve entire batch   →  POST  /semester-registration/bulk-approve

5. After add/drop period ends     →  POST  /semester-registration/freeze
   ← All approved registrations become immutable (status: frozen)
```

---

### Faculty Meeting (Principal / HoD)

```
1. Principal/HoD schedules meeting  →  POST /meeting
   {
     meetingType: "faculty",
     invitees: ["faculty-id-1", "faculty-id-2"],
     agenda: "...",
     scheduledAt: "2026-06-10T10:00:00Z",
     mode: "physical",
     venue: "Conference Hall"
   }
   ← Invitees notified immediately via in-app notification

2. Faculty views their meetings     →  GET  /meeting/my

3. Meeting starts                   →  PATCH /meeting/:id/status { status: "ongoing" }

4. Mark attendance                  →  POST /meeting/:id/attendance { userId: "..." }

5. Post-meeting: submit remarks     →  POST /meeting/:id/remarks
   { remarks: "Detailed concluding notes..." }
   ← Status auto-updated to "completed"
```

---

### Student Batch Meeting

```
1. Principal/HoD schedules meeting  →  POST /meeting
   {
     meetingType: "student",
     targetDepartments: ["cse-dept-id"],
     targetYears: [3, 4],
     mode: "hybrid",
     venue: "Seminar Hall",
     meetingLink: "https://meet.google.com/..."
   }
   ← All matching students notified via in-app notification

2. Students view meeting            →  GET  /meeting/student?departmentId=...&year=3

3. Student marks attendance         →  POST /meeting/:id/attendance

4. Conductor submits remarks        →  POST /meeting/:id/remarks
```

---

### Dean Academic — Academic Health Review

```
1. Dean logs in, hits dashboard         →  GET /dashboard
   ← Returns: {
       overallAvgCompletion: 72.4,
       courseCompletionStats: [{ _id: deptId, avgCompletion, totalSubjects, completedSubjects }],
       deptAttendance: [{ _id: deptId, avgAttendance, shortageCount, totalStudents }],
       workloadSummary: [{ _id: deptId, avgWeeklyHours, maxWeeklyHours, facultyCount }],
       upcomingExams, activeNotices, upcomingMeetings
     }

2. Review slow departments              →  GET /course-progress?departmentId=<id>&completionLt=50

3. Compare faculty workload by dept     →  GET /faculty-workload?departmentId=<id>&academicYear=2025-26

4. View shortage students               →  GET /attendance/shortage-list?semester=5&academicYear=2025-26
```

---

### Super Admin — ERP Audit & User Management

```
1. Super Admin logs in, hits dashboard  →  GET /dashboard
   ← Returns: {
       totalUsers, totalStudents, totalFaculty,
       userBreakdown: [{ _id: role, count }],
       auditSummary: [{ _id: module, count }],    ← last 24h activity by module
       recentAuditLogs: [{ action, module, userName, userRole, description }]
     }

2. View full audit log                  →  GET /audit-log?limit=50&page=1

3. Create/suspend a user                →  POST /admin/users  |  PATCH /admin/users/:id/status

4. View all roles & permissions         →  GET /role
```

---

## Development Scripts

```bash
# Start dev server with hot-reload
pnpm server

# TypeScript compile (production)
pnpm build

# Start production server (after build)
pnpm start

# Format all TypeScript files
pnpm format

# Check formatting (CI)
pnpm format:check

# Lint
pnpm lint

# Lint + auto-fix
pnpm lint:fix

# Full check (format + lint + type-check)
pnpm check
```

---

## License

ISC — RITE College of Engineering, Berhampur, Odisha, India.  
Author: **Rajesh Kumar Behera**
