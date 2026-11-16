/*
 * StudyPlan: Assignment 3, Figure 2.
 *
 * Attributes:  planId, userId, generatedOn
 * Operations:  generate(), adjust(), filterBy(range)
 *
 * Realises FR 17-19.  User 1 --- 0..* StudyPlan, StudyPlan 1 --- 0..* StudySession,
 * StudyPlan 1 --- 1 PriorityEngine.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";
import Availability, { DAYS, toMinutes } from "./Availability.js";
import StudySession from "./StudySession.js";
import PriorityEngine from "../services/PriorityEngine.js";

const StudyPlanSchema = new mongoose.Schema(
  {
    planId: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    generatedOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

autoIncrement(StudyPlanSchema, "planId", "studyplan");

const HORIZON_DAYS = 14;
const MS_PER_HOUR = 1000 * 60 * 60;

/*
 * Turn the student's weekly Availability slots into concrete dated windows
 * across the next two weeks, earliest first.
 */
async function buildWindows(userId) {
  const slots = await Availability.find({ userId });
  const windows = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < HORIZON_DAYS; d++) {
    const date = new Date(today.getTime() + d * 24 * MS_PER_HOUR);
    // JS getDay(): 0 = Sunday. DAYS starts at Monday.
    const label = DAYS[(date.getDay() + 6) % 7];
    for (const slot of slots.filter((s) => s.dayOfWeek === label)) {
      const start = new Date(date);
      start.setMinutes(toMinutes(slot.startTime));
      const end = new Date(date);
      end.setMinutes(toMinutes(slot.endTime));
      if (end > new Date()) {
        windows.push({ start: start < new Date() ? new Date() : start, end });
      }
    }
  }
  return windows.sort((a, b) => a.start - b.start);
}

/*
 * FR 17: suggest a schedule from estimated effort and declared availability.
 *
 * Assignments are ranked by PriorityEngine, then each one's estimated hours are
 * placed greedily into the earliest free windows that still fall before its due
 * date. Sessions the student has already completed are left untouched.
 */
StudyPlanSchema.statics.generate = async function (userId) {
  const { default: Assignment } = await import("./Assignment.js");

  let plan = await this.findOne({ userId }).sort({ planId: -1 });
  if (!plan) plan = await this.create({ userId });

  // Keep completed sessions; clear the rest so the plan can be rebuilt.
  await StudySession.deleteMany({ planId: plan.planId, isCompleted: false });
  const kept = await StudySession.find({ planId: plan.planId });

  const assignments = await Assignment.find({
    userId,
    status: { $ne: "completed" },
  });
  const ranked = await PriorityEngine.rankTasks(assignments);
  const windows = await buildWindows(userId);

  // Subtract time already committed to completed sessions.
  for (const session of kept) {
    for (const w of windows) {
      if (session.startTime < w.end && session.endTime > w.start) {
        w.start = new Date(Math.max(w.start, session.endTime));
      }
    }
  }

  const created = [];
  for (const assignment of ranked) {
    let remaining = assignment.estimatedHours || 0;
    if (remaining <= 0) continue;

    for (const w of windows) {
      if (remaining <= 0) break;
      const free = (w.end - w.start) / MS_PER_HOUR;
      if (free <= 0.25) continue;
      if (w.start >= assignment.dueDate) continue; // FR 17: finish before it is due

      const hours = Math.min(free, remaining, 2); // cap a sitting at 2 hours
      const end = new Date(w.start.getTime() + hours * MS_PER_HOUR);
      created.push({
        planId: plan.planId,
        assignmentId: assignment.taskId,
        startTime: new Date(w.start),
        endTime: end,
      });
      w.start = end;
      remaining -= hours;
    }
  }

  for (const s of created) await StudySession.create(s);

  plan.generatedOn = new Date();
  await plan.save();
  return plan;
};

/* FR 18: rebuild the plan after a deadline or availability change. */
StudyPlanSchema.statics.adjust = function (userId) {
  return this.generate(userId);
};

/*
 * FR 19: filter the plan's sessions by day, by week, or by course.
 * range: { scope: "day" | "week" | "all", courseId?: number }
 */
StudyPlanSchema.methods.filterBy = async function (range = {}) {
  const { scope = "all", courseId } = range;
  const query = { planId: this.planId };

  if (scope === "day" || scope === "week") {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + (scope === "day" ? 1 : 7) * 24 * MS_PER_HOUR);
    query.startTime = { $gte: from, $lt: to };
  }

  let sessions = await StudySession.find(query).sort({ startTime: 1 });

  if (courseId != null) {
    const { default: Assignment } = await import("./Assignment.js");
    const inCourse = await Assignment.find({ courseId: Number(courseId) }).select("taskId");
    const ids = new Set(inCourse.map((a) => a.taskId));
    sessions = sessions.filter((s) => ids.has(s.assignmentId));
  }
  return sessions;
};

export default mongoose.model("StudyPlan", StudyPlanSchema);
