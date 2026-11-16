/*
 * Assignment routes: FR 11-15, plus priority override FR 23.
 */
import { Router } from "express";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import PriorityEngine from "../services/PriorityEngine.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* GET /api/assignments?courseId=&status= */
router.get(
  "/",
  handle(async (req, res) => {
    const query = { userId: req.user.userId };
    if (req.query.courseId) query.courseId = Number(req.query.courseId);
    if (req.query.status) query.status = req.query.status;

    const assignments = await Assignment.find(query).sort({ dueDate: 1 });
    res.json({ assignments });
  })
);

/* FR 11: POST /api/assignments  (must be filed under a course the student owns) */
router.post(
  "/",
  handle(async (req, res) => {
    const { courseId, title, dueDate, estimatedHours, gradeWeight } = req.body;

    const course = await Course.findOne({
      courseId: Number(courseId),
      userId: req.user.userId,
    });
    if (!course) {
      return res.status(400).json({ error: "That course does not exist on your account" });
    }
    if (!title || !dueDate) {
      return res.status(400).json({ error: "Title and due date are required" });
    }

    const assignment = await Assignment.create({
      userId: req.user.userId,
      courseId: course.courseId,
      title,
      dueDate,
      estimatedHours: estimatedHours ?? 0,
      gradeWeight: gradeWeight ?? 0,
    });
    assignment.priorityScore = PriorityEngine.computeScore(assignment);
    await assignment.save();

    res.status(201).json({ assignment });
  })
);

/* FR 13: PATCH /api/assignments/:taskId/effort */
router.patch(
  "/:taskId/effort",
  handle(async (req, res) => {
    const a = await Assignment.findOne({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    await a.setEffort(req.body.estimatedHours);
    res.json({ assignment: a });
  })
);

/* FR 14: PATCH /api/assignments/:taskId/weight */
router.patch(
  "/:taskId/weight",
  handle(async (req, res) => {
    const a = await Assignment.findOne({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    await a.setWeight(req.body.gradeWeight);
    res.json({ assignment: a });
  })
);

/* FR 15: PATCH /api/assignments/:taskId/status  (Task.updateStatus, inherited) */
router.patch(
  "/:taskId/status",
  handle(async (req, res) => {
    const a = await Assignment.findOne({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    await a.updateStatus(req.body.status);
    res.json({ assignment: a });
  })
);

/* DELETE /api/assignments/:taskId */
router.delete(
  "/:taskId",
  handle(async (req, res) => {
    const a = await Assignment.findOneAndDelete({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    res.json({ message: `Deleted "${a.title}"` });
  })
);

export default router;
