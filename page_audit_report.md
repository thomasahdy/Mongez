# Frontend Page Audit Report
_Branch: `review-alsherif-merge` — 2026-06-24_

---

## Summary

| Page | Status | Backend Alignment | Issues |
|------|--------|-------------------|--------|
| Landing Page | ✅ Static | N/A | None |
| Reset Password | ✅ Correct | ✅ Full | None |
| Verify Email | ✅ Correct | ✅ Full | None |
| Onboarding | ✅ Correct | ✅ Full | Minor: templates not fetched from backend |
| AI Assistant | ✅ Correct | ✅ Full | None |
| Billing | ⚠️ Partial | ⚠️ Partial | `getSlaMetrics`, `getWorkflowAnalytics` return `{}` — empty stubs |
| Task Details | ⚠️ Minor | ✅ Full | Assignee update is blocked/disabled |
| Dashboard | ⚠️ Partial | ⚠️ Partial | `getSlaMetrics`, `getWorkflowAnalytics` are stubs |
| Table View | ✅ Correct | ✅ Full | None |
| Timeline View | ✅ Correct | ✅ Full | None |

---

## 1. Landing Page ✅

**File**: `frontend/src/pages/landing/LandingPage.jsx`  
**Type**: Static marketing page  
**Backend**: None required  
**Status**: ✅ Clean. All sections compose correctly. No API calls.

---

## 2. Reset Password ✅

**File**: `frontend/src/pages/auth/ResetPasswordPage.jsx`  
**Hooks**: `useForgotPasswordMutation`, `useResetPasswordMutation`, `useResetTokenVerificationQuery`  
**Service**: `authService.js`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `POST /auth/forgot-password` | `@Post('forgot-password')` | ✅ |
| `POST /auth/reset-password` | `@Post('reset-password')` | ✅ |
| `POST /auth/verify-reset-token` | `@Post('verify-reset-token')` | ✅ |

**Status**: ✅ Fully aligned. Token verification query, dual-mode (request/reset), redirect timer after success — all correct.

---

## 3. Verify Email ✅

**File**: `frontend/src/pages/auth/VerifyEmailPage.jsx`  
**Hooks**: `useVerifyEmailTokenQuery`, `useVerificationStatusQuery`, `useSendVerificationEmailMutation`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `POST /auth/verify-email` | `@Post('verify-email')` | ✅ |
| `GET /auth/verification-status` | `@Get('verification-status')` | ✅ |
| `POST /auth/send-verification` | `@Post('send-verification')` | ✅ |
| `GET /auth/me` | `@Get('me')` | ✅ |

**Status**: ✅ Fully aligned. Resend cooldown (45s), OAuth user detection, redirect to dashboard/login — all correct.

---

## 4. Onboarding ✅ (Minor Issue)

**File**: `frontend/src/pages/onboarding/OnboardingPage.jsx`  
**Hook**: `useOnboardingSetupMutation` → `authService.completeOnboarding`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `POST /auth/complete-onboarding` | `@Post('complete-onboarding')` | ✅ |

**Payload sent**: `{ organization: { name, industry, size, country, prefix }, template, invites }`

> [!NOTE]
> `useOnboardingTemplatesQuery` returns `[]` hardcoded. The backend has `GET /onboarding/templates` — it's not called. Templates are hardcoded in the UI (`project-board`, `ngo-operations`, `blank`). This is intentional (the ids match what the backend accepts).

**Status**: ✅ Functionally correct. Optional improvement: fetch templates from `GET /api/v1/onboarding/templates`.

---

## 5. AI Assistant ✅

**File**: `frontend/src/pages/aiChat/AiAssistantPage.jsx`  
**Hooks**: `useAiDashboardQuery`, `useAiQueries`  
**Service**: `aiService.js`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `GET /ai/dashboard?spaceId=` | `@Get('dashboard')` in ai.controller.ts | ✅ |
| `GET /ai/pending-actions` | `@Get('pending-actions')` | ✅ |
| `PATCH /ai/actions/:id/approve` | `@Patch('actions/:id/approve')` | ✅ |
| `PATCH /ai/actions/:id/reject` | `@Patch('actions/:id/reject')` | ✅ |
| `POST /ai/chat` (SSE stream) | `@Post('chat')` | ✅ |

**Status**: ✅ Fully aligned. Tabbed cockpit layout, Executive Feed, Action Center, metrics — all wired.

---

## 6. Billing ⚠️ Partially Aligned

**File**: `frontend/src/pages/dashboard/BillingPage.jsx`  
**Hook**: `useBillingQuery` → `billingService.getSpaceBilling`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `GET /subscriptions/plan?spaceId=` | `@Get('plan')` | ✅ |
| `GET /subscriptions/usage?spaceId=` | `@Get('usage')` | ✅ |
| `GET /analytics/ai?spaceId=` | `@Get('analytics/ai')` | ✅ |

> [!WARNING]
> **Issue**: The backend `GET /subscriptions/plan` response has `{ tier, limits }`. The frontend maps `tier → name` and `tier → id`. This works but is semantically loose — there is no billing `id` from the backend.

> [!NOTE]
> The Billing page shows a "No plan metadata returned" empty state when the workspace has no subscription. This is acceptable UX and handled gracefully.

**Status**: ⚠️ Functionally works but plan data is sparse. The page gracefully handles missing data.

---

## 7. Task Details ⚠️ Minor Issue

