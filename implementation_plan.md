# Production Readiness Plan — All 10 Pages

## Background

This plan covers everything needed to take the `review-alsherif-merge` branch to a production-ready state before merging to `main`. It goes beyond the basic audit to include SEO, accessibility, error boundaries per page, mobile UX, performance, and the remaining API stubs.

All changes are **frontend-only** unless explicitly stated.

---

## User Review Required

> [!IMPORTANT]
> **Assignee unassign behavior**: `PATCH /tasks/:id` — does `{ assigneeId: null }` clear the assignee, or should the field be omitted entirely? Verify in `tasks.service.ts` before wiring the select.

> [!WARNING]
> **CSRF token staleness**: The `apiClient` caches `csrfToken` in a module-level variable with no expiry. If the backend rotates CSRF tokens, all subsequent mutations will 403. This needs a TTL or re-fetch on 403.

> [!NOTE]
> **`GET /analytics/tasks` response shape**: The backend may not return a `breakdown` key by priority. Confirm the response shape at `http://localhost:3000/api/docs` before using it for the priority chart.

---

## Tier 1 — Critical Bugs (Must Fix)

### 1.1 — TaskDetailsPage: Assignee dropdown disabled

**Problem**: The assignee `<select>` has `disabled` hardcoded in `buildActionBar()`. The `onchange` handler displays an error message instead of calling the API. `PATCH /tasks/:id` accepts `{ assigneeId }`.

#### [MODIFY] [TaskDetailsPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TaskDetailsPage.jsx)

- Remove `disabled` attribute from assignee select in `buildActionBar()` (line ~242)
- Change `background: '#f8fafc'` to `background: 'white'` and `cursor: 'not-allowed'` to `cursor: 'pointer'`
- Replace the `assigneeSelect.onchange` stub (line ~450) with a real `applyTaskUpdate({ assigneeId: value || null })`

```diff
- <select data-task-control="assignee" disabled style="...cursor:not-allowed;background:#f8fafc;">
+ <select data-task-control="assignee" style="...cursor:pointer;background:white;">
```

```diff
- assigneeSelect.onchange = () => {
-   setFeedback('Assignee changes are not exposed by the current backend task API.', 'error');
- };
+ assigneeSelect.onchange = async (event) => {
+   try {
+     await applyTaskUpdate({ assigneeId: event.target.value || null });
+     setFeedback('Assignee updated.', 'success');
+   } catch (error) {
+     setFeedback(error.message || 'Unable to update assignee.', 'error');
+   }
+ };
```

---

### 1.2 — apiClient: CSRF Token Staleness

**Problem**: `csrfToken` is a module-level variable with no TTL. After long sessions or token rotation, all mutations return 403. 

#### [MODIFY] [apiClient.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/services/api/apiClient.js)

- Add a timestamp to `csrfToken` cache
- Re-fetch if older than 15 minutes or if a 403 is received on a mutation

```diff
- let csrfToken = null;
+ let csrfTokenValue = null;
+ let csrfTokenFetchedAt = 0;
+ const CSRF_TTL_MS = 15 * 60 * 1000;

  export const getCsrfToken = async (force = false) => {
-   if (csrfToken) return csrfToken;
+   const isStale = Date.now() - csrfTokenFetchedAt > CSRF_TTL_MS;
+   if (csrfTokenValue && !isStale && !force) return csrfTokenValue;
    const response = await axios.get(...);
-   csrfToken = response.data?.data?.csrfToken;
-   return csrfToken;
+   csrfTokenValue = response.data?.data?.csrfToken;
+   csrfTokenFetchedAt = Date.now();
+   return csrfTokenValue;
  };
```

Also add to the response error interceptor: if `status === 403` and `config.method` is in `unsafeMethods`, re-fetch CSRF and retry once.

---

### 1.3 — Analytics Stubs Wired to Real Endpoints

**Problem**: `getSlaMetrics()` and `getWorkflowAnalytics()` return `{}` hardcoded. Dashboard shows `--` for SLA and Workflow Bottleneck metrics.

