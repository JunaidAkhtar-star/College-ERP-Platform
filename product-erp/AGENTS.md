# GitHub Copilot Instructions — RITE ERP Frontend

> These instructions govern **every file** generated or modified in this Next.js 16 / React 19 codebase.
> Read them fully before generating any code.

---

## 0. Branding Assets

- **Favicon**: `src/app/favicon.ico` — already placed; Next.js serves it automatically. Do **not** replace or add another favicon.
- **Logo**: `public/rite-logo.webp` — this is the **only** logo used across the entire app.
  - Always use `<Image src="/rite-logo.webp" alt="RITE ERP Logo" ... />` (Next.js `next/image`) wherever a logo is needed.
  - Used in: Sidebar top, Login page, any other branding location.
  - Never use a placeholder, text-only logo, or any other image as the logo.

---

## 0.1 LocalStorage Utilities (locked — do not create new helpers)

All localStorage access **must** use the existing functions from `@/shared/utils/index.ts`. Never use `localStorage` directly or create new wrapper functions.

| Purpose                                 | Function                          |
| --------------------------------------- | --------------------------------- |
| Save a plain string (e.g. access token) | `saveToLocalStorage(key, value)`  |
| Save a JSON-serializable object         | `setLocalStorageItem(key, value)` |
| Get a plain string                      | `getFromLocalStorage(key)`        |
| Get a parsed JSON object                | `getLocalStorageItem(key)`        |
| Remove an item                          | `removeFromLocalStorage(key)`     |

### Access Token convention

```typescript
import { saveToLocalStorage, getFromLocalStorage, removeFromLocalStorage } from '@/shared/utils';

// Save after login
saveToLocalStorage('accessToken', token);

// Read
const token = getFromLocalStorage('accessToken');

// Remove on logout
removeFromLocalStorage('accessToken');
```

- Key name for the access token is `'accessToken'` — use this exact key everywhere.
- Never call `localStorage.setItem / getItem / removeItem` directly in any component or hook.

---

## 1. Tech Stack (locked — do not deviate)

| Layer                  | Library / Version                                                        |
| ---------------------- | ------------------------------------------------------------------------ |
| Framework              | Next.js 16 (App Router)                                                  |
| Language               | TypeScript 5 — **strict mode**                                           |
| Styling                | Tailwind CSS v4 + MUI v9                                                 |
| Animations             | Framer Motion (`@/shared/utils/motion`)                                  |
| Icons                  | Lucide React + React Icons                                               |
| Data fetching (GET)    | Custom `useSwr` hook (`@/shared/hooks/useSwr`)                           |
| Data fetching (mutate) | Custom `useMutation` hook (`@/shared/hooks/useMutation`)                 |
| Global state           | Zustand v5 (`@/shared/store/`)                                           |
| Forms                  | Formik + Yup                                                             |
| Tables                 | `CustomTable` (`@/shared/core/CustomTable`) — NEVER create a new table   |
| File preview           | `FileViewer` (`@/shared/core/FileViewer`) — NEVER build a custom modal   |
| File upload            | `InlineFileUpload` (`@/shared/core/InlineFileUpload`) — inline per field |
| Alerts / feedback      | `react-toastify` (inline) + `sweetalert2` (destructive confirm)          |
| Routing protection     | `UseProtectedRoutes` HOC (`@/shared/hooks/UseProtectedRoutes`)           |

---

## 2. Absolute Rules

