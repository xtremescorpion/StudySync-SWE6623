/*
 * Seeds a demo account so the app has something to show on a first run.
 *
 *   npm run seed
 *
 * Creates: student@studysync.test / password123
 * with two courses, four assignments, a week of availability, a study group
 * and a generated study plan.
 */
import "dotenv/config";
import { connectDB, disconnectDB } from "./config/db.js";
import User from "./models/User.js";
import Course from "./models/Course.js";
import Assignment from "./models/Assignment.js";
import Availability from "./models/Availability.js";
import StudyPlan from "./models/StudyPlan.js";
import StudyGroup from "./models/StudyGroup.js";
import GroupTask from "./models/GroupTask.js";
import Membership from "./models/Membership.js";
import PriorityEngine from "./services/PriorityEngine.js";

const EMAIL = "student@studysync.test";
const PASSWORD = "password123";
const day = (n) => new Date(Date.now() + n * 864e5);

async function main() {
  await connectDB();

  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    console.log(`${EMAIL} already exists, nothing to do.`);
    console.log("Delete the database first if you want to reseed.");
    await disconnectDB();
    return;
  }

  const user = await User.register({
    name: "Demo Student",
    email: EMAIL,
    password: PASSWORD,
    timeZone: "America/New_York",
  });
  console.log(`Created ${EMAIL}`);

  const swe = await Course.addCourse({
    userId: user.userId, code: "SWE6623",
    title: "Software Engineering", semester: "Fall 2026",
  });
  const cs = await Course.addCourse({
    userId: user.userId, code: "CS5000",
    title: "Algorithms", semester: "Fall 2026",
  });
  console.log("Created 2 courses");

  const work = [
    { courseId: swe.courseId, title: "Assignment 4 - Development", dueDate: day(4),  estimatedHours: 12, gradeWeight: 10 },
    { courseId: swe.courseId, title: "Assignment 5 - Testing",     dueDate: day(23), estimatedHours: 8,  gradeWeight: 10 },
    { courseId: swe.courseId, title: "Final project report",       dueDate: day(25), estimatedHours: 10, gradeWeight: 10 },
    { courseId: cs.courseId,  title: "Problem set 6",              dueDate: day(2),  estimatedHours: 4,  gradeWeight: 15 },
  ];
  for (const w of work) {
    const a = await Assignment.create({ ...w, userId: user.userId });
    a.priorityScore = PriorityEngine.computeScore(a);
    await a.save();
  }
  console.log(`Created ${work.length} assignments`);

  const slots = [
    ["Mon", "18:00", "21:00"], ["Tue", "09:00", "12:00"],
    ["Wed", "18:00", "21:00"], ["Thu", "09:00", "12:00"],
    ["Sat", "10:00", "15:00"],
  ];
  for (const [dayOfWeek, startTime, endTime] of slots) {
    await Availability.addSlot({ userId: user.userId, dayOfWeek, startTime, endTime });
  }
  console.log(`Created ${slots.length} availability slots`);

  const group = await StudyGroup.createGroup({
    name: "SWE 6623 Group 4",
    description: "Capstone project team",
    userId: user.userId,
  });
  const owner = await Membership.findOne({ userId: user.userId, groupId: group.groupId });
  for (const [title, offset] of [["Draft the project report", 3], ["Prepare the presentation slides", 10]]) {
    const t = await GroupTask.create({
      groupId: group.groupId, userId: user.userId, title, dueDate: day(offset),
    });
    await t.assignTo(owner.membershipId);
  }
  console.log("Created a study group with 2 tasks");

  const plan = await StudyPlan.generate(user.userId);
  const sessions = await plan.filterBy({ scope: "all" });
  console.log(`Generated a study plan with ${sessions.length} sessions`);

  console.log(`\nDone. Sign in with ${EMAIL} / ${PASSWORD}`);
  await disconnectDB();
}

main().catch(async (e) => {
  console.error("Seeding failed:", e.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