#### [MODIFY] [analyticsService.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/services/api/analyticsService.js)

```diff
- export const getSlaMetrics = async () => ({});
- export const getWorkflowAnalytics = async () => ({});

+ export const getSlaMetrics = async (spaceId) => {
+   const response = await apiClient.get('/analytics/overview', { params: { spaceId } });
+   return response.data || {};
+ };

+ export const getWorkflowAnalytics = async (spaceId) => {
+   const response = await apiClient.get('/analytics/tasks', {
+     params: { spaceId, period: 'month' },
+   });
+   return response.data || {};
+ };
```

Also improve `getDashboardPriorityBreakdown` to try the analytics endpoint first, fall back to client-side task counting:

```diff
  export const getDashboardPriorityBreakdown = async (spaceId) => {
+   try {
+     const response = await apiClient.get('/analytics/tasks', {
+       params: { spaceId, period: 'month', groupBy: 'priority' },
+     });
+     const items = toArrayPayload(response.data, ['breakdown', 'data', 'items']);
+     if (items.length) return items;
+   } catch { /* fall through to client-side */ }
    const tasks = await tasksService.searchTasks('', spaceId, { limit: 100 });
    ...
  };
```

Update callers in `useDashboardQueries.js` to pass `spaceId` to all three functions:

```diff
- analyticsService.getSlaMetrics(spaceId).catch(() => ({})),
- analyticsService.getWorkflowAnalytics(spaceId).catch(() => ({})),
```
_(already passed but verify `spaceId` is threaded correctly)_

---

## Tier 2 — Missing Production Features

### 2.1 — Onboarding: Fetch Templates from Backend

**Problem**: `useOnboardingTemplatesQuery` returns `[]` hardcoded. Backend has `GET /onboarding/templates`.

#### [MODIFY] [useOnboardingQueries.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/hooks/useOnboardingQueries.js)

```diff
+ import apiClient from '../services/api/apiClient';

  export function useOnboardingTemplatesQuery() {
    return useQuery({
      queryKey: ['onboarding', 'templates'],
-     queryFn: async () => [],
+     queryFn: async () => {
+       try {
+         const response = await apiClient.get('/onboarding/templates');
+         return Array.isArray(response.data) ? response.data : [];
+       } catch {
+         return [];
+       }
+     },
      staleTime: Infinity,
    });
  }
```

#### [MODIFY] [OnboardingPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/onboarding/OnboardingPage.jsx)

- Import and call `useOnboardingTemplatesQuery`
- Merge backend templates with hardcoded fallback list (use backend if available, fallback if empty)
- Show a spinner on step 2 while templates load

---

### 2.2 — TaskDetailsPage: File Download Links

**Problem**: The `hydrateAttachments()` function shows file names but no download links. Backend exposes `GET /files/:fileId/download`.

#### [MODIFY] [TaskDetailsPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TaskDetailsPage.jsx)

In `renderFiles()`, after `hydrateAttachments`, add download links using `file.id` or `file.url`:

```diff
  const url = file?.url || file?.downloadUrl || file?.fileUrl;
+ const downloadUrl = url || (file?.id
+   ? `${import.meta.env.VITE_API_URL || '/api/v1'}/files/${file.id}/download`
+   : null);
- if (node && url) {
+ if (node && downloadUrl) {
-   node.innerHTML = `<a href="${url}" ...>...</a>`;
+   node.innerHTML = `<a href="${downloadUrl}" target="_blank" ...>...</a>`;
  }
```

---

### 2.3 — Navbar: Ctrl+K Search Actually Works

**Problem**: The unified search bar in the top `Navbar` renders a styled input but pressing Enter does nothing — it's not wired to `SearchPage` or the AI.

#### [MODIFY] [Navbar.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/components/layout/Navbar.jsx)

- Add `useNavigate` hook
- On `onKeyDown` (Enter or Ctrl+K), navigate to `/search?q=<value>`
- Add `keydown` global listener for `Ctrl+K` to focus the input

