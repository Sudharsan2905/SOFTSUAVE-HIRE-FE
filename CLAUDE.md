# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Talentia interview platform frontend: React 18 + TypeScript + Vite, Redux Toolkit, React Router 6, Axios, CSS Modules. The git repo root is this directory (`SOFTSUAVE-HIRE-FE`), nested inside the `Talentia` workspace folder. `README.md` has a long walkthrough, but parts are stale (e.g. it lists `liveInterviews`; the code has `liveMonitoring` and `candidates`). Trust the code.

## Commands

```bash
npm run dev            # Vite on :5173, proxies /api, /api/ws, /livekit
npm run build          # tsc && vite build
npm run type-check     # tsc --noEmit
npm run lint           # eslint src --max-warnings 0 (warnings fail)
npm run format:check   # prettier (100 cols, double quotes)
npm run test:run       # vitest run (once); `npm test` is watch mode
npx vitest run src/hooks/useDebounce.test.ts     # single file
npx vitest run -t "test name"                    # single test by name
npm run coverage       # v8 coverage -> ./coverage (feeds Sonar)
```

Pre-commit (husky) runs `lint-staged` (eslint + prettier --check) and a full `tsc --noEmit`, so type errors anywhere block commits. Copy `.env.example` to `.env` first (`VITE_PROXY_TARGET`, `VITE_LIVEKIT_SERVER`, `VITE_GOOGLE_CLIENT_ID`).
Pushes to `main` auto-deploy via SSH (`.github/workflows/deploy.yml`: pull, `npm install`, `npm run build`, reload nginx).

## Architecture

- **No client-side API base URL.** All calls use relative `/api/...` paths. The Vite dev proxy (`vite.config.ts`) forwards `/api` to `VITE_PROXY_TARGET`, `/api/ws` as WebSocket, and `/livekit` to the LiveKit server (path prefix stripped). In production nginx plays the same role. `VITE_PROXY_TARGET` and `VITE_LIVEKIT_SERVER` are Node-side only.
- **Endpoints:** define them in `src/constants/api.ts` (`API_ENDPOINTS`, with builder functions for parameterized paths) and call via the Axios instance in `src/utils/api.ts`. That instance adds the Bearer token and, on 401, runs one `/auth/refresh` and replays queued requests. If refresh fails, it logs out. Responses are shaped `{ success, message, data }`.
- **Constants live in `src/constants/`** (`routes`, `storage` keys, `messages`, `enums`, `validation`, `statusColors`, ...). Each feature also has its own `constants/` folder. Don't inline route strings, storage keys or messages.
- **Routing:** the whole tree is in `src/App.tsx`, with lazy-loaded pages. `AdminLayout` is the auth guard and shell (Sidebar + AppHeader + `<Outlet>`). The candidate flow (`/candidate/*`, `/assessment/:shareLink/...`) is a separate area with its own JWT, context, hooks and services under `src/features/candidate/`.
- **Features** (`src/features/<name>/{pages,components,constants,types}`) are self-contained. Shared UI is in `src/components/{ui,layout,shared,...}`. Global TS types are in `src/types/*.types.ts`, re-exported from `index.ts`.
- **Redux slices** (`src/store/slices`): auth, workspace, ui (theme/sidebar), notification, proctoring. Auth, workspace and theme persist to `localStorage` (keys in `constants/storage`). Use the typed hooks from `src/store/hooks.ts`.
- **Interview/proctoring:** the candidate `InterviewPage` combines a timer, tab and devtools detection (`devtools-detect`), fullscreen (`screenfull`), MediaPipe vision (`@mediapipe/tasks-vision`) and LiveKit video streaming. The admin `liveMonitoring` feature watches these sessions.
- **Theming:** `data-theme` on `<html>`; all colors are CSS variables from `src/styles/variables.css`. Never hardcode colors in CSS Modules.

## Conventions

- Path alias `@/` maps to `src/`.
- Every component is a folder with `index.tsx`, a co-located `X.module.css` and `X.test.tsx`.
- Tests use Vitest + Testing Library in jsdom (`globals: true`). Shared setup, mocks and render helpers are in `src/test/` (`setup.ts`, `mocks.ts`, `utils.tsx`). Check there before writing new mocks.
- Icons come from the factory in `src/assets/icons/index.tsx`.
- Adding a page: create the folder under `src/features/<feature>/pages/`, add a lazy import and route in `App.tsx`, add `ROUTES` and sidebar entries if needed, and use the existing `usePagination` + `useDebounce` list pattern.
