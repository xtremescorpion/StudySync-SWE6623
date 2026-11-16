/*
 * Dashboard: Assignment 3, Figure 2.  Application layer.
 *
 * Attributes:  userId
 * Operations:  upcomingDeadlines(), workloadSummary(), completionRate(), progressChart()
 *
 * Realises FR 30 and FR 33.  User 1 --- 1 Dashboard.
 *
 * Dashboard reads through the other classes rather than querying the database
 * directly, so the one-directional dependency described in Assignment 3 holds.
 */
import Task from "../models/Task.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Availability from "../models/Availability.js";
import PriorityEngine from "./PriorityEngine.js";

export class Dashboard {
  constructor(userId) {
    this.userId = userId;
  }

  /* FR 30: the next assignments due, most pressing first. */
  async upcomingDeadlines(limit = 10) {
    const open = await Assignment.find({
      userId: this.userId,
      status: { $ne: "completed" },
    });
    const ranked = await PriorityEngine.rankTasks(open);
    const courses = await Course.find({ userId: this.userId });
    const titleOf = new Map(courses.map((c) => [c.courseId, `${c.code} ${c.title}`]));

    return ranked.slice(0, limit).map((a) => ({
      taskId: a.taskId,
      title: a.title,
      course: titleOf.get(a.courseId) || "Unknown course",
      dueDate: a.dueDate,
      daysRemaining: a.daysRemaining(),
      estimatedHours: a.estimatedHours,
      gradeWeight: a.gradeWeight,
      priorityScore: a.priorityScore,
      status: a.status,
    }));
  }

  /* FR 30: hours of work outstanding, against the hours the student has free. */
  async workloadSummary() {
    const open = await Assignment.find({
      userId: this.userId,
      status: { $ne: "completed" },
    });
    const hoursOutstanding = open.reduce((s, a) => s + (a.estimatedHours || 0), 0);
    const weeklyHours = await Availability.weeklyHours(this.userId);
    const dueThisWeek = open.filter((a) => a.daysRemaining() <= 7 && a.daysRemaining() >= 0);

    return {
      openAssignments: open.length,
      hoursOutstanding: Number(hoursOutstanding.toFixed(1)),
      weeklyStudyHours: weeklyHours,
      dueWithinSevenDays: dueThisWeek.length,
      hoursDueThisWeek: Number(
        dueThisWeek.reduce((s, a) => s + (a.estimatedHours || 0), 0).toFixed(1)
      ),
      // A simple feasibility signal: can this week's work fit the declared time?
      weekIsFeasible:
        weeklyHours === 0
          ? null
          : dueThisWeek.reduce((s, a) => s + (a.estimatedHours || 0), 0) <= weeklyHours,
    };
  }

  /* FR 33: share of all tasks completed. */
  async completionRate() {
    const all = await Task.find({ userId: this.userId });
    const done = all.filter((t) => t.status === "completed").length;
    return {
      total: all.length,
      completed: done,
      percent: all.length ? Math.round((done / all.length) * 100) : 0,
    };
  }

  /* FR 33: completed vs created per week over the last eight weeks, for charting. */
  async progressChart(weeks = 8) {
    const all = await Task.find({ userId: this.userId });
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const from = new Date(now - (i + 1) * WEEK);
      const to = new Date(now - i * WEEK);
      buckets.push({
        weekStarting: from.toISOString().slice(0, 10),
        created: all.filter((t) => t.createdAt >= from && t.createdAt < to).length,
        completed: all.filter(
          (t) => t.status === "completed" && t.updatedAt >= from && t.updatedAt < to
        ).length,
      });
    }
    return buckets;
  }
}

export default Dashboard;
