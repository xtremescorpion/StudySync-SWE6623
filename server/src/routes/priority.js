/*
 * Task prioritization routes: FR 21-23.  PriorityEngine.
 */
import { Router } from "express";
import Assignment from "../models/Assignment.js";
import PriorityEngine from "../services/PriorityEngine.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* FR 21-22: GET /api/priority  (outstanding tasks, ranked) */
router.get(
  "/",
  handle(async (req, res) => {
    const open = await Assignment.find({
      userId: req.user.userId,
      status: { $ne: "completed" },
    });
    const ranked = await PriorityEngine.rankTasks(open);
    res.json({
      weights: {
        deadlineWeight: PriorityEngine.deadlineWeight,
        gradeWeight: PriorityEngine.gradeWeight,
        effortWeight: PriorityEngine.effortWeight,
      },
      tasks: ranked,
    });
  })
);

/* FR 23: PUT /api/priority/:taskId  { score } */
router.put(
  "/:taskId",
  handle(async (req, res) => {
    const owned = await Assignment.findOne({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!owned) return res.status(404).json({ error: "Assignment not found" });

    const assignment = await PriorityEngine.overrideScore(req.params.taskId, req.body.score);
    res.json({ assignment });
  })
);

/* FR 23: DELETE /api/priority/:taskId  (drop the manual override) */
router.delete(
  "/:taskId",
  handle(async (req, res) => {
    const owned = await Assignment.findOne({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!owned) return res.status(404).json({ error: "Assignment not found" });

    const assignment = await PriorityEngine.clearOverride(req.params.taskId);
    res.json({ assignment });
  })
);

export default router;
