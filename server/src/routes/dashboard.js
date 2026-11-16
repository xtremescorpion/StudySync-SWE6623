/*
 * Dashboard routes: FR 30 and FR 33.
 */
import { Router } from "express";
import Dashboard from "../services/Dashboard.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* FR 30: GET /api/dashboard  (everything the landing screen needs, in one call) */
router.get(
  "/",
  handle(async (req, res) => {
    const dashboard = new Dashboard(req.user.userId);
    const [deadlines, workload, completion] = await Promise.all([
      dashboard.upcomingDeadlines(),
      dashboard.workloadSummary(),
      dashboard.completionRate(),
    ]);
    res.json({ deadlines, workload, completion });
  })
);

/* FR 33: GET /api/dashboard/chart?weeks=8 */
router.get(
  "/chart",
  handle(async (req, res) => {
    const dashboard = new Dashboard(req.user.userId);
    res.json({ chart: await dashboard.progressChart(Number(req.query.weeks) || 8) });
  })
);

export default router;
