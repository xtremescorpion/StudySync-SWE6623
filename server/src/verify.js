/*
 * Offline verification: runs without a database.
 *
 * Checks two things:
 *   1. Every module loads, every schema and discriminator registers, and the
 *      whole REST surface mounts. This catches import cycles, schema typos and
 *      broken middleware before anyone starts the server.
 *   2. The algorithmic logic (scoring, time arithmetic, permissions, iCalendar
 *      formatting) behaves correctly.
 *
 * The database-backed flows are covered by src/smoke.js, which needs MongoDB.
 *
 * Run with:  npm run verify
 */
process.env.NODE_ENV = "test";

import Task, { TASK_STATUS } from "./models/Task.js";
import Assignment from "./models/Assignment.js";
import GroupTask from "./models/GroupTask.js";
import User from "./models/User.js";
import Course from "./models/Course.js";
import Availability, { toMinutes, DAYS } from "./models/Availability.js";
import StudyPlan from "./models/StudyPlan.js";
import StudySession from "./models/StudySession.js";
import StudyGroup from "./models/StudyGroup.js";
import Membership from "./models/Membership.js";
import Invitation, { INVITE_STATUS } from "./models/Invitation.js";
import { PriorityEngine } from "./services/PriorityEngine.js";
import NotificationService from "./services/NotificationService.js";
import CalendarService from "./services/CalendarService.js";
import Dashboard from "./services/Dashboard.js";
import app from "./index.js";

let pass = 0, fail = 0;
const failures = [];

function check(label, ok, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; failures.push(`${label} ${detail}`); console.log(`  FAIL ${label} ${detail}`); }
}

const DAY = 864e5;
const day = (n) => new Date(Date.now() + n * DAY);

// ---------------------------------------------------------------- structure
console.log("\nStructure: all 15 designed classes exist");

const DESIGNED = {
  User: ["register", "login", "logout", "updateProfile", "resetPassword"],
  Course: ["addCourse", "editCourse", "archiveCourse", "deleteCourse", "listActive"],
  Task: ["updateStatus", "daysRemaining"],
  Assignment: ["setEffort", "setWeight"],
  GroupTask: ["assignTo"],
  StudyGroup: ["createGroup", "removeMember", "groupProgress"],
  Membership: ["hasPermission"],
  Invitation: ["send", "accept", "decline", "expire"],
  Availability: ["addSlot", "weeklyHours"],
  StudyPlan: ["generate", "adjust", "filterBy"],
  StudySession: ["markComplete"],
};
const MODELS = {
  User, Course, Task, Assignment, GroupTask, StudyGroup,
  Membership, Invitation, Availability, StudyPlan, StudySession,
};

for (const [name, ops] of Object.entries(DESIGNED)) {
  const model = MODELS[name];
  const have = new Set([
    ...Object.keys(model.schema.methods),
    ...Object.keys(model.schema.statics),
  ]);
  const missing = ops.filter((o) => !have.has(o));
  check(`${name}: ${ops.length} operations from Figure 2`, missing.length === 0,
    missing.length ? `missing ${missing.join(", ")}` : "");
}

const engine = new PriorityEngine();
for (const [name, obj, ops] of [
  ["PriorityEngine", engine, ["computeScore", "rankTasks", "overrideScore"]],
  ["Dashboard", new Dashboard(1),
    ["upcomingDeadlines", "workloadSummary", "completionRate", "progressChart"]],
  ["CalendarService", CalendarService, ["syncDeadlines", "exportICalendar"]],
  ["NotificationService", NotificationService, ["sendInvitation", "sendReminder"]],
]) {
  const missing = ops.filter((o) => typeof obj[o] !== "function");
  check(`${name}: ${ops.length} operations from Figure 2`, missing.length === 0,
    missing.length ? `missing ${missing.join(", ")}` : "");
}

console.log("\nStructure: attributes match Figure 2");
const ATTRS = {
  User: ["userId", "name", "email", "passwordHash", "timeZone"],
  Course: ["courseId", "userId", "code", "title", "semester", "isArchived"],
  Task: ["taskId", "title", "dueDate", "status"],
  Assignment: ["courseId", "estimatedHours", "gradeWeight", "priorityScore"],
  GroupTask: ["groupId", "assigneeId"],
  StudyGroup: ["groupId", "name", "description", "createdOn"],
  Membership: ["membershipId", "userId", "groupId", "role", "joinedOn"],
  Invitation: ["inviteId", "groupId", "senderId", "recipientEmail", "status", "expiresOn"],
  Availability: ["slotId", "userId", "dayOfWeek", "startTime", "endTime"],
  StudyPlan: ["planId", "userId", "generatedOn"],
  StudySession: ["sessionId", "planId", "assignmentId", "startTime", "endTime", "isCompleted"],
};
for (const [name, attrs] of Object.entries(ATTRS)) {
  const paths = Object.keys(MODELS[name].schema.paths);
  const missing = attrs.filter((a) => !paths.includes(a));
  check(`${name}: ${attrs.length} attributes`, missing.length === 0,
    missing.length ? `missing ${missing.join(", ")}` : "");
}