```diff
+ const navigate = useNavigate();
+ const inputRef = useRef(null);

+ useEffect(() => {
+   const handler = (e) => {
+     if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
+       e.preventDefault();
+       inputRef.current?.focus();
+     }
+   };
+   window.addEventListener('keydown', handler);
+   return () => window.removeEventListener('keydown', handler);
+ }, []);
```

```diff
  <input
+   ref={inputRef}
+   onKeyDown={(e) => {
+     if (e.key === 'Enter' && e.target.value.trim()) {
+       navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
+       e.target.value = '';
+     }
+   }}
    ...
  />
```

---

### 2.4 — Landing Page: Mobile Hamburger Menu

**Problem**: `OuterNavbar.jsx` hides nav links and CTA buttons on mobile (`lg:hidden`, `hidden lg:flex`) but there is no hamburger menu for small screens.

#### [MODIFY] [OuterNavbar.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/components/landing/OuterNavbar.jsx)

- Add `useState` for `menuOpen`
- Add a hamburger button visible on `< lg`
- Add a slide-down mobile menu that shows nav links + Login + Get Started when `menuOpen`

---

### 2.5 — Navbar: Close User Menu on Outside Click

**Problem**: The user menu dropdown in `Navbar.jsx` opens on click but never closes when clicking outside of it.

#### [MODIFY] [Navbar.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/components/layout/Navbar.jsx)

- Add a `useEffect` with a `mousedown` listener on `document`
- Use a `ref` on the dropdown container to detect outside clicks and call `setShowUserMenu(false)`

---

### 2.6 — QueryClient: Retry Strategy for Auth Failures

**Problem**: `queryClient.js` has `retry: 3` globally. Auth errors (401, 403) should not be retried at all — this causes 3 redundant requests on every protected page before showing the login redirect.

#### [MODIFY] [queryClient.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/lib/queryClient.js)

```diff
  defaultOptions: {
    queries: {
-     retry: 3,
+     retry: (failureCount, error) => {
+       const status = error?.response?.status;
+       if (status === 401 || status === 403 || status === 404) return false;
+       return failureCount < 2;
+     },
```

---

### 2.7 — TableView: Search Input Debounce

**Problem**: `TableView.jsx` fires a new API request on every keystroke in the search field. At 10ms per key, a 10-char query makes 10 round trips.

#### [MODIFY] [TableView.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TableView.jsx)

- Replace immediate `setSearch` with a debounced version (300ms)

```diff
+ import { useDeferredValue } from 'react';

  const [search, setSearch] = useState('');
+ const deferredSearch = useDeferredValue(search);

  const filters = useMemo(() => ({
-   ...(search.trim() ? { search: search.trim() } : {}),
+   ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
  }), [...]);
```

---

## Tier 3 — SEO, Accessibility & Polish

### 3.1 — index.html: Rich Meta Tags

**Problem**: `index.html` has a single generic `<meta name="description" content="Mongez">`. Missing `og:image`, `twitter:card`, proper title.

#### [MODIFY] [index.html](file:///c:/Users/Thomas/Code/Mongez/frontend/index.html)

