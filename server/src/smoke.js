/*
 * Smoke test: exercises the implemented endpoints end to end.
 *
 * Registers an account and walks every implemented requirement in order against
 * a live database, checking the response each time.
 *
 * Run with:  npm run smoke
 *
 * It clears the database before it starts, so MONGODB_URI must point at one
 * whose name contains "test". It refuses to run against anything else, which
 * keeps a mistyped connection string from wiping real data.
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "./config/db.js";
import app from "./index.js";

process.env.NODE_ENV = "test";

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push(`${label} ${detail}`);
    console.log(`  FAIL ${label} ${detail}`);
  }
}

async function main() {
  await connectDB();

  // The test registers an account and then checks that registering it again is
  // refused, so it needs an empty database every run. Clear it first, but only
  // ever a database with "test" in its name, so a mistyped MONGODB_URI can never
  // wipe real data.
  const dbName = mongoose.connection.name;
  if (!/test/i.test(dbName)) {
    console.error(
      `\nRefusing to run against "${dbName}".\n` +
        `The smoke test clears the database before it starts, so point MONGODB_URI\n` +
        `at a database whose name contains "test", for example:\n\n` +
        `  mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studysync_test\n`
    );
    process.exit(1);
  }
  /* Empty every collection. deleteMany works with the readWrite role that a
     normal application user has, whereas dropDatabase needs admin rights. */
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    await mongoose.connection.db.collection(c.name).deleteMany({});
  }
  console.log(`Cleared "${dbName}" so this run starts from empty.\n`);

  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/api`;

  let token = null;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  };

  console.log("\nFR 01-05  User / authentication");
  let r = await call("GET", "/health");
  check("health check responds", r.status === 200);

  r = await call("POST", "/auth/register", {
    name: "Test Student",
    email: "test@students.kennesaw.edu",
    password: "password123",
  });
  check("FR 01 register", r.status === 201 && r.body.token, JSON.stringify(r.body));
  token = r.body.token;
  check("FR 01 password hash is not returned", r.body.user?.passwordHash === undefined);

  r = await call("POST", "/auth/register", {
    name: "Dup",
    email: "test@students.kennesaw.edu",
    password: "password123",
  });
  check("FR 01 duplicate email rejected", r.status === 409);

  r = await call("POST", "/auth/login", {
    email: "test@students.kennesaw.edu",
    password: "wrongpass",
  });
  check("FR 02 wrong password rejected", r.status === 401);

  r = await call("POST", "/auth/login", {
    email: "test@students.kennesaw.edu",
    password: "password123",
  });
  check("FR 02 login", r.status === 200 && r.body.token);
  token = r.body.token;

  r = await call("PATCH", "/auth/me", { timeZone: "America/Chicago" });
  check("FR 03 update profile", r.body.user?.timeZone === "America/Chicago");

  console.log("\nFR 06-10  Course");
  r = await call("POST", "/courses", {
    code: "swe6623",
    title: "Software Engineering",
    semester: "Fall 2026",
  });
  check("FR 06 add course", r.status === 201 && r.body.course?.code === "SWE6623");
  const courseId = r.body.course?.courseId;

  r = await call("POST", "/courses", {
    code: "SWE6623",
    title: "Dup",
    semester: "Fall 2026",
  });
  check("FR 06 duplicate course rejected", r.status === 409);

  r = await call("POST", "/courses", {
    code: "CS5000",
    title: "Algorithms",
    semester: "Fall 2026",
  });
  const otherCourseId = r.body.course?.courseId;

  r = await call("PATCH", `/courses/${courseId}`, { title: "Software Engineering I" });
  check("FR 07 edit course", r.body.course?.title === "Software Engineering I");

  r = await call("POST", `/courses/${otherCourseId}/archive`, {});
  check("FR 08 archive course", r.body.course?.isArchived === true);

  r = await call("GET", "/courses");
  check("FR 09 archived course excluded", r.body.courses?.length === 1);

  console.log("\nFR 11-15  Task / Assignment (inheritance)");
  const soon = new Date(Date.now() + 3 * 864e5).toISOString();
  const later = new Date(Date.now() + 20 * 864e5).toISOString();

  r = await call("POST", "/assignments", {
    courseId,
    title: "Assignment 4 - Development",
    dueDate: soon,
    estimatedHours: 10,
    gradeWeight: 10,
  });
  check("FR 11 add assignment", r.status === 201);
  check("FR 12 daysRemaining inherited from Task", r.body.assignment?.daysRemaining === 3,
    `got ${r.body.assignment?.daysRemaining}`);
  check("inheritance: discriminator recorded", r.body.assignment?.kind === "Assignment");
  const taskId = r.body.assignment?.taskId;

  r = await call("POST", "/assignments", {
    courseId,
    title: "Final Project",
    dueDate: later,
    estimatedHours: 6,
    gradeWeight: 30,
  });
  const task2 = r.body.assignment?.taskId;

  r = await call("POST", "/assignments", { courseId: 9999, title: "x", dueDate: soon });
  check("FR 11 assignment under a course you do not own is rejected", r.status === 400);

  r = await call("PATCH", `/assignments/${taskId}/effort`, { estimatedHours: 12 });
  check("FR 13 set effort", r.body.assignment?.estimatedHours === 12);

  r = await call("PATCH", `/assignments/${taskId}/weight`, { gradeWeight: 150 });
  check("FR 14 invalid grade weight rejected", r.status === 400);

  r = await call("PATCH", `/assignments/${taskId}/status`, { status: "in_progress" });
  check("FR 15 update status", r.body.assignment?.status === "in_progress");

  console.log("\nFR 16  Availability");
  r = await call("POST", "/planning/availability", {
    dayOfWeek: "Mon",
    startTime: "18:00",
    endTime: "21:00",
  });
  check("FR 16 add slot", r.status === 201);

  r = await call("POST", "/planning/availability", {
    dayOfWeek: "Mon",
    startTime: "20:00",
    endTime: "22:00",
  });
  check("FR 16 overlapping slot rejected", r.status === 409);

  for (const day of ["Tue", "Wed", "Thu", "Sat"]) {
    await call("POST", "/planning/availability", {
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "13:00",
    });
  }
  r = await call("GET", "/planning/availability");
  check("FR 16 weekly hours totalled", r.body.weeklyHours === 19, `got ${r.body.weeklyHours}`);

  console.log("\nFR 21-23  PriorityEngine");
  r = await call("GET", "/priority");
  check("FR 21 tasks ranked", Array.isArray(r.body.tasks) && r.body.tasks.length === 2);
  check(
    "FR 22 sooner deadline outranks heavier grade weight",
    r.body.tasks?.[0]?.taskId === taskId,
    `first was ${r.body.tasks?.[0]?.title}`
  );

  r = await call("PUT", `/priority/${task2}`, { score: 99 });
  check("FR 23 manual override", r.body.assignment?.priorityScore === 99);

  r = await call("GET", "/priority");
  check("FR 23 override changes the ranking", r.body.tasks?.[0]?.taskId === task2);

  console.log("\nFR 17-20  StudyPlan / StudySession");
  r = await call("POST", "/planning/plan/generate", {});
  check("FR 17 plan generated", r.status === 201);
  check("FR 17 sessions scheduled", r.body.sessions?.length > 0,
    `got ${r.body.sessions?.length}`);
  const sessionId = r.body.sessions?.[0]?.sessionId;

  const allBefore = r.body.sessions?.every((s) => new Date(s.startTime) >= new Date());
  check("FR 17 no session scheduled in the past", allBefore === true);

  r = await call("GET", "/planning/plan?scope=week");
  check("FR 19 filter by week", Array.isArray(r.body.sessions));

  r = await call("POST", `/planning/sessions/${sessionId}/complete`, {});
  check("FR 20 mark session complete", r.body.session?.isCompleted === true);

  r = await call("POST", "/planning/plan/adjust", {});
  check("FR 18 adjust keeps completed sessions",
    r.body.sessions?.some((s) => s.isCompleted === true));

  console.log("\nFR 24-29  Study groups");
  r = await call("POST", "/groups", { name: "SWE 6623 Group 4", description: "Capstone" });
  check("FR 24 create group", r.status === 201);
  const groupId = r.body.group?.groupId;

  r = await call("GET", `/groups/${groupId}/members`);
  check("FR 25 creator is the owner", r.body.members?.[0]?.role === "owner");
  const ownerMembershipId = r.body.members?.[0]?.membershipId;

  r = await call("POST", `/groups/${groupId}/invitations`, {
    recipientEmail: "classmate@students.kennesaw.edu",
  });
  check("FR 26 owner can invite", r.status === 201 && r.body.invitation?.status === "pending");

  r = await call("GET", "/integrations/outbox");
  check("FR 26 invitation email queued", r.body.messages?.length >= 1);

  r = await call("POST", `/groups/${groupId}/tasks`, {
    title: "Draft the project report",
    dueDate: soon,
    assigneeId: ownerMembershipId,
  });
  check("FR 28 group task assigned to a member", r.body.task?.assigneeId === ownerMembershipId);
  check("inheritance: GroupTask is a Task", r.body.task?.kind === "GroupTask");
  const groupTaskId = r.body.task?.taskId;

  r = await call("PATCH", `/groups/${groupId}/tasks/${groupTaskId}/assign`, {
    membershipId: 9999,
  });
  check("FR 28 cannot assign to a non-member", r.status === 400);

  r = await call("GET", `/groups/${groupId}/progress`);
  check("FR 29 group progress", r.body.progress?.totalTasks === 1);

  r = await call("DELETE", `/groups/${groupId}/members/${ownerMembershipId}`);
  check("FR 24 last owner cannot be removed", r.status === 409);

  console.log("\nFR 30, 33  Dashboard");
  r = await call("GET", "/dashboard");
  check("FR 30 upcoming deadlines", r.body.deadlines?.length >= 1);
  check("FR 30 workload summary", typeof r.body.workload?.hoursOutstanding === "number");
  check("FR 33 completion rate", typeof r.body.completion?.percent === "number");

  r = await call("GET", "/dashboard/chart?weeks=4");
  check("FR 33 progress chart", r.body.chart?.length === 4);

  console.log("\nFR 31, 32, 34  External integrations");
  const icsRes = await fetch(`${base}/integrations/calendar.ics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ics = await icsRes.text();
  check("FR 34 iCalendar export", ics.startsWith("BEGIN:VCALENDAR") && ics.includes("BEGIN:VEVENT"));

  r = await call("POST", `/integrations/reminders/${taskId}`, {});
  check("FR 32 reminder queued (SMTP not configured)", r.body.reminder?.delivered === false);

  r = await call("POST", "/integrations/google/sync", {});
  check("FR 31 google sync reports not implemented", r.status === 501);

  console.log("\nFR 04  Logout invalidates the session");
  r = await call("POST", "/auth/logout", {});
  check("FR 04 logout", r.status === 200);
  r = await call("GET", "/dashboard");
  check("FR 04 old token refused after logout", r.status === 401);

  server.close();
  await disconnectDB();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log("  - " + f));
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
