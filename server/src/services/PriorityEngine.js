/*
 * PriorityEngine: Assignment 3, Figure 2.  Application layer.
 *
 * Attributes:  deadlineWeight, gradeWeight, effortWeight
 * Operations:  computeScore(a), rankTasks(list), overrideScore(id, v)
 *
 * Realises FR 21-23.  StudyPlan 1 --- 1 PriorityEngine,
 * Assignment 0..* --- 1 PriorityEngine.
 *
 * The three weights are held as attributes rather than hard-coded constants so
 * the scoring rule can be re-tuned without touching the ranking logic.
 */

const DAY = 24 * 60 * 60 * 1000;

export class PriorityEngine {
  constructor({ deadlineWeight = 0.5, gradeWeight = 0.3, effortWeight = 0.2 } = {}) {
    this.deadlineWeight = deadlineWeight;
    this.gradeWeight = gradeWeight;
    this.effortWeight = effortWeight;
  }

  /*
   * FR 21-22: score one assignment from 0 to 100.
   *
   * Three components, each normalised to 0..1 before weighting:
   *   urgency: rises as the due date approaches, 1.0 on the day or overdue
   *   grade:   the assignment's share of the course grade
   *   effort:  longer assignments score higher so they are started sooner
   */
  computeScore(a) {
    const days = Math.ceil((new Date(a.dueDate) - Date.now()) / DAY);
    const urgency = days <= 0 ? 1 : Math.min(1, 14 / (days + 13));
    const grade = Math.min(1, (a.gradeWeight || 0) / 100);
    const effort = Math.min(1, (a.estimatedHours || 0) / 20);

    const score =
      this.deadlineWeight * urgency + this.gradeWeight * grade + this.effortWeight * effort;

    return Number((score * 100).toFixed(2));
  }

  /*
   * FR 21: order outstanding assignments, most pressing first.
   * A manual override (FR 23) wins over the computed score.
   */
  async rankTasks(list) {
    for (const a of list) {
      if (!a.priorityOverridden) {
        a.priorityScore = this.computeScore(a);
        if (typeof a.save === "function") await a.save();
      }
    }
    return [...list].sort((x, y) => {
      if (y.priorityScore !== x.priorityScore) return y.priorityScore - x.priorityScore;
      return new Date(x.dueDate) - new Date(y.dueDate); // earlier deadline breaks ties
    });
  }

  /* FR 23: let the student set a score by hand and keep it. */
  async overrideScore(id, v) {
    const { default: Assignment } = await import("../models/Assignment.js");
    const value = Number(v);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw Object.assign(new Error("Priority must be between 0 and 100"), { status: 400 });
    }
    const assignment = await Assignment.findOne({ taskId: Number(id) });
    if (!assignment) return null;

    assignment.priorityScore = value;
    assignment.priorityOverridden = true;
    await assignment.save();
    return assignment;
  }

  /* Drop a manual override so the assignment is scored automatically again. */
  async clearOverride(id) {
    const { default: Assignment } = await import("../models/Assignment.js");
    const assignment = await Assignment.findOne({ taskId: Number(id) });
    if (!assignment) return null;
    assignment.priorityOverridden = false;
    assignment.priorityScore = this.computeScore(assignment);
    await assignment.save();
    return assignment;
  }
}

// StudyPlan 1 --- 1 PriorityEngine: one shared, configured instance.
export default new PriorityEngine();