console.log("\nStructure: Task generalisation (hollow triangles in Figure 2)");
check("Assignment inherits Task", Assignment.baseModelName === "Task");
check("GroupTask inherits Task", GroupTask.baseModelName === "Task");
check("Assignment inherits Task.daysRemaining",
  typeof Assignment.schema.methods.daysRemaining === "function");
check("Assignment inherits Task.status path", "status" in Assignment.schema.paths);
check("GroupTask inherits Task.updateStatus",
  typeof GroupTask.schema.methods.updateStatus === "function");

console.log("\nStructure: REST surface mounts");
const routes = [];
for (const layer of app._router.stack) {
  if (layer.name !== "router" || !layer.handle?.stack) continue;
  const base = layer.regexp.source
    .replace("^\\/", "/").replace("\\/?(?=\\/|$)", "").replace(/\\\//g, "/");
  for (const r of layer.handle.stack) {
    if (!r.route) continue;
    for (const m of Object.keys(r.route.methods)) {
      routes.push(`${m.toUpperCase()} ${base}${r.route.path}`.replace(/\/$/, ""));
    }
  }
}
check("every router mounted", routes.length >= 35, `${routes.length} routes`);
for (const expected of [
  "POST /api/auth/register", "POST /api/auth/login", "POST /api/auth/logout",
  "GET /api/courses", "POST /api/courses", "DELETE /api/courses/:courseId",
  "POST /api/assignments", "PATCH /api/assignments/:taskId/status",
  "POST /api/planning/availability", "POST /api/planning/plan/generate",
  "GET /api/priority", "PUT /api/priority/:taskId",
  "POST /api/groups", "POST /api/groups/:groupId/invitations",
  "GET /api/groups/:groupId/progress", "GET /api/dashboard",
  "GET /api/integrations/calendar.ics",
]) {
  check(`route ${expected}`, routes.includes(expected));
}

// ---------------------------------------------------------------- logic
console.log("\nFR 12  Task.daysRemaining");
const dr = (d) => Task.schema.methods.daysRemaining.call({ dueDate: d });
check("three days ahead", dr(day(3)) === 3, `got ${dr(day(3))}`);
check("today is zero", dr(new Date()) === 0, `got ${dr(new Date())}`);
check("overdue is negative", dr(day(-2)) === -2, `got ${dr(day(-2))}`);

console.log("\nFR 15  Task status values");
check("three statuses", TASK_STATUS.length === 3);
check("statuses as designed",
  TASK_STATUS.join() === "not_started,in_progress,completed");

console.log("\nFR 16  Availability time arithmetic");
check("parses 09:30", toMinutes("09:30") === 570);
check("parses 00:00", toMinutes("00:00") === 0);
check("parses 23:59", toMinutes("23:59") === 1439);
check("rejects 24:00", Number.isNaN(toMinutes("24:00")));
check("rejects 9:30 (no leading zero)", Number.isNaN(toMinutes("9:30")));
check("rejects nonsense", Number.isNaN(toMinutes("evening")));
check("seven weekdays, Monday first", DAYS.length === 7 && DAYS[0] === "Mon");
const dur = Availability.schema.methods.durationHours;
check("three-hour slot", dur.call({ startTime: "18:00", endTime: "21:00" }) === 3);

console.log("\nFR 21-22  PriorityEngine.computeScore");
const base = { dueDate: day(10), gradeWeight: 20, estimatedHours: 5 };
check("score within 0-100", (() => {
  const s = engine.computeScore(base);
  return s >= 0 && s <= 100;
})());
check("sooner deadline scores higher",
  engine.computeScore({ ...base, dueDate: day(1) }) >
  engine.computeScore({ ...base, dueDate: day(20) }));
check("heavier grade weight scores higher",
  engine.computeScore({ ...base, gradeWeight: 50 }) >
  engine.computeScore({ ...base, gradeWeight: 5 }));
check("more effort scores higher",
  engine.computeScore({ ...base, estimatedHours: 18 }) >
  engine.computeScore({ ...base, estimatedHours: 1 }));
check("overdue work is maximally urgent",
  engine.computeScore({ ...base, dueDate: day(-5) }) ===
  engine.computeScore({ ...base, dueDate: day(0) }));
check("weights are attributes, not constants",
  new PriorityEngine({ gradeWeight: 0.9, deadlineWeight: 0.05, effortWeight: 0.05 })
    .computeScore({ ...base, gradeWeight: 100 }) > 85);

console.log("\nFR 21, 23  PriorityEngine.rankTasks");
const tasks = [
  { taskId: 1, title: "far off", dueDate: day(25), gradeWeight: 10, estimatedHours: 2 },
  { taskId: 2, title: "due soon", dueDate: day(1), gradeWeight: 10, estimatedHours: 2 },
  { taskId: 3, title: "mid", dueDate: day(8), gradeWeight: 10, estimatedHours: 2 },
];
let ranked = await engine.rankTasks(tasks);
check("most urgent first", ranked[0].taskId === 2, `got ${ranked[0].title}`);
check("least urgent last", ranked[2].taskId === 1, `got ${ranked[2].title}`);
check("every task scored", tasks.every((t) => typeof t.priorityScore === "number"));

const withOverride = [
  { taskId: 1, title: "pinned", dueDate: day(25), gradeWeight: 1, estimatedHours: 1,
    priorityScore: 100, priorityOverridden: true },
  { taskId: 2, title: "due soon", dueDate: day(1), gradeWeight: 10, estimatedHours: 2 },
];
ranked = await engine.rankTasks(withOverride);
check("FR 23 manual override outranks the computed score", ranked[0].taskId === 1);
check("FR 23 override is not recalculated", withOverride[0].priorityScore === 100);

const tie = [
  { taskId: 1, dueDate: day(5), gradeWeight: 10, estimatedHours: 3 },
  { taskId: 2, dueDate: day(5), gradeWeight: 10, estimatedHours: 3 },
];
ranked = await engine.rankTasks(tie);
check("ties are stable", ranked.length === 2);

console.log("\nFR 25  Membership.hasPermission");
const can = (role, action) =>
  Membership.schema.methods.hasPermission.call({ role }, action);
check("owner can invite", can("owner", "invite") === true);
check("owner can remove members", can("owner", "remove_member") === true);
check("member cannot invite", can("member", "invite") === false);
check("member cannot remove members", can("member", "remove_member") === false);
check("member can view", can("member", "view") === true);
check("unknown action denied", can("owner", "delete_everything") === false);

console.log("\nFR 27  Invitation states");
check("four states as designed", INVITE_STATUS.join() === "pending,accepted,declined,expired");
const isExpired = Invitation.schema.methods.isExpired;
check("pending past its date is expired",
  isExpired.call({ status: "pending", expiresOn: day(-1) }) === true);
check("pending in date is not expired",
  isExpired.call({ status: "pending", expiresOn: day(1) }) === false);
check("already accepted is not re-expired",
  isExpired.call({ status: "accepted", expiresOn: day(-1) }) === false);

console.log("\nFR 26, 32  NotificationService");
NotificationService.outbox.length = 0;
const queued = await NotificationService.sendInvitation({
  recipientEmail: "x@students.kennesaw.edu", inviteId: 7, expiresOn: day(7),
});
check("invitation recorded", NotificationService.outbox.length === 1);
check("not marked delivered without SMTP", queued.delivered === false);
check("addressed to the recipient", queued.to === "x@students.kennesaw.edu");
const reminder = await NotificationService.sendReminder(
  { name: "A", email: "a@b.com" },
  { title: "Essay", dueDate: day(1), estimatedHours: 3, taskId: 9,
    daysRemaining: () => 1 }
);
check("reminder names the assignment", reminder.subject.includes("Essay"));

console.log("\nFR 31, 34  CalendarService");
const original = Assignment.find;
Assignment.find = () => ({
  sort: async () => [
    { taskId: 1, title: "Report; part 1, draft", dueDate: day(2),
      estimatedHours: 4, gradeWeight: 15, courseId: 1 },
  ],
});
const origCourse = Course.find;
Course.find = async () => [{ courseId: 1, code: "SWE6623" }];

const ics = await CalendarService.exportICalendar(1);
check("FR 34 begins a calendar", ics.startsWith("BEGIN:VCALENDAR"));
check("FR 34 ends a calendar", ics.trimEnd().endsWith("END:VCALENDAR"));
check("FR 34 contains the event", ics.includes("BEGIN:VEVENT"));
check("FR 34 CRLF line endings per RFC 5545", ics.includes("\r\n"));
check("FR 34 escapes commas and semicolons",
  ics.includes("Report\\; part 1\\, draft"), "escaping not applied");
check("FR 34 includes a reminder alarm", ics.includes("BEGIN:VALARM"));
check("FR 34 names the course", ics.includes("SWE6623"));

Assignment.find = original;
Course.find = origCourse;

let syncFailed = false;
try { await CalendarService.syncDeadlines(); }
catch (e) { syncFailed = e.status === 501; }
check("FR 31 sync reports not-implemented, not a crash", syncFailed);

// ---------------------------------------------------------------- summary
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log("  - " + f));
}
console.log(
  "\nNote: this suite runs without a database. The database-backed flows are " +
  "covered by `npm run smoke`, which needs MongoDB running."
);
process.exit(fail ? 1 : 0);
