/**
 * Mongez Faculty Seed Data — Faculty of Computers and Artificial Intelligence (FCAI)
 *
 * Seeds:
 *  - 1 Space (FCAI)
 *  - 8 Programs (Departments) + 1 Board Administration Department
 *  - 5 Boards (Academic, Control Room, Exam, Grad Projects, Research)
 *  - 30 Faculty Users (Dean, 3 Vice Deans, 8 Directors, 8 HODs, 10 Profs/Lecturers)
 *  - 150 Teaching Assistant Users distributed across programs
 *  - 6 Control Rooms (A to F)
 *  - 50 Room Reservations + 5 intentional reservation conflicts
 *  - 120 Exams
 *  - 300 Monitoring Assignments + 10 intentional proctor conflicts
 *
 * Run:
 *   npx ts-node prisma/seed-faculty.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from 'dotenv';
import * as path from 'path';
import { hash } from "bcrypt";

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in the environment variables');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function hashPassword(pw: string): Promise<string> {
  return hash(pw, 10);
}

// ─── Deterministic IDs Helper ──────────────────────────────────────────────────
const ids = {
  roleOwner:     "role_owner_001",
  roleAdmin:     "role_admin_001",
  roleHead:      "role_head_001",
  roleMember:    "role_member_001",
  roleViewer:    "role_viewer_001",

  subFree:       "subplan_free_001",
  subPro:        "subplan_pro_001",
  subEnterprise: "subplan_enterprise_001",

  spaceFcai:     "space_fcai_001",
  deptAdmin:     "dept_fcai_admin_001",
};

// ─── Helper for unique identifiers (e.g. FCAI-001) ──────────────────────────
let taskCounter = 1;
function getNextIdentifier(): string {
  const num = String(taskCounter++).padStart(3, '0');
  return `FCAI-${num}`;
}

async function main() {
  console.log("🌱 Seeding Mongez Faculty (FCAI) Data...");

  // 1. WIPE DATA
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
    prisma.calendarEventParticipant.deleteMany(),
    prisma.calendarEvent.deleteMany(),
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
  console.log("  ✓ Database cleared successfully");

  // 2. CREATE STANDARD ROLES & SUBSCRIPTION PLANS
  await prisma.subscriptionPlan.createMany({
    data: [
      { id: ids.subFree,       name: "FREE",       maxSpaces: 1, maxUsers: 5,  maxBoards: 3,  aiEnabled: false, price: 0 },
      { id: ids.subPro,        name: "PRO",         maxSpaces: 10, maxUsers: 50, maxBoards: 50, aiEnabled: true,  price: 29 },
      { id: ids.subEnterprise, name: "ENTERPRISE",  maxSpaces: -1, maxUsers: -1, maxBoards: -1, aiEnabled: true,  price: 99 },
    ],
  });

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
    { action: "manage", resource: "workflow" },
    { action: "read",   resource: "audit" },
    { action: "read",   resource: "analytics" },
  ];
  await prisma.permission.createMany({ data: permData });
  const allPerms = await prisma.permission.findMany();

  for (const p of allPerms) {
    await prisma.rolePermission.create({ data: { roleId: ids.roleOwner, permissionId: p.id } });
  }
  for (const p of allPerms) {
    if (!(p.action === "delete" && p.resource === "space")) {
      await prisma.rolePermission.create({ data: { roleId: ids.roleAdmin, permissionId: p.id } });
    }
  }
  for (const p of allPerms) {
    if (["task", "board", "report", "analytics", "audit"].includes(p.resource) && p.action !== "delete") {
      await prisma.rolePermission.create({ data: { roleId: ids.roleHead, permissionId: p.id } });
    }
  }
  for (const p of allPerms) {
    if (p.resource === "task" || ((p.resource === "board" || p.resource === "space" || p.resource === "analytics" || p.resource === "report") && p.action === "read")) {
      await prisma.rolePermission.create({ data: { roleId: ids.roleMember, permissionId: p.id } });
    }
  }
  for (const p of allPerms) {
    if (p.action === "read") {
      await prisma.rolePermission.create({ data: { roleId: ids.roleViewer, permissionId: p.id } });
    }
  }
  console.log("  ✓ Roles & Permissions created");

  // 3. CREATE FCAI SPACE & COUNTER
  await prisma.space.create({
    data: {
      id: ids.spaceFcai,
      name: "Faculty of Computers and Artificial Intelligence (FCAI)",
      description: "Academic operations, control room scheduling, and proctor assignments for FCAI",
      prefix: "FCAI",
      color: "#0F172A",
      icon: "🎓",
      isPublic: true,
      subscriptionPlanId: ids.subEnterprise,
    }
  });

  await prisma.spaceCounter.create({
    data: {
      spaceId: ids.spaceFcai,
      seq: 1000,
    }
  });
  console.log("  ✓ FCAI Space created");

  // 4. CREATE PROGRAMS (DEPARTMENTS)
  const programs = [
    // Credit Programs
    { id: "dept_fcai_se", name: "Software Engineering (Credit)", color: "#3B82F6" },
    { id: "dept_fcai_cys", name: "Cybersecurity (Credit)", color: "#EF4444" },
    { id: "dept_fcai_ds", name: "Data Science (Credit)", color: "#10B981" },
    { id: "dept_fcai_bi", name: "Bioinformatics (Credit)", color: "#8B5CF6" },
    // Mainstream Programs
    { id: "dept_fcai_cs", name: "Computer Science (Mainstream)", color: "#F59E0B" },
    { id: "dept_fcai_is", name: "Information Systems (Mainstream)", color: "#EC4899" },
    { id: "dept_fcai_it", name: "Information Technology (Mainstream)", color: "#06B6D4" },
    { id: "dept_fcai_ai", name: "Artificial Intelligence (Mainstream)", color: "#14B8A6" },
  ];

  for (const prog of programs) {
    await prisma.department.create({
      data: {
        id: prog.id,
        spaceId: ids.spaceFcai,
        name: prog.name,
        color: prog.color,
        description: `Academic program department for ${prog.name}`,
      }
    });
  }

  // Central Administration Department for Boards
  await prisma.department.create({
    data: {
      id: ids.deptAdmin,
      spaceId: ids.spaceFcai,
      name: "FCAI Board Administration",
      color: "#64748B",
      description: "Faculty management board workspace",
    }
  });
  console.log("  ✓ Departments & Programs created");

  // 5. CREATE USERS (Faculty Members: 30, TAs: 150)
  const passwordHash = await hashPassword("Test@1234");
  const usersToCreate: Prisma.UserCreateManyInput[] = [];
  const membershipsToCreate: Prisma.MembershipCreateManyInput[] = [];

  // A. Dean (1)
  const deanId = "user_fcai_dean";
  usersToCreate.push({
    id: deanId,
    email: "dean@fcai.edu.eg",
    name: "Prof. Dr. Ahmed Al-Azhary (Dean)",
    passwordHash,
    status: "ACTIVE",
    isVerified: true,
  });
  membershipsToCreate.push({
    userId: deanId,
    spaceId: ids.spaceFcai,
    roleId: ids.roleOwner,
  });

  // B. Vice Deans (3)
  const viceDeans = [
    { id: "user_fcai_vd_1", name: "Prof. Dr. Sherif Soliman (Vice Dean Academic)", email: "sherif.soliman@fcai.edu.eg" },
    { id: "user_fcai_vd_2", name: "Prof. Dr. Nadia Hegazi (Vice Dean Research)", email: "nadia.hegazi@fcai.edu.eg" },
    { id: "user_fcai_vd_3", name: "Prof. Dr. Hisham Arafat (Vice Dean Community)", email: "hisham.arafat@fcai.edu.eg" },
  ];
  viceDeans.forEach((vd) => {
    usersToCreate.push({
      id: vd.id,
      email: vd.email,
      name: vd.name,
      passwordHash,
      status: "ACTIVE",
      isVerified: true,
    });
    membershipsToCreate.push({
      userId: vd.id,
      spaceId: ids.spaceFcai,
      roleId: ids.roleAdmin,
    });
  });

  // C. Program Directors (8) - one for each program
  const directorIds: string[] = [];
  programs.forEach((prog, index) => {
    const dirId = `user_fcai_director_${index + 1}`;
    directorIds.push(dirId);
    usersToCreate.push({
      id: dirId,
      email: `director.${prog.id.split("_").pop()}@fcai.edu.eg`,
      name: `Dr. Director ${index + 1} (${prog.name.split(" ")[0]})`,
      passwordHash,
      status: "ACTIVE",
      isVerified: true,
    });
    membershipsToCreate.push({
      userId: dirId,
      spaceId: ids.spaceFcai,
      roleId: ids.roleHead,
      departmentId: prog.id,
    });
  });

  // D. Heads of Departments (8) - one for each department/program
  const hodIds: string[] = [];
  programs.forEach((prog, index) => {
    const hodId = `user_fcai_hod_${index + 1}`;
    hodIds.push(hodId);
    usersToCreate.push({
      id: hodId,
      email: `hod.${prog.id.split("_").pop()}@fcai.edu.eg`,
      name: `Prof. HOD ${index + 1} (${prog.name.split(" ")[0]})`,
      passwordHash,
      status: "ACTIVE",
      isVerified: true,
    });
    membershipsToCreate.push({
      userId: hodId,
      spaceId: ids.spaceFcai,
      roleId: ids.roleHead,
      departmentId: prog.id,
    });
  });

  // E. Professors and Lecturers (10)
  const professorIds: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const profId = `user_fcai_prof_${i}`;
    professorIds.push(profId);
    usersToCreate.push({
      id: profId,
      email: `prof.${i}@fcai.edu.eg`,
      name: `Dr. Professor ${i}`,
      passwordHash,
      status: "ACTIVE",
      isVerified: true,
    });
    const prog = programs[(i - 1) % programs.length];
    membershipsToCreate.push({
      userId: profId,
      spaceId: ids.spaceFcai,
      roleId: ids.roleMember,
      departmentId: prog.id,
    });
  }

  // F. Teaching Assistants (150)
  const taIds: string[] = [];
  for (let i = 1; i <= 150; i++) {
    const taId = `user_fcai_ta_${i}`;
    taIds.push(taId);
    usersToCreate.push({
      id: taId,
      email: `ta.${i}@fcai.edu.eg`,
      name: `TA Teaching Assistant ${i}`,
      passwordHash,
      status: "ACTIVE",
      isVerified: true,
    });
    const prog = programs[(i - 1) % programs.length];
    membershipsToCreate.push({
      userId: taId,
      spaceId: ids.spaceFcai,
      roleId: ids.roleMember,
      departmentId: prog.id,
    });
  }

  await prisma.user.createMany({ data: usersToCreate });
  await prisma.membership.createMany({ data: membershipsToCreate });

  await prisma.subscription.createMany({
    data: [
      { userId: deanId, tier: "ENTERPRISE", startsAt: new Date(), isAutoRenew: true },
      { userId: "user_fcai_vd_1", tier: "PRO", startsAt: new Date(), isAutoRenew: true },
      { userId: "user_fcai_vd_2", tier: "PRO", startsAt: new Date(), isAutoRenew: true },
      { userId: "user_fcai_vd_3", tier: "PRO", startsAt: new Date(), isAutoRenew: true },
    ]
  });

  console.log(`  ✓ ${usersToCreate.length} Users created`);
  console.log(`  ✓ ${membershipsToCreate.length} Memberships created`);

  // 6. CREATE BOARDS & COLUMNS
  const boards = [
    { id: "board_fcai_academic", name: "Academic Affairs Board", columns: ["Semester Planning", "Course Offerings", "Teaching Assignments"] },
    { id: "board_fcai_control", name: "Control Room Management Board", columns: ["Rooms", "Reservations", "Maintenance"] },
    { id: "board_fcai_exam", name: "Examination Management Board", columns: ["Scheduled Exams", "Ongoing", "Completed"] },
    { id: "board_fcai_grad", name: "Graduation Projects Board", columns: ["Supervisors", "Teams", "Milestones", "Deliverables"] },
    { id: "board_fcai_research", name: "Research Activities Board", columns: ["Publications", "Conferences", "Funding"] },
  ];

  const columnsMap: Record<string, string[]> = {};

  for (let bIndex = 0; bIndex < boards.length; bIndex++) {
    const b = boards[bIndex];
    await prisma.board.create({
      data: {
        id: b.id,
        name: b.name,
        departmentId: ids.deptAdmin,
        type: "KANBAN",
        position: bIndex,
        color: b.id === "board_fcai_control" ? "#3B82F6" : b.id === "board_fcai_exam" ? "#EF4444" : "#10B981",
      }
    });

    columnsMap[b.id] = [];
    for (let cIndex = 0; cIndex < b.columns.length; cIndex++) {
      const colName = b.columns[cIndex];
      const colId = `col_fcai_${b.id.split("_").pop()}_${cIndex + 1}`;
      columnsMap[b.id].push(colId);

      await prisma.boardColumn.create({
        data: {
          id: colId,
          boardId: b.id,
          name: colName,
          position: cIndex,
          color: cIndex === 0 ? "#6B7280" : cIndex === 1 ? "#3B82F6" : "#10B981",
        }
      });
    }
  }
  console.log("  ✓ Boards & columns created");

  // 7. SEED RESOURCE RESERVATION (Control Rooms: 6, Reservations: 50 + 5 intentional conflicts)
  const controlRoomsList = [
    { name: "Control Room A", pcs: 40, loc: "Building A, Floor 1, Room 102" },
    { name: "Control Room B", pcs: 35, loc: "Building A, Floor 2, Room 204" },
    { name: "Control Room C", pcs: 30, loc: "Building B, Floor 1, Room 112" },
    { name: "Control Room D", pcs: 25, loc: "Building B, Floor 2, Room 225" },
    { name: "Control Room E", pcs: 20, loc: "Building C, Floor 1, Room 101" },
    { name: "Control Room F", pcs: 20, loc: "Building C, Floor 3, Room 303" },
  ];

  const controlRoomTaskIds: string[] = [];

  for (let i = 0; i < controlRoomsList.length; i++) {
    const cr = controlRoomsList[i];
    const taskId = `task_fcai_room_${i + 1}`;
    controlRoomTaskIds.push(taskId);

    await prisma.task.create({
      data: {
        id: taskId,
        identifier: getNextIdentifier(),
        title: cr.name,
        description: `Capacity: ${cr.pcs} PCs\nLocation: ${cr.loc}\nAvailable PCs: ${cr.pcs}\nStatus: Available`,
        boardId: "board_fcai_control",
        columnId: columnsMap["board_fcai_control"][0],
        status: "TODO",
        priority: "MEDIUM",
        type: "ControlRoom",
        createdById: deanId,
        tags: [`capacity:${cr.pcs}`, `pcs:${cr.pcs}`, `location:${cr.loc.split(",")[0]}`],
      }
    });
  }
  console.log("  ✓ 6 Control Rooms created as tasks");

  const reservationTasks: Prisma.TaskCreateManyInput[] = [];
  const reservationAssignments: Prisma.TaskAssignmentCreateManyInput[] = [];
  const calendarEvents: Prisma.CalendarEventCreateManyInput[] = [];
  const eventParticipants: Prisma.CalendarEventParticipantCreateManyInput[] = [];

  let resCounter = 1;
  const reservationCreators = [...professorIds, ...taIds.slice(0, 40)];

  // June reservations
  for (let d = 26; d <= 30; d++) {
    for (let rIndex = 0; rIndex < 6; rIndex++) {
      for (let s = 1; s <= 3; s++) {
        if (resCounter > 35) break;

        const roomId = controlRoomTaskIds[rIndex];
        const roomName = controlRoomsList[rIndex].name;
        const startHour = s === 1 ? 9 : s === 2 ? 11 : 13;
        const endHour = startHour + 2;
        const startDate = new Date(2026, 5, d, startHour, 0, 0);
        const endDate = new Date(2026, 5, d, endHour, 0, 0);
        const creatorId = reservationCreators[resCounter % reservationCreators.length];

        const resTaskId = `task_fcai_res_${resCounter}`;
        const eventId = `event_fcai_res_${resCounter}`;
        const identifier = getNextIdentifier();

        reservationTasks.push({
          id: resTaskId,
          identifier,
          title: `Reservation: ${roomName} - Slot ${s}`,
          description: `Purpose: Lab session for Credit Programs\nRequested by: ${creatorId}\nDate: 2026-06-${d}`,
          boardId: "board_fcai_control",
          columnId: columnsMap["board_fcai_control"][1],
          status: d < 30 ? "DONE" : "TODO",
          priority: "LOW",
          type: "RoomReservation",
          parentId: roomId,
          createdById: creatorId,
          startDate,
          dueDate: endDate,
          tags: ["reservation", roomName.replace(" ", "")],
        });

        reservationAssignments.push({
          taskId: resTaskId,
          userId: creatorId,
        });

        calendarEvents.push({
          id: eventId,
          spaceId: ids.spaceFcai,
          title: `Room Reserved: ${roomName}`,
          description: `Reserved for credit courses laboratory exercises.`,
          startDate,
          endDate,
          location: roomName,
          taskId: resTaskId,
          isTaskGenerated: true,
          createdById: creatorId,
        });

        eventParticipants.push({
          id: `part_res_${resCounter}`,
          eventId,
          userId: creatorId,
          email: `${creatorId}@fcai.edu.eg`,
          status: "ACCEPTED",
        });

        resCounter++;
      }
    }
  }

  // July reservations (Future)
  for (let d = 1; d <= 8; d++) {
    for (let rIndex = 0; rIndex < 6; rIndex++) {
      for (let s = 1; s <= 2; s++) {
        if (resCounter > 50) break;

        const roomId = controlRoomTaskIds[rIndex];
        const roomName = controlRoomsList[rIndex].name;
        const startHour = s === 1 ? 9 : s === 2 ? 11 : 13;
        const endHour = startHour + 2;
        const startDate = new Date(2026, 6, d, startHour, 0, 0);
        const endDate = new Date(2026, 6, d, endHour, 0, 0);
        const creatorId = reservationCreators[resCounter % reservationCreators.length];

        const resTaskId = `task_fcai_res_${resCounter}`;
        const eventId = `event_fcai_res_${resCounter}`;
        const identifier = getNextIdentifier();

        reservationTasks.push({
          id: resTaskId,
          identifier,
          title: `Reservation: ${roomName} - Slot ${s}`,
          description: `Purpose: Mainstream laboratory class exercises\nRequested by: ${creatorId}\nDate: 2026-07-0${d}`,
          boardId: "board_fcai_control",
          columnId: columnsMap["board_fcai_control"][1],
          status: "TODO",
          priority: "LOW",
          type: "RoomReservation",
          parentId: roomId,
          createdById: creatorId,
          startDate,
          dueDate: endDate,
          tags: ["reservation", roomName.replace(" ", "")],
        });

        reservationAssignments.push({
          taskId: resTaskId,
          userId: creatorId,
        });

        calendarEvents.push({
          id: eventId,
          spaceId: ids.spaceFcai,
          title: `Room Reserved: ${roomName}`,
          description: `Reserved for mainstream courses laboratory exercises.`,
          startDate,
          endDate,
          location: roomName,
          taskId: resTaskId,
          isTaskGenerated: true,
          createdById: creatorId,
        });

        eventParticipants.push({
          id: `part_res_${resCounter}`,
          eventId,
          userId: creatorId,
          email: `${creatorId}@fcai.edu.eg`,
          status: "ACCEPTED",
        });

        resCounter++;
      }
    }
  }

  // 5 Room Booking Conflicts (July 2, 10:00 - 12:00, overlapping with 9-11 and 11-1 slots)
  const conflictRooms = [0, 1, 2, 3, 4];
  const conflictCreators = ["user_fcai_prof_1", "user_fcai_prof_2", "user_fcai_prof_3", "user_fcai_prof_4", "user_fcai_prof_5"];

  for (let c = 0; c < 5; c++) {
    const roomIndex = conflictRooms[c];
    const roomId = controlRoomTaskIds[roomIndex];
    const roomName = controlRoomsList[roomIndex].name;
    const creatorId = conflictCreators[c];

    const baseRes = reservationTasks.find(r => r.parentId === roomId);
    const startDate = baseRes ? baseRes.startDate as Date : new Date(2026, 6, 2, 10, 0, 0);
    const endDate = baseRes ? baseRes.dueDate as Date : new Date(2026, 6, 2, 12, 0, 0);

    const resTaskId = `task_fcai_res_conflict_${c + 1}`;
    const eventId = `event_fcai_res_conflict_${c + 1}`;
    const identifier = getNextIdentifier();

    reservationTasks.push({
      id: resTaskId,
      identifier,
      title: `CONFLICT Reservation: ${roomName} - Overlap`,
      description: `Intentional conflict for testing double bookings.\nRequested by: ${creatorId}\nDate: 2026-07-02`,
      boardId: "board_fcai_control",
      columnId: columnsMap["board_fcai_control"][1],
      status: "TODO",
      priority: "HIGH",
      type: "RoomReservation",
      parentId: roomId,
      createdById: creatorId,
      startDate,
      dueDate: endDate,
      tags: ["reservation", roomName.replace(" ", ""), "conflict-test"],
    });

    reservationAssignments.push({
      taskId: resTaskId,
      userId: creatorId,
    });

    calendarEvents.push({
      id: eventId,
      spaceId: ids.spaceFcai,
      title: `CONFLICT Room Reserved: ${roomName}`,
      description: `Conflict simulation. Should trigger double-booking error!`,
      startDate,
      endDate,
      location: roomName,
      taskId: resTaskId,
      isTaskGenerated: true,
      createdById: creatorId,
    });

    eventParticipants.push({
      id: `part_res_conflict_${c + 1}`,
      eventId,
      userId: creatorId,
      email: `${creatorId}@fcai.edu.eg`,
      status: "ACCEPTED",
    });
  }

  await prisma.task.createMany({ data: reservationTasks });
  await prisma.taskAssignment.createMany({ data: reservationAssignments });
  await prisma.calendarEvent.createMany({ data: calendarEvents });
  await prisma.calendarEventParticipant.createMany({ data: eventParticipants });

  console.log(`  ✓ ${reservationTasks.length} Room Reservations created (including 5 conflicts)`);

  // 8. SEED EXAMS & MONITORING (120 Exams, 300 Assignments + 10 conflicts)
  const coursesList = [
    "Database Systems", "Software Engineering", "Cybersecurity Basics", "Data Structures",
    "Machine Learning", "Introduction to AI", "Computer Networks", "Operating Systems",
    "Bioinformatics Algorithms", "Human-Computer Interaction", "Web Development",
    "Information Systems", "Distributed Systems", "Cloud Computing", "Digital Forensics",
    "Natural Language Processing", "Compiler Design", "Computer Graphics", "AI Ethics",
    "Discrete Mathematics", "Software Architecture", "Data Mining", "Network Security"
  ];
  const examHalls = ["Exam Hall 101", "Exam Hall 102", "Exam Hall 201", "Exam Hall 202", "Main Hall A", "Gymnasium Hall"];

  const examTasks: Prisma.TaskCreateManyInput[] = [];
  const examCalendarEvents: Prisma.CalendarEventCreateManyInput[] = [];

  // Let's generate exactly 120 exams.
  // We can distribute them over 15 days (June 25 to July 9), with 8 exams per day.
  // Daily slots: slot 1 (9:00 - 11:00), slot 2 (11:00 - 13:00), slot 3 (13:00 - 15:00), slot 4 (15:00 - 17:00).
  // E.g. 2 exams per slot.
  for (let i = 1; i <= 120; i++) {
    const dayOffset = Math.floor((i - 1) / 8); // 8 exams per day
    const examDate = new Date(2026, 5, 25); // Start on June 25
    examDate.setDate(examDate.getDate() + dayOffset);

    const slotIndex = Math.floor(((i - 1) % 8) / 2); // 4 slots per day, 2 exams per slot
    const startHour = slotIndex === 0 ? 9 : slotIndex === 1 ? 11 : slotIndex === 2 ? 13 : 15;
    const endHour = startHour + 2;

    const startDate = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate(), startHour, 0, 0);
    const endDate = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate(), endHour, 0, 0);

    const course = coursesList[i % coursesList.length];
    const hallIndex = (i - 1) % examHalls.length;
    const hall = examHalls[hallIndex];
    const creatorId = hodIds[i % hodIds.length];

    const examTaskId = `task_fcai_exam_${i}`;
    const eventId = `event_fcai_exam_${i}`;
    const identifier = getNextIdentifier();

    const isPast = startDate.getTime() < new Date(2026, 5, 30, 8, 30, 0).getTime();

    examTasks.push({
      id: examTaskId,
      identifier,
      title: `Exam: ${course}`,
      description: `Course: ${course}\nHall: ${hall}\nRequired Monitors: 2-3`,
      boardId: "board_fcai_exam",
      columnId: columnsMap["board_fcai_exam"][0],
      status: isPast ? "DONE" : "TODO",
      priority: "HIGH",
      type: "Exam",
      createdById: creatorId,
      startDate,
      dueDate: endDate,
      tags: ["exam", course.replace(" ", ""), hall.replace(" ", "")],
    });

    examCalendarEvents.push({
      id: eventId,
      spaceId: ids.spaceFcai,
      title: `Exam: ${course}`,
      description: `Exam session in ${hall}.`,
      startDate,
      endDate,
      location: hall,
      taskId: examTaskId,
      isTaskGenerated: true,
      createdById: creatorId,
    });
  }

  await prisma.task.createMany({ data: examTasks });
  await prisma.calendarEvent.createMany({ data: examCalendarEvents });
  console.log(`  ✓ ${examTasks.length} Exams created`);

  const monitoringTasks: Prisma.TaskCreateManyInput[] = [];
  const monitoringAssignments: Prisma.TaskAssignmentCreateManyInput[] = [];
  const monitoringEventParticipants: Prisma.CalendarEventParticipantCreateManyInput[] = [];

  let assignmentCounter = 1;
  const proctorsList = [...taIds];

  for (let examIndex = 1; examIndex <= 120; examIndex++) {
    const numAssignments = examIndex % 2 === 0 ? 2 : 3;

    for (let a = 0; a < numAssignments; a++) {
      if (assignmentCounter > 300) break;

      const examTaskId = `task_fcai_exam_${examIndex}`;
      const examTitle = examTasks[examIndex - 1].title;
      const examEventId = `event_fcai_exam_${examIndex}`;
      const startDate = examTasks[examIndex - 1].startDate!;
      const endDate = examTasks[examIndex - 1].dueDate!;

      const proctorIndex = (assignmentCounter - 1) % proctorsList.length;
      const proctorId = proctorsList[proctorIndex];

      const assignmentTaskId = `task_fcai_mon_${assignmentCounter}`;
      const identifier = getNextIdentifier();

      monitoringTasks.push({
        id: assignmentTaskId,
        identifier,
        title: `Proctoring: ${examTasks[examIndex - 1].title.replace("Exam: ", "")}`,
        description: `Proctor monitoring duty assigned to TA.\nRole: Proctor\nExam: ${examTitle}`,
        boardId: "board_fcai_exam",
        columnId: columnsMap["board_fcai_exam"][0],
        status: examTasks[examIndex - 1].status,
        priority: "MEDIUM",
        type: "MonitoringAssignment",
        parentId: examTaskId,
        createdById: deanId,
        startDate,
        dueDate: endDate,
        tags: ["monitoring", "proctor-duty"],
      });

      monitoringAssignments.push({
        taskId: assignmentTaskId,
        userId: proctorId,
      });

      monitoringEventParticipants.push({
        id: `part_mon_${assignmentCounter}`,
        eventId: examEventId,
        userId: proctorId,
        email: `${proctorId}@fcai.edu.eg`,
        status: "ACCEPTED",
      });

      assignmentCounter++;
    }
  }

  // 10 Intentional Proctor Conflicts (TAs assigned to overlapping exams on July 2 at 9:00-11:00 and 10:00-12:00)
  const conflictTAs = taIds.slice(10, 20);
  const targetJuly2Exams = examTasks
    .filter(e => {
      const d = e.startDate instanceof Date ? e.startDate : (e.startDate ? new Date(e.startDate) : null);
      return d && d.getFullYear() === 2026 && d.getMonth() === 6 && (d.getDate() === 2 || d.getDate() === 3);
    })
    .slice(0, 10);

  for (let c = 0; c < 10; c++) {
    if (c >= targetJuly2Exams.length) break;

    const targetExam = targetJuly2Exams[c];
    const taId = conflictTAs[c];

    const conflictExamTaskId = `task_fcai_exam_conflict_${c + 1}`;
    const conflictExamIdentifier = getNextIdentifier();
    const startDate = targetExam.startDate as Date;
    const endDate = targetExam.dueDate as Date;

    await prisma.task.create({
      data: {
        id: conflictExamTaskId,
        identifier: conflictExamIdentifier,
        title: `Exam: Conflict Testing ${c + 1}`,
        description: `Course: Conflict Simulation\nHall: Conflict Hall\nRequired Monitors: 1`,
        boardId: "board_fcai_exam",
        columnId: columnsMap["board_fcai_exam"][0],
        status: "TODO",
        priority: "HIGH",
        type: "Exam",
        createdById: deanId,
        startDate,
        dueDate: endDate,
        tags: ["exam", "conflict-test"],
      }
    });

    const assignmentTaskId = `task_fcai_mon_conflict_${c + 1}`;
    const identifier = getNextIdentifier();

    monitoringTasks.push({
      id: assignmentTaskId,
      identifier,
      title: `CONFLICT Proctoring: Conflict Testing ${c + 1}`,
      description: `Conflict simulation. Double-booking check!`,
      boardId: "board_fcai_exam",
      columnId: columnsMap["board_fcai_exam"][0],
      status: "TODO",
      priority: "HIGH",
      type: "MonitoringAssignment",
      parentId: conflictExamTaskId,
      createdById: deanId,
      startDate,
      dueDate: endDate,
      tags: ["monitoring", "proctor-duty", "conflict-test"],
    });

    monitoringAssignments.push({
      taskId: assignmentTaskId,
      userId: taId,
    });

    const originalAssignmentTaskId = `task_fcai_mon_orig_conflict_${c + 1}`;
    const originalIdentifier = getNextIdentifier();

    monitoringTasks.push({
      id: originalAssignmentTaskId,
      identifier: originalIdentifier,
      title: `Proctoring: ${targetExam.title.replace("Exam: ", "")}`,
      description: `Original assignment for conflict validation.`,
      boardId: "board_fcai_exam",
      columnId: columnsMap["board_fcai_exam"][0],
      status: "TODO",
      priority: "MEDIUM",
      type: "MonitoringAssignment",
      parentId: targetExam.id,
      createdById: deanId,
      startDate: targetExam.startDate,
      dueDate: targetExam.dueDate,
      tags: ["monitoring", "proctor-duty"],
    });

    monitoringAssignments.push({
      taskId: originalAssignmentTaskId,
      userId: taId,
    });
  }

  await prisma.task.createMany({ data: monitoringTasks });
  await prisma.taskAssignment.createMany({ data: monitoringAssignments });
  await prisma.calendarEventParticipant.createMany({ data: monitoringEventParticipants });

  console.log(`  ✓ ${monitoringTasks.length} Monitoring Assignments created (including 10 proctor conflicts)`);

  // 9. SEED PROGRAM-SPECIFIC COURSE AND PROJECT BOARDS/TASKS (Simulating 2026 academic work)
  console.log("  → Seeding program departments course coordination & GP tasks...");
  const programData = [
    {
      id: "dept_fcai_se",
      abbr: "SE",
      courses: ["DevOps Pipeline Automation", "Software Testing & QA", "Object-Oriented Design"],
      projects: ["Cloud-Native Microservices ERP", "AI-Powered Test Case Generator", "Automated Security Compliance Checker"]
    },
    {
      id: "dept_fcai_cys",
      abbr: "CYS",
      courses: ["Penetration Testing Lab", "Cryptography & Network Security", "Digital Forensics & Incident Response"],
      projects: ["Blockchain-Based Identity Management", "Intrusion Detection System using GNNs", "Zero-Trust LAN controller"]
    },
    {
      id: "dept_fcai_ds",
      abbr: "DS",
      courses: ["Big Data Analytics with Spark", "Data Visualization & BI", "Statistical Methods for Data Science"],
      projects: ["Real-time Traffic Congestion Predictor", "Predictive Analytics for Healthcare Recidivism", "Financial Fraud Detection Engine"]
    },
    {
      id: "dept_fcai_bi",
      abbr: "BI",
      courses: ["Genomic Sequence Alignment", "Computational Molecular Biology", "Structural Bioinformatics"],
      projects: ["Deep Learning for Gene Expression Profiling", "Protein Structure Folding Prediction Model", "Metagenomic Classifier"]
    },
    {
      id: "dept_fcai_cs",
      abbr: "CS",
      courses: ["Compiler Design & Construction", "Operating Systems Internals", "Analysis of Algorithms"],
      projects: ["Custom Scripting Language Interpreter", "Distributed Consensus Engine", "Real-Time Ray Tracer"]
    },
    {
      id: "dept_fcai_is",
      abbr: "IS",
      courses: ["Database Administration & Tuning", "Enterprise Architecture Frameworks", "Systems Analysis & Design"],
      projects: ["E-Commerce Recommendation Engine", "CRM Portal with Predictive Lead Scoring", "Supply Chain Optimization Ledger"]
    },
    {
      id: "dept_fcai_it",
      abbr: "IT",
      courses: ["Cloud Infrastructure Administration", "Wireless & Mobile Networks", "System Administration (Linux/Windows)"],
      projects: ["IoT Smart Agriculture Gateway", "Software-Defined Network Controller", "Smart Campus Asset Tracker"]
    },
    {
      id: "dept_fcai_ai",
      abbr: "AI",
      courses: ["Deep Learning Neural Networks", "Natural Language Processing", "Computer Vision Lab"],
      projects: ["Autonomous Drone Navigation", "Arabic Sign Language Translator", "Generative Medical Image Synthesizer"]
    }
  ];

  let deptTaskCount = 0;

  for (const prog of programData) {
    const courseBoardId = `board_${prog.id}_course`;
    const gradBoardId = `board_${prog.id}_grad`;

    await prisma.board.createMany({
      data: [
        { id: courseBoardId, name: `${prog.abbr} Course Coordination`, departmentId: prog.id, type: "KANBAN", position: 0, color: "#3B82F6" },
        { id: gradBoardId, name: `${prog.abbr} Graduation Projects`, departmentId: prog.id, type: "KANBAN", position: 1, color: "#8B5CF6" },
      ]
    });

    const courseColumns = ["Course Planning", "Material Prep", "Review & Approval", "Approved / Done"];
    const gradColumns = ["Proposals", "Development", "Evaluations", "Graduated"];
    
    const courseColIds: string[] = [];
    const gradColIds: string[] = [];

    for (let cIndex = 0; cIndex < courseColumns.length; cIndex++) {
      const colId = `col_${prog.id}_course_${cIndex + 1}`;
      courseColIds.push(colId);
      await prisma.boardColumn.create({
        data: { id: colId, boardId: courseBoardId, name: courseColumns[cIndex], position: cIndex, color: cIndex === 3 ? "#10B981" : "#3B82F6" }
      });
    }

    for (let cIndex = 0; cIndex < gradColumns.length; cIndex++) {
      const colId = `col_${prog.id}_grad_${cIndex + 1}`;
      gradColIds.push(colId);
      await prisma.boardColumn.create({
        data: { id: colId, boardId: gradBoardId, name: gradColumns[cIndex], position: cIndex, color: cIndex === 3 ? "#10B981" : "#8B5CF6" }
      });
    }

    const deptMemberships = membershipsToCreate.filter(m => m.departmentId === prog.id);
    const deptMemberIds = deptMemberships.map(m => m.userId);
    const assignees = deptMemberIds.length > 0 ? deptMemberIds : professorIds;

    for (let courseIndex = 0; courseIndex < prog.courses.length; courseIndex++) {
      const course = prog.courses[courseIndex];
      const assigneeId = assignees[courseIndex % assignees.length];

      const t1Id = `task_${prog.id}_syl_rev_${courseIndex + 1}`;
      await prisma.task.create({
        data: {
          id: t1Id,
          identifier: getNextIdentifier(),
          title: `Syllabus Review: ${course}`,
          description: `Review and update syllabus for ${course} to include 2026 state-of-the-art standards.`,
          boardId: courseBoardId,
          columnId: courseColIds[3],
          status: "DONE",
          priority: "MEDIUM",
          type: "Task",
          createdById: deanId,
          startDate: new Date(2026, 1, 10, 9, 0, 0),
          dueDate: new Date(2026, 1, 20, 17, 0, 0),
          tags: ["syllabus", "spring-2026", prog.abbr],
          assignments: { create: { userId: assigneeId } },
          comments: {
            create: [
              { authorId: assigneeId, content: "Syllabus has been updated with modern microservices references. Ready for approval." },
              { authorId: deanId, content: "Approved. Great job incorporating containerization!" }
            ]
          }
        }
      });

      const t2Id = `task_${prog.id}_lab_set_${courseIndex + 1}`;
      await prisma.task.create({
        data: {
          id: t2Id,
          identifier: getNextIdentifier(),
          title: `Setup Lab Environment: ${course}`,
          description: `Configure virtual environments, VM templates, and Docker compose files for ${course} lab work.`,
          boardId: courseBoardId,
          columnId: courseColIds[1],
          status: "IN_PROGRESS",
          priority: "HIGH",
          type: "Task",
          createdById: deanId,
          startDate: new Date(2026, 5, 15, 9, 0, 0),
          dueDate: new Date(2026, 6, 15, 17, 0, 0),
          tags: ["lab-prep", "summer-2026", prog.abbr],
          assignments: { create: { userId: assigneeId } },
          comments: {
            create: [
              { authorId: assigneeId, content: "Working on setting up the Kubernetes cluster configurations for students." }
            ]
          }
        }
      });

      const t3Id = `task_${prog.id}_syl_prep_${courseIndex + 1}`;
      await prisma.task.create({
        data: {
          id: t3Id,
          identifier: getNextIdentifier(),
          title: `Prepare Lecture Slides: ${course} (Fall 2026)`,
          description: `Develop slides, lecture notes, and reading lists for the upcoming Fall 2026 semester.`,
          boardId: courseBoardId,
          columnId: courseColIds[0],
          status: "TODO",
          priority: "LOW",
          type: "Task",
          createdById: deanId,
          startDate: new Date(2026, 8, 1, 9, 0, 0),
          dueDate: new Date(2026, 8, 25, 17, 0, 0),
          tags: ["planning", "fall-2026", prog.abbr],
          assignments: { create: { userId: assigneeId } }
        }
      });

      await prisma.approval.create({
        data: {
          taskId: t1Id,
          requestedById: assigneeId,
          reviewerId: deanId,
          status: "APPROVED",
          comment: "Syllabus meets all regional academic accreditation standards.",
          requestedAt: new Date(2026, 1, 18, 10, 0, 0),
          resolvedAt: new Date(2026, 1, 20, 16, 0, 0)
        }
      });

      deptTaskCount += 3;
    }

    for (let projIndex = 0; projIndex < prog.projects.length; projIndex++) {
      const project = prog.projects[projIndex];
      const supervisorId = professorIds[projIndex % professorIds.length];
      const taAdvisorId = assignees[(projIndex + 2) % assignees.length];
      const gpAssignments = [{ userId: supervisorId }];
      if (taAdvisorId !== supervisorId) {
        gpAssignments.push({ userId: taAdvisorId });
      }

      const gpId = `task_${prog.id}_gp_${projIndex + 1}`;
      await prisma.task.create({
        data: {
          id: gpId,
          identifier: getNextIdentifier(),
          title: `GP Team ${projIndex + 1}: ${project}`,
          description: `Supervised by: Dr. Professor\nTA Advisor: Teaching Assistant\nProject Title: ${project}\nMilestones: System Design, Midterm Evaluation, Final Submission.`,
          boardId: gradBoardId,
          columnId: projIndex === 0 ? gradColIds[3] : projIndex === 1 ? gradColIds[2] : gradColIds[1],
          status: projIndex === 0 ? "DONE" : projIndex === 1 ? "IN_PROGRESS" : "TODO",
          priority: "HIGH",
          type: "Feature",
          createdById: supervisorId,
          startDate: new Date(2026, 0, 15, 9, 0, 0),
          dueDate: new Date(2026, 5, 20, 17, 0, 0),
          tags: ["grad-project", "class-2026", prog.abbr],
          assignments: {
            createMany: {
              data: gpAssignments
            }
          },
          comments: {
            create: [
              { authorId: supervisorId, content: "Team has completed their initial system architecture design diagram." },
              { authorId: taAdvisorId, content: "Code repository has been set up. Coding phase is currently at 70% progress." }
            ]
          }
        }
      });

      deptTaskCount++;
    }
  }
  console.log(`  ✓ Created ${programData.length * 2} program boards, columns, and ${deptTaskCount} academic tasks for 2026`);

  // 10. AUDIT LOG RECORD
  await prisma.auditLog.create({
    data: {
      userId: deanId,
      action: "space.seed_faculty",
      entityType: "Space",
      entityId: ids.spaceFcai,
      diff: { status: "seeding_complete", total_users: 180, total_exams: 120, total_reservations: 50, total_department_tasks: deptTaskCount },
    }
  });

  console.log("🏁 Mongez Faculty Use Case Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