Add:
```html
<title>Mongez — AI-Powered Project Management for NGOs</title>
<meta name="description" content="Mongez uses AI to manage projects, detect risks, and automate execution for NGOs and organizations." />
<meta property="og:title" content="Mongez — AI Project Management" />
<meta property="og:description" content="AI-powered task management, risk detection and workflow automation." />
<meta property="og:image" content="/og-image.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Mongez — AI Project Management" />
<meta name="theme-color" content="#0ea5e9" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

---

### 3.2 — Landing Page: Semantic & Accessibility Gaps

#### [MODIFY] [HeroSection.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/landing/sections/HeroSection.jsx)

- Add `aria-label="Product preview"` to the mock dashboard `<div>`
- The "Get Started" `<a href="#features">` should be `<a href="/register">` for a real CTA

#### [MODIFY] [OuterNavbar.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/components/landing/OuterNavbar.jsx)

- Wrap nav links in `<nav aria-label="Main navigation">`
- Add `role="navigation"` to the header

---

### 3.3 — ResetPasswordPage / VerifyEmailPage: Auto-focus First Input

**Problem**: On page load, the email/password input is not auto-focused — users must click.

#### [MODIFY] [ResetPasswordPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/auth/ResetPasswordPage.jsx)
#### [MODIFY] [VerifyEmailPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/auth/VerifyEmailPage.jsx)

Add `autoFocus` prop to the primary input in each form.

---

### 3.4 — Dashboard: Loading Skeleton Instead of "..." Text

**Problem**: `KpiCard` shows `"..."` as the value while loading. This is not accessible and looks unpolished.

#### [MODIFY] [DashboardPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/DashboardPage.jsx)

Replace `loading ? "..." : value` with a proper skeleton element:

```diff
- <div className="kpi-value">{loading ? "..." : `${value}${suffix}`}</div>
+ <div className="kpi-value" aria-busy={loading}>
+   {loading
+     ? <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-slate-200" aria-hidden="true" />
+     : `${value}${suffix}`}
+ </div>
```

---

### 3.5 — Onboarding: Page Title Update per Step

**Problem**: The browser tab shows "Mongez" throughout all 3 onboarding steps — not useful.

#### [MODIFY] [OnboardingPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/onboarding/OnboardingPage.jsx)

```diff
+ useEffect(() => {
+   const titles = ['Create Workspace', 'Choose Template', 'Invite Team'];
+   document.title = `${titles[step - 1]} — Mongez`;
+   return () => { document.title = 'Mongez'; };
+ }, [step]);
```

---

### 3.6 — BillingPage: Refresh Button After Error

**Problem**: When billing fails to load (e.g. 500 from `/subscriptions/plan`), the error is shown but the Refresh button resets error state and triggers `billingQuery.refetch()`. The Refresh button is already wired — ✅ — but the error state is not cleared on refetch start.

#### [MODIFY] [BillingPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/BillingPage.jsx)

```diff
  <button
    type="button"
    onClick={() => {
+     setError('');
      billingQuery.refetch();
    }}
  >
```

---

### 3.7 — TimelineView: `boardId` Redirect Guard

**Problem**: If `boardId` is missing from the URL and `activeBoard` is also null (no boards loaded yet), `TimelineView` shows an empty grid but no message.

#### [MODIFY] [TimelineView.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TimelineView.jsx)

Add an early return after loading:
```diff
  if (!boardIdValue && !loading) {
+   return (
+     <div className="flex h-full items-center justify-center text-slate-400 text-sm">
+       Select a board from the sidebar to view its timeline.
+     </div>
+   );
  }
```

---

### 3.8 — TaskDetailsPage: Error Boundary Wrapper

**Problem**: If `ReferencePage` throws during HTML parsing, the error propagates up to the root `ErrorBoundary`. The task detail page should have its own boundary.

#### [MODIFY] [TaskDetailsPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TaskDetailsPage.jsx)

```diff
+ import ErrorBoundary from '../../components/error-boundary/ErrorBoundary';

  function TaskDetailsPage() { ... }

