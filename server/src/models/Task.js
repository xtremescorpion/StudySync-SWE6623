/*
 * Task: Assignment 3, Figure 2.  Parent class in the two generalisations.
 *
 * Attributes:  taskId, title, dueDate, status
 * Operations:  updateStatus(s), daysRemaining()
 *
 * Assignment and GroupTask inherit from Task ("is-a", hollow triangle in Figure 2).
 * That inheritance is implemented with Mongoose discriminators, so all three share
 * one collection and the subclasses genuinely extend this schema.
 *
 * Realises FR 12 and FR 15.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";

export const TASK_STATUS = ["not_started", "in_progress", "completed"];

const TaskSchema = new mongoose.Schema(
  {
    taskId: { type: Number, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: TASK_STATUS, default: "not_started" },

    // Implementation addition (not in Figure 2): records the owning student so
    // tasks can be queried directly. Ownership is otherwise only reachable
    // through Course, and GroupTask has no course at all.
    userId: { type: Number, required: true, index: true },
  },
  { timestamps: true, discriminatorKey: "kind" }
);

autoIncrement(TaskSchema, "taskId", "task");

/* FR 15: move a task between not_started, in_progress and completed. */
TaskSchema.methods.updateStatus = async function (s) {
  if (!TASK_STATUS.includes(s)) {
    throw Object.assign(
      new Error(`Status must be one of: ${TASK_STATUS.join(", ")}`),
      { status: 400 }
    );
  }
  this.status = s;
  await this.save();
  return this;
};

/* FR 12: whole days from today until the due date; negative when overdue. */
TaskSchema.methods.daysRemaining = function () {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(this.dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / MS_PER_DAY);
};

TaskSchema.set("toJSON", {
  virtuals: true,
  transform(doc, ret) {
    ret.daysRemaining = doc.daysRemaining();
    delete ret._id;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

export default mongoose.model("Task", TaskSchema);
