"""
Mongez AI Service — Mock Data for Testing
 mirrors the seed data in backend/mongez/prisma/seed-complex.ts
 Used by tests and the live test script (scripts/test_phase4.py)
"""

from datetime import datetime, timedelta

NOW = datetime.utcnow()
DAYS_AGO = lambda d: (NOW - timedelta(days=d)).isoformat() + "Z"
DAYS_FROM_NOW = lambda d: (NOW + timedelta(days=d)).isoformat() + "Z"
HOURS_AGO = lambda h: (NOW - timedelta(hours=h)).isoformat() + "Z"

# ─── IDs ──────────────────────────────────────────────────────────────────────
IDS = {
    "userThomas":   "user_thomas_001",
    "userSara":     "user_sara_001",
    "userOmar":     "user_omar_001",
    "userLayla":    "user_layla_001",
    "userYoussef":  "user_youssef_001",
    "userAmira":    "user_amira_001",
    "userKarim":    "user_karim_001",
    "userFatima":   "user_fatima_001",
    "userHassan":   "user_hassan_001",
    "userMona":     "user_mona_001",
    "spaceAlpha":   "space_alpha_001",
    "spaceBeta":    "space_beta_001",
    "spaceGamma":   "space_gamma_001",
    "spaceEmpty":   "space_empty_001",
    "boardSprint1": "board_alpha_sprint1",
    "boardBetaMain":"board_beta_main",
    "boardGammaMain":"board_gamma_main",
}

# ─── USERS ────────────────────────────────────────────────────────────────────
MOCK_USERS = {
    IDS["userThomas"]:  {"name": "Thomas Magdy",  "email": "thomas@mongez.io",  "status": "ACTIVE",   "role": "OWNER"},
    IDS["userSara"]:    {"name": "Sara Ahmed",     "email": "sara@mongez.io",    "status": "ACTIVE",   "role": "ADMIN"},
    IDS["userOmar"]:    {"name": "Omar Hassan",    "email": "omar@mongez.io",    "status": "ACTIVE",   "role": "HEAD"},
    IDS["userLayla"]:   {"name": "Layla Ibrahim",  "email": "layla@mongez.io",   "status": "ACTIVE",   "role": "MEMBER"},
    IDS["userYoussef"]: {"name": "Youssef Nabil",  "email": "youssef@mongez.io", "status": "ACTIVE",   "role": "MEMBER"},
    IDS["userAmira"]:   {"name": "Amira Khaled",   "email": "amira@mongez.io",   "status": "ACTIVE",   "role": "VIEWER"},
    IDS["userKarim"]:   {"name": "Karim Mostafa",  "email": "karim@mongez.io",   "status": "ACTIVE",   "role": "OWNER"},
    IDS["userFatima"]:  {"name": "Fatima Ali",     "email": "fatima@mongez.io",  "status": "ACTIVE",   "role": "MEMBER"},
    IDS["userHassan"]:  {"name": "Hassan Walid",   "email": "hassan@mongez.io",  "status": "SUSPENDED","role": "MEMBER"},
    IDS["userMona"]:    {"name": "Mona Samir",     "email": "mona@mongez.io",    "status": "ACTIVE",   "role": "OWNER"},
}

