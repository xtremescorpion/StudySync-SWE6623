/*
 * Availability: Assignment 3, Figure 2.
 *
 * Attributes:  slotId, userId, dayOfWeek, startTime, endTime
 * Operations:  addSlot(), weeklyHours()
 *
 * Realises FR 16.  User 1 --- 0..* Availability.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* "HH:MM" -> minutes since midnight. Returns NaN when the format is wrong. */
export function toMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

const AvailabilitySchema = new mongoose.Schema(
  {
    slotId: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    dayOfWeek: { type: String, required: true, enum: DAYS },
    startTime: { type: String, required: true }, // "HH:MM", 24-hour
    endTime: { type: String, required: true },
  },
  { timestamps: true }
);

autoIncrement(AvailabilitySchema, "slotId", "availability");

/* Length of this slot in hours. */
AvailabilitySchema.methods.durationHours = function () {
  return (toMinutes(this.endTime) - toMinutes(this.startTime)) / 60;
};

/* FR 16: declare a free study window on a given weekday. */
AvailabilitySchema.statics.addSlot = async function ({ userId, dayOfWeek, startTime, endTime }) {
  if (!DAYS.includes(dayOfWeek)) {
    throw Object.assign(new Error(`Day must be one of: ${DAYS.join(", ")}`), { status: 400 });
  }
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw Object.assign(new Error("Times must be in HH:MM 24-hour format"), { status: 400 });
  }
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), { status: 400 });
  }
  // NFR 11: reject a slot that overlaps one already recorded for that day.
  const sameDay = await this.find({ userId, dayOfWeek });
  for (const slot of sameDay) {
    if (start < toMinutes(slot.endTime) && end > toMinutes(slot.startTime)) {
      throw Object.assign(
        new Error(`Overlaps an existing slot (${slot.startTime}-${slot.endTime})`),
        { status: 409 }
      );
    }
  }
  return this.create({ userId, dayOfWeek, startTime, endTime });
};

/* FR 16: total hours the student has declared free across the week. */
AvailabilitySchema.statics.weeklyHours = async function (userId) {
  const slots = await this.find({ userId });
  return Number(slots.reduce((sum, s) => sum + s.durationHours(), 0).toFixed(2));
};

export default mongoose.model("Availability", AvailabilitySchema);
