# SOFTSUAVE-HIRE-FE

React + TypeScript frontend for the Talentia interview platform.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Routing](#routing)
6. [State Management](#state-management)
7. [Authentication & Token Handling](#authentication--token-handling)
8. [Theming (Light / Dark Mode)](#theming-light--dark-mode)
9. [Application Shell](#application-shell)
10. [Component Library](#component-library)
11. [Icon System](#icon-system)
12. [Feature Modules](#feature-modules)
13. [Candidate Portal Flow](#candidate-portal-flow)
14. [API Utility](#api-utility)
15. [Hooks](#hooks)
16. [CSS Conventions](#css-conventions)
17. [Adding a New Feature](#adding-a-new-feature)
18. [Code Quality & Linting](#code-quality--linting)

---

## Tech Stack

| Package             | Version | Purpose                              |
| ------------------- | ------- | ------------------------------------ |
| React               | 18.x    | UI framework                         |
| TypeScript          | 5.x     | Static typing                        |
| Vite                | 7.x     | Build tool + dev server              |
| Redux Toolkit       | 2.x     | Global state (auth, workspace, ui, notifications) |
| React Router DOM    | 6.x     | Client-side routing                  |
| Axios               | 1.x     | HTTP client with interceptors        |
| react-hook-form     | 7.x     | Form state management                |
| @hookform/resolvers | 3.x     | Zod integration for forms            |
| zod                 | 3.x     | Schema validation                    |
| @dnd-kit/core       | 6.x     | Drag-and-drop (assessment wizard)    |
| react-hot-toast     | 2.x     | Toast notifications                  |
| date-fns            | 4.x     | Date formatting + calendar utilities |
| read-excel-file     | 9.x     | Excel file parsing (question import) |

---

## Project Structure

```
src/
├── App.tsx                        # Root routing tree (lazy-loaded pages)
├── main.tsx                       # Entry point — Redux Provider + BrowserRouter + Toaster
│
├── assets/
│   └── icons/
│       └── index.tsx              # 45+ SVG icon components via factory function
│
├── components/
│   ├── layout/
│   │   ├── AdminLayout/           # Auth guard + Sidebar + AppHeader + <Outlet>
│   │   ├── AppHeader/             # Sticky global header: greeting, bell, calendar, theme, user
│   │   ├── Header/                # Per-page title + subtitle + actions slot
│   │   ├── Sidebar/               # Fixed left nav (theme-aware); collapse with ⋮ toggle
│   │   └── WorkspaceSwitcher/     # Popup: switch workspace, settings, invite, create
│   ├── notifications/
│   │   ├── NotificationItem/      # Single notification row (type dot, title, message, time)
│   │   └── NotificationDropdown/  # Desktop popup (portal, anchored to bell icon)
│   ├── calendar/
│   │   └── CalendarPopup/         # Custom monthly calendar + embedded interview scheduler
│   ├── shared/
│   │   └── FilterBar.tsx          # Reusable search + sort + view-mode + filter bar
│   └── ui/
│       ├── Badge/                 # Badge, ComplexityBadge, StatusBadge
│       ├── Button/                # Button (variants: primary/secondary/ghost/danger/success)
│       ├── Input/                 # Input + Textarea (with left/right element slots)
│       ├── Modal/                 # Portal modal (sizes: sm/md/lg/xl/full)
│       ├── Pagination/            # Smart pagination with ellipsis
│       ├── Select/                # Styled select dropdown
│       ├── Spinner/               # Loading spinner + PageLoader
│       └── Toggle/                # Boolean toggle switch
│
├── constants/
│   ├── app.ts                     # DEFAULT_PAGE_SIZE, AVATAR_COLORS, option lists
│   └── routes.ts                  # ROUTES constant map
│
├── features/
│   ├── auth/
│   │   └── pages/AdminLoginPage   # Admin email/password login
│   ├── dashboard/
│   │   └── DashboardPage          # Redirects to active workspace assessments
│   ├── notifications/
│   │   └── pages/NotificationsPage   # Mobile/tablet paginated notifications list
│   ├── profile/
│   │   └── pages/UserProfilePage     # Edit profile, change password
│   ├── questionBank/
│   │   └── pages/
│   │       ├── CategoriesPage     # CRUD for question categories
│   │       └── QuestionsPage      # CRUD + AI generate + Excel import
│   ├── assessments/
│   │   ├── pages/
│   │   │   ├── AssessmentsPage    # List + share + clone + delete assessments
│   │   │   └── AssessmentDetailPage  # Submissions table + re-access + export
│   │   └── components/
│   │       └── CreateWizard/
│   │           ├── WizardContainer   # 2-step modal wizard
│   │           ├── Step1BasicInfo    # Name, rounds config, Normal vs Monitoring mode
│   │           └── Step2Questions    # Dual-pane question selector with filters
│   ├── liveInterviews/
│   │   └── pages/LiveInterviewsPage  # 15-second polling; active session cards
│   ├── users/
│   │   └── pages/UsersPage           # Super-admin: list + create admin users
│   └── candidate/
│       └── pages/
│           ├── CandidateLoginPage    # Candidate sign-in
│           ├── RegisterPage          # Candidate registration (full profile)
│           ├── InstructionsPage      # Rules + stats + camera permission setup
│           ├── InterviewPage         # Exam UI (timer, questions, tab detection)
│           └── CompletedPage         # Submission confirmation
│
├── hooks/
│   ├── useApi.ts           # Generic fetch hook with AbortController
│   ├── useClickOutside.ts  # Fires handler when click lands outside a ref
│   ├── useDebounce.ts      # Debounces a value by N ms
│   ├── useMediaQuery.ts    # Reactive window.matchMedia wrapper
│   └── usePagination.ts    # page, pageSize, goToPage, reset, changePageSize
│
├── store/
│   ├── index.ts            # configureStore + useAppDispatch + useAppSelector
│   └── slices/
│       ├── authSlice.ts          # adminLogin, candidateLogin, candidateRegister; logout
│       ├── workspaceSlice.ts     # setActiveWorkspace, setWorkspaces, clearWorkspace
│       ├── uiSlice.ts            # toggleTheme, setTheme, toggleSidebar
│       └── notificationSlice.ts  # markAsRead, markAllAsRead, addNotification
│
├── styles/
│   ├── variables.css       # All CSS custom properties (colors, radius, shadows, layout)
│   └── globals.css         # Reset, Inter font, scrollbar, .page-container
│
├── types/
│   └── index.ts            # All TypeScript interfaces and type aliases
│
└── utils/
    ├── api.ts              # Axios instance — Bearer token + auto refresh with queue
    └── helpers.ts          # getAvatarColor, getInitials, formatDate/DateTime, …
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment file
cp .env.example .env

# 3. Start development server (proxies /api → localhost:8000)
npm run dev

# 4. Build for production
npm run build
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

The Vite proxy in `vite.config.ts` forwards all `/api` requests to `http://localhost:8000` in development.

---

## Routing

All routes are defined in `src/App.tsx`. Pages are **lazy-loaded** via `React.lazy` + `Suspense`.

| Path                                             | Component            | Auth            |
| ------------------------------------------------ | -------------------- | --------------- |
| `/admin/login`                                   | AdminLoginPage       | Public          |
| `/candidate/login`                               | CandidateLoginPage   | Public          |
| `/candidate/register`                            | RegisterPage         | Public          |
| `/assessment/:shareLink/instructions`            | InstructionsPage     | Candidate JWT   |
| `/assessment/:shareLink/interview/:submissionId` | InterviewPage        | Candidate JWT   |
| `/assessment/:shareLink/completed`               | CompletedPage        | Public          |
| `/dashboard`                                     | DashboardPage        | Admin JWT       |
| `/question-bank`                                 | CategoriesPage       | Admin JWT       |
| `/question-bank/:categoryId`                     | QuestionsPage        | Admin JWT       |
| `/workspaces/:workspaceId/assessments`           | AssessmentsPage      | Admin JWT       |
| `/workspaces/:workspaceId/assessments/:id`       | AssessmentDetailPage | Admin JWT       |
| `/live-interviews`                               | LiveInterviewsPage   | Admin JWT       |
| `/profile`                                       | UserProfilePage      | Admin JWT       |
| `/notifications`                                 | NotificationsPage    | Admin JWT       |
| `/users`                                         | UsersPage            | Super Admin JWT |

**Guard:** `AdminLayout` redirects unauthenticated users to `/admin/login`. Candidates attempting admin routes are redirected to `/login`.

---

## State Management

### Redux Slices

#### `authSlice`
Persists to `localStorage` — keys: `talentia_access`, `talentia_refresh`, `talentia_user`.

```ts
adminLogin({ email, password })
candidateLogin({ email, password })
candidateRegister({ name, email, phone, ... })
logout()       // clears storage + calls /api/auth/logout
updateUser()   // update profile in state + storage
```

#### `workspaceSlice`
Active workspace persists to `localStorage` key `talentia_workspace`.

```ts
setActiveWorkspace(workspace)
setWorkspaces(workspaces[])
clearWorkspace()
```

#### `uiSlice`
Theme persists to `localStorage` key `talentia_theme`.

```ts
toggleTheme(); // light ↔ dark
setTheme("light" | "dark");
toggleSidebar();
```

#### `notificationSlice`
In-memory only (no persistence). Initialised with mock data until a backend
`GET /api/notifications` endpoint is added.

```ts
markAsRead(id)      // mark one notification read
markAllAsRead()     // mark all read
addNotification(n)  // push a new notification (for real-time integration)
clearNotifications()
```

State shape: `{ notifications: Notification[], unreadCount: number }`

---

## Authentication & Token Handling

The Axios instance in `src/utils/api.ts`:

1. **Request interceptor** — Reads `talentia_access` from `localStorage`, sets `Authorization: Bearer <token>`.
2. **Response interceptor** — On `401`, suspends the failed request, calls `POST /api/auth/refresh` once, then replays all queued requests with the new token. If refresh fails, dispatches `logout()`.

---

## Theming (Light / Dark Mode)

The theme is applied as a `data-theme` attribute on `<html>`:

```html
<html data-theme="dark"></html>
```

All visual tokens are CSS custom properties in `src/styles/variables.css`. Dark overrides are scoped under `[data-theme='dark']`. Components never hardcode colors — always use `var(--token-name)`.

**Key token groups:**

- `--primary-{50..900}` — Blue scale
- `--accent-{50..900}` — Purple scale
- `--success/warning/error-{50..900}` — Semantic colors
- `--bg-surface`, `--bg-muted`, `--bg-page` — Background layers
- `--text-primary`, `--text-secondary`, `--text-tertiary` — Text hierarchy
- `--border-default`, `--border-strong` — Border weights
- `--sidebar-bg`, `--sidebar-text`, `--sidebar-active-text` — Sidebar tokens (theme-aware: white in light, dark in dark mode)
- `--header-height: 64px` — Sticky header height
- `--z-sidebar: 100`, `--z-header: 95`, `--z-dropdown: 150`, `--z-modal: 200` — Z-index scale

---

## Application Shell

The admin shell is structured as:

```
AdminLayout
├── Sidebar (position: fixed; left; full height; theme-aware)
│   ├── Logo + ⋮ collapse toggle (three-dot vertical)
│   ├── WorkspaceSwitcher
│   └── Navigation links
└── .main (margin-left: sidebar-width)
    ├── AppHeader (position: sticky; top: 0; full width of .main)
    │   ├── Left: "Welcome, {firstName}" greeting + current date
    │   └── Right: Bell → NotificationDropdown | /notifications
    │           Calendar → CalendarPopup (custom monthly + scheduler)
    │           Theme toggle (☀/🌙)
    │           Avatar → UserProfileMenu (Edit Profile | Logout)
    └── .content — <Outlet /> (page content with Header + page body)
```

### AppHeader behaviour

| Trigger | Desktop (≥1025px) | Mobile / Tablet |
|---------|------------------|-----------------|
| Bell icon | Animated dropdown popup anchored to button | Navigate to `/notifications` |
| Calendar icon | Popup with custom monthly calendar | Same popup (responsive) |
| Avatar | Dropdown: "Edit Profile" → `/profile`; "Logout" | Same |

### NotificationDropdown

- Renders via `createPortal` to `document.body`
- Position calculated from the bell button's `getBoundingClientRect()`
- Lists all notifications with `NotificationItem` components
- "Mark all read" button when unread count > 0
- Empty state UI
- "View all" footer → `/notifications`
- _Note:_ Replace the scrollable `<div>` with `react-window <FixedSizeList>` if notification count regularly exceeds 200 items.

### CalendarPopup

- Custom branded monthly calendar (not the browser `<input type="date">`)
- Built with `date-fns` — no additional calendar library needed
- Features: month navigation, today highlight, past-date disabled, date selection
- After selecting a date, transitions to the **Interview Scheduler** view inline:
  - Candidate name, email, time slot grid, notes
  - _TODO:_ Connect to `POST /api/interviews/schedule` once the backend endpoint is added

### Sidebar changes (v2)

- Removed the embedded user profile section from the bottom
- Profile editing moved to `/profile` (UserProfilePage)
- Collapse toggle now uses a `⋮` (three-dot vertical) icon instead of chevrons
- Sidebar is fully **theme-aware**: white/light in light mode, dark in dark mode

---

## Component Library

### Button

```tsx
<Button
  variant="primary | secondary | ghost | danger | success"
  size="sm | md | lg"
  isLoading={bool}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  fullWidth={bool}
>
  Label
</Button>
```

### Input / Textarea

```tsx
<Input
  label="Field Label"
  placeholder="..."
  error="Validation message"
  hint="Helper text"
  leftElement={<Icon />}
  rightElement={<button />}
  showRequired
  {...register("fieldName")}
/>
```

### Modal

```tsx
<Modal
  isOpen={bool}
  onClose={() => setShow(false)}
  title="Modal Title"
  size="sm | md | lg | xl | full"
  footer={<><Button>Cancel</Button><Button>Confirm</Button></>}
>
  {/* content */}
</Modal>
```

### NotificationItem

```tsx
<NotificationItem notification={notification} onRead={(id) => dispatch(markAsRead(id))} />
```

---

## Icon System

All icons live in `src/assets/icons/index.tsx` (factory pattern, SVG stroke-based).

```tsx
import { IconBell, IconCalendar, IconDotsVertical, IconPlus } from "@/assets/icons";

<IconBell size={20} color="var(--text-secondary)" />
```

**New icons added in v2:** `IconBell`, `IconCalendar`, `IconDotsVertical`

Full icon list: `IconDashboard`, `IconWorkspace`, `IconQuestionBank`, `IconAssessment`, `IconLiveInterview`, `IconSearch`, `IconFilter`, `IconSort`, `IconSortAsc`, `IconSortDesc`, `IconGrid`, `IconList`, `IconPlus`, `IconEdit`, `IconDelete`, `IconClose`, `IconCheck`, `IconChevronDown/Right/Left/Up`, `IconSettings`, `IconUserPlus`, `IconUsers`, `IconShare`, `IconCopy`, `IconMail`, `IconDownload`, `IconUpload`, `IconEye`, `IconEyeOff`, `IconLock`, `IconLogout`, `IconMoon`, `IconSun`, `IconCamera`, `IconMic`, `IconMonitor`, `IconClone`, `IconRefresh`, `IconExternalLink`, `IconAlertTriangle`, `IconInfo`, `IconDrag`, `IconWhatsApp`, `IconBrain`, `IconFileExcel`, `IconTime`, `IconGlobe`, `IconShield`, **`IconBell`**, **`IconCalendar`**, **`IconDotsVertical`**

---

## Feature Modules

### Profile (`/profile`)

Full-page profile editor (moved from the old sidebar popup):
- Avatar with initials + role badge
- Editable: first name, last name, default workspace
- Read-only: email, role
- Password change via Modal (`PATCH /api/users/me`)

### Notifications (`/notifications`)

Mobile-first paginated notification list (10 per page). On desktop the `NotificationDropdown` in the header is used instead.

### Question Bank, Assessments, Live Interviews, Users

_(unchanged — see previous documentation)_

---

## Candidate Portal Flow

```
/candidate/login  or  /candidate/register
          ↓
/assessment/:shareLink/instructions
          ↓
/assessment/:shareLink/interview/:submissionId
          ↓
/assessment/:shareLink/completed
```

_(unchanged)_

---

## API Utility

```ts
import { api } from "@/utils/api";

const { data } = await api.get("/api/questions/categories");
const { data } = await api.post("/api/questions", { ... });
await api.patch("/api/users/me", { first_name: "John" });
await api.delete(`/api/questions/${id}`);
```

All API responses follow the shape: `{ success: boolean, message: string, data: T }`

---

## Hooks

### `useClickOutside(ref, handler, enabled?)`

Fires `handler` when a pointer-down event lands outside `ref`. Accepts an optional `enabled` flag to disable during closed state. Used by notification dropdown, calendar popup, and profile menu.

### `useMediaQuery(query): boolean`

Reactive `window.matchMedia` wrapper. Re-evaluates when the viewport changes.
```ts
const isDesktop = useMediaQuery("(min-width: 1025px)");
```

### `useDebounce<T>(value, delay): T`

Returns a debounced copy of `value` (default 300 ms).

### `usePagination(initialPageSize?)`

```ts
const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
```

### `useApi<T>(url, options)`

Generic fetch hook with AbortController. Cancels in-flight requests on dependency change.

---

## CSS Conventions

- Every component uses **CSS Modules** (`.module.css` co-located).
- Never hardcode color values — always use `var(--token)`.
- Global utilities in `styles/globals.css` (`.page-container`, `.sr-only`, `.truncate`).
- Responsive breakpoints:
  - Mobile: `max-width: 480px`
  - Tablet: `max-width: 768px`
  - Desktop: 1025px+

### CSS Variable Naming Pattern

```
--{category}-{scale}
--primary-600        → main brand blue
--error-50           → error background tint
--bg-surface         → card / panel background
--text-tertiary      → muted / hint text
--shadow-sm/md/lg    → elevation system
--radius-sm/md/lg/xl → border radius scale
--transition-fast    → 150ms ease
--header-height      → 64px (sticky AppHeader)
--sidebar-width      → set dynamically via JS (225px expanded / 65px collapsed)
```

---

## Adding a New Feature

1. Create folder: `src/features/<feature-name>/pages/`
2. Add page component: `<PageName>.tsx` + `<PageName>.module.css`
3. Add lazy import in `src/App.tsx`
4. Add route under `<AdminLayout>` in `src/App.tsx`
5. Add nav link in `src/components/layout/Sidebar/index.tsx` if needed
6. Add API calls via `import { api } from '@/utils/api'`
7. Follow existing pagination pattern: `usePagination` + `useDebounce` + `useCallback` fetch

---

## Scripts

| Command                  | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | Start Vite dev server on port 5173                |
| `npm run build`          | Type-check + build to `dist/`                     |
| `npm run preview`        | Preview production build locally                  |
| `npm run lint`           | Run ESLint on all `.ts`/`.tsx` files (0 warnings) |
| `npm run format`         | Prettier format all `src/**/*.{ts,tsx,css}`       |
| `npm run format:check`   | Prettier check without writing (CI use)           |

---

## Code Quality & Linting

Config: `eslint.config.mjs` (ESLint 9 flat config). Prettier: 100-char limit, double quotes, 2-space indentation.

```bash
npm run lint            # must pass with 0 warnings
npm run format          # format all src files in-place
npm run build           # also runs tsc — all type errors must resolve
```
