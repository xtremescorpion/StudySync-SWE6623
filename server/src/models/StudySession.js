/*
 * StudySession: Assignment 3, Figure 2.
 *
 * Attributes:  sessionId, planId, assignmentId, startTime, endTime, isCompleted
 * Operations:  markComplete()
 *
 * Realises FR 20.  StudyPlan 1 --- 0..* StudySession, Assignment 1 --- 0..* StudySession.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";

const StudySessionSchema = new mongoose.Schema(
  {
    sessionId: { type: Number, unique: true, index: true },
    planId: { type: Number, required: true, index: true },
    assignmentId: { type: Number, required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

autoIncrement(StudySessionSchema, "sessionId", "studysession");

StudySessionSchema.methods.durationHours = function () {
  return (this.endTime - this.startTime) / (1000 * 60 * 60);
};

/* FR 20: mark a scheduled study session as done. */
StudySessionSchema.methods.markComplete = async function () {
  this.isCompleted = true;
  await this.save();
  return this;
};

export default mongoose.model("StudySession", StudySessionSchema);