- export default TaskDetailsPage;
+ export default function TaskDetailsPageWithBoundary() {
+   return (
+     <ErrorBoundary fallbackMessage="Unable to load task details. Try refreshing the page.">
+       <TaskDetailsPage />
+     </ErrorBoundary>
+   );
+ }
```

---

### 3.9 — AiAssistantPage: Loading State for Dashboard

**Problem**: On first load, the AI dashboard tab shows empty cards with no loading indicator while `useAiDashboardQuery` is pending.

#### [MODIFY] [AiAssistantPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/aiChat/AiAssistantPage.jsx)

- When `dashboardQuery.isLoading` is true and the Overview tab is active, show skeleton rows instead of empty metric cards

---

### 3.10 — AI Page: Chat Input Character Limit Display

**Problem**: The chat textarea has no visible character limit. The backend `ChatRequestDto` likely has a max length. Long prompts are silently truncated or 400'd.

#### [MODIFY] [AiAssistantPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/aiChat/AiAssistantPage.jsx)

- Add `maxLength={2000}` to the chat textarea
- Show a `{input.length}/2000` counter below it, turning red at 1800+

---

## File Change Summary

| File | Tier | Change |
|------|------|--------|
| [TaskDetailsPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TaskDetailsPage.jsx) | 1 | Assignee update enabled; file download links; error boundary |
| [apiClient.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/services/api/apiClient.js) | 1 | CSRF token TTL + 403 re-fetch retry |
| [analyticsService.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/services/api/analyticsService.js) | 1 | Wire SLA, workflow, priority breakdown to real endpoints |
| [useOnboardingQueries.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/hooks/useOnboardingQueries.js) | 2 | Fetch templates from `GET /onboarding/templates` |
| [OnboardingPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/onboarding/OnboardingPage.jsx) | 2 | Use backend templates + page title per step |
| [Navbar.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/components/layout/Navbar.jsx) | 2 | Ctrl+K search wired; outside-click closes user menu |
| [OuterNavbar.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/components/landing/OuterNavbar.jsx) | 2 | Mobile hamburger menu + ARIA nav |
| [queryClient.js](file:///c:/Users/Thomas/Code/Mongez/frontend/src/lib/queryClient.js) | 2 | Smart retry — skip on 401/403/404 |
| [TableView.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TableView.jsx) | 2 | Debounce search input with `useDeferredValue` |
| [index.html](file:///c:/Users/Thomas/Code/Mongez/frontend/index.html) | 3 | Rich meta tags, OG image, Twitter card, theme color |
| [HeroSection.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/landing/sections/HeroSection.jsx) | 3 | Get Started → `/register`, ARIA preview label |
| [ResetPasswordPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/auth/ResetPasswordPage.jsx) | 3 | `autoFocus` on email input |
| [VerifyEmailPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/auth/VerifyEmailPage.jsx) | 3 | `autoFocus` on resend button when applicable |
| [DashboardPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/DashboardPage.jsx) | 3 | Animated skeleton in KPI cards during load |
| [BillingPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/BillingPage.jsx) | 3 | Clear error state on refresh click |
| [TimelineView.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/dashboard/TimelineView.jsx) | 3 | "No board selected" empty state |
| [AiAssistantPage.jsx](file:///c:/Users/Thomas/Code/Mongez/frontend/src/pages/aiChat/AiAssistantPage.jsx) | 3 | Dashboard loading skeletons; chat char limit + counter |

---

## Execution Order

1. **Tier 1** — Fix broken functionality (assignee, CSRF, analytics stubs) — ~2 hours
2. **Tier 2** — Add missing production features (templates, search, mobile nav, retry) — ~3 hours
3. **Tier 3** — SEO, a11y, polish — ~2 hours
4. **Verify** — `npm run build` (0 errors), test each page manually

---

## Verification Plan

### Automated
```bash
cd frontend && npm run build    # must exit 0
```

### Manual Checklist
| Page | Test |
|------|------|
| Landing | Mobile < 768px: hamburger menu opens/closes, Get Started → /register |
| Reset Password | Input auto-focuses; "Request" → email sent; "Reset" → password updated, redirect in 1.8s |
| Verify Email | Open with `?token=xxx` → verified; without token → resend button |
| Onboarding | Step 2 shows backend templates (or fallback); complete → redirect to /spaces |
| AI Cockpit | Overview tab shows skeleton while loading; metrics populate; chat counts chars |
| Billing | Works or shows empty state gracefully; Refresh clears error and retries |
| Task Details | Assignee dropdown updates; file names are clickable download links |
| Dashboard | SLA % shows real number; workflow bottleneck shows; KPI cards animate on load |
| Table View | Search 300ms debounced (no rapid refetches in Network tab) |
| Timeline | No boardId → shows "Select a board" message |
| Ctrl+K | Pressing globally focuses search; Enter navigates to /search |
