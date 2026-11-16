/*
 * Course: Assignment 3, Figure 2.
 *
 * Attributes:  courseId, userId, code, title, semester, isArchived
 * Operations:  addCourse(), editCourse(), archiveCourse(), deleteCourse(), listActive()
 *
 * Realises FR 06-10.  User 1 --- 0..* Course.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";

const CourseSchema = new mongoose.Schema(
  {
    courseId: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    semester: { type: String, required: true, trim: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

autoIncrement(CourseSchema, "courseId", "course");

// NFR 11: a student cannot hold the same course code twice in one semester.
CourseSchema.index({ userId: 1, code: 1, semester: 1 }, { unique: true });

/* FR 06: add a course for a student. */
CourseSchema.statics.addCourse = async function ({ userId, code, title, semester }) {
  if (!code || !title || !semester) {
    throw Object.assign(new Error("Code, title and semester are required"), { status: 400 });
  }
  const clash = await this.findOne({ userId, code: code.toUpperCase(), semester });
  if (clash) {
    throw Object.assign(
      new Error(`${code.toUpperCase()} already exists for ${semester}`),
      { status: 409 }
    );
  }
  return this.create({ userId, code, title, semester });
};

/* FR 07: edit a course the student owns. */
CourseSchema.statics.editCourse = async function (courseId, userId, fields) {
  const course = await this.findOne({ courseId, userId });
  if (!course) return null;
  for (const key of ["code", "title", "semester"]) {
    if (fields[key] !== undefined) course[key] = fields[key];
  }
  await course.save();
  return course;
};

/* FR 08: archive (or un-archive) a course without deleting its assignments. */
CourseSchema.statics.archiveCourse = async function (courseId, userId, archived = true) {
  const course = await this.findOne({ courseId, userId });
  if (!course) return null;
  course.isArchived = Boolean(archived);
  await course.save();
  return course;
};

/* FR 10: delete a course and the assignments filed under it. */
CourseSchema.statics.deleteCourse = async function (courseId, userId) {
  const course = await this.findOne({ courseId, userId });
  if (!course) return null;
  const { default: Task } = await import("./Task.js");
  await Task.deleteMany({ courseId, kind: "Assignment" });
  await course.deleteOne();
  return course;
};

/* FR 09: list the courses a student is currently taking. */
CourseSchema.statics.listActive = function (userId) {
  return this.find({ userId, isArchived: false }).sort({ semester: -1, code: 1 });
};

export default mongoose.model("Course", CourseSchema);