1. **Never use `any`** — always define a TypeScript `interface` or `type`. No `any`, no `unknown` without a cast guard.
2. **Never call `fetch()` directly** — always use `useSwr` for GET requests and `useMutation` for POST / PUT / PATCH / DELETE.
3. **Never create a new table component** — always use `CustomTable` from `@/shared/core/CustomTable`.
4. **Never build a custom file / image preview modal** — always use `FileViewer` from `@/shared/core/FileViewer`. It already handles images, PDFs, prev/next arrows, keyboard navigation, download and thumbnails for multi-file collections.
5. **Never write ad-hoc upload UI** — always use `InlineFileUpload` from `@/shared/core/InlineFileUpload` for any file/document upload. Place it INLINE next to the field it belongs to (Aadhaar upload next to the Aadhaar Number input, marksheet upload inside the academic-record row, etc.) — never in a separate "Documents" section. It supports multi-file mode via the `multiple` prop and reuses `FileViewer` for previews.
6. **Never use static/hardcoded data** — every list, select, or display must come from an API via `useSwr`.
7. **Never skip error handling** — every `useMutation` call must handle `onError` with a `toast.error(...)`.
8. **Never use inline `style={}` objects** — use Tailwind classes or MUI `sx` prop.
9. **Never add `box-shadow` to UI surfaces** — cards, panels, heroes, modals and menus must stay flat. Borders are optional: use a simple, subtle 1px neutral border when it improves grouping or separation, and avoid heavy, decorative, doubled or high-contrast borders.
10. **Never import `useRouter` from `next/navigation`** — always import it from `nextjs-toploader/app` so the top loading bar triggers on every programmatic navigation.
11. **Never use dark UI surfaces anywhere in the product** — do not use black, navy, charcoal, slate-900, gray-900, zinc-900, neutral-900, dark gradients, or near-black backgrounds for pages, heroes, cards, panels, modals, tables, sidebars, empty states, illustrations, or decorative sections. Use white and light pastel surfaces with accessible dark text. Dark text and icons are allowed only when needed for readable contrast; the prohibition applies to dark background treatments and dark-mode visual sections.
12. **Every UI must be fully responsive before it is considered complete** — verify mobile (320–639px), tablet (640–1023px), laptop (1024–1439px), and wide desktop (1440px+). Layouts must avoid horizontal overflow, clipped actions, hidden content, overlapping text, unreadable charts, and wasted space. Use content-driven wrapping, responsive grids, sensible max-widths, and touch-friendly controls. Never design only for desktop and patch mobile later.
13. **Never use sparkle or star icons anywhere** — do not import or render `Sparkles`, `Sparkle`, `Stars`, or `Star` icons from any icon library, including for decoration, ratings, favourites, AI, success, or featured states. Use a semantic alternative such as `BadgeCheck`, `Award`, `Bookmark`, `CircleGauge`, `Lightbulb`, or `ThumbsUp`, chosen for the actual meaning. Text such as “star student” may remain when it is a genuine business label, but it must not be accompanied by a star/sparkle icon.
14. **Dashboard charts must use polished, data-appropriate SVG visualizations** — use varied chart forms only when they suit the underlying business data (for example area trends, rounded distributions, donuts and progress signals), rather than cloning one graph style everywhere. Charts must use real API values, light accessible colors, readable labels and legends, responsive containers, smooth focus/hover transitions, and a clear empty state. Hovering a series or segment should emphasize it and gently neutralize competing data where that improves comparison. Never add decorative or fabricated chart values merely to fill space.

```typescript
// ✅ CORRECT
import { useRouter } from 'nextjs-toploader/app';

// ❌ FORBIDDEN
import { useRouter } from 'next/navigation';
```

9. **Never use `h-screen`** — always use `h-dvh` for full-viewport-height elements. `100dvh` accounts for the dynamic viewport on mobile browsers (collapsing address bars, etc.) and works correctly across all devices.

```typescript
// ✅ CORRECT
<div className="h-dvh">...</div>

// ❌ FORBIDDEN
<div className="h-screen">...</div>
```

---

## 2.1 File Viewer & Uploads (locked components)

The app ships two locked components for every file workflow. Re-rolling either of these is a review-blocking violation.

### `FileViewer` — `@/shared/core/FileViewer`

Full-screen viewer for one or many files. Used wherever the app needs to show an image, PDF or other uploaded document.

```tsx
import FileViewer, { IViewerFile } from '@/shared/core/FileViewer';

const [open, setOpen] = useState(false);
const files: IViewerFile[] = [
  { url: '/aadhaar-front.jpg', name: 'Aadhaar Front' },
  { url: '/aadhaar-back.jpg', name: 'Aadhaar Back' },
];

<FileViewer
  open={open}
  onClose={() => setOpen(false)}
  files={files}
  initialIndex={0}
  title="Aadhaar Card"
/>;
```

Features handled for you: prev/next arrows, thumbnail strip, Arrow / Esc key shortcuts, Open-in-new-tab, Download, image + PDF rendering, graceful fallback for unknown types, framer-motion transitions.

### `InlineFileUpload` — `@/shared/core/InlineFileUpload`

Compact uploader you place RIGHT NEXT TO the form field it belongs to. Single or multi-file, validates PDF / JPG / PNG up to 5 MB. Files upload immediately on selection; preview is shown only through a "View" button that opens `FileViewer`.

```tsx
import InlineFileUpload from '@/shared/core/InlineFileUpload';

<InlineFileUpload
  label="Aadhaar Card"
  multiple // allow front + back
  required
  files={files} // IViewerFile[] already uploaded
  onUpload={async (f) => uploadDoc('aadhaar_card', f)}
  onRemove={async (file) => removeDoc('aadhaar_card', file)}
/>;
```

Rules:

- Place it inline with the field it documents. **Never** create a separate "Documents" section/tab.
- Use `multiple` whenever the field can legitimately have more than one file (e.g. 12th + diploma marksheets, multiple certificates).
- Never show a live preview inline — the View button + `FileViewer` is the only allowed preview surface.

---

## 3. Folder Structure

```
src/
├── app/                          # Next.js App Router pages & layouts
│   ├── (auth)/                   # Public routes (login, register)
│   ├── (dashboard)/              # Protected routes — uses DefaultLayout
│   │   ├── layout.tsx            # Wraps DefaultLayout + UseProtectedRoutes
│   │   ├── [role]/               # Dynamic per-role panel root
│   │   │   └── page.tsx
│   │   └── [module]/
│   │       ├── page.tsx          # List page (uses CustomTable)
│   │       └── [id]/
│   │           └── page.tsx      # Detail / edit page
├── features/                     # Feature slices (co-located)
│   └── [feature-name]/
│       ├── components/           # UI components for this feature only
│       ├── hooks/                # Feature-specific hooks
│       ├── store/                # Zustand slice for this feature
│       ├── types/                # Interfaces & types for this feature
│       ├── validations/          # Yup schemas
│       └── index.ts              # Public barrel export
└── shared/
    ├── core/                     # Global reusable UI (CustomTable, CustomButton, etc.)
    ├── hooks/                    # useSwr, useMutation, UseProtectedRoutes
    ├── layouts/                  # DefaultLayout, AuthLayout, etc.
    ├── provider/                 # App-level providers (SWRConfig, ToastProvider, etc.)
    ├── store/                    # Global Zustand stores (auth, ui, permissions)
    ├── types/                    # Global shared interfaces
    └── utils/                    # Utility functions (BASE_URL, localStorage helpers, etc.)
```

---

## 4. TypeScript Interface Standards

```typescript
// ✅ CORRECT — always define explicit interfaces
interface IStudent {
  _id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  createdAt: string;
  updatedAt: string;
}

// ✅ API response wrapper
interface IApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: IPagination;
}

interface IPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ❌ FORBIDDEN
const student: any = {};
const data: Record<string, any> = {};
```

- All interfaces live in the feature's `types/` folder or `src/shared/types/`.
- Prefix all interfaces with `I` (e.g., `IStudent`, `IFaculty`, `IApiResponse`).
- Prefix all type aliases with `T` (e.g., `TRole`, `TPermission`).
- Use `_id: string` (MongoDB convention) for entity identifiers.

---

## 5. Data Fetching Patterns

### GET — always use `useSwr`

```typescript
// ✅ Correct GET usage
const { data, isLoading, error, mutate } = useSwr<IApiResponse<IStudent[]>>(
  'student-profile', // path after BASE_URL
);
```

### POST / PUT / PATCH / DELETE — always use `useMutation`

```typescript
// ✅ Correct mutation usage
const { mutation, isLoading } = useMutation();

const handleSubmit = async (values: ICreateStudentDto) => {
  const res = await mutation('student-profile', {
    method: 'POST',
    body: values,
  });
  if (res?.data?.success) {
    toast.success('Student created successfully');
    mutate(); // revalidate the SWR cache
  }
};
```

### DELETE with confirmation — always use SweetAlert2

```typescript
const handleDelete = async (id: string) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it',
    confirmButtonColor: '#0178D7', // --color-primary
  });
  if (result.isConfirmed) {
    const res = await mutation(`student-profile/${id}`, { method: 'DELETE' });
    if (res?.data?.success) {
      toast.success('Deleted successfully');
      mutate();
    } else {
      toast.error(res?.data?.message || 'Delete failed');
    }
  }
};
```

---

## 6. Backend API Routes Reference

All paths are relative to `BASE_URL` (env: `NEXT_PUBLIC_SERVER_URL`).

| Module               | Base Path            |
| -------------------- | -------------------- |
| Auth                 | `auth`               |
| User Management      | `user`               |
| Role Management      | `role`               |
| Student Profile      | `student-profile`    |
| Faculty Profile      | `faculty-profile`    |
| Department           | `department`         |
| Subject              | `subject`            |
| Timetable            | `timetable`          |
| Attendance (Student) | `attendance`         |
| Attendance (Faculty) | `faculty-attendance` |
| Examination          | `examination`        |
| Assignment           | `assignment`         |
| Quiz                 | `quiz`               |
| Study Material       | `study-material`     |
| Academic Calendar    | `academic-calendar`  |
| Curriculum           | `curriculum`         |
| Lesson Plan          | `lesson-plan`        |
| Course Progress      | `course-progress`    |
| Fee                  | `fee`                |
| Payroll              | `payroll`            |
| Accounts             | `accounts`           |
| Leave                | `leave`              |
| Library              | `library`            |
| Hostel               | `hostel`             |
| Transport            | `transport`          |
| Placement            | `placement`          |
| Scholarship          | `scholarship`        |
| Notice               | `notice`             |
| Notification         | `notification`       |
| Chat                 | `chat`               |
| Mentor               | `mentor`             |
| Counseling           | `counseling`         |
| Admission            | `admission`          |
| Alumni               | `alumni`             |
| Question Bank        | `question-bank`      |
| IQAC                 | `iqac`               |
| NAAC/NBA             | `naac-nba`           |
| Dashboard            | `dashboard`          |
| Audit Log            | `audit-log`          |
| Document             | `document`           |
| Parent               | `parent`             |
| Faculty Workload     | `faculty-workload`   |

---

## 7. Role & Permission System

### System Roles (from backend `SystemRole` enum)

```typescript
type TSystemRole =
  | 'super_admin'
  | 'principal'
  | 'dean_academic'
  | 'hod'
  | 'faculty'
  | 'student'
  | 'parent'
  | 'examination_cell'
  | 'iqac_team'
  | 'scholarship_cell'
  | 'library_staff'
  | 'placement_cell'
  | 'hr_department'
  | 'accounts_department'
  | 'admission_counselor';
```

### Dynamic Role-Based Panel (Sidebar)

- The left sidebar **must** render navigation items dynamically based on the authenticated user's `role` and `permissions`.
- Fetch the user's role + permissions from the auth store (Zustand).
- Each nav item must have a `requiredPermission` property; hide it if the user lacks that permission.
- The sidebar structure: **Logo → Nav Groups → Nav Items (with icons) → User Profile Card at bottom**.
- Use `framer-motion` `AnimatePresence` for sidebar collapse/expand.

### UseProtectedRoutes HOC

```typescript
// Every dashboard page component must be wrapped
export default UseProtectedRoutes(StudentListPage);
```

The HOC should also check `permissions` from the auth Zustand store and redirect to `/unauthorized` if the user lacks the required permission for that module.

---

## 8. Layout Rules

### DefaultLayout (`src/shared/layouts/index.tsx`)

```
┌─────────────────────────────────────────────┐
│  Header (fixed top, full width)             │
├──────────┬──────────────────────────────────┤
│ Sidebar  │  <children> (scrollable)         │
│ (fixed)  │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

- Header: breadcrumb, notifications bell, user avatar dropdown.
- Sidebar: collapsible, role-based nav, smooth Framer Motion transition.
- All dashboard pages **must** be wrapped with `DefaultLayout` via the `(dashboard)/layout.tsx`.

---

## 9. Component & File Splitting

### Code Splitting Rules

```typescript
// ✅ Heavy components must use dynamic import with lazy loading
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./components/HeavyChart'), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
```

- Any component over ~150 lines must be split into sub-components.
- Each page file should only contain the page shell + data fetching; delegate UI to `components/`.
- Modal forms must always be in a separate file (`CreateStudentModal.tsx`, `EditStudentModal.tsx`).

### Component Structure Template

```
features/
└── student/
    ├── components/
    │   ├── StudentListTable.tsx     // uses CustomTable
    │   ├── StudentFilterBar.tsx
    │   ├── CreateStudentModal.tsx   // Formik form
    │   └── StudentDetailCard.tsx
    ├── hooks/
    │   └── useStudentData.ts       // wraps useSwr calls
    ├── store/
    │   └── studentStore.ts         // Zustand slice
    ├── types/
    │   └── student.types.ts        // IStudent, ICreateStudentDto
    ├── validations/
    │   └── student.schema.ts       // Yup schema
    └── index.ts
```

---

## 10. Design System & UI/UX

### Color Tokens (use CSS variables — defined in `src/app/globals.css`)

```css
/* Primary — #0178D7 (blue) — use for main CTAs, active nav, links */
--color-primary: #0178d7;
--color-primary-50: #e6f2fb; /* light tint — hover backgrounds */
--color-primary-100: #cce4f7;
--color-primary-500: #0178d7; /* base */
--color-primary-600: #015eac; /* pressed / darker */
--color-primary-900: #002544;

/* Secondary — #9BB94F (green) — use for success states, badges, accents */
--color-secondary: #9bb94f;
--color-secondary-50: #f5f8ec;
--color-secondary-500: #9bb94f; /* base */
--color-secondary-600: #7c9440;

/* Tertiary — #B0B0B0 (neutral grey) — use for disabled, muted text, dividers */
--color-tertiary: #b0b0b0;
--color-tertiary-50: #f7f7f7;
--color-tertiary-500: #b0b0b0; /* base */
--color-tertiary-700: #6a6a6a;

/* Backgrounds */
--background: #ffffff;
--foreground: #171717;
```

**Tailwind usage** — these map directly to Tailwind classes via `@theme inline`:

```
bg-primary        text-primary        border-primary
bg-secondary      text-secondary
bg-tertiary       text-tertiary
bg-primary-50     bg-primary-100  …   (all shade steps 50–900)
```

### UI Rules

- **Borders are optional** — use a simple 1px neutral border when a card needs clearer grouping or separation; keep border treatment consistent within the same view.
- **No box-shadow** — keep surfaces flat and create hierarchy with spacing, borders and light background color differences.
- **Consistent heading sizes across all pages**:
  - Page title: `text-2xl font-bold text-slate-900`
  - Section title: `text-lg font-semibold text-slate-800`
  - Sub-title / label: `text-sm font-medium text-slate-600`
- **Smooth animations** — wrap list items and modals with Framer Motion `motion.div` with `initial/animate/exit`.
- **All buttons** use `CustomButton` from `@/shared/core/CustomButton`.
- **Responsive**: every layout must work on mobile (sm), tablet (md), desktop (lg, xl).
- **Light surfaces only**: no dark page, hero, card, panel, modal, table, sidebar, or decorative backgrounds.
- **No sparkle/star iconography**: use meaning-specific neutral icons instead.
- **Professional SVG charts**: choose distinct chart types based on the business relationship, with responsive sizing, readable labels, smooth comparative hover focus and truthful API-backed values.
- **Enterprise ERP feel**: clean, structured, information-dense but not cluttered.

### Interactive Feedback

```typescript
// ✅ Success
toast.success('Record saved successfully');

// ✅ Error
toast.error(error?.message || 'Something went wrong');

// ✅ Destructive confirmation
await Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true });

// ✅ Loading state — always show spinner on async buttons
<CustomButton loading={isLoading} onClick={handleSubmit}>Save</CustomButton>
```

---

## 11. Zustand Store Pattern

```typescript
// src/features/student/store/studentStore.ts
import { create } from 'zustand';
import { IStudent } from '../types/student.types';

interface IStudentStore {
  selectedStudent: IStudent | null;
  isModalOpen: boolean;
  setSelectedStudent: (student: IStudent | null) => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useStudentStore = create<IStudentStore>((set) => ({
  selectedStudent: null,
  isModalOpen: false,
  setSelectedStudent: (student) => set({ selectedStudent: student }),
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false, selectedStudent: null }),
}));
```

Global auth store lives at `src/shared/store/authStore.ts` and must expose:

- `user`, `role`, `permissions`, `token`
- `setAuth()`, `clearAuth()`

---

## 12. Metadata (SEO)

Every page must export a `generateMetadata` or static `metadata`:

```typescript
// Static
export const metadata: Metadata = {
  title: 'Students | RITE ERP',
  description: 'Manage student profiles, documents and academic records.',
};

// Dynamic (preferred for detail pages)
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Student ${params.id} | RITE ERP`,
  };
}
```

---

## 13. Comment Standards

Every file must have a top-level file comment:

```typescript
/**
 * @file StudentListPage.tsx
 * @description Displays paginated list of all students with filter, search,
 *              export and CRUD actions. Accessible to SUPER_ADMIN, PRINCIPAL, HOD.
 * @module features/student
 */
```

Every non-trivial function must have a JSDoc comment:

```typescript
/**
 * Fetches paginated student list with optional filters.
 * @param filters - Active filter state from StudentFilterBar
 * @returns SWR response containing IStudent array and pagination
 */
const useStudentList = (filters: IStudentFilters) => { ... };
```

Inline comments: use `//` for single-line logic explanation. Never comment obvious code.

---

## 14. Form Standards (Formik + Yup)

```typescript
// ✅ Every form must have a Yup schema in validations/
const createStudentSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  rollNumber: Yup.string().required('Roll number is required'),
  department: Yup.string().required('Department is required'),
});

// ✅ Form component uses Formik
const CreateStudentModal = () => {
  const { mutation, isLoading } = useMutation();

  return (
    <Formik
      initialValues={{ name: '', rollNumber: '', department: '' }}
      validationSchema={createStudentSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched }) => (
        <Form>
          {/* fields */}
        </Form>
      )}
    </Formik>
  );
};
```

---

## 15. Page Completion Checklist

Before moving to the next page, verify:

- [ ] TypeScript interfaces defined — no `any`
- [ ] All data from API via `useSwr` / `useMutation` — no static data
- [ ] `CustomTable` used for tabular data — no new table created
- [ ] `UseProtectedRoutes` HOC wrapping the page export
- [ ] Error handling with `toast.error(...)` on every mutation
- [ ] Destructive actions use SweetAlert2 confirmation
- [ ] Metadata exported (`title`, `description`)
- [ ] Page comment block at top of file
- [ ] Heavy components use `dynamic()` import
- [ ] Responsive layout (mobile → desktop)
- [ ] Verified at mobile, tablet, laptop and wide-desktop widths with no clipping or overflow
- [ ] No dark surfaces, dark gradients or near-black decorative sections
- [ ] No `Sparkles`, `Sparkle`, `Stars` or `Star` icons
- [ ] Dashboard graphs are responsive, API-backed, visually varied and use smooth SVG focus interactions
- [ ] Consistent heading sizes (`text-2xl`, `text-lg`, `text-sm`)
- [ ] No box-shadows; any card borders are subtle, intentional and consistent
- [ ] Zustand store used for UI state (modals, selected rows)
- [ ] Formik + Yup for all forms
- [ ] All buttons use `CustomButton` with `loading` prop

---

## 16. ESLint / Prettier

- Run `pnpm check` before any commit.
- ESLint naming convention: interfaces `I*`, types `T*`.
- No `console.log` in production code — use proper error boundaries.
- Max line length: 100 chars (prettier config).

---

## 17. What NOT to generate

- ❌ `any` types
- ❌ Direct `fetch()` calls
- ❌ New table components
- ❌ Hardcoded / mock data
- ❌ `shadow` utilities or CSS `box-shadow` on UI surfaces
- ❌ Heavy, decorative, doubled or high-contrast card borders
- ❌ Dark backgrounds, dark gradients or near-black UI surfaces
- ❌ Sparkle or star icons from any icon library
- ❌ New page files without metadata export
- ❌ Mutations without error toast
- ❌ Forms without Yup validation schema
- ❌ Dashboard pages without `UseProtectedRoutes` HOC
- ❌ Heavy components without `dynamic()` import
- ❌ Zustand stores with `any` state type

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
