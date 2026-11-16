/*
 * Auto-incrementing integer IDs.
 *
 * The class diagram in Assignment 3 gives every entity an integer identifier
 * (userId, courseId, taskId, ...). MongoDB's own _id is an ObjectId, so this
 * helper keeps the designed integer fields as real, sequential values instead
 * of silently replacing them with ObjectIds.
 */
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", CounterSchema);

export async function nextSequence(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

/* Attach an auto-incrementing integer field to a schema. */
export function autoIncrement(schema, field, counterName) {
  schema.pre("save", async function (next) {
    if (this.isNew && this[field] == null) {
      this[field] = await nextSequence(counterName);
    }
    next();
  });
}
