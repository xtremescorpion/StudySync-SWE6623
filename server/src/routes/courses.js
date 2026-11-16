/*
 * Course routes: FR 06-10.
 */
import { Router } from "express";
import Course from "../models/Course.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* FR 09: GET /api/courses?all=true */
router.get(
  "/",
  handle(async (req, res) => {
    const courses =
      req.query.all === "true"
        ? await Course.find({ userId: req.user.userId }).sort({ semester: -1, code: 1 })
        : await Course.listActive(req.user.userId);
    res.json({ courses });
  })
);

/* FR 06: POST /api/courses */
router.post(
  "/",
  handle(async (req, res) => {
    const course = await Course.addCourse({ ...req.body, userId: req.user.userId });
    res.status(201).json({ course });
  })
);

/* FR 07: PATCH /api/courses/:courseId */
router.patch(
  "/:courseId",
  handle(async (req, res) => {
    const course = await Course.editCourse(
      Number(req.params.courseId),
      req.user.userId,
      req.body
    );
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json({ course });
  })
);

/* FR 08: POST /api/courses/:courseId/archive */
router.post(
  "/:courseId/archive",
  handle(async (req, res) => {
    const course = await Course.archiveCourse(
      Number(req.params.courseId),
      req.user.userId,
      req.body.archived !== false
    );
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json({ course });
  })
);

/* FR 10: DELETE /api/courses/:courseId */
router.delete(
  "/:courseId",
  handle(async (req, res) => {
    const course = await Course.deleteCourse(Number(req.params.courseId), req.user.userId);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json({ message: `Deleted ${course.code} and its assignments` });
  })
);

export default router;
