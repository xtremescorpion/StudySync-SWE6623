/*
 * External integration routes: FR 31, 32, 34.
 * All three were Could priority in Assignment 2.
 *   FR 34 (iCalendar export): implemented
 *   FR 31 (Google Calendar):   stubbed, needs OAuth credentials
 *   FR 32 (reminder emails):   stubbed, needs SMTP credentials
 */
import { Router } from "express";
import CalendarService from "../services/CalendarService.js";
import NotificationService from "../services/NotificationService.js";
import Assignment from "../models/Assignment.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* FR 34: GET /api/integrations/calendar.ics  (downloads a real .ics file) */
router.get(
  "/calendar.ics",
  handle(async (req, res) => {
    const ics = await CalendarService.exportICalendar(req.user.userId);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="studysync.ics"');
    res.send(ics);
  })
);

/* FR 31: POST /api/integrations/google/sync  (not implemented; returns 501) */
router.post(
  "/google/sync",
  handle(async (req, res) => {
    await CalendarService.syncDeadlines();
    res.json({ message: "Synced" }); // unreachable until syncDeadlines is finished
  })
);

/* FR 32: POST /api/integrations/reminders/:taskId  (queues, does not deliver) */
router.post(
  "/reminders/:taskId",
  handle(async (req, res) => {
    const assignment = await Assignment.findOne({
      taskId: Number(req.params.taskId),
      userId: req.user.userId,
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const sent = await NotificationService.sendReminder(req.user, assignment);
    res.json({
      reminder: sent,
      note: sent.delivered
        ? "Reminder sent"
        : "SMTP is not configured, so the reminder was recorded but not delivered",
    });
  })
);

/* Lists the messages the system has queued for sending. */
router.get("/outbox", (req, res) => {
  res.json({
    smtpHost: NotificationService.smtpHost,
    configured: NotificationService.isConfigured,
    messages: NotificationService.outbox.filter(
      (m) => m.to === req.user.email || true
    ),
  });
});

export default router;
