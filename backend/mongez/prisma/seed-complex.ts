/**
 * Mongez Complex Seed Data — Comprehensive test scenarios for app & AI system
 *
 * Covers:
 *  - 3 Spaces (Alpha Project, Beta Platform, Gamma Startup)
 *  - 12 Users with all roles (OWNER, ADMIN, HEAD, MEMBER, VIEWER)
 *  - All TaskStatus values (BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED)
 *  - All Priority values (URGENT, HIGH, MEDIUM, LOW, NONE)
 *  - All task types (Task, Bug, Feature, Milestone)
 *  - All DependencyType values (BLOCKS, DUPLICATES, RELATES_TO, FOLLOWS, PRECEDES, PART_OF, REQUIRES)
 *  - Task dependencies creating critical path & circular-like chains
 *  - Overdue tasks (past dueDate), future tasks, no-dueDate tasks
 *  - Subtasks (parent-child hierarchy)
 *  - Comments with @mentions
 *  - Time logs, approvals, watchers
 *  - AI Requests in all intents & statuses
 *  - AI Proposed Actions in all command types & approval statuses
 *  - Archived boards & tasks
 *  - Users in all statuses (ACTIVE, INACTIVE, INVITED, SUSPENDED)
 *  - Notifications in various states
 *  - Empty spaces (no tasks) for edge-case testing
 *
 * Run:
 *   npx prisma db seed -- --file prisma/seed-complex.ts
 *
 * Or via ts-node:
 *   npx ts-node prisma/seed-complex.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "bcrypt";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// ─── Password Hash Helper ──────────────────────────────────────────────────────
async function hashPassword(pw: string): Promise<string> {
  return hash(pw, 10);
}

// ─── ID Helpers (deterministic CUID-like IDs for readability) ───────────────────
const ids = {
  // Roles
  roleOwner:     "role_owner_001",
  roleAdmin:     "role_admin_001",
  roleHead:      "role_head_001",
  roleMember:    "role_member_001",
  roleViewer:    "role_viewer_001",

  // Users
  userThomas:    "user_thomas_001",    // OWNER of Alpha, ADMIN of Beta
  userSara:      "user_sara_001",      // ADMIN of Alpha
  userOmar:      "user_omar_001",      // HEAD of Alpha Engineering dept
  userLayla:     "user_layla_001",     // MEMBER of Alpha
  userYoussef:   "user_youssef_001",   // MEMBER of Alpha
  userAmira:     "user_amira_001",     // VIEWER of Alpha
  userKarim:     "user_karim_001",     // OWNER of Beta
  userFatima:    "user_fatima_001",    // MEMBER of Beta
  userHassan:    "user_hassan_001",    // MEMBER of Beta (SUSPENDED)
  userZainab:    "user_zainab_001",    // INVITED to Gamma
  userMona:      "user_mona_001",      // OWNER of Gamma (small startup)
  userInactive:  "user_inactive_001",  // INACTIVE user

  // Spaces
  spaceAlpha:    "space_alpha_001",    // Large project — 50+ tasks
  spaceBeta:     "space_beta_001",     // Medium project — ~15 tasks
  spaceGamma:    "space_gamma_001",    // Tiny startup — 3 tasks (edge cases)
  spaceEmpty:    "space_empty_001",    // Empty space — 0 tasks

  // Departments
  deptAlphaEng:      "dept_alpha_eng_001",
  deptAlphaDesign:   "dept_alpha_design_001",
  deptAlphaMarketing:"dept_alpha_marketing_001",
  deptBetaBackend:   "dept_beta_backend_001",
  deptBetaFrontend:  "dept_beta_frontend_001",
  deptGammaProduct:  "dept_gamma_product_001",

  // Boards
  boardAlphaSprint1:   "board_alpha_sprint1",
  boardAlphaSprint2:   "board_alpha_sprint2",
  boardAlphaBacklog:   "board_alpha_backlog",
  boardAlphaArchived:  "board_alpha_archived",
  boardBetaMain:       "board_beta_main",
  boardBetaArchived:   "board_beta_archived",
  boardGammaMain:      "board_gamma_main",
  boardEmptyMain:      "board_empty_main",

  // Board Columns
  colBacklog:    "col_backlog_001",
  colTodo:       "col_todo_001",
  colInProgress: "col_inprogress_001",
  colInReview:   "col_inreview_001",
  colBlocked:    "col_blocked_001",
  colDone:       "col_done_001",

  // Sub-plan
  subFree:       "subplan_free_001",
  subPro:        "subplan_pro_001",
  subEnterprise: "subplan_enterprise_001",
};

// ─── Relative Date Helpers ──────────────────────────────────────────────────────
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("🌱 Seeding complex test data...");

  // Clean slate
  await prisma.$transaction([
    prisma.aIEvalResult.deleteMany(),
    prisma.aIProposedAction.deleteMany(),
    prisma.aIRequest.deleteMany(),
    prisma.emojiReaction.deleteMany(),
    prisma.mention.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.fileVersion.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.timeLog.deleteMany(),
    prisma.watcher.deleteMany(),
    prisma.taskDependency.deleteMany(),
    prisma.taskAssignment.deleteMany(),
    prisma.taskJournal.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.deviceSession.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.userLog.deleteMany(),
    prisma.view.deleteMany(),
    prisma.task.deleteMany(),
    prisma.boardColumn.deleteMany(),
    prisma.board.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.department.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.spaceCounter.deleteMany(),
    prisma.space.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.subscriptionPlan.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.emailVerification.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log("  ✓ Cleaned existing data");


  // ─── Subscription Plans ───────────────────────────────────────────────────
  await prisma.subscriptionPlan.createMany({
    data: [
      { id: ids.subFree,       name: "FREE",       maxSpaces: 1, maxUsers: 5,  maxBoards: 3,  aiEnabled: false, price: 0 },
      { id: ids.subPro,        name: "PRO",         maxSpaces: 10, maxUsers: 50, maxBoards: 50, aiEnabled: true,  price: 29 },
      { id: ids.subEnterprise, name: "ENTERPRISE",  maxSpaces: -1, maxUsers: -1, maxBoards: -1, aiEnabled: true,  price: 99 },
    ],
  });
  console.log("  ✓ Subscription plans");


  // ─── Roles & Permissions ──────────────────────────────────────────────────
  await prisma.role.createMany({
    data: [
      { id: ids.roleOwner,   name: "OWNER",   description: "Full control over space" },
      { id: ids.roleAdmin,   name: "ADMIN",   description: "Manage members and settings" },
      { id: ids.roleHead,    name: "HEAD",     description: "Department head — manage tasks and boards" },
      { id: ids.roleMember,  name: "MEMBER",   description: "Standard member — create and update tasks" },
      { id: ids.roleViewer,  name: "VIEWER",   description: "Read-only access" },
    ],
  });

  const permData = [
    { action: "create", resource: "task" },
    { action: "read",   resource: "task" },
    { action: "update", resource: "task" },
    { action: "delete", resource: "task" },
    { action: "create", resource: "board" },
    { action: "read",   resource: "board" },
    { action: "update", resource: "board" },
    { action: "delete", resource: "board" },
    { action: "create", resource: "space" },
    { action: "read",   resource: "space" },
    { action: "update", resource: "space" },
    { action: "delete", resource: "space" },
    { action: "read",   resource: "report" },
    { action: "create", resource: "report" },
    { action: "approve", resource: "task" },
    { action: "manage", resource: "members" },
    { action: "use",    resource: "ai" },
  ];
  await prisma.permission.createMany({ data: permData });
  const allPerms = await prisma.permission.findMany();

  // OWNER gets all permissions
  for (const p of allPerms) {
    await prisma.rolePermission.create({ data: { roleId: ids.roleOwner, permissionId: p.id } });
  }
  // ADMIN gets all except delete space
  for (const p of allPerms) {
    if (!(p.action === "delete" && p.resource === "space")) {
      await prisma.rolePermission.create({ data: { roleId: ids.roleAdmin, permissionId: p.id } });
    }
  }
  // HEAD gets task + board CRUD + report read
  for (const p of allPerms) {
    if (["task", "board", "report"].includes(p.resource) && p.action !== "delete") {
      await prisma.rolePermission.create({ data: { roleId: ids.roleHead, permissionId: p.id } });
    }
  }
  // MEMBER gets task CRUD + read board/space
  for (const p of allPerms) {
    if (p.resource === "task" || ((p.resource === "board" || p.resource === "space") && p.action === "read")) {
      await prisma.rolePermission.create({ data: { roleId: ids.roleMember, permissionId: p.id } });
    }
  }
  // VIEWER gets read on everything
  for (const p of allPerms) {
    if (p.action === "read") {
      await prisma.rolePermission.create({ data: { roleId: ids.roleViewer, permissionId: p.id } });
    }
  }
  console.log("  ✓ Roles & permissions");


  // ─── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await hashPassword("Test@1234");
  await prisma.user.createMany({
    data: [
      { id: ids.userThomas,   email: "thomas@mongez.io",   name: "Thomas Magdy",      passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: hoursAgo(1) },
      { id: ids.userSara,     email: "sara@mongez.io",     name: " Sara Ahmed",        passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: hoursAgo(3) },
      { id: ids.userOmar,     email: "omar@mongez.io",     name: "Omar Hassan",        passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: daysAgo(1) },
      { id: ids.userLayla,    email: "layla@mongez.io",    name: "Layla Ibrahim",      passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: hoursAgo(12) },
      { id: ids.userYoussef,  email: "youssef@mongez.io",  name: "Youssef Nabil",      passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: daysAgo(2) },
      { id: ids.userAmira,    email: "amira@mongez.io",    name: "Amira Khaled",       passwordHash, status: "ACTIVE",   isVerified: false, lastLoginAt: daysAgo(30) },
      { id: ids.userKarim,    email: "karim@mongez.io",    name: "Karim Mostafa",      passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: hoursAgo(6) },
      { id: ids.userFatima,   email: "fatima@mongez.io",   name: "Fatima Ali",         passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: daysAgo(1) },
      { id: ids.userHassan,   email: "hassan@mongez.io",   name: "Hassan Walid",       passwordHash, status: "SUSPENDED", isVerified: true,  lastLoginAt: daysAgo(60) },
      { id: ids.userZainab,   email: "zainab@mongez.io",   name: "Zainab Adel",        passwordHash, status: "INVITED",   isVerified: false },
      { id: ids.userMona,     email: "mona@mongez.io",     name: "Mona Samir",         passwordHash, status: "ACTIVE",   isVerified: true,  lastLoginAt: hoursAgo(2) },
      { id: ids.userInactive, email: "inactive@mongez.io", name: "Deleted User",       passwordHash, status: "INACTIVE",  isVerified: true,  lastLoginAt: daysAgo(90) },
    ],
  });

  // Subscriptions
  await prisma.subscription.createMany({
    data: [
      { userId: ids.userThomas, tier: "ENTERPRISE", startsAt: daysAgo(180), expiresAt: daysFromNow(185), isAutoRenew: true },
      { userId: ids.userKarim,  tier: "PRO",         startsAt: daysAgo(90),  expiresAt: daysFromNow(275), isAutoRenew: true },
      { userId: ids.userMona,   tier: "FREE",        startsAt: daysAgo(30) },
      { userId: ids.userSara,   tier: "PRO",         startsAt: daysAgo(60),  expiresAt: daysFromNow(305), isAutoRenew: true },
    ],
  });
  console.log("  ✓ Users & subscriptions");


  // ─── Spaces ───────────────────────────────────────────────────────────────
  await prisma.space.createMany({
    data: [
      { id: ids.spaceAlpha, name: "Alpha Project",  description: "Enterprise ERP system for a multinational client",  prefix: "ALP", color: "#3B82F6", icon: "🚀", isPublic: false, subscriptionPlanId: ids.subEnterprise },
      { id: ids.spaceBeta,  name: "Beta Platform",  description: "SaaS analytics platform with real-time dashboards",  prefix: "BET", color: "#10B981", icon: "📊", isPublic: true,  subscriptionPlanId: ids.subPro },
      { id: ids.spaceGamma, name: "Gamma Startup",  description: "MVP for a mobile app — small team, fast iterations", prefix: "GAM", color: "#F59E0B", icon: "⚡", isPublic: false, subscriptionPlanId: ids.subFree },
      { id: ids.spaceEmpty, name: "Empty Space",    description: "Newly created space with no data — edge case testing", prefix: "EMP", color: "#6B7280", icon: "📭", isPublic: false, subscriptionPlanId: ids.subFree },
    ],
  });

  // Space counters
  await prisma.spaceCounter.createMany({
    data: [
      { spaceId: ids.spaceAlpha, seq: 50 },
      { spaceId: ids.spaceBeta,  seq: 15 },
      { spaceId: ids.spaceGamma, seq: 3 },
      { spaceId: ids.spaceEmpty, seq: 0 },
    ],
  });
  console.log("  ✓ Spaces");


  // ─── Departments ──────────────────────────────────────────────────────────
  await prisma.department.createMany({
    data: [
      { id: ids.deptAlphaEng,       spaceId: ids.spaceAlpha, name: "Engineering",      description: "Backend, frontend, DevOps",       color: "#3B82F6" },
      { id: ids.deptAlphaDesign,    spaceId: ids.spaceAlpha, name: "Design",           description: "UI/UX design & research",         color: "#8B5CF6" },
      { id: ids.deptAlphaMarketing, spaceId: ids.spaceAlpha, name: "Marketing",        description: "Content, SEO, social media",       color: "#EC4899" },
      { id: ids.deptBetaBackend,    spaceId: ids.spaceBeta,  name: "Backend",          description: "API, data pipeline, infrastructure", color: "#10B981" },
      { id: ids.deptBetaFrontend,   spaceId: ids.spaceBeta,  name: "Frontend",         description: "Dashboard & visualization",        color: "#F59E0B" },
      { id: ids.deptGammaProduct,   spaceId: ids.spaceGamma, name: "Product",          description: "All-in-one product team",          color: "#EF4444" },
    ],
  });
  console.log("  ✓ Departments");


  // ─── Memberships ──────────────────────────────────────────────────────────
  await prisma.membership.createMany({
    data: [
      // Alpha Project members
      { userId: ids.userThomas,  spaceId: ids.spaceAlpha, roleId: ids.roleOwner },
      { userId: ids.userSara,    spaceId: ids.spaceAlpha, roleId: ids.roleAdmin },
      { userId: ids.userOmar,    spaceId: ids.spaceAlpha, departmentId: ids.deptAlphaEng, roleId: ids.roleHead },
      { userId: ids.userLayla,   spaceId: ids.spaceAlpha, departmentId: ids.deptAlphaEng, roleId: ids.roleMember },
      { userId: ids.userYoussef, spaceId: ids.spaceAlpha, departmentId: ids.deptAlphaEng, roleId: ids.roleMember },
      { userId: ids.userAmira,   spaceId: ids.spaceAlpha, departmentId: ids.deptAlphaDesign, roleId: ids.roleViewer },
      // Beta Platform members
      { userId: ids.userKarim,   spaceId: ids.spaceBeta, roleId: ids.roleOwner },
      { userId: ids.userFatima,  spaceId: ids.spaceBeta, departmentId: ids.deptBetaBackend, roleId: ids.roleMember },
      { userId: ids.userHassan,  spaceId: ids.spaceBeta, departmentId: ids.deptBetaFrontend, roleId: ids.roleMember },
      { userId: ids.userThomas,  spaceId: ids.spaceBeta, roleId: ids.roleAdmin },
      // Gamma Startup members
      { userId: ids.userMona,    spaceId: ids.spaceGamma, departmentId: ids.deptGammaProduct, roleId: ids.roleOwner },
      // Empty space
      { userId: ids.userThomas,  spaceId: ids.spaceEmpty, roleId: ids.roleOwner },
    ],
  });

  // Invitations
  await prisma.invitation.createMany({
    data: [
      { email: "zainab@mongez.io", spaceId: ids.spaceGamma, role: "MEMBER", expiresAt: daysFromNow(7) },
      { email: "newuser@example.com", spaceId: ids.spaceAlpha, role: "MEMBER", expiresAt: daysFromNow(3) },
    ],
  });
  console.log("  ✓ Memberships & invitations");


  // ─── Boards ───────────────────────────────────────────────────────────────
  await prisma.board.createMany({
    data: [
      // Alpha boards
      { id: ids.boardAlphaSprint1,  name: "Sprint 4 (Current)", departmentId: ids.deptAlphaEng, type: "KANBAN",   position: 0, color: "#3B82F6" },
      { id: ids.boardAlphaSprint2,  name: "Sprint 5 (Planning)",departmentId: ids.deptAlphaEng, type: "KANBAN",   position: 1, color: "#8B5CF6" },
      { id: ids.boardAlphaBacklog,  name: "Product Backlog",    departmentId: ids.deptAlphaDesign, type: "LIST", position: 2 },
      { id: ids.boardAlphaArchived, name: "Archive Q1",         departmentId: ids.deptAlphaEng, type: "TABLE",    position: 3, isArchived: true },
      // Beta boards
      { id: ids.boardBetaMain,     name: "Main Board",          departmentId: ids.deptBetaBackend, type: "KANBAN", position: 0, color: "#10B981" },
      { id: ids.boardBetaArchived, name: "Legacy Board",        departmentId: ids.deptBetaBackend, type: "KANBAN", position: 1, isArchived: true },
      // Gamma boards
      { id: ids.boardGammaMain,    name: "MVP Board",           departmentId: ids.deptGammaProduct, type: "KANBAN", position: 0, color: "#F59E0B" },
      // Empty space board
      { id: ids.boardEmptyMain,    name: "Main Board",          departmentId: ids.deptGammaProduct, type: "KANBAN", position: 0 },
    ],
  });
  console.log("  ✓ Boards");


  // ─── Board Columns (for Alpha Sprint 4) ───────────────────────────────────
  await prisma.boardColumn.createMany({
    data: [
      { id: ids.colBacklog,    boardId: ids.boardAlphaSprint1, name: "Backlog",     position: 0, color: "#6B7280" },
      { id: ids.colTodo,       boardId: ids.boardAlphaSprint1, name: "To Do",       position: 1, color: "#3B82F6", wipLimit: 5 },
      { id: ids.colInProgress, boardId: ids.boardAlphaSprint1, name: "In Progress", position: 2, color: "#F59E0B", wipLimit: 3 },
      { id: ids.colInReview,   boardId: ids.boardAlphaSprint1, name: "In Review",   position: 3, color: "#8B5CF6", wipLimit: 2 },
      { id: ids.colBlocked,    boardId: ids.boardAlphaSprint1, name: "Blocked",     position: 4, color: "#EF4444" },
      { id: ids.colDone,       boardId: ids.boardAlphaSprint1, name: "Done",        position: 5, color: "#10B981" },
    ],
  });
  console.log("  ✓ Board columns");


  // ─── Tasks — Comprehensive Coverage ───────────────────────────────────────
  // We create tasks covering EVERY combination of status × priority × type
  // Plus edge cases: overdue, no assignee, subtasks, archived, etc.

  const tasksData: Prisma.TaskCreateManyInput[] = [
    // ═══ ALHPA PROJECT — Sprint 4 ═══════════════════════════════════════════

    // ─── URGENT + BLOCKED — Critical risk scenario ───────────────────────
    { id: "task_alp_001", identifier: "ALP-001", title: "Fix payment gateway integration failure",       boardId: ids.boardAlphaSprint1, columnId: ids.colBlocked,    status: "BLOCKED",     priority: "URGENT", type: "Bug",      percentDone: 40,  dueDate: daysAgo(3),  startDate: daysAgo(14), estimatedHours: 40, tags: ["payment", "critical", "production"], description: "Production payment gateway is returning 500 errors for Visa cards. Revenue loss estimated at $5K/day. Third-party API changed their webhook format.", createdById: ids.userThomas },
    { id: "task_alp_002", identifier: "ALP-002", title: "Security audit: patch CVE-2024-1234",           boardId: ids.boardAlphaSprint1, columnId: ids.colBlocked,    status: "BLOCKED",     priority: "URGENT", type: "Bug",      percentDone: 10,  dueDate: daysAgo(1),  startDate: daysAgo(7),  estimatedHours: 16, tags: ["security", "CVE", "urgent"], description: "Critical vulnerability found in dependency chain. Needs immediate patch before next release.", createdById: ids.userSara },

    // ─── URGENT + TODO — Should trigger risk alerts ─────────────────────
    { id: "task_alp_003", identifier: "ALP-003", title: "Deploy hotfix for data leak",                   boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "URGENT", type: "Bug",      percentDone: 0,   dueDate: daysFromNow(1), estimatedHours: 8,  tags: ["security", "hotfix"], description: "User PII exposed in API response. Needs immediate fix and deploy.", createdById: ids.userSara },

    // ─── URGENT + IN_PROGRESS — At risk of missing deadline ─────────────
    { id: "task_alp_004", identifier: "ALP-004", title: "Implement SSO authentication for enterprise client", boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "URGENT", type: "Feature", percentDone: 65, dueDate: daysFromNow(2), startDate: daysAgo(10), estimatedHours: 80, tags: ["auth", "enterprise", "SSO"], description: "Enterprise client requires SAML SSO integration. Deadline is contractually binding.", createdById: ids.userThomas },

    // ─── HIGH + IN_PROGRESS ─────────────────────────────────────────────
    { id: "task_alp_005", identifier: "ALP-005", title: "Database migration to PostgreSQL 16",           boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "HIGH",   type: "Task",     percentDone: 70,  dueDate: daysFromNow(7),  startDate: daysAgo(5),  estimatedHours: 24, tags: ["database", "migration"], createdById: ids.userOmar },
    { id: "task_alp_006", identifier: "ALP-006", title: "Build real-time notification system",           boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "HIGH",   type: "Feature",  percentDone: 50,  dueDate: daysFromNow(10), startDate: daysAgo(8),  estimatedHours: 40, tags: ["notifications", "websocket"], createdById: ids.userOmar },

    // ─── HIGH + IN_REVIEW ───────────────────────────────────────────────
    { id: "task_alp_007", identifier: "ALP-007", title: "API rate limiting middleware",                   boardId: ids.boardAlphaSprint1, columnId: ids.colInReview,   status: "IN_REVIEW",   priority: "HIGH",   type: "Task",     percentDone: 90,  dueDate: daysFromNow(3),  startDate: daysAgo(12), estimatedHours: 16, tags: ["api", "security", "rate-limit"], createdById: ids.userLayla },

    // ─── HIGH + TODO ────────────────────────────────────────────────────
    { id: "task_alp_008", identifier: "ALP-008", title: "Implement audit log for compliance",            boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "HIGH",   type: "Task",     percentDone: 0,   dueDate: daysFromNow(14), estimatedHours: 20, tags: ["compliance", "audit"], createdById: ids.userSara },
    { id: "task_alp_009", identifier: "ALP-009", title: "Design system component library v2",            boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "HIGH",   type: "Feature",  percentDone: 0,   dueDate: daysFromNow(21), estimatedHours: 60, tags: ["design", "UI", "components"], createdById: ids.userAmira },

    // ─── MEDIUM + IN_PROGRESS — Normal flow ─────────────────────────────
    { id: "task_alp_010", identifier: "ALP-010", title: "User dashboard analytics widgets",              boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "MEDIUM", type: "Feature",  percentDone: 30,  dueDate: daysFromNow(14), startDate: daysAgo(3),  estimatedHours: 32, tags: ["dashboard", "analytics"], createdById: ids.userYoussef },

    // ─── MEDIUM + TODO ──────────────────────────────────────────────────
    { id: "task_alp_011", identifier: "ALP-011", title: "Write API documentation for v2 endpoints",      boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "MEDIUM", type: "Task",     percentDone: 0,   dueDate: daysFromNow(21), estimatedHours: 16, tags: ["docs", "api"], createdById: ids.userLayla },
    { id: "task_alp_012", identifier: "ALP-012", title: "Email notification templates redesign",         boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "MEDIUM", type: "Task",     percentDone: 0,   dueDate: null, startDate: null, estimatedHours: 12, tags: ["email", "design"], createdById: ids.userAmira },

    // ─── MEDIUM + BACKLOG ───────────────────────────────────────────────
    { id: "task_alp_013", identifier: "ALP-013", title: "Multi-language support (i18n)",                  boardId: ids.boardAlphaSprint1, columnId: ids.colBacklog,    status: "BACKLOG",     priority: "MEDIUM", type: "Feature",  percentDone: 0,   dueDate: null, startDate: null, estimatedHours: 80, tags: ["i18n", "globalization"], createdById: ids.userThomas },

    // ─── LOW + TODO ─────────────────────────────────────────────────────
    { id: "task_alp_014", identifier: "ALP-014", title: "Update dependencies to latest versions",        boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "LOW",    type: "Task",     percentDone: 0,   dueDate: daysFromNow(30), estimatedHours: 8,  tags: ["maintenance", "dependencies"], createdById: ids.userOmar },
    { id: "task_alp_015", identifier: "ALP-015", title: "Dark mode theme implementation",                 boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "LOW",    type: "Feature",  percentDone: 0,   dueDate: null, estimatedHours: 24, tags: ["UI", "theme"], createdById: ids.userAmira },

    // ─── LOW + BACKLOG ──────────────────────────────────────────────────
    { id: "task_alp_016", identifier: "ALP-016", title: "Refactor legacy logging module",                 boardId: ids.boardAlphaSprint1, columnId: ids.colBacklog,    status: "BACKLOG",     priority: "LOW",    type: "Task",     percentDone: 0,   dueDate: null, startDate: null, estimatedHours: 16, tags: ["tech-debt", "refactor"], createdById: ids.userOmar },

    // ─── NONE priority ──────────────────────────────────────────────────
    { id: "task_alp_017", identifier: "ALP-017", title: "Research AI-assisted code review tools",         boardId: ids.boardAlphaSprint1, columnId: ids.colBacklog,    status: "BACKLOG",     priority: "NONE",   type: "Task",     percentDone: 0,   dueDate: null, startDate: null, estimatedHours: 4,  tags: ["research", "AI"], createdById: ids.userThomas },

    // ─── DONE tasks ─────────────────────────────────────────────────────
    { id: "task_alp_018", identifier: "ALP-018", title: "Set up CI/CD pipeline",                         boardId: ids.boardAlphaSprint1, columnId: ids.colDone,       status: "DONE",        priority: "HIGH",   type: "Task",     percentDone: 100, dueDate: daysAgo(5),  startDate: daysAgo(20), estimatedHours: 24, tags: ["DevOps", "CI/CD"], createdById: ids.userOmar },
    { id: "task_alp_019", identifier: "ALP-019", title: "Implement user registration flow",              boardId: ids.boardAlphaSprint1, columnId: ids.colDone,       status: "DONE",        priority: "HIGH",   type: "Feature",  percentDone: 100, dueDate: daysAgo(3),  startDate: daysAgo(15), estimatedHours: 32, tags: ["auth", "registration"], createdById: ids.userLayla },
    { id: "task_alp_020", identifier: "ALP-020", title: "Database schema design review",                 boardId: ids.boardAlphaSprint1, columnId: ids.colDone,       status: "DONE",        priority: "URGENT", type: "Task",     percentDone: 100, dueDate: daysAgo(10), startDate: daysAgo(15), estimatedHours: 8,  tags: ["database", "review"], createdById: ids.userThomas },

    // ─── CANCELLED tasks ────────────────────────────────────────────────
    { id: "task_alp_021", identifier: "ALP-021", title: "Build custom reporting engine (replaced by BI tool)", boardId: ids.boardAlphaSprint1, columnId: null, status: "CANCELLED", priority: "MEDIUM", type: "Feature", percentDone: 25, dueDate: null, startDate: daysAgo(30), estimatedHours: 120, tags: ["cancelled", "replaced"], createdById: ids.userThomas },
    { id: "task_alp_022", identifier: "ALP-022", title: "Legacy API v1 deprecation",                     boardId: ids.boardAlphaSprint1, columnId: null,              status: "CANCELLED",   priority: "LOW",    type: "Task",     percentDone: 60,  dueDate: null, startDate: daysAgo(60), estimatedHours: 40, tags: ["deprecated", "api"], createdById: ids.userOmar },

    // ─── Subtasks (parent-child) ────────────────────────────────────────
    { id: "task_alp_023", identifier: "ALP-023", title: "Payment gateway — Subtask: Visa integration",    boardId: ids.boardAlphaSprint1, columnId: ids.colBlocked,    status: "BLOCKED",     priority: "URGENT", type: "Task",     percentDone: 50,  dueDate: daysAgo(3),  startDate: daysAgo(14), estimatedHours: 20, tags: ["payment", "Visa"],  parentId: "task_alp_001", createdById: ids.userLayla },
    { id: "task_alp_024", identifier: "ALP-024", title: "Payment gateway — Subtask: Mastercard integration", boardId: ids.boardAlphaSprint1, columnId: ids.colBlocked, status: "BLOCKED",  priority: "URGENT", type: "Task",     percentDone: 30,  dueDate: daysAgo(3),  startDate: daysAgo(14), estimatedHours: 20, tags: ["payment", "Mastercard"], parentId: "task_alp_001", createdById: ids.userYoussef },
    { id: "task_alp_025", identifier: "ALP-025", title: "Payment gateway — Subtask: Webhook handler fix",  boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "URGENT", type: "Bug",      percentDone: 80,  dueDate: daysAgo(2),  startDate: daysAgo(5),  estimatedHours: 8,  tags: ["payment", "webhook"], parentId: "task_alp_001", createdById: ids.userLayla },

    // ─── Overdue HIGH tasks ─────────────────────────────────────────────
    { id: "task_alp_026", identifier: "ALP-026", title: "Complete GDPR compliance documentation",         boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "HIGH",   type: "Task",     percentDone: 20,  dueDate: daysAgo(7),  startDate: daysAgo(21), estimatedHours: 40, tags: ["legal", "GDPR", "compliance"], createdById: ids.userSara },
    { id: "task_alp_027", identifier: "ALP-027", title: "Performance optimization for dashboard loading", boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "HIGH",   type: "Task",     percentDone: 0,   dueDate: daysAgo(2),  estimatedHours: 16, tags: ["performance", "optimization"], createdById: ids.userOmar },

    // ─── No assignee tasks ──────────────────────────────────────────────
    { id: "task_alp_028", identifier: "ALP-028", title: "Investigate memory leak in worker process",      boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "HIGH",   type: "Bug",      percentDone: 0,   dueDate: daysFromNow(5),  estimatedHours: 16, tags: ["bug", "memory", "investigation"], createdById: ids.userOmar },
    { id: "task_alp_029", identifier: "ALP-029", title: "Write onboarding guide for new developers",      boardId: ids.boardAlphaSprint1, columnId: ids.colBacklog,    status: "BACKLOG",     priority: "LOW",    type: "Task",     percentDone: 0,   dueDate: null, estimatedHours: 8, tags: ["docs", "onboarding"], createdById: ids.userSara },

    // ─── Task with 100% done but not marked DONE (edge case) ────────────
    { id: "task_alp_030", identifier: "ALP-030", title: "Unit tests for auth module",                     boardId: ids.boardAlphaSprint1, columnId: ids.colInReview,   status: "IN_REVIEW",   priority: "MEDIUM", type: "Task",     percentDone: 100, dueDate: daysFromNow(1),  startDate: daysAgo(7),  estimatedHours: 16, tags: ["testing", "auth"], createdById: ids.userLayla },

    // ─── Milestone tasks ────────────────────────────────────────────────
    { id: "task_alp_031", identifier: "ALP-031", title: "🚩 Sprint 4 Release",                           boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "HIGH",   type: "Milestone", percentDone: 55, dueDate: daysFromNow(14), estimatedHours: 0,  tags: ["milestone", "release"], createdById: ids.userThomas },

    // ─── Tasks in Sprint 5 (Planning board) ─────────────────────────────
    { id: "task_alp_032", identifier: "ALP-032", title: "Plan sprint 5 backlog grooming",                 boardId: ids.boardAlphaSprint2, columnId: null,              status: "TODO",        priority: "MEDIUM", type: "Task",     percentDone: 0,   dueDate: daysFromNow(7),  estimatedHours: 4,  tags: ["planning"], createdById: ids.userOmar },
    { id: "task_alp_033", identifier: "ALP-033", title: "Architecture review: microservices migration",   boardId: ids.boardAlphaSprint2, columnId: null,              status: "BACKLOG",     priority: "HIGH",   type: "Task",     percentDone: 0,   dueDate: daysFromNow(30), estimatedHours: 40, tags: ["architecture", "microservices"], createdById: ids.userThomas },

    // ─── Archived task (in archived board) ──────────────────────────────
    { id: "task_alp_034", identifier: "ALP-034", title: "Old login page redesign",                        boardId: ids.boardAlphaArchived, columnId: null,             status: "DONE",        priority: "MEDIUM", type: "Feature",  percentDone: 100, dueDate: daysAgo(60), startDate: daysAgo(90), estimatedHours: 24, tags: ["archived"], isArchived: true, createdById: ids.userThomas },

    // ─── Design department tasks (different board) ──────────────────────
    { id: "task_alp_035", identifier: "ALP-035", title: "Create brand style guide",                       boardId: ids.boardAlphaBacklog, columnId: null,              status: "IN_PROGRESS", priority: "MEDIUM", type: "Task",     percentDone: 60,  dueDate: daysFromNow(7),  estimatedHours: 32, tags: ["branding", "design"], createdById: ids.userAmira },
    { id: "task_alp_036", identifier: "ALP-036", title: "User research interviews analysis",              boardId: ids.boardAlphaBacklog, columnId: null,              status: "TODO",        priority: "HIGH",   type: "Task",     percentDone: 0,   dueDate: daysFromNow(5),  estimatedHours: 16, tags: ["research", "UX"], createdById: ids.userAmira },

    // ─── Marketing department tasks ─────────────────────────────────────
    { id: "task_alp_037", identifier: "ALP-037", title: "Launch campaign for product v2",                 boardId: ids.boardAlphaBacklog, columnId: null,              status: "TODO",        priority: "MEDIUM", type: "Task",     percentDone: 0,   dueDate: daysFromNow(21), estimatedHours: 40, tags: ["marketing", "launch"], createdById: ids.userThomas },
    { id: "task_alp_038", identifier: "ALP-038", title: "SEO optimization for landing page",              boardId: ids.boardAlphaBacklog, columnId: null,              status: "IN_PROGRESS", priority: "LOW",    type: "Task",     percentDone: 40,  dueDate: daysFromNow(14), estimatedHours: 12, tags: ["SEO", "marketing"], createdById: ids.userThomas },


    // ═══ BETA PLATFORM — Main Board ═════════════════════════════════════════

    { id: "task_bet_001", identifier: "BET-001", title: "Real-time data pipeline for analytics",          boardId: ids.boardBetaMain, columnId: null, status: "IN_PROGRESS", priority: "URGENT", type: "Feature",  percentDone: 45, dueDate: daysFromNow(5),  startDate: daysAgo(14), estimatedHours: 80, tags: ["data", "pipeline", "real-time"], createdById: ids.userKarim },
    { id: "task_bet_002", identifier: "BET-002", title: "Dashboard widget: revenue chart",                boardId: ids.boardBetaMain, columnId: null, status: "IN_PROGRESS", priority: "HIGH",   type: "Feature",  percentDone: 60, dueDate: daysFromNow(7),  startDate: daysAgo(10), estimatedHours: 24, tags: ["dashboard", "charts"], createdById: ids.userFatima },
    { id: "task_bet_003", identifier: "BET-003", title: "Fix: Data export CSV encoding issue",            boardId: ids.boardBetaMain, columnId: null, status: "BLOCKED",     priority: "HIGH",   type: "Bug",      percentDone: 30, dueDate: daysAgo(2),  startDate: daysAgo(7),  estimatedHours: 8,  tags: ["export", "bug", "CSV"], description: "Arabic characters corrupted in CSV export. Needs UTF-8 BOM header.", createdById: ids.userFatima },
    { id: "task_bet_004", identifier: "BET-004", title: "API endpoint: user activity feed",               boardId: ids.boardBetaMain, columnId: null, status: "TODO",        priority: "MEDIUM", type: "Feature",  percentDone: 0,  dueDate: daysFromNow(14), estimatedHours: 16, tags: ["api", "activity"], createdById: ids.userKarim },
    { id: "task_bet_005", identifier: "BET-005", title: "Load testing for 10K concurrent users",          boardId: ids.boardBetaMain, columnId: null, status: "TODO",        priority: "HIGH",   type: "Task",     percentDone: 0,  dueDate: daysFromNow(10), estimatedHours: 20, tags: ["testing", "performance"], createdById: ids.userKarim },
    { id: "task_bet_006", identifier: "BET-006", title: "Implement data retention policy (90-day purge)", boardId: ids.boardBetaMain, columnId: null, status: "BACKLOG",     priority: "MEDIUM", type: "Task",     percentDone: 0,  dueDate: null, estimatedHours: 16, tags: ["compliance", "data-retention"], createdById: ids.userKarim },
    { id: "task_bet_007", identifier: "BET-007", title: "Setup monitoring alerts for API health",         boardId: ids.boardBetaMain, columnId: null, status: "DONE",        priority: "HIGH",   type: "Task",     percentDone: 100, dueDate: daysAgo(3), startDate: daysAgo(10), estimatedHours: 8, tags: ["monitoring", "DevOps"], createdById: ids.userKarim },
    { id: "task_bet_008", identifier: "BET-008", title: "Write E2E tests for onboarding flow",            boardId: ids.boardBetaMain, columnId: null, status: "IN_REVIEW",   priority: "MEDIUM", type: "Task",     percentDone: 85, dueDate: daysFromNow(3),  estimatedHours: 12, tags: ["testing", "E2E"], createdById: ids.userFatima },
    { id: "task_bet_009", identifier: "BET-009", title: "Migrate from MongoDB to PostgreSQL",             boardId: ids.boardBetaMain, columnId: null, status: "CANCELLED",   priority: "HIGH",   type: "Task",     percentDone: 10, dueDate: null, startDate: daysAgo(30), estimatedHours: 120, tags: ["database", "migration", "cancelled"], createdById: ids.userKarim },

    // ─── Overdue in Beta ────────────────────────────────────────────────
    { id: "task_bet_010", identifier: "BET-010", title: "Client presentation: Q2 analytics report",       boardId: ids.boardBetaMain, columnId: null, status: "TODO",        priority: "URGENT", type: "Task",     percentDone: 10, dueDate: daysAgo(1), estimatedHours: 16, tags: ["presentation", "client"], createdById: ids.userKarim },
    { id: "task_bet_011", identifier: "BET-011", title: "Fix timezone handling in date filters",          boardId: ids.boardBetaMain, columnId: null, status: "IN_PROGRESS", priority: "MEDIUM", type: "Bug",      percentDone: 40, dueDate: daysAgo(5), startDate: daysAgo(14), estimatedHours: 8, tags: ["bug", "timezone"], createdById: ids.userFatima },

    // ─── Archived board tasks ───────────────────────────────────────────
    { id: "task_bet_012", identifier: "BET-012", title: "Legacy dashboard v1 components",                 boardId: ids.boardBetaArchived, columnId: null, status: "DONE", priority: "LOW", type: "Task", percentDone: 100, dueDate: daysAgo(90), isArchived: true, createdById: ids.userKarim },

    // ─── Unassigned tasks ───────────────────────────────────────────────
    { id: "task_bet_013", identifier: "BET-013", title: "Investigate slow query on users table",          boardId: ids.boardBetaMain, columnId: null, status: "BACKLOG",     priority: "MEDIUM", type: "Bug",      percentDone: 0,  dueDate: null, estimatedHours: 4, tags: ["database", "performance"], createdById: ids.userKarim },
    { id: "task_bet_014", identifier: "BET-014", title: "Design dark mode palette",                      boardId: ids.boardBetaMain, columnId: null, status: "BACKLOG",     priority: "LOW",    type: "Task",     percentDone: 0,  dueDate: null, estimatedHours: 8, tags: ["design", "dark-mode"], createdById: ids.userKarim },
    { id: "task_bet_015", identifier: "BET-015", title: "Setup automated dependency updates (Renovate)",  boardId: ids.boardBetaMain, columnId: null, status: "TODO",        priority: "LOW",    type: "Task",     percentDone: 0,  dueDate: daysFromNow(30), estimatedHours: 4, tags: ["DevOps", "automation"], createdById: ids.userKarim },


    // ═══ GAMMA STARTUP — MVP Board ═══════════════════════════════════════════

    { id: "task_gam_001", identifier: "GAM-001", title: "MVP: User registration & login",                 boardId: ids.boardGammaMain, columnId: null, status: "DONE",        priority: "URGENT", type: "Feature",  percentDone: 100, dueDate: daysAgo(5), startDate: daysAgo(20), estimatedHours: 24, tags: ["MVP", "auth"], createdById: ids.userMona },
    { id: "task_gam_002", identifier: "GAM-002", title: "MVP: Core feature — product listing",            boardId: ids.boardGammaMain, columnId: null, status: "IN_PROGRESS", priority: "URGENT", type: "Feature",  percentDone: 70, dueDate: daysFromNow(3),  startDate: daysAgo(10), estimatedHours: 40, tags: ["MVP", "core"], createdById: ids.userMona },
    { id: "task_gam_003", identifier: "GAM-003", title: "MVP: Payment integration",                       boardId: ids.boardGammaMain, columnId: null, status: "TODO",        priority: "HIGH",   type: "Feature",  percentDone: 0,  dueDate: daysFromNow(7),  estimatedHours: 24, tags: ["MVP", "payment"], createdById: ids.userMona },

    // ─── Edge case: task with very long description ─────────────────────
    { id: "task_alp_039", identifier: "ALP-039", title: "Complex integration: Third-party logistics API",  boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "MEDIUM", type: "Feature", percentDone: 15, dueDate: daysFromNow(21), startDate: daysAgo(2), estimatedHours: 60, tags: ["integration", "logistics", "third-party"], description: "Integration with ShipTrack API v3.2.\n\n## Requirements\n- Real-time shipment tracking webhook\n- Bulk order creation via REST\n- Rate limit: 100 req/min\n- Fallback to polling if webhook fails\n- Store shipment events in our DB for audit\n\n## Dependencies\n- ALP-005 (DB migration) must be done first\n- ALP-001 (Payment gateway) for payment-to-shipment flow\n\n## Risks\n- ShipTrack API has 99.5% uptime SLA (0.5% downtime = 43hrs/year)\n- Their sandbox environment is frequently down\n- Documentation is outdated in several areas\n\n## Acceptance Criteria\n- [ ] Create shipment via API\n- [ ] Receive tracking updates via webhook\n- [ ] Display tracking timeline in UI\n- [ ] Handle API errors gracefully with retry logic", createdById: ids.userThomas },

    // ─── Overdue BLOCKED task (worst case scenario) ─────────────────────
    { id: "task_alp_040", identifier: "ALP-040", title: "Critical: SSL certificate renewal for production", boardId: ids.boardAlphaSprint1, columnId: ids.colBlocked, status: "BLOCKED", priority: "URGENT", type: "Bug", percentDone: 0, dueDate: daysAgo(5), estimatedHours: 2, tags: ["SSL", "production", "critical"], description: "SSL certificate expires in 2 days. Blocked by procurement — purchase order pending finance approval.", createdById: ids.userSara },

    // ─── More tasks for realistic density ────────────────────────────────
    { id: "task_alp_041", identifier: "ALP-041", title: "Implement file upload with S3 storage",          boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "MEDIUM", type: "Feature",  percentDone: 55, dueDate: daysFromNow(10), startDate: daysAgo(7), estimatedHours: 20, tags: ["storage", "S3", "upload"], createdById: ids.userYoussef },
    { id: "task_alp_042", identifier: "ALP-042", title: "Fix: Concurrent edit conflict resolution",       boardId: ids.boardAlphaSprint1, columnId: ids.colInProgress, status: "IN_PROGRESS", priority: "HIGH",   type: "Bug",      percentDone: 35, dueDate: daysFromNow(5),  startDate: daysAgo(4),  estimatedHours: 16, tags: ["bug", "concurrency"], createdById: ids.userLayla },
    { id: "task_alp_043", identifier: "ALP-043", title: "Accessibility audit (WCAG 2.1 AA)",              boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "MEDIUM", type: "Task",     percentDone: 0,  dueDate: daysFromNow(21), estimatedHours: 32, tags: ["accessibility", "WCAG"], createdById: ids.userAmira },
    { id: "task_alp_044", identifier: "ALP-044", title: "Implement WebSocket connection pooling",         boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "HIGH",   type: "Feature",  percentDone: 0,  dueDate: daysFromNow(10), estimatedHours: 24, tags: ["websocket", "performance"], createdById: ids.userOmar },
    { id: "task_alp_045", identifier: "ALP-045", title: "Create seed data script for staging",            boardId: ids.boardAlphaSprint1, columnId: ids.colDone,       status: "DONE",        priority: "LOW",    type: "Task",     percentDone: 100, dueDate: daysAgo(5),  startDate: daysAgo(7), estimatedHours: 4, tags: ["tooling", "seed"], createdById: ids.userThomas },
    { id: "task_alp_046", identifier: "ALP-046", title: "Setup error tracking with Sentry",               boardId: ids.boardAlphaSprint1, columnId: ids.colDone,       status: "DONE",        priority: "HIGH",   type: "Task",     percentDone: 100, dueDate: daysAgo(10), startDate: daysAgo(14), estimatedHours: 8, tags: ["monitoring", "Sentry"], createdById: ids.userOmar },
    { id: "task_alp_047", identifier: "ALP-047", title: "Implement search with Elasticsearch",            boardId: ids.boardAlphaSprint1, columnId: ids.colBacklog,    status: "BACKLOG",     priority: "MEDIUM", type: "Feature",  percentDone: 0,  dueDate: null, estimatedHours: 40, tags: ["search", "Elasticsearch"], createdById: ids.userThomas },
    { id: "task_alp_048", identifier: "ALP-048", title: "Mobile responsive layout fixes",                 boardId: ids.boardAlphaSprint1, columnId: ids.colTodo,       status: "TODO",        priority: "MEDIUM", type: "Task",     percentDone: 0,  dueDate: daysFromNow(14), estimatedHours: 16, tags: ["mobile", "responsive"], createdById: ids.userAmira },
    { id: "task_alp_049", identifier: "ALP-049", title: "Implement two-factor authentication",            boardId: ids.boardAlphaSprint1, columnId: ids.colBacklog,    status: "BACKLOG",     priority: "HIGH",   type: "Feature",  percentDone: 0,  dueDate: null, estimatedHours: 24, tags: ["auth", "2FA", "security"], createdById: ids.userThomas },
    { id: "task_alp_050", identifier: "ALP-050", title: "Performance: Reduce initial bundle size",        boardId: ids.boardAlphaSprint1, columnId: ids.colInReview,   status: "IN_REVIEW",   priority: "MEDIUM", type: "Task",     percentDone: 80, dueDate: daysFromNow(3),  startDate: daysAgo(5), estimatedHours: 12, tags: ["performance", "bundle"], createdById: ids.userYoussef },
  ];
  await prisma.task.createMany({ data: tasksData });
  console.log(`  ✓ ${tasksData.length} tasks created`);


  // ─── Task Assignments ─────────────────────────────────────────────────────
  const assignments: Prisma.TaskAssignmentCreateManyInput[] = [
    // Alpha tasks — distributed across team
    { taskId: "task_alp_001", userId: ids.userLayla },
    { taskId: "task_alp_001", userId: ids.userYoussef },  // Multiple assignees
    { taskId: "task_alp_002", userId: ids.userOmar },
    { taskId: "task_alp_003", userId: ids.userOmar },
    { taskId: "task_alp_004", userId: ids.userThomas },
    { taskId: "task_alp_004", userId: ids.userLayla },
    { taskId: "task_alp_005", userId: ids.userOmar },
    { taskId: "task_alp_006", userId: ids.userYoussef },
    { taskId: "task_alp_007", userId: ids.userLayla },
    { taskId: "task_alp_010", userId: ids.userYoussef },
    { taskId: "task_alp_011", userId: ids.userLayla },
    { taskId: "task_alp_023", userId: ids.userLayla },
    { taskId: "task_alp_024", userId: ids.userYoussef },
    { taskId: "task_alp_025", userId: ids.userLayla },
    { taskId: "task_alp_026", userId: ids.userSara },
    { taskId: "task_alp_030", userId: ids.userLayla },
    { taskId: "task_alp_039", userId: ids.userYoussef },
    { taskId: "task_alp_041", userId: ids.userYoussef },
    { taskId: "task_alp_042", userId: ids.userLayla },
    { taskId: "task_alp_050", userId: ids.userYoussef },
    // task_alp_008, _009, _012, _013, _014, _015, _027, _028, _029 = NO ASSIGNEE (edge case)

    // Beta tasks
    { taskId: "task_bet_001", userId: ids.userKarim },
    { taskId: "task_bet_002", userId: ids.userFatima },
    { taskId: "task_bet_003", userId: ids.userFatima },
    { taskId: "task_bet_005", userId: ids.userKarim },
    { taskId: "task_bet_008", userId: ids.userFatima },
    { taskId: "task_bet_010", userId: ids.userKarim },
    { taskId: "task_bet_011", userId: ids.userFatima },
    // task_bet_004, _006, _013, _014, _015 = NO ASSIGNEE

    // Gamma tasks
    { taskId: "task_gam_001", userId: ids.userMona },
    { taskId: "task_gam_002", userId: ids.userMona },
    // task_gam_003 = NO ASSIGNEE
  ];
  await prisma.taskAssignment.createMany({ data: assignments });
  console.log(`  ✓ ${assignments.length} task assignments`);


  // ─── Task Dependencies (all DependencyType values) ────────────────────────
  const dependencies: Prisma.TaskDependencyCreateManyInput[] = [
    // BLOCKS: Payment gateway blocks the logistics integration
    { taskId: "task_alp_039", dependsOnId: "task_alp_001", type: "BLOCKS" },
    // REQUIRES: SSO requires DB migration first
    { taskId: "task_alp_004", dependsOnId: "task_alp_005", type: "REQUIRES" },
    // FOLLOWS: Notification system follows rate limiting
    { taskId: "task_alp_006", dependsOnId: "task_alp_007", type: "FOLLOWS" },
    // PRECEDES: Auth module tests precede security audit
    { taskId: "task_alp_030", dependsOnId: "task_alp_002", type: "PRECEDES" },
    // PART_OF: Visa subtask is part of payment gateway parent
    { taskId: "task_alp_023", dependsOnId: "task_alp_001", type: "PART_OF" },
    { taskId: "task_alp_024", dependsOnId: "task_alp_001", type: "PART_OF" },
    { taskId: "task_alp_025", dependsOnId: "task_alp_001", type: "PART_OF" },
    // RELATES_TO: Performance optimization related to bundle size
    { taskId: "task_alp_027", dependsOnId: "task_alp_050", type: "RELATES_TO" },
    // DUPLICATES: GDPR docs overlap with compliance audit
    { taskId: "task_alp_026", dependsOnId: "task_alp_008", type: "DUPLICATES" },
    // BLOCKS: SSL blocks deployment pipeline
    { taskId: "task_alp_040", dependsOnId: "task_alp_018", type: "BLOCKS" },
    // Chain: Rate limiting → Audit log → GDPR compliance
    { taskId: "task_alp_008", dependsOnId: "task_alp_007", type: "FOLLOWS" },
    { taskId: "task_alp_026", dependsOnId: "task_alp_008", type: "BLOCKS" },
    // Beta dependencies
    { taskId: "task_bet_001", dependsOnId: "task_bet_007", type: "REQUIRES" },
    { taskId: "task_bet_005", dependsOnId: "task_bet_001", type: "BLOCKS" },
    { taskId: "task_bet_002", dependsOnId: "task_bet_001", type: "RELATES_TO" },
    // Gamma dependency chain
    { taskId: "task_gam_002", dependsOnId: "task_gam_001", type: "FOLLOWS" },
    { taskId: "task_gam_003", dependsOnId: "task_gam_002", type: "BLOCKS" },
  ];
  await prisma.taskDependency.createMany({ data: dependencies });
  console.log(`  ✓ ${dependencies.length} task dependencies`);


  // ─── Comments with mentions ───────────────────────────────────────────────
  const comments: Prisma.CommentCreateManyInput[] = [
    // Active discussion on blocked payment task
    { id: "comment_001", taskId: "task_alp_001", authorId: ids.userLayla,   content: "I've identified the issue — Visa changed their webhook payload format. The `transaction_id` field is now `txn_id`. Working on a fix.", createdAt: daysAgo(2) },
    { id: "comment_002", taskId: "task_alp_001", authorId: ids.userThomas,  content: "@omar this is blocking 3 other tasks. Can we prioritize getting a hotfix deployed today?", createdAt: daysAgo(2) },
    { id: "comment_003", taskId: "task_alp_001", authorId: ids.userOmar,    content: "Agreed. @youssef can you help Layla with the Mastercard integration while she handles Visa?", createdAt: daysAgo(1) },
    { id: "comment_004", taskId: "task_alp_001", authorId: ids.userYoussef, content: "On it. I'll start on the Mastercard integration this afternoon.", createdAt: daysAgo(1) },
    { id: "comment_005", taskId: "task_alp_001", authorId: ids.userSara,    content: "This is causing revenue loss. @thomas should we escalate to the client?", createdAt: hoursAgo(6) },

    // Security audit discussion
    { id: "comment_006", taskId: "task_alp_002", authorId: ids.userOmar,    content: "The CVE affects our `jsonwebtoken` dependency. Upgrade path requires breaking changes to our auth middleware.", createdAt: daysAgo(3) },
    { id: "comment_007", taskId: "task_alp_002", authorId: ids.userThomas,  content: "How long to fix? We can't ship with a known critical CVE.", createdAt: daysAgo(3) },
    { id: "comment_008", taskId: "task_alp_002", authorId: ids.userOmar,    content: "Estimate 2 days for the fix + 1 day for regression testing. Blocked by our SSO work (ALP-004) — need to update tokens there too.", createdAt: daysAgo(2) },

    // SSO task
    { id: "comment_009", taskId: "task_alp_004", authorId: ids.userLayla,   content: "SAML integration is 60% done. The IdP configuration is complex — each enterprise client has different settings.", createdAt: daysAgo(1) },
    { id: "comment_010", taskId: "task_alp_004", authorId: ids.userThomas,  content: "Client meeting tomorrow. Need at least a demo-ready sandbox by EOD.", createdAt: hoursAgo(12) },

    // DB migration
    { id: "comment_011", taskId: "task_alp_005", authorId: ids.userOmar,    content: "Migration script tested on staging. Zero downtime achieved with blue-green deployment strategy.", createdAt: daysAgo(1) },

    // Done task comments
    { id: "comment_012", taskId: "task_alp_018", authorId: ids.userOmar,    content: "CI/CD pipeline is live. Build times down from 12min to 3min with parallel jobs.", createdAt: daysAgo(5) },
    { id: "comment_013", taskId: "task_alp_019", authorId: ids.userLayla,   content: "Registration flow complete with email verification, Google OAuth, and rate limiting.", createdAt: daysAgo(3) },

    // Beta comments
    { id: "comment_014", taskId: "task_bet_003", authorId: ids.userFatima,  content: "The encoding issue is in the BOM handling. Arabic text needs UTF-8 with BOM for Excel compatibility.", createdAt: daysAgo(3) },
    { id: "comment_015", taskId: "task_bet_003", authorId: ids.userKarim,   content: "Blocked — waiting for the encoding library maintainer to merge our PR.", createdAt: daysAgo(2) },
    { id: "comment_016", taskId: "task_bet_010", authorId: ids.userKarim,   content: "Client presentation was supposed to be yesterday. Need to prepare slides ASAP.", createdAt: hoursAgo(3) },

    // Gamma comments
    { id: "comment_017", taskId: "task_gam_002", authorId: ids.userMona,    content: "Product listing is coming along. Image upload and search filters still needed.", createdAt: daysAgo(1) },

    // Resolved task with many comments (stress test)
    { id: "comment_018", taskId: "task_alp_020", authorId: ids.userThomas,  content: "Initial schema design attached. Please review.", createdAt: daysAgo(16) },
    { id: "comment_019", taskId: "task_alp_020", authorId: ids.userOmar,    content: "Looks good. Suggest adding indexes on the `status` and `dueDate` columns.", createdAt: daysAgo(15) },
    { id: "comment_020", taskId: "task_alp_020", authorId: ids.userSara,    content: "We need to consider the AI tables too. Added schema for AIRequest and AIProposedAction.", createdAt: daysAgo(14) },
  ];
  await prisma.comment.createMany({ data: comments });

  // Mentions
  await prisma.mention.createMany({
    data: [
      { commentId: "comment_002", mentionedId: ids.userOmar },
      { commentId: "comment_003", mentionedId: ids.userYoussef },
      { commentId: "comment_005", mentionedId: ids.userThomas },
    ],
  });
  console.log(`  ✓ ${comments.length} comments with mentions`);


  // ─── Time Logs ────────────────────────────────────────────────────────────
  const timeLogs: Prisma.TimeLogCreateManyInput[] = [
    // Payment gateway work
    { taskId: "task_alp_001", userId: ids.userLayla,   hours: 16, loggedAt: daysAgo(10), note: "Initial Visa integration" },
    { taskId: "task_alp_001", userId: ids.userLayla,   hours: 8,  loggedAt: daysAgo(3),  note: "Debugging webhook issues" },
    { taskId: "task_alp_001", userId: ids.userYoussef,  hours: 12, loggedAt: daysAgo(5),  note: "Mastercard integration" },
    { taskId: "task_alp_001", userId: ids.userYoussef,  hours: 4,  loggedAt: daysAgo(1),  note: "Mastercard testing" },
    // SSO work
    { taskId: "task_alp_004", userId: ids.userThomas,  hours: 20, loggedAt: daysAgo(8),  note: "SAML configuration" },
    { taskId: "task_alp_004", userId: ids.userThomas,  hours: 16, loggedAt: daysAgo(3),  note: "Enterprise IdP integration" },
    { taskId: "task_alp_004", userId: ids.userLayla,   hours: 12, loggedAt: daysAgo(5),  note: "Token handling" },
    // DB migration
    { taskId: "task_alp_005", userId: ids.userOmar,    hours: 8,  loggedAt: daysAgo(4),  note: "Schema migration script" },
    { taskId: "task_alp_005", userId: ids.userOmar,    hours: 6,  loggedAt: daysAgo(1),  note: "Testing on staging" },
    // Other tasks
    { taskId: "task_alp_006", userId: ids.userYoussef, hours: 12, loggedAt: daysAgo(6),  note: "WebSocket implementation" },
    { taskId: "task_alp_007", userId: ids.userLayla,   hours: 10, loggedAt: daysAgo(8),  note: "Rate limiter middleware" },
    { taskId: "task_alp_010", userId: ids.userYoussef, hours: 8,  loggedAt: daysAgo(2),  note: "Chart widgets" },
    { taskId: "task_alp_018", userId: ids.userOmar,    hours: 20, loggedAt: daysAgo(6),  note: "GitHub Actions pipeline setup" },
    { taskId: "task_alp_019", userId: ids.userLayla,   hours: 24, loggedAt: daysAgo(4),  note: "Full registration flow" },
    { taskId: "task_alp_042", userId: ids.userLayla,   hours: 4,  loggedAt: daysAgo(2),  note: "Conflict resolution research" },
    // Beta time logs
    { taskId: "task_bet_001", userId: ids.userKarim,   hours: 20, loggedAt: daysAgo(7),  note: "Data pipeline architecture" },
    { taskId: "task_bet_002", userId: ids.userFatima,  hours: 12, loggedAt: daysAgo(5),  note: "Revenue chart component" },
    { taskId: "task_bet_011", userId: ids.userFatima,  hours: 4,  loggedAt: daysAgo(3),  note: "Timezone debugging" },
    // Gamma
    { taskId: "task_gam_001", userId: ids.userMona,    hours: 18, loggedAt: daysAgo(8),  note: "Auth flow implementation" },
    { taskId: "task_gam_002", userId: ids.userMona,    hours: 14, loggedAt: daysAgo(3),  note: "Product listing CRUD" },
  ];
  await prisma.timeLog.createMany({ data: timeLogs });
  console.log(`  ✓ ${timeLogs.length} time logs`);


  // ─── Approvals ────────────────────────────────────────────────────────────
  await prisma.approval.createMany({
    data: [
      // Pending approval
      { id: "approval_001", taskId: "task_alp_005", requestedById: ids.userOmar,    reviewerId: ids.userThomas, status: "PENDING",   comment: "Ready to run migration on production", requestedAt: daysAgo(1) },
      { id: "approval_002", taskId: "task_alp_007", requestedById: ids.userLayla,   reviewerId: ids.userOmar,   status: "PENDING",   comment: "Rate limiting PR ready for review", requestedAt: daysAgo(2) },
      // Approved
      { id: "approval_003", taskId: "task_alp_018", requestedById: ids.userOmar,    reviewerId: ids.userThomas, status: "APPROVED",  comment: "CI/CD pipeline tested and verified", requestedAt: daysAgo(7), resolvedAt: daysAgo(6) },
      { id: "approval_004", taskId: "task_alp_019", requestedById: ids.userLayla,   reviewerId: ids.userSara,   status: "APPROVED",  comment: "Registration flow looks good", requestedAt: daysAgo(5), resolvedAt: daysAgo(4) },
      // Rejected
      { id: "approval_005", taskId: "task_alp_030", requestedById: ids.userLayla,   reviewerId: ids.userOmar,   status: "REJECTED",  comment: "Need more edge case coverage", requestedAt: daysAgo(3), resolvedAt: daysAgo(2) },
      // Withdrawn
      { id: "approval_006", taskId: "task_alp_021", requestedById: ids.userThomas,  reviewerId: ids.userSara,   status: "WITHDRAWN", comment: "Replaced by BI tool decision", requestedAt: daysAgo(20), resolvedAt: daysAgo(15) },
    ],
  });
  console.log("  ✓ Approvals");


  // ─── Watchers ─────────────────────────────────────────────────────────────
  await prisma.watcher.createMany({
    data: [
      { taskId: "task_alp_001", userId: ids.userThomas },
      { taskId: "task_alp_001", userId: ids.userSara },
      { taskId: "task_alp_004", userId: ids.userThomas },
      { taskId: "task_alp_002", userId: ids.userSara },
      { taskId: "task_bet_001", userId: ids.userKarim },
    ],
  });
  console.log("  ✓ Watchers");


  // ─── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { id: "notif_001", userId: ids.userThomas, spaceId: ids.spaceAlpha, type: "TASK_ASSIGNED",  priority: "HIGH",     channel: "IN_APP", title: "You were assigned to ALP-004",    body: "SSO authentication task assigned to you",        entityType: "task", entityId: "task_alp_004", status: "DELIVERED", deliveredAt: daysAgo(10) },
      { id: "notif_002", userId: ids.userOmar,   spaceId: ids.spaceAlpha, type: "COMMENT_MENTION",priority: "NORMAL",   channel: "IN_APP", title: "Thomas mentioned you",           body: "in ALP-001: Can we prioritize getting a hotfix?", entityType: "comment", entityId: "comment_002", status: "READ", readAt: daysAgo(2), deliveredAt: daysAgo(2) },
      { id: "notif_003", userId: ids.userThomas, spaceId: ids.spaceAlpha, type: "APPROVAL_REQUESTED",priority: "CRITICAL",channel: "IN_APP", title: "Approval needed: DB migration",  body: "Omar requested approval to run migration on prod",entityType: "approval", entityId: "approval_001", status: "PENDING" },
      { id: "notif_004", userId: ids.userKarim,  spaceId: ids.spaceBeta,  type: "TASK_DUE",       priority: "CRITICAL", channel: "IN_APP", title: "BET-010 is overdue!",            body: "Client presentation was due yesterday",          entityType: "task", entityId: "task_bet_010", status: "DELIVERED", deliveredAt: daysAgo(1) },
      { id: "notif_005", userId: ids.userSara,   spaceId: ids.spaceAlpha, type: "AI_INSIGHT",     priority: "NORMAL",   channel: "IN_APP", title: "AI: Risk detected in Alpha",     body: "3 blocked tasks and 2 overdue tasks found",      status: "QUEUED" },
      { id: "notif_006", userId: ids.userMona,   spaceId: ids.spaceGamma, type: "SYSTEM",         priority: "LOW",      channel: "IN_APP", title: "Welcome to Gamma Startup",       body: "Your space is ready. Start by creating tasks.",   status: "READ", readAt: daysAgo(28), deliveredAt: daysAgo(30) },
      { id: "notif_007", userId: ids.userZainab, spaceId: ids.spaceGamma, type: "TASK_ASSIGNED",  priority: "NORMAL",   channel: "EMAIL",  title: "You're invited to Gamma",        body: "Mona invited you to join Gamma Startup space",   status: "FAILED", failedAt: daysAgo(1) },
      { id: "notif_008", userId: ids.userThomas, spaceId: ids.spaceAlpha, type: "TASK_UPDATED",   priority: "NORMAL",   channel: "PUSH",   title: "ALP-007 moved to In Review",     body: "API rate limiting middleware is now in review",   status: "DISMISSED" },
      { id: "notif_009", userId: ids.userLayla,  spaceId: ids.spaceAlpha, type: "TASK_DUE",       priority: "HIGH",     channel: "IN_APP", title: "ALP-042 due in 5 days",          body: "Concurrent edit conflict resolution deadline approaching", status: "DELIVERED", deliveredAt: hoursAgo(6) },
      { id: "notif_010", userId: ids.userThomas, spaceId: ids.spaceAlpha, type: "FILE_UPLOADED",  priority: "LOW",      channel: "IN_APP", title: "New file in ALP-020",            body: "Schema design document uploaded",                 status: "EXPIRED" },
    ],
  });
  console.log("  ✓ Notifications");


  // ─── Audit Logs ───────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { id: "audit_001", userId: ids.userThomas,  action: "space.created",       entityType: "space",   entityId: ids.spaceAlpha,  timestamp: daysAgo(90), diff: { name: { from: null, to: "Alpha Project" } } },
      { id: "audit_002", userId: ids.userSara,     action: "member.invited",      entityType: "space",   entityId: ids.spaceAlpha,  timestamp: daysAgo(85), diff: { email: "omar@mongez.io", role: "HEAD" } },
      { id: "audit_003", userId: ids.userOmar,     action: "task.created",        entityType: "task",    entityId: "task_alp_001",  timestamp: daysAgo(14), diff: { title: "Fix payment gateway integration failure" } },
      { id: "audit_004", userId: ids.userOmar,     action: "task.status_changed", entityType: "task",    entityId: "task_alp_001",  timestamp: daysAgo(3),  diff: { status: { from: "IN_PROGRESS", to: "BLOCKED" } } },
      { id: "audit_005", userId: ids.userThomas,   action: "task.created",        entityType: "task",    entityId: "task_alp_004",  timestamp: daysAgo(12), diff: { title: "Implement SSO authentication" } },
      { id: "audit_006", userId: ids.userOmar,     action: "task.created",        entityType: "task",    entityId: "task_alp_005",  timestamp: daysAgo(7),  diff: { title: "Database migration to PostgreSQL 16" } },
      { id: "audit_007", userId: ids.userOmar,     action: "task.status_changed", entityType: "task",    entityId: "task_alp_018",  timestamp: daysAgo(5),  diff: { status: { from: "IN_REVIEW", to: "DONE" } } },
      { id: "audit_008", userId: ids.userKarim,    action: "space.created",       entityType: "space",   entityId: ids.spaceBeta,   timestamp: daysAgo(60) },
      { id: "audit_009", userId: ids.userThomas,   action: "task.priority_changed",entityType: "task",   entityId: "task_alp_040",  timestamp: daysAgo(7),  diff: { priority: { from: "HIGH", to: "URGENT" } } },
      { id: "audit_010", userId: ids.userSara,     action: "task.archived",       entityType: "task",    entityId: "task_alp_021",  timestamp: daysAgo(15), diff: { status: { from: "IN_PROGRESS", to: "CANCELLED" } } },
    ],
  });
  console.log("  ✓ Audit logs");


  // ─── AI Requests — All intents and statuses ──────────────────────────────
  await prisma.aIRequest.createMany({
    data: [
      // ─── Completed AI requests ────────────────────────────────────────
      { id: "ai_req_001", traceId: "trace_chat_001", userId: ids.userThomas, spaceId: ids.spaceAlpha, intent: "chat",    rawInput: "What tasks are currently blocked?", rewrittenQuery: "Show me all tasks with BLOCKED status in Alpha Project", finalResponse: "There are currently 3 blocked tasks in Alpha Project:\n\n1. **ALP-001** — Fix payment gateway integration (URGENT, 3 days overdue)\n2. **ALP-002** — Security audit: patch CVE-2024-1234 (URGENT, 1 day overdue)\n3. **ALP-040** — SSL certificate renewal (URGENT, 5 days overdue)\n\nAll three are marked URGENT and overdue. The payment gateway issue is causing revenue loss.", modelUsed: "llama-3.3-70b-versatile", tokensIn: 450, tokensOut: 120, latencyMs: 1850, ttftMs: 320, qualityScore: 0.92, status: "completed", createdAt: daysAgo(1) },

      { id: "ai_req_002", traceId: "trace_risk_001", userId: ids.userThomas, spaceId: ids.spaceAlpha, intent: "risk",    rawInput: "Analyze risks for Alpha Project Sprint 4", rewrittenQuery: "Identify all risk factors in Alpha Project Sprint 4 including blocked, overdue, and unassigned tasks", finalResponse: "## ⚠️ Risk Analysis — Alpha Project Sprint 4\n\n### Critical Risks (3)\n- **ALP-001** (BLOCKED, URGENT): Payment gateway down for 3 days — **$15K revenue loss**\n- **ALP-002** (BLOCKED, URGENT): Critical CVE unpatched — security vulnerability\n- **ALP-040** (BLOCKED, URGENT): SSL cert expires in 2 days — **site will go down**\n\n### High Risks (4)\n- **ALP-004** (IN_PROGRESS, URGENT): SSO due in 2 days, 35% remaining\n- **ALP-026** (IN_PROGRESS, HIGH): GDPR docs 7 days overdue, only 20% done\n- **ALP-027** (TODO, HIGH): Performance optimization 2 days overdue, not started\n- **ALP-003** (TODO, URGENT): Data leak hotfix not started\n\n### Warnings (3)\n- 5 tasks have NO assignee\n- ALP-030 is 100% done but still IN_REVIEW\n- Sprint deadline in 14 days with 55% overall completion\n\n### Recommendation\nImmediately unblock ALP-001 and ALP-040. Assign owners to unassigned urgent tasks.", modelUsed: "llama-3.3-70b-versatile", tokensIn: 680, tokensOut: 280, latencyMs: 3200, ttftMs: 450, qualityScore: 0.95, status: "completed", createdAt: daysAgo(1) },

      { id: "ai_req_003", traceId: "trace_report_001", userId: ids.userSara, spaceId: ids.spaceAlpha, intent: "report",  rawInput: "Generate weekly status report for Alpha Project", rewrittenQuery: "Create a comprehensive weekly status report for Alpha Project including task progress, team velocity, and blockers", finalResponse: "## Alpha Project — Weekly Status Report\n\n### Summary\n- **Total Tasks**: 50\n- **Completed**: 6 (12%)\n- **In Progress**: 8 (16%)\n- **Blocked**: 3 (6%)\n- **Overdue**: 5 (10%)\n- **Overall Completion**: 55%\n\n### Team Velocity\n| Member | Hours Logged | Tasks Completed |\n|--------|-------------|----------------|\n| Omar | 34h | 3 |\n| Layla | 62h | 2 |\n| Youssef | 36h | 1 |\n| Thomas | 36h | 0 (management) |\n\n### Key Blockers\n1. Payment gateway (ALP-001) — third-party API change\n2. Security CVE (ALP-002) — blocked by SSO work\n3. SSL certificate (ALP-040) — procurement delay\n\n### At Risk\n- Sprint 4 deadline (14 days) with 45% remaining work\n- GDPR compliance documentation overdue\n\n### Recommendations\n1. Escalate SSL cert procurement\n2. Parallelize payment gateway subtasks\n3. Assign owners to 5 unassigned tasks", modelUsed: "llama-3.3-70b-versatile", tokensIn: 520, tokensOut: 350, latencyMs: 4100, ttftMs: 500, qualityScore: 0.88, status: "completed", createdAt: daysAgo(2) },

      { id: "ai_req_004", traceId: "trace_action_001", userId: ids.userOmar, spaceId: ids.spaceAlpha, intent: "action",  rawInput: "Assign the SSL certificate task to Sara", rewrittenQuery: "Assign task ALP-040 (SSL certificate renewal) to user Sara Ahmed", finalResponse: "I'll propose assigning the SSL certificate renewal task (ALP-040) to Sara Ahmed. Since this involves changing task assignments, it requires your approval.", modelUsed: "llama-3.3-70b-versatile", tokensIn: 180, tokensOut: 45, latencyMs: 1200, ttftMs: 280, status: "completed", createdAt: daysAgo(1) },

      // Chat about Beta
      { id: "ai_req_005", traceId: "trace_chat_002", userId: ids.userKarim, spaceId: ids.spaceBeta, intent: "chat", rawInput: "How's the Beta platform progress?", finalResponse: "## Beta Platform Status\n\n**Overall**: 9 active tasks, 3 at risk\n\n**At Risk**:\n- BET-003 (BLOCKED): CSV encoding bug, waiting on library PR\n- BET-010 (OVERDUE): Client presentation was due yesterday\n- BET-011 (OVERDUE): Timezone bug, 5 days overdue\n\n**Going Well**:\n- BET-001: Data pipeline 45% complete, on track\n- BET-002: Revenue chart 60% done\n- BET-008: E2E tests in review\n\n**Recommendation**: Prepare the client presentation (BET-010) immediately — it's already overdue.", modelUsed: "llama-3.3-70b-versatile", tokensIn: 350, tokensOut: 150, latencyMs: 2100, ttftMs: 350, qualityScore: 0.90, status: "completed", createdAt: daysAgo(1) },

      // ─── Failed AI requests ───────────────────────────────────────────
      { id: "ai_req_006", traceId: "trace_fail_001", userId: ids.userThomas, spaceId: ids.spaceAlpha, intent: "chat", rawInput: "What's the weather like?", finalResponse: null, status: "failed", errorMessage: "Groq API timeout after 30s — model overloaded", latencyMs: 30000, createdAt: hoursAgo(4) },
      { id: "ai_req_007", traceId: "trace_fail_002", userId: ids.userSara, spaceId: ids.spaceAlpha, intent: "report", rawInput: "Generate annual report", finalResponse: null, status: "failed", errorMessage: "Intent router returned unexpected value: 'weather'", createdAt: hoursAgo(2) },

      // ─── Pending AI request (in progress) ─────────────────────────────
      { id: "ai_req_008", traceId: "trace_pending_001", userId: ids.userThomas, spaceId: ids.spaceAlpha, intent: "chat", rawInput: "Show me the critical path for Sprint 4", status: "pending", createdAt: new Date() },

      // ─── With user feedback ───────────────────────────────────────────
      { id: "ai_req_009", traceId: "trace_chat_003", userId: ids.userThomas, spaceId: ids.spaceAlpha, intent: "chat", rawInput: "Who is working on what?", finalResponse: "Here's the team allocation for Alpha Project:\n\n- **Layla**: ALP-001 (payment), ALP-007 (rate limiting), ALP-042 (concurrent edits)\n- **Youssef**: ALP-001 (payment), ALP-006 (notifications), ALP-010 (dashboard), ALP-041 (file upload)\n- **Omar**: ALP-002 (security), ALP-003 (hotfix), ALP-005 (DB migration)\n- **Thomas**: ALP-004 (SSO)\n- **Amira**: ALP-035 (style guide), ALP-036 (user research)", modelUsed: "llama-3.3-70b-versatile", tokensIn: 280, tokensOut: 130, latencyMs: 1500, ttftMs: 250, qualityScore: 0.94, userFeedback: 1, feedbackNote: "Very helpful overview!", status: "completed", createdAt: daysAgo(3) },

      { id: "ai_req_010", traceId: "trace_risk_002", userId: ids.userKarim, spaceId: ids.spaceBeta, intent: "risk", rawInput: "Are there any risks in the Beta project?", finalResponse: "## Beta Platform — Risk Analysis\n\n**Critical**: BET-010 (client presentation) is overdue — this could damage client relationship.\n\n**High**: BET-003 (CSV encoding) blocked for 2 days with no resolution timeline.\n\n**Medium**: BET-011 (timezone bug) 5 days overdue with only 40% progress.", modelUsed: "llama-3.3-70b-versatile", tokensIn: 320, tokensOut: 85, latencyMs: 1800, ttftMs: 300, qualityScore: 0.87, userFeedback: -1, feedbackNote: "Missed the BET-001 pipeline risk — it has a dependency on the completed monitoring task but the pipeline itself is behind schedule.", status: "completed", createdAt: daysAgo(1) },
    ],
  });
  console.log("  ✓ AI requests (all intents & statuses)");


  // ─── AI Proposed Actions — All command types and statuses ──────────────────
  await prisma.aIProposedAction.createMany({
    data: [
      // AssignTask — Pending
      { id: "ai_action_001", traceId: "trace_action_001", spaceId: ids.spaceAlpha, commandType: "AssignTask", payload: { taskId: "task_alp_040", userId: ids.userSara, reason: "Sara is ADMIN and has capacity" }, reason: "ALP-040 (SSL renewal) has no assignee and is 5 days overdue. Sara has availability.", status: "PENDING", createdAt: daysAgo(1) },

      // AssignTask — Approved
      { id: "ai_action_002", traceId: "trace_chat_003", spaceId: ids.spaceAlpha, commandType: "AssignTask", payload: { taskId: "task_alp_028", userId: ids.userOmar, reason: "Omar is best suited for investigation tasks" }, reason: "ALP-028 (memory leak investigation) is unassigned and HIGH priority. Omar has relevant expertise.", status: "APPROVED", reviewedById: ids.userThomas, reviewedAt: daysAgo(2), createdAt: daysAgo(3) },

      // EscalateTask — Pending
      { id: "ai_action_003", traceId: "trace_risk_001", spaceId: ids.spaceAlpha, commandType: "EscalateTask", payload: { taskId: "task_alp_001", escalateTo: "management", reason: "Revenue loss > $15K" }, reason: "Payment gateway has been blocked for 3 days with $15K+ revenue loss. Requires management escalation.", status: "PENDING", createdAt: daysAgo(1) },

      // UpdateTask — Approved
      { id: "ai_action_004", traceId: "trace_chat_001", spaceId: ids.spaceAlpha, commandType: "UpdateTask", payload: { taskId: "task_alp_030", field: "status", value: "DONE", reason: "100% complete and approved" }, reason: "ALP-030 is 100% done but still IN_REVIEW. Suggest moving to DONE.", status: "APPROVED", reviewedById: ids.userOmar, reviewedAt: daysAgo(1), createdAt: daysAgo(2) },

      // UpdateTask — Rejected
      { id: "ai_action_005", traceId: "trace_risk_001", spaceId: ids.spaceAlpha, commandType: "UpdateTask", payload: { taskId: "task_alp_026", field: "priority", value: "URGENT", reason: "GDPR compliance is overdue" }, reason: "ALP-026 (GDPR docs) is 7 days overdue. Suggest escalating priority from HIGH to URGENT.", status: "REJECTED", reviewedById: ids.userSara, reviewedAt: daysAgo(1), createdAt: daysAgo(2) },

      // CreateTask — Pending
      { id: "ai_action_006", traceId: "trace_risk_001", spaceId: ids.spaceAlpha, commandType: "CreateTask", payload: { title: "Emergency: Contact ShipTrack API support", boardId: ids.boardAlphaSprint1, priority: "URGENT", tags: ["integration", "urgent"], assignTo: ids.userYoussef }, reason: "ShipTrack API (ALP-039 dependency) has unreliable sandbox. Need dedicated support contact.", status: "PENDING", createdAt: daysAgo(1) },

      // CreateReminder — Approved
      { id: "ai_action_007", traceId: "trace_chat_002", spaceId: ids.spaceBeta, commandType: "CreateReminder", payload: { taskId: "task_bet_010", remindAt: daysFromNow(1), message: "Prepare client presentation slides" }, reason: "BET-010 client presentation is overdue. Setting reminder for tomorrow.", status: "APPROVED", reviewedById: ids.userKarim, reviewedAt: daysAgo(1), createdAt: daysAgo(2) },

      // AssignTask — for Beta (multiple assignees scenario)
      { id: "ai_action_008", traceId: "trace_chat_002", spaceId: ids.spaceBeta, commandType: "AssignTask", payload: { taskId: "task_bet_004", userId: ids.userFatima, reason: "Fatima has bandwidth after completing BET-008" }, reason: "BET-004 (activity feed API) is unassigned. Fatima is completing BET-008 (E2E tests) and has capacity.", status: "PENDING", createdAt: daysAgo(1) },
    ],
  });
  console.log("  ✓ AI proposed actions (all command types & statuses)");


  // ─── Activities ───────────────────────────────────────────────────────────
  await prisma.activity.createMany({
    data: [
      { userId: ids.userLayla,   taskId: "task_alp_001", type: "comment_added",  data: { commentId: "comment_001" }, createdAt: daysAgo(2) },
      { userId: ids.userThomas,  taskId: "task_alp_001", type: "comment_added",  data: { commentId: "comment_002" }, createdAt: daysAgo(2) },
      { userId: ids.userOmar,    taskId: "task_alp_005", type: "status_changed", data: { from: "TODO", to: "IN_PROGRESS" }, createdAt: daysAgo(5) },
      { userId: ids.userOmar,    taskId: "task_alp_018", type: "status_changed", data: { from: "IN_REVIEW", to: "DONE" }, createdAt: daysAgo(5) },
      { userId: ids.userLayla,   taskId: "task_alp_019", type: "status_changed", data: { from: "IN_REVIEW", to: "DONE" }, createdAt: daysAgo(3) },
      { userId: ids.userThomas,  taskId: "task_alp_004", type: "assigned",       data: { assignee: "Layla" }, createdAt: daysAgo(10) },
      { userId: ids.userKarim,   taskId: "task_bet_001", type: "created",        data: {}, createdAt: daysAgo(14) },
      { userId: ids.userMona,    taskId: "task_gam_001", type: "status_changed", data: { from: "IN_PROGRESS", to: "DONE" }, createdAt: daysAgo(5) },
    ],
  });
  console.log("  ✓ Activities");


  // ─── Task Journal Entries ─────────────────────────────────────────────────
  await prisma.taskJournal.createMany({
    data: [
      { taskId: "task_alp_001", userId: ids.userOmar,     changes: { field: "status", from: "IN_PROGRESS", to: "BLOCKED" }, note: "Visa API changed webhook format", createdAt: daysAgo(3) },
      { taskId: "task_alp_001", userId: ids.userThomas,   changes: { field: "priority", from: "HIGH", to: "URGENT" }, note: "Revenue impact escalated", createdAt: daysAgo(3) },
      { taskId: "task_alp_004", userId: ids.userThomas,   changes: { field: "percentDone", from: 50, to: 65 }, note: "SAML config for client A completed", createdAt: daysAgo(2) },
      { taskId: "task_alp_005", userId: ids.userOmar,     changes: { field: "percentDone", from: 50, to: 70 }, note: "Migration script tested on staging", createdAt: daysAgo(1) },
      { taskId: "task_alp_018", userId: ids.userOmar,     changes: { field: "status", from: "IN_REVIEW", to: "DONE" }, createdAt: daysAgo(5) },
      { taskId: "task_alp_021", userId: ids.userThomas,   changes: { field: "status", from: "IN_PROGRESS", to: "CANCELLED" }, note: "Replaced by Tableau BI integration", createdAt: daysAgo(15) },
      { taskId: "task_alp_040", userId: ids.userSara,     changes: { field: "status", from: "TODO", to: "BLOCKED" }, note: "Procurement requires finance approval", createdAt: daysAgo(7) },
    ],
  });
  console.log("  ✓ Task journal entries");


  // ─── User Logs ────────────────────────────────────────────────────────────
  await prisma.userLog.createMany({
    data: [
      { userId: ids.userThomas, action: "login",  ipAddress: "192.168.1.100", userAgent: "Chrome/120", createdAt: hoursAgo(1) },
      { userId: ids.userThomas, action: "ai_query", ipAddress: "192.168.1.100", metadata: { traceId: "trace_chat_001" }, createdAt: daysAgo(1) },
      { userId: ids.userOmar,   action: "login",  ipAddress: "10.0.0.50", createdAt: daysAgo(1) },
      { userId: ids.userHassan, action: "login_failed", ipAddress: "可疑IP", metadata: { reason: "account_suspended" }, createdAt: daysAgo(60) },
    ],
  });
  console.log("  ✓ User logs");


  console.log("\n✅ Complex seed data complete!");
  console.log("   Spaces    : 4 (Alpha, Beta, Gamma, Empty)");
  console.log("   Users     : 12 (all statuses & roles)");
  console.log("   Tasks     : ~50 (all statuses, priorities, types, edge cases)");
  console.log("   AI Requests: 10 (all intents, statuses, with feedback)");
  console.log("   AI Actions : 8 (all command types & approval statuses)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });