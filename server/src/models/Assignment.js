/*
 * Assignment: Assignment 3, Figure 2.  Inherits from Task.
 *
 * Attributes:  courseId, estimatedHours, gradeWeight, priorityScore
 * Operations:  setEffort(h), setWeight(w)
 *
 * Realises FR 11, 13, 14 (and FR 12, 15 inherited from Task).
 * Course 1 --- 0..* Assignment.
 */
import mongoose from "mongoose";
import Task from "./Task.js";

const AssignmentSchema = new mongoose.Schema({
  courseId: { type: Number, required: true, index: true },
  estimatedHours: { type: Number, default: 0, min: 0 },
  gradeWeight: { type: Number, default: 0, min: 0, max: 100 },
  priorityScore: { type: Number, default: 0 },

  // Implementation addition (not in Figure 2): records that the student set the
  // score by hand (FR 23), so PriorityEngine leaves it alone.
  priorityOverridden: { type: Boolean, default: false },
});

/* FR 13: record how long the student expects the assignment to take. */
AssignmentSchema.methods.setEffort = async function (h) {
  const hours = Number(h);
  if (!Number.isFinite(hours) || hours < 0) {
    throw Object.assign(new Error("Estimated hours must be zero or more"), { status: 400 });
  }
  this.estimatedHours = hours;
  await this.save();
  return this;
};

/* FR 14: record what the assignment is worth towards the course grade. */
AssignmentSchema.methods.setWeight = async function (w) {
  const weight = Number(w);
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    throw Object.assign(new Error("Grade weight must be between 0 and 100"), { status: 400 });
  }
  this.gradeWeight = weight;
  await this.save();
  return this;
};

export default Task.discriminator("Assignment", AssignmentSchema);
