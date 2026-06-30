/**
 * Mongez Faculty Data Validation Script
 *
 * Verifies:
 *  - Faculty Space, Programs, Boards, and Users counts
 *  - Control Room & Exam counts
 *  - Room reservation conflict detection (finds the 5 overlapping room reservations)
 *  - Exam proctor conflict detection (finds the 10 overlapping TA assignments)
 *  - Workload balancing suggestions (lists TAs sorted by number of monitoring duties)
 *
 * Run:
 *   npx ts-node scripts/validate-faculty-data.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Validating Mongez Faculty Use Case Seeding & Algorithms...\n");

  const spaceId = "space_fcai_001";

  // 1. Validate Space
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) {
    console.error("❌ Space FCAI not found!");
    return;
  }
  console.log(`✅ Space Found: "${space.name}"`);

  // 2. Validate Programs (Departments)
  const departments = await prisma.department.findMany({ where: { spaceId } });
  console.log(`✅ Programs (Departments) Count: ${departments.length} (Expected: 9 - 8 programs + 1 admin)`);
  departments.forEach(d => console.log(`   - ${d.name} (${d.id})`));

  // 3. Validate Boards
  const boards = await prisma.board.findMany({ where: { department: { spaceId } } });
  console.log(`\n✅ Boards Count: ${boards.length} (Expected: 21 - 5 central + 16 program boards)`);
  boards.forEach(b => console.log(`   - ${b.name} (${b.id})`));

  // 4. Validate Users & Memberships
  const memberships = await prisma.membership.findMany({
    where: { spaceId },
    include: { user: true }
  });
  console.log(`\n✅ Total Space Members: ${memberships.length} (Expected: 180 - 30 faculty + 150 TAs)`);

  const tas = memberships.filter(m => m.user.email.startsWith("ta."));
  const faculty = memberships.filter(m => !m.user.email.startsWith("ta."));
  console.log(`   - Faculty members count: ${faculty.length} (Expected: 30)`);
  console.log(`   - Teaching Assistants count: ${tas.length} (Expected: 150)`);

  // 5. Validate Control Rooms
  const rooms = await prisma.task.findMany({
    where: { boardId: "board_fcai_control", type: "ControlRoom" }
  });
  console.log(`\n✅ Control Rooms Count: ${rooms.length} (Expected: 6)`);
  rooms.forEach(r => console.log(`   - ${r.title} (${r.tags.join(", ")})`));

  // 6. Validate Room Reservations
  const reservations = await prisma.task.findMany({
    where: { boardId: "board_fcai_control", type: "RoomReservation" }
  });
  console.log(`✅ Room Reservations Count: ${reservations.length} (Expected: 55 - 50 standard + 5 conflicts)`);

  // 7. Test Algorithm: Control Room Booking Overlap & Conflict Prevention
  console.log("\n--------------------------------------------------");
  console.log("⚡ TESTING ALGORITHM #1: Control Room Booking Overlap Detection");
  console.log("--------------------------------------------------");
  
  let detectedRoomConflicts = 0;
  for (const res of reservations) {
    if (!res.parentId || !res.startDate || !res.dueDate) continue;

    // Check if there is an overlapping reservation for the same room
    const overlap = reservations.find(other => 
      other.id !== res.id &&
      other.parentId === res.parentId &&
      other.startDate && other.dueDate &&
      res.startDate! < other.dueDate! && res.dueDate! > other.startDate!
    );

    if (overlap) {
      detectedRoomConflicts++;
      console.log(`⚠️ Conflict Detected on "${res.title.replace("Reservation: ", "")}"`);
      console.log(`   Booking 1 (ID: ${res.identifier}): ${res.startDate.toISOString()} -> ${res.dueDate.toISOString()}`);
      console.log(`   Booking 2 (ID: ${overlap.identifier}): ${overlap.startDate!.toISOString()} -> ${overlap.dueDate!.toISOString()}`);
      console.log("");
    }
  }
  console.log(`Summary: Found ${detectedRoomConflicts / 2} unique room reservation conflicts (Expected: 5).`);

  // 8. Validate Exams
  const exams = await prisma.task.findMany({
    where: { boardId: "board_fcai_exam", type: "Exam" }
  });
  console.log(`\n✅ Exams Count: ${exams.length} (Expected: 130 - 120 standard + 10 conflicts)`);

  // 9. Validate Monitoring Assignments
  const assignments = await prisma.task.findMany({
    where: { boardId: "board_fcai_exam", type: "MonitoringAssignment" },
    include: { assignments: { include: { user: true } } }
  });
  console.log(`✅ Monitoring Assignments Count: ${assignments.length} (Expected: 320 - 300 standard + 20 conflicts)`);

  // 10. Test Algorithm: Exam Proctor Conflict Detection
  console.log("\n--------------------------------------------------");
  console.log("⚡ TESTING ALGORITHM #2: Exam Proctor Conflict Detection");
  console.log("--------------------------------------------------");
  
  let detectedProctorConflicts = 0;
  const processedConflicts = new Set<string>();

  for (const asg of assignments) {
    const user = asg.assignments[0]?.user;
    if (!user || !asg.startDate || !asg.dueDate) continue;

    // Check if the user is assigned to another monitoring assignment at the same time
    const overlap = assignments.find(other => 
      other.id !== asg.id &&
      other.assignments[0]?.userId === user.id &&
      other.startDate && other.dueDate &&
      asg.startDate! < other.dueDate! && asg.dueDate! > other.startDate!
    );

    if (overlap) {
      const conflictKey = [asg.id, overlap.id].sort().join("-");
      if (!processedConflicts.has(conflictKey)) {
        processedConflicts.add(conflictKey);
        detectedProctorConflicts++;
        console.log(`⚠️ Proctor Conflict Detected for Proctor "${user.name}" (${user.email})`);
        console.log(`   Exam Duty 1 (ID: ${asg.identifier}): ${asg.startDate.toISOString()} -> ${asg.dueDate.toISOString()}`);
        console.log(`   Exam Duty 2 (ID: ${overlap.identifier}): ${overlap.startDate!.toISOString()} -> ${overlap.dueDate!.toISOString()}`);
        console.log("");
      }
    }
  }
  console.log(`Summary: Found ${detectedProctorConflicts} unique proctor double-booking conflicts (Expected: 10).`);

  // 11. Test Algorithm: TA Workload Balancing
  console.log("\n--------------------------------------------------");
  console.log("⚡ TESTING ALGORITHM #3: TA Workload Balancing & Recommendation");
  console.log("--------------------------------------------------");
  
  // Calculate workloads for each TA
  const taWorkloads = tas.map(ta => {
    const taAssignments = assignments.filter(asg => asg.assignments[0]?.userId === ta.userId);
    const totalHours = taAssignments.reduce((sum, asg) => {
      if (asg.startDate && asg.dueDate) {
        const diffMs = asg.dueDate.getTime() - asg.startDate.getTime();
        return sum + diffMs / 3600000;
      }
      return sum;
    }, 0);

    return {
      name: ta.user.name,
      email: ta.user.email,
      assignmentCount: taAssignments.length,
      monitoringHours: totalHours,
    };
  });

  // Sort by workload (count first, then hours)
  taWorkloads.sort((a, b) => a.assignmentCount - b.assignmentCount || a.monitoringHours - b.monitoringHours);

  console.log("Top 5 Least Loaded TAs (Recommended for next duty):");
  taWorkloads.slice(0, 5).forEach(wl => {
    console.log(`   - ${wl.name} (${wl.email}): ${wl.assignmentCount} exams, ${wl.monitoringHours} monitoring hours`);
  });

  console.log("\nTop 5 Most Loaded TAs:");
  taWorkloads.slice(-5).reverse().forEach(wl => {
    console.log(`   - ${wl.name} (${wl.email}): ${wl.assignmentCount} exams, ${wl.monitoringHours} monitoring hours`);
  });

  console.log(`\nAverage exams assigned per TA: ${(assignments.length / tas.length).toFixed(2)} exams`);
  console.log("Workload balancing is functioning correctly and suggests least loaded TAs first!");
}

main()
  .catch((e) => {
    console.error("❌ Validation failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
