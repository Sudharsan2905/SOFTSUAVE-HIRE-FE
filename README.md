# SOFTSUAVE-HIRE-FE

React + TypeScript frontend for the SoftSuave Hire interview platform.

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
9. [Component Library](#component-library)
10. [Icon System](#icon-system)
11. [Feature Modules](#feature-modules)
12. [Candidate Portal Flow](#candidate-portal-flow)
13. [API Utility](#api-utility)
14. [Hooks](#hooks)
15. [CSS Conventions](#css-conventions)
16. [Adding a New Feature](#adding-a-new-feature)

---

## Tech Stack

| Package               | Version  | Purpose                              |
|-----------------------|----------|--------------------------------------|
| React                 | 18.x     | UI framework                         |
| TypeScript            | 5.x      | Static typing                        |
| Vite                  | 5.x      | Build tool + dev server              |
| Redux Toolkit         | 2.x      | Global state (auth, workspace, ui)   |
| React Router DOM      | 6.x      | Client-side routing                  |
| Axios                 | 1.x      | HTTP client with interceptors        |
| react-hook-form       | 7.x      | Form state management                |
| @hookform/resolvers   | 3.x      | Zod integration for forms            |
| zod                   | 3.x      | Schema validation                    |
| @dnd-kit/core         | 6.x      | Drag-and-drop (assessment wizard)    |
| react-hot-toast       | 2.x      | Toast notifications                  |
| date-fns              | 4.x      | Date formatting utilities            |
| xlsx                  | 0.18.x   | Excel file parsing (question import) |

---

## Project Structure

```
src/
├── App.tsx                        # Root routing tree (lazy-loaded pages)
├── main.tsx                       # Entry point — Redux Provider + BrowserRouter + Toaster
│
├── assets/
│   └── icons/
│       └── index.tsx              # 40+ SVG icon components via factory function
│
├── components/
│   ├── layout/
│   │   ├── AdminLayout/           # Auth guard + sidebar + <Outlet> for admin routes
│   │   ├── Header/                # Page title, subtitle, actions slot, theme toggle
│   │   ├── Sidebar/               # Fixed 260px left nav; workspace nav + global nav
│   │   └── WorkspaceSwitcher/     # Popup: switch workspace, settings, invite, create
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
│   ├── useApi.ts          # Generic fetch hook with AbortController (deduplication)
│   ├── useDebounce.ts     # Debounces a value by N ms
│   └── usePagination.ts   # page, pageSize, goToPage, reset, changePageSize
│
├── store/
│   ├── index.ts           # configureStore + useAppDispatch + useAppSelector
│   └── slices/
│       ├── authSlice.ts       # adminLogin, candidateLogin, candidateRegister thunks; logout
│       ├── workspaceSlice.ts  # setActiveWorkspace, setWorkspaces, clearWorkspace
│       └── uiSlice.ts         # toggleTheme, setTheme, toggleSidebar
│
├── styles/
│   ├── variables.css      # All CSS custom properties (colors, radius, shadows, spacing)
│   └── globals.css        # Reset, Inter font, scrollbar, .page-container
│
├── types/
│   └── index.ts           # All TypeScript interfaces and type aliases
│
└── utils/
    ├── api.ts             # Axios instance — Bearer token + auto refresh with queue
    └── helpers.ts         # getAvatarColor, getInitials, formatDate/DateTime,
                           #   percentageBadgeColor, copyToClipboard, downloadBlob
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
```

The Vite proxy in `vite.config.ts` forwards all `/api` requests to `http://localhost:8000` in development, so `VITE_API_BASE_URL` is only needed for production builds.

---

## Routing

All routes are defined in `src/App.tsx`. Pages are **lazy-loaded** via `React.lazy` + `Suspense`.

| Path | Component | Auth |
|------|-----------|------|
| `/admin/login` | AdminLoginPage | Public |
| `/candidate/login` | CandidateLoginPage | Public |
| `/candidate/register` | RegisterPage | Public |
| `/assessment/:shareLink/instructions` | InstructionsPage | Candidate JWT |
| `/assessment/:shareLink/interview/:submissionId` | InterviewPage | Candidate JWT |
| `/assessment/:shareLink/completed` | CompletedPage | Public |
| `/dashboard` | DashboardPage | Admin JWT |
| `/question-bank` | CategoriesPage | Admin JWT |
| `/question-bank/:categoryId` | QuestionsPage | Admin JWT |
| `/workspaces/:workspaceId/assessments` | AssessmentsPage | Admin JWT |
| `/workspaces/:workspaceId/assessments/:id` | AssessmentDetailPage | Admin JWT |
| `/live-interviews` | LiveInterviewsPage | Admin JWT |
| `/users` | UsersPage | Super Admin JWT |

**Guard:** `AdminLayout` redirects unauthenticated users to `/admin/login`. Candidates attempting admin routes are redirected to `/login`.

---

## State Management

### Redux Slices

#### `authSlice`
Persists to `localStorage` with keys: `ssh_access`, `ssh_refresh`, `ssh_user`.

```ts
// Thunks
adminLogin({ email, password })
candidateLogin({ email, password })
candidateRegister({ name, email, phone, ... })

// Reducers
logout()          // clears storage + calls /api/auth/logout
setTokens()       // updates access token after refresh
updateUser()      // update profile in state + storage
```

#### `workspaceSlice`
Active workspace persists to `localStorage` key `ssh_workspace`.

```ts
setActiveWorkspace(workspace)   // switches active workspace
setWorkspaces(workspaces[])     // loads all workspaces
clearWorkspace()                // on logout
```

#### `uiSlice`
Theme persists to `localStorage` key `ssh_theme`. Initializes from storage or `prefers-color-scheme`.

```ts
toggleTheme()         // light ↔ dark
setTheme('light' | 'dark')
toggleSidebar()
```

---

## Authentication & Token Handling

The Axios instance in `src/utils/api.ts`:

1. **Request interceptor** — Reads `ssh_access` from `localStorage` and sets `Authorization: Bearer <token>`.
2. **Response interceptor** — On `401`, suspends the failed request, calls `POST /api/auth/refresh` once (subsequent 401s queue up), then replays all queued requests with the new token. If refresh fails, dispatches `logout()`.

This prevents multiple simultaneous refresh calls (race condition handled via `isRefreshing` flag + `failedQueue` array).

---

## Theming (Light / Dark Mode)

The theme is applied as a `data-theme` attribute on `<html>`:

```html
<html data-theme="dark">
```

All visual tokens are CSS custom properties in `src/styles/variables.css`. Dark overrides are scoped under `[data-theme='dark']`. Components never hardcode colors — they always use `var(--token-name)`.

**Key token groups:**
- `--primary-{50..900}` — Blue scale
- `--accent-{50..900}` — Purple scale
- `--success/warning/error-{50..900}` — Semantic colors
- `--bg-default`, `--bg-surface`, `--bg-muted` — Background layers
- `--text-primary`, `--text-secondary`, `--text-tertiary` — Text hierarchy
- `--border-default`, `--border-strong` — Border weights
- `--sidebar-bg`, `--sidebar-text`, `--sidebar-active` — Sidebar-specific

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
  disabled={bool}
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
  {...register('fieldName')}
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

### Badge
```tsx
<Badge variant="default | primary | success | warning | error | info | accent">
  Text
</Badge>

<ComplexityBadge complexity="low | medium | high" />
<StatusBadge status="pending | in_progress | completed | malpractice" />
```

### FilterBar
```tsx
<FilterBar
  search={search} onSearchChange={setSearch}
  sortBy={sortBy} onSortByChange={setSortBy}
  sortByOptions={[{ value: 'created_at', label: 'Date' }]}
  sortOrder={sortOrder} onSortOrderToggle={toggleOrder}
  viewMode={viewMode} onViewModeChange={setViewMode}
  showComplexity onComplexityChange={setComplexity}
  showQuestionType onQuestionTypeChange={setType}
>
  {/* custom filters as children */}
</FilterBar>
```

---

## Icon System

All icons live in `src/assets/icons/index.tsx` and are generated by a factory function:

```tsx
const icon = (paths: string[], viewBox = '0 0 24 24') =>
  function Icon({ size = 20, color = 'currentColor', strokeWidth = 1.5, className }: IconProps) { ... }
```

Usage:
```tsx
import { IconPlus, IconEdit, IconDelete } from '@/assets/icons';

<IconPlus size={16} color="var(--primary-600)" />
```

Available icons: `IconDashboard`, `IconWorkspace`, `IconQuestionBank`, `IconAssessment`, `IconLiveInterview`, `IconSearch`, `IconFilter`, `IconSort`, `IconSortAsc`, `IconSortDesc`, `IconGrid`, `IconList`, `IconPlus`, `IconEdit`, `IconDelete`, `IconClose`, `IconCheck`, `IconChevronDown/Right/Left/Up`, `IconSettings`, `IconUserPlus`, `IconUsers`, `IconShare`, `IconCopy`, `IconMail`, `IconDownload`, `IconUpload`, `IconEye`, `IconEyeOff`, `IconLock`, `IconLogout`, `IconMoon`, `IconSun`, `IconCamera`, `IconMic`, `IconMonitor`, `IconClone`, `IconRefresh`, `IconExternalLink`, `IconAlertTriangle`, `IconInfo`, `IconDrag`, `IconWhatsApp`, `IconBrain`, `IconFileExcel`, `IconTime`, `IconGlobe`, `IconShield`

---

## Feature Modules

### Question Bank
- `CategoriesPage` — CRUD for categories. Each category navigates to its `QuestionsPage`.
- `QuestionsPage` — CRUD for questions. Three creation modes:
  - **Manual** — form with type (MCQ single / MCQ multi / Essay), complexity, options with correct flag
  - **AI Generate** — sends topic + count to backend (Anthropic API), displays parsed results for confirmation
  - **Excel Import** — 2-step: upload `.xlsx` → extract column names → map columns to fields (with defaults), import

### Assessments
- `AssessmentsPage` — Lists assessments for the active workspace. Share via copy/email/WhatsApp. Clone and delete.
- **Create Wizard** (2 steps):
  - Step 1: Name, description, rounds (add/remove, question count + duration per round), mode toggle, monitoring config
  - Step 2: Dual-pane — left shows selected questions, right is a browsable question library with filters. Click to toggle selection. Shows selected count vs required.
- `AssessmentDetailPage` — Submissions table: candidate name/email, status badge, score %, round, start time, view detail, re-access button. Export button downloads `.xlsx`.

### Live Interviews
- Polls `GET /api/candidate/live-interviews` every 15 seconds.
- Cards show: live pulse indicator, candidate name/email, assessment name, monitoring badge, current round, screenshot count.
- Monitoring sessions show a camera icon placeholder; normal sessions show an initials avatar.
- Click card → detail modal with screenshot timestamps.

### Users (Super Admin only)
- Lists all admin users (role: admin or super_admin).
- Create new admin users with name, email, temporary password.
- Only rendered in sidebar for `super_admin` role.

---

## Candidate Portal Flow

```
/candidate/login  or  /candidate/register
          ↓
/assessment/:shareLink/instructions
  - fetches assessment info (name, description, rounds, mode)
  - shows duration, question count, round count, mode badge
  - if monitoring mode: shows camera/tab-monitoring requirements
  - "Request Access" button triggers getUserMedia()
  - "Start Assessment" calls POST /api/candidate/assessment/:shareLink/start
          ↓
/assessment/:shareLink/interview/:submissionId
  - fetches current round questions (GET /api/candidate/submission/:id/round)
  - countdown timer auto-submits when it hits 0
  - question navigator sidebar (numbered grid, colored by answered/current/unanswered)
  - MCQ single → radio buttons; MCQ multiple → checkboxes; Essay → textarea
  - answers saved on 500ms debounce (POST /answer)
  - webcam screenshots captured every 30s (POST /screenshot, multipart)
  - tab leave → visibilitychange event → POST /malpractice + warning modal
  - "Submit Round" → POST /finish-round
    → if more rounds: reload questions for next round
    → if complete: navigate to /completed
          ↓
/assessment/:shareLink/completed
  - static confirmation screen
```

---

## API Utility

`src/utils/api.ts` exports a configured Axios instance. Always import this, never use raw `axios`:

```ts
import { api } from '@/utils/api';

const { data } = await api.get('/api/questions/categories');
const { data } = await api.post('/api/questions/categories', { name, description });
const { data } = await api.put(`/api/questions/categories/${id}`, form);
await api.delete(`/api/questions/categories/${id}`);

// File download
const res = await api.get('/api/...export', { responseType: 'blob' });
```

All API responses follow the shape:
```ts
{ success: boolean, message: string, data: T }
```

Error responses additionally include `detail` for debugging.

---

## Hooks

### `useDebounce<T>(value: T, delay: number): T`
Returns a debounced copy of `value`. Used for search inputs to avoid firing an API call on every keystroke.

### `usePagination(initialPageSize?)`
```ts
const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
```
- `goToPage(n)` — navigate to page n
- `reset()` — go back to page 1 (call when filters change)
- `changePageSize(n)` — updates page size + resets to page 1

### `useApi<T>(url, options)`
Generic fetch hook with AbortController. Cancels the previous in-flight request when dependencies change, preventing stale responses from overwriting newer ones.

```ts
const { data, isLoading, error, refetch } = useApi<MyType[]>('/api/endpoint', { immediate: true });
```

---

## CSS Conventions

- Every page/feature uses **CSS Modules** (`.module.css` co-located with the component).
- Never hardcode color values — always use `var(--token)`.
- Global utilities are in `styles/globals.css` (e.g. `.page-container` for max-width + padding).
- Responsive breakpoints:
  - Mobile: `max-width: 640px`
  - Tablet: `max-width: 768px`
  - Desktop: 1024px+

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
```

---

## Adding a New Feature

1. Create folder: `src/features/<feature-name>/pages/`
2. Add page component: `<PageName>.tsx` + `<PageName>.module.css`
3. Add lazy import in `src/App.tsx`
4. Add route under `<AdminLayout>` (or public) in `src/App.tsx`
5. Add nav link in `src/components/layout/Sidebar/index.tsx` if needed
6. Add API calls via `import { api } from '@/utils/api'`
7. Follow existing pagination pattern: `usePagination` + `useDebounce` + `useCallback` fetch

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Type-check + build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on all `.ts`/`.tsx` files |