**File**: `frontend/src/pages/dashboard/TaskDetailsPage.jsx`  
**Hooks**: `useTaskDetailsQuery`, `useTaskUpdateMutation`, `useTaskCommentMutation`, `useTaskUploadMutation`, `useTaskDeleteMutation`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `GET /tasks/:id` | `@Get(':id')` in tasks.controller.ts | ✅ |
| `PATCH /tasks/:id` | `@Patch(':id')` | ✅ |
| `POST /tasks/:id/comments` | `@Post(':id/comments')` | ✅ |
| `GET /tasks/:id/comments` | `@Get(':id/comments')` | ✅ |
| `POST /tasks/:id/files` (multipart) | `@Post(':id/files')` | ✅ |
| `GET /tasks/:id/files` | `@Get(':id/files')` | ✅ |
| `DELETE /tasks/:id` | `@Delete(':id')` | ✅ |
| `POST /ai/analyze` (risk) | `@Post('analyze')` | ✅ |

> [!WARNING]
> **Issue**: Assignee dropdown is **disabled** in `buildActionBar()` with the comment "Assignee changes are not exposed by the current backend task API." However, `PATCH /tasks/:id` accepts `{ assigneeId }`. **Fix**: Enable the assignee select and pass `assigneeId` in the update payload.

**Status**: ⚠️ 99% correct. Assignee update is incorrectly blocked.

---

## 8. Dashboard ⚠️ Two Stub Functions

**File**: `frontend/src/pages/dashboard/DashboardPage.jsx`  
**Hook**: `useDashboardAnalyticsQuery` → `analyticsService`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `GET /analytics/overview?spaceId=` | `@Get('analytics/overview')` | ✅ |
| `GET /spaces/:id/audit-logs?limit=6` | `@Get('audit-logs')` in activity.controller.ts | ✅ |
| `GET /analytics/tasks?spaceId=` | `@Get('analytics/tasks')` | ✅ |
| `GET /analytics/team?spaceId=` | `@Get('analytics/team')` | ✅ |
| `GET /analytics/approvals?spaceId=` | `@Get('analytics/approvals')` | ✅ |
| `GET /spaces/:id/stats` | `@Get(':id/stats')` | ✅ |

> [!WARNING]
> **Issue #1**: `getSlaMetrics()` returns `{}` (hardcoded empty). Backend has `GET /analytics/overview` which includes SLA fields. Should map from overview response.
>
> **Issue #2**: `getWorkflowAnalytics()` returns `{}` (hardcoded empty). Backend has workflow data in `GET /analytics/tasks`. Should extract bottleneck/workflow data.

> [!NOTE]
> Priority breakdown (`getDashboardPriorityBreakdown`) calls `searchTasks("", spaceId, { limit: 100 })` — this works but is inefficient. Should use the analytics endpoint when available.

**Status**: ⚠️ Core metrics work. SLA and workflow analytics return empty data.

---

## 9. Table View ✅

**File**: `frontend/src/pages/dashboard/TableView.jsx`  
**Hook**: `useBoardTableQuery`, `useCreateBoardTaskMutation`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `GET /boards/:boardId` | `@Get(':boardId')` | ✅ |
| `GET /boards/:boardId/tasks?page=&limit=&search=&status=` | `@Get(':boardId/tasks')` | ✅ |
| `POST /boards/:boardId/tasks` | `@Post(':boardId/tasks')` | ✅ |

**Features**: Client-side sorting, server-side pagination, search, status filter, inline task creation.

**Status**: ✅ Fully aligned.

---

## 10. Timeline View ✅

**File**: `frontend/src/pages/dashboard/TimelineView.jsx`  
**Hook**: `useTimelineQuery`

### Backend Endpoint Alignment

| Frontend Call | Backend Endpoint | Match |
|---------------|-----------------|-------|
| `GET /boards/:boardId/tasks` | `@Get(':boardId/tasks')` | ✅ |
| `GET /calendar/events?spaceId=&startDate=&endDate=&sources=tasks,events` | `@Get('events')` in calendar.controller.ts | ✅ |

**Features**: Days/Weeks/Months scale switcher, Gantt bars positioned by `startDate`/`endDate`/`dueDate`, calendar event overlay, grouped by status.

**Status**: ✅ Fully aligned.

---

## Issues to Fix Before Merge

### 🔴 Priority 1 — Assignee Update Disabled (TaskDetailsPage)

```js
// TaskDetailsPage.jsx line ~242 — change this:
<select data-task-control="assignee" disabled ...>

// To:
<select data-task-control="assignee" ...>

// And wire the onchange to:
assigneeSelect.onchange = async (event) => {
  try {
    await applyTaskUpdate({ assigneeId: event.target.value || null });
    setFeedback('Assignee updated.', 'success');
  } catch (error) {
    setFeedback(error.message || 'Unable to update assignee.', 'error');
  }
};
```

### 🟡 Priority 2 — SLA & Workflow Analytics Stubs (analyticsService.js)

```js
// Currently:
export const getSlaMetrics = async () => ({});
export const getWorkflowAnalytics = async () => ({});

// Should be:
export const getSlaMetrics = async (spaceId) => {
  const response = await apiClient.get('/analytics/overview', { params: { spaceId } });
  return response.data || {};
};

export const getWorkflowAnalytics = async (spaceId) => {
  const response = await apiClient.get('/analytics/tasks', { params: { spaceId } });
  return response.data || {};
};
```

### 🟢 Priority 3 — Onboarding Templates (Optional)

Fetch real templates from `GET /api/v1/onboarding/templates` instead of hardcoded list, then map to same ids.

---

## Architecture Summary

All pages follow the correct layered architecture:
- **Page** → **React Query Hook** → **Service** → **apiClient** → **Backend**
- All auth pages use `authService.js` + `useAuthQueries.js`
- All task pages use `tasksService.js` + `useTaskDetailsQueries.js` / `useDashboardQueries.js`
- All AI pages use `aiService.js` + `useAiQueries.js`
- No page makes raw `fetch()` or `axios` calls — all go through `apiClient`