# ─── TASKS — returned by NestJS GET /internal/ai/tasks/:spaceId ───────────────
# Each key is a spaceId; value is the list the NestJS data-provider would return.
MOCK_TASKS: dict[str, list[dict]] = {
    IDS["spaceAlpha"]: [
        # ── URGENT + BLOCKED (critical risk) ──
        {"id": "task_alp_001", "identifier": "ALP-001", "title": "Fix payment gateway integration failure",
         "status": "BLOCKED", "priority": "URGENT", "type": "Bug", "percentDone": 40,
         "dueDate": DAYS_AGO(3), "startDate": DAYS_AGO(14), "estimatedHours": 40,
         "tags": ["payment", "critical", "production"],
         "description": "Production payment gateway is returning 500 errors for Visa cards. Revenue loss estimated at $5K/day.",
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4 (Current)",
         "assignees": [{"userId": IDS["userLayla"], "name": "Layla Ibrahim"},
                       {"userId": IDS["userYoussef"], "name": "Youssef Nabil"}],
         "parentId": None},

        {"id": "task_alp_002", "identifier": "ALP-002", "title": "Security audit: patch CVE-2024-1234",
         "status": "BLOCKED", "priority": "URGENT", "type": "Bug", "percentDone": 10,
         "dueDate": DAYS_AGO(1), "startDate": DAYS_AGO(7), "estimatedHours": 16,
         "tags": ["security", "CVE", "urgent"],
         "description": "Critical vulnerability found in dependency chain.",
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userOmar"], "name": "Omar Hassan"}],
         "parentId": None},

        # ── URGENT + TODO ──
        {"id": "task_alp_003", "identifier": "ALP-003", "title": "Deploy hotfix for data leak",
         "status": "TODO", "priority": "URGENT", "type": "Bug", "percentDone": 0,
         "dueDate": DAYS_FROM_NOW(1), "estimatedHours": 8,
         "tags": ["security", "hotfix"],
         "description": "User PII exposed in API response.",
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userOmar"], "name": "Omar Hassan"}],
         "parentId": None},

        # ── URGENT + IN_PROGRESS ──
        {"id": "task_alp_004", "identifier": "ALP-004", "title": "Implement SSO authentication for enterprise client",
         "status": "IN_PROGRESS", "priority": "URGENT", "type": "Feature", "percentDone": 65,
         "dueDate": DAYS_FROM_NOW(2), "startDate": DAYS_AGO(10), "estimatedHours": 80,
         "tags": ["auth", "enterprise", "SSO"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userThomas"], "name": "Thomas Magdy"},
                       {"userId": IDS["userLayla"], "name": "Layla Ibrahim"}],
         "parentId": None},

        # ── HIGH + IN_PROGRESS ──
        {"id": "task_alp_005", "identifier": "ALP-005", "title": "Database migration to PostgreSQL 16",
         "status": "IN_PROGRESS", "priority": "HIGH", "type": "Task", "percentDone": 70,
         "dueDate": DAYS_FROM_NOW(7), "startDate": DAYS_AGO(5), "estimatedHours": 24,
         "tags": ["database", "migration"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userOmar"], "name": "Omar Hassan"}],
         "parentId": None},

        {"id": "task_alp_006", "identifier": "ALP-006", "title": "Build real-time notification system",
         "status": "IN_PROGRESS", "priority": "HIGH", "type": "Feature", "percentDone": 50,
         "dueDate": DAYS_FROM_NOW(10), "startDate": DAYS_AGO(8), "estimatedHours": 40,
         "tags": ["notifications", "websocket"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userYoussef"], "name": "Youssef Nabil"}],
         "parentId": None},

        # ── HIGH + IN_REVIEW ──
        {"id": "task_alp_007", "identifier": "ALP-007", "title": "API rate limiting middleware",
         "status": "IN_REVIEW", "priority": "HIGH", "type": "Task", "percentDone": 90,
         "dueDate": DAYS_FROM_NOW(3), "startDate": DAYS_AGO(12), "estimatedHours": 16,
         "tags": ["api", "security", "rate-limit"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userLayla"], "name": "Layla Ibrahim"}],
         "parentId": None},

        # ── HIGH + TODO (no assignee) ──
        {"id": "task_alp_008", "identifier": "ALP-008", "title": "Implement audit log for compliance",
         "status": "TODO", "priority": "HIGH", "type": "Task", "percentDone": 0,
         "dueDate": DAYS_FROM_NOW(14), "estimatedHours": 20,
         "tags": ["compliance", "audit"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [],
         "parentId": None},

        # ── MEDIUM + IN_PROGRESS ──
        {"id": "task_alp_010", "identifier": "ALP-010", "title": "User dashboard analytics widgets",
         "status": "IN_PROGRESS", "priority": "MEDIUM", "type": "Feature", "percentDone": 30,
         "dueDate": DAYS_FROM_NOW(14), "startDate": DAYS_AGO(3), "estimatedHours": 32,
         "tags": ["dashboard", "analytics"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userYoussef"], "name": "Youssef Nabil"}],
         "parentId": None},

        # ── Overdue HIGH ──
        {"id": "task_alp_026", "identifier": "ALP-026", "title": "Complete GDPR compliance documentation",
         "status": "IN_PROGRESS", "priority": "HIGH", "type": "Task", "percentDone": 20,
         "dueDate": DAYS_AGO(7), "startDate": DAYS_AGO(21), "estimatedHours": 40,
         "tags": ["legal", "GDPR", "compliance"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userSara"], "name": "Sara Ahmed"}],
         "parentId": None},

        {"id": "task_alp_027", "identifier": "ALP-027", "title": "Performance optimization for dashboard loading",
         "status": "TODO", "priority": "HIGH", "type": "Task", "percentDone": 0,
         "dueDate": DAYS_AGO(2), "estimatedHours": 16,
         "tags": ["performance"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [],  # NO ASSIGNEE
         "parentId": None},

        # ── No assignee HIGH ──
        {"id": "task_alp_028", "identifier": "ALP-028", "title": "Investigate memory leak in worker process",
         "status": "TODO", "priority": "HIGH", "type": "Bug", "percentDone": 0,
         "dueDate": DAYS_FROM_NOW(5), "estimatedHours": 16,
         "tags": ["bug", "memory"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [],
         "parentId": None},

        # ── 100% done but not DONE (edge case) ──
        {"id": "task_alp_030", "identifier": "ALP-030", "title": "Unit tests for auth module",
         "status": "IN_REVIEW", "priority": "MEDIUM", "type": "Task", "percentDone": 100,
         "dueDate": DAYS_FROM_NOW(1), "startDate": DAYS_AGO(7), "estimatedHours": 16,
         "tags": ["testing", "auth"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userLayla"], "name": "Layla Ibrahim"}],
         "parentId": None},

        # ── Milestone ──
        {"id": "task_alp_031", "identifier": "ALP-031", "title": "🚩 Sprint 4 Release",
         "status": "TODO", "priority": "HIGH", "type": "Milestone", "percentDone": 55,
         "dueDate": DAYS_FROM_NOW(14), "estimatedHours": 0,
         "tags": ["milestone", "release"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [],
         "parentId": None},

        # ── Overdue + BLOCKED + URGENT + no assignee (worst case) ──
        {"id": "task_alp_040", "identifier": "ALP-040", "title": "Critical: SSL certificate renewal for production",
         "status": "BLOCKED", "priority": "URGENT", "type": "Bug", "percentDone": 0,
         "dueDate": DAYS_AGO(5), "estimatedHours": 2,
         "tags": ["SSL", "production", "critical"],
         "description": "SSL certificate expires in 2 days. Blocked by procurement.",
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [],  # NO ASSIGNEE
         "parentId": None},

        # ── Subtasks of ALP-001 ──
        {"id": "task_alp_023", "identifier": "ALP-023", "title": "Payment gateway — Visa integration",
         "status": "BLOCKED", "priority": "URGENT", "type": "Task", "percentDone": 50,
         "dueDate": DAYS_AGO(3), "estimatedHours": 20,
         "tags": ["payment", "Visa"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userLayla"], "name": "Layla Ibrahim"}],
         "parentId": "task_alp_001"},

        {"id": "task_alp_024", "identifier": "ALP-024", "title": "Payment gateway — Mastercard integration",
         "status": "BLOCKED", "priority": "URGENT", "type": "Task", "percentDone": 30,
         "dueDate": DAYS_AGO(3), "estimatedHours": 20,
         "tags": ["payment", "Mastercard"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userYoussef"], "name": "Youssef Nabil"}],
         "parentId": "task_alp_001"},

        # ── DONE tasks ──
        {"id": "task_alp_018", "identifier": "ALP-018", "title": "Set up CI/CD pipeline",
         "status": "DONE", "priority": "HIGH", "type": "Task", "percentDone": 100,
         "dueDate": DAYS_AGO(5), "startDate": DAYS_AGO(20), "estimatedHours": 24,
         "tags": ["DevOps", "CI/CD"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userOmar"], "name": "Omar Hassan"}],
         "parentId": None},

        {"id": "task_alp_019", "identifier": "ALP-019", "title": "Implement user registration flow",
         "status": "DONE", "priority": "HIGH", "type": "Feature", "percentDone": 100,
         "dueDate": DAYS_AGO(3), "startDate": DAYS_AGO(15), "estimatedHours": 32,
         "tags": ["auth", "registration"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userLayla"], "name": "Layla Ibrahim"}],
         "parentId": None},

        # ── CANCELLED ──
        {"id": "task_alp_021", "identifier": "ALP-021", "title": "Build custom reporting engine (replaced by BI tool)",
         "status": "CANCELLED", "priority": "MEDIUM", "type": "Feature", "percentDone": 25,
         "estimatedHours": 120,
         "tags": ["cancelled"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [],
         "parentId": None},

        # ── More IN_PROGRESS for density ──
        {"id": "task_alp_041", "identifier": "ALP-041", "title": "Implement file upload with S3 storage",
         "status": "IN_PROGRESS", "priority": "MEDIUM", "type": "Feature", "percentDone": 55,
         "dueDate": DAYS_FROM_NOW(10), "startDate": DAYS_AGO(7), "estimatedHours": 20,
         "tags": ["storage", "S3"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userYoussef"], "name": "Youssef Nabil"}],
         "parentId": None},

        {"id": "task_alp_042", "identifier": "ALP-042", "title": "Fix: Concurrent edit conflict resolution",
         "status": "IN_PROGRESS", "priority": "HIGH", "type": "Bug", "percentDone": 35,
         "dueDate": DAYS_FROM_NOW(5), "startDate": DAYS_AGO(4), "estimatedHours": 16,
         "tags": ["bug", "concurrency"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userLayla"], "name": "Layla Ibrahim"}],
         "parentId": None},

        # ── IN_REVIEW ──
        {"id": "task_alp_050", "identifier": "ALP-050", "title": "Performance: Reduce initial bundle size",
         "status": "IN_REVIEW", "priority": "MEDIUM", "type": "Task", "percentDone": 80,
         "dueDate": DAYS_FROM_NOW(3), "startDate": DAYS_AGO(5), "estimatedHours": 12,
         "tags": ["performance", "bundle"],
         "boardId": IDS["boardSprint1"], "boardName": "Sprint 4",
         "assignees": [{"userId": IDS["userYoussef"], "name": "Youssef Nabil"}],
         "parentId": None},
    ],

    IDS["spaceBeta"]: [
        {"id": "task_bet_001", "identifier": "BET-001", "title": "Real-time data pipeline for analytics",
         "status": "IN_PROGRESS", "priority": "URGENT", "type": "Feature", "percentDone": 45,
         "dueDate": DAYS_FROM_NOW(5), "startDate": DAYS_AGO(14), "estimatedHours": 80,
         "tags": ["data", "pipeline"],
         "boardId": IDS["boardBetaMain"], "boardName": "Main Board",
         "assignees": [{"userId": IDS["userKarim"], "name": "Karim Mostafa"}],
         "parentId": None},

        {"id": "task_bet_003", "identifier": "BET-003", "title": "Fix: Data export CSV encoding issue",
         "status": "BLOCKED", "priority": "HIGH", "type": "Bug", "percentDone": 30,
         "dueDate": DAYS_AGO(2), "startDate": DAYS_AGO(7), "estimatedHours": 8,
         "tags": ["export", "bug", "CSV"],
         "description": "Arabic characters corrupted in CSV export.",
         "boardId": IDS["boardBetaMain"], "boardName": "Main Board",
         "assignees": [{"userId": IDS["userFatima"], "name": "Fatima Ali"}],
         "parentId": None},

        {"id": "task_bet_010", "identifier": "BET-010", "title": "Client presentation: Q2 analytics report",
         "status": "TODO", "priority": "URGENT", "type": "Task", "percentDone": 10,
         "dueDate": DAYS_AGO(1), "estimatedHours": 16,
         "tags": ["presentation", "client"],
         "boardId": IDS["boardBetaMain"], "boardName": "Main Board",
         "assignees": [{"userId": IDS["userKarim"], "name": "Karim Mostafa"}],
         "parentId": None},

        {"id": "task_bet_011", "identifier": "BET-011", "title": "Fix timezone handling in date filters",
         "status": "IN_PROGRESS", "priority": "MEDIUM", "type": "Bug", "percentDone": 40,
         "dueDate": DAYS_AGO(5), "startDate": DAYS_AGO(14), "estimatedHours": 8,
         "tags": ["bug", "timezone"],
         "boardId": IDS["boardBetaMain"], "boardName": "Main Board",
         "assignees": [{"userId": IDS["userFatima"], "name": "Fatima Ali"}],
         "parentId": None},
    ],

    IDS["spaceGamma"]: [
        {"id": "task_gam_001", "identifier": "GAM-001", "title": "MVP: User registration & login",
         "status": "DONE", "priority": "URGENT", "type": "Feature", "percentDone": 100,
         "dueDate": DAYS_AGO(5), "startDate": DAYS_AGO(20), "estimatedHours": 24,
         "tags": ["MVP", "auth"],
         "boardId": IDS["boardGammaMain"], "boardName": "MVP Board",
         "assignees": [{"userId": IDS["userMona"], "name": "Mona Samir"}],
         "parentId": None},

        {"id": "task_gam_002", "identifier": "GAM-002", "title": "MVP: Core feature — product listing",
         "status": "IN_PROGRESS", "priority": "URGENT", "type": "Feature", "percentDone": 70,
         "dueDate": DAYS_FROM_NOW(3), "startDate": DAYS_AGO(10), "estimatedHours": 40,
         "tags": ["MVP", "core"],
         "boardId": IDS["boardGammaMain"], "boardName": "MVP Board",
         "assignees": [{"userId": IDS["userMona"], "name": "Mona Samir"}],
         "parentId": None},

        {"id": "task_gam_003", "identifier": "GAM-003", "title": "MVP: Payment integration",
         "status": "TODO", "priority": "HIGH", "type": "Feature", "percentDone": 0,
         "dueDate": DAYS_FROM_NOW(7), "estimatedHours": 24,
         "tags": ["MVP", "payment"],
         "boardId": IDS["boardGammaMain"], "boardName": "MVP Board",
         "assignees": [],  # NO ASSIGNEE
         "parentId": None},
    ],

    IDS["spaceEmpty"]: [],
}

# ─── COMMENTS — returned by GET /internal/ai/comments/:taskId ─────────────────
MOCK_COMMENTS: dict[str, list[dict]] = {
    "task_alp_001": [
        {"id": "comment_001", "authorId": IDS["userLayla"],   "authorName": "Layla Ibrahim",  "content": "Visa changed their webhook payload format. `transaction_id` is now `txn_id`.", "createdAt": DAYS_AGO(2)},
        {"id": "comment_002", "authorId": IDS["userThomas"],  "authorName": "Thomas Magdy",   "content": "@omar this is blocking 3 other tasks. Can we prioritize a hotfix?",          "createdAt": DAYS_AGO(2)},
        {"id": "comment_003", "authorId": IDS["userOmar"],    "authorName": "Omar Hassan",    "content": "@youssef can you help Layla with Mastercard while she handles Visa?",        "createdAt": DAYS_AGO(1)},
        {"id": "comment_004", "authorId": IDS["userYoussef"], "authorName": "Youssef Nabil",  "content": "On it. Starting Mastercard integration this afternoon.",                      "createdAt": DAYS_AGO(1)},
        {"id": "comment_005", "authorId": IDS["userSara"],    "authorName": "Sara Ahmed",     "content": "Revenue loss. @thomas should we escalate to the client?",                    "createdAt": HOURS_AGO(6)},
    ],
    "task_alp_002": [
        {"id": "comment_006", "authorId": IDS["userOmar"],   "authorName": "Omar Hassan",  "content": "CVE affects jsonwebtoken. Upgrade requires breaking auth middleware changes.", "createdAt": DAYS_AGO(3)},
        {"id": "comment_007", "authorId": IDS["userThomas"], "authorName": "Thomas Magdy", "content": "How long to fix? Can't ship with a known critical CVE.",                        "createdAt": DAYS_AGO(3)},
        {"id": "comment_008", "authorId": IDS["userOmar"],   "authorName": "Omar Hassan",  "content": "2 days fix + 1 day regression. Blocked by SSO work (ALP-004).",               "createdAt": DAYS_AGO(2)},
    ],
    "task_alp_004": [
        {"id": "comment_009", "authorId": IDS["userLayla"],  "authorName": "Layla Ibrahim", "content": "SAML integration 60% done. Each enterprise client has different IdP settings.", "createdAt": DAYS_AGO(1)},
        {"id": "comment_010", "authorId": IDS["userThomas"], "authorName": "Thomas Magdy",  "content": "Client meeting tomorrow. Need demo-ready sandbox by EOD.",                      "createdAt": HOURS_AGO(12)},
    ],
    "task_alp_005": [
        {"id": "comment_011", "authorId": IDS["userOmar"], "authorName": "Omar Hassan", "content": "Migration tested on staging. Zero downtime with blue-green deployment.", "createdAt": DAYS_AGO(1)},
    ],
    "task_bet_003": [
        {"id": "comment_014", "authorId": IDS["userFatima"], "authorName": "Fatima Ali",   "content": "Arabic text needs UTF-8 with BOM for Excel compatibility.",  "createdAt": DAYS_AGO(3)},
        {"id": "comment_015", "authorId": IDS["userKarim"],  "authorName": "Karim Mostafa","content": "Blocked — waiting for encoding library PR merge.",            "createdAt": DAYS_AGO(2)},
    ],
    "task_bet_010": [
        {"id": "comment_016", "authorId": IDS["userKarim"], "authorName": "Karim Mostafa", "content": "Client presentation was due yesterday. Need slides ASAP.", "createdAt": HOURS_AGO(3)},
    ],
}

# ─── AUDIT LOG — returned by GET /internal/ai/audit-log/:spaceId ──────────────
MOCK_AUDIT_LOG: dict[str, list[dict]] = {
    IDS["spaceAlpha"]: [
        {"id": "audit_003", "userId": IDS["userOmar"],    "action": "task.created",        "entityType": "task", "entityId": "task_alp_001", "timestamp": DAYS_AGO(14)},
        {"id": "audit_004", "userId": IDS["userOmar"],    "action": "task.status_changed",  "entityType": "task", "entityId": "task_alp_001", "timestamp": DAYS_AGO(3),  "diff": {"status": {"from": "IN_PROGRESS", "to": "BLOCKED"}}},
        {"id": "audit_005", "userId": IDS["userThomas"],  "action": "task.created",        "entityType": "task", "entityId": "task_alp_004", "timestamp": DAYS_AGO(12)},
        {"id": "audit_007", "userId": IDS["userOmar"],    "action": "task.status_changed",  "entityType": "task", "entityId": "task_alp_018", "timestamp": DAYS_AGO(5),  "diff": {"status": {"from": "IN_REVIEW", "to": "DONE"}}},
        {"id": "audit_009", "userId": IDS["userThomas"],  "action": "task.priority_changed","entityType": "task", "entityId": "task_alp_040", "timestamp": DAYS_AGO(7),  "diff": {"priority": {"from": "HIGH", "to": "URGENT"}}},
    ],
    IDS["spaceBeta"]: [
        {"id": "audit_008", "userId": IDS["userKarim"], "action": "space.created", "entityType": "space", "entityId": IDS["spaceBeta"], "timestamp": DAYS_AGO(60)},
    ],
}

# ─── CONVENIENCE: build a mock NestJSClient ───────────────────────────────────
class MockNestJSClient:
    """Drop-in replacement for NestJSClient that returns mock data."""

    async def get_tasks(self, space_id: str, board_id: str | None = None) -> list[dict]:
        tasks = MOCK_TASKS.get(space_id, [])
        if board_id:
            tasks = [t for t in tasks if t["boardId"] == board_id]
        return tasks

    async def get_comments(self, task_id: str) -> list[dict]:
        return MOCK_COMMENTS.get(task_id, [])

    async def get_comments_by_space(self, space_id: str) -> list[dict]:
        """Collect comments for all tasks in a space."""
        all_comments = []
        for task in MOCK_TASKS.get(space_id, []):
            all_comments.extend(MOCK_COMMENTS.get(task["id"], []))
        return all_comments

    async def get_audit_log(self, space_id: str) -> list[dict]:
        return MOCK_AUDIT_LOG.get(space_id, [])

    async def get_schema(self) -> dict:
        return {"tables": ["tasks", "comments", "users", "spaces", "boards"]}

    async def propose_action(self, trace_id: str, space_id: str, action: dict) -> dict:
        return {"id": "mock_action_001", "status": "PENDING", **action}

    async def update_ai_request(self, trace_id: str, updates: dict) -> None:
        pass

    async def close(self) -> None:
        pass