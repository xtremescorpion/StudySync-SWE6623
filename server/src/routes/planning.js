/*
 * Study planning routes: FR 16-20.
 * Availability (FR 16), StudyPlan (FR 17-19), StudySession (FR 20).
 */
import { Router } from "express";
import Availability from "../models/Availability.js";
import StudyPlan from "../models/StudyPlan.js";
import StudySession from "../models/StudySession.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* FR 16: GET /api/planning/availability */
router.get(
  "/availability",
  handle(async (req, res) => {
    const slots = await Availability.find({ userId: req.user.userId }).sort({ startTime: 1 });
    const weeklyHours = await Availability.weeklyHours(req.user.userId);
    res.json({ slots, weeklyHours });
  })
);

/* FR 16: POST /api/planning/availability */
router.post(
  "/availability",
  handle(async (req, res) => {
    const slot = await Availability.addSlot({ ...req.body, userId: req.user.userId });
    res.status(201).json({ slot });
  })
);

/* FR 16: DELETE /api/planning/availability/:slotId */
router.delete(
  "/availability/:slotId",
  handle(async (req, res) => {
    const slot = await Availability.findOneAndDelete({
      slotId: Number(req.params.slotId),
      userId: req.user.userId,
    });
    if (!slot) return res.status(404).json({ error: "Time slot not found" });
    res.json({ message: "Time slot removed" });
  })
);

/* FR 17: POST /api/planning/plan/generate */
router.post(
  "/plan/generate",
  handle(async (req, res) => {
    const plan = await StudyPlan.generate(req.user.userId);
    const sessions = await plan.filterBy({ scope: "all" });
    res.status(201).json({ plan, sessions });
  })
);

/* FR 18: POST /api/planning/plan/adjust */
router.post(
  "/plan/adjust",
  handle(async (req, res) => {
    const plan = await StudyPlan.adjust(req.user.userId);
    const sessions = await plan.filterBy({ scope: "all" });
    res.json({ plan, sessions });
  })
);

/* FR 19: GET /api/planning/plan?scope=day|week|all&courseId= */
router.get(
  "/plan",
  handle(async (req, res) => {
    const plan = await StudyPlan.findOne({ userId: req.user.userId }).sort({ planId: -1 });
    if (!plan) {
      return res.json({ plan: null, sessions: [], message: "No plan generated yet" });
    }
    const sessions = await plan.filterBy({
      scope: req.query.scope || "all",
      courseId: req.query.courseId,
    });
    res.json({ plan, sessions });
  })
);

/* FR 20: POST /api/planning/sessions/:sessionId/complete */
router.post(
  "/sessions/:sessionId/complete",
  handle(async (req, res) => {
    const plan = await StudyPlan.findOne({ userId: req.user.userId }).sort({ planId: -1 });
    const session = await StudySession.findOne({
      sessionId: Number(req.params.sessionId),
      planId: plan?.planId,
    });
    if (!session) return res.status(404).json({ error: "Study session not found" });
    await session.markComplete();
    res.json({ session });
  })
);

export default router;
