/*
 * Study-group routes: FR 24-29.
 * StudyGroup, Membership, Invitation, GroupTask.
 */
import { Router } from "express";
import StudyGroup from "../models/StudyGroup.js";
import Membership from "../models/Membership.js";
import Invitation from "../models/Invitation.js";
import GroupTask from "../models/GroupTask.js";
import { requireAuth, handle } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/* Loads the caller's membership of :groupId, or 403s. (FR 25) */
async function membershipOf(req, res) {
  const groupId = Number(req.params.groupId);
  const membership = await Membership.findOne({ userId: req.user.userId, groupId });
  if (!membership) {
    res.status(403).json({ error: "You are not a member of that group" });
    return null;
  }
  return membership;
}

/* GET /api/groups, the groups the student belongs to */
router.get(
  "/",
  handle(async (req, res) => {
    const memberships = await Membership.find({ userId: req.user.userId });
    const groups = await StudyGroup.find({
      groupId: { $in: memberships.map((m) => m.groupId) },
    });
    res.json({
      groups: groups.map((g) => ({
        ...g.toObject(),
        myRole: memberships.find((m) => m.groupId === g.groupId).role,
      })),
    });
  })
);

/* FR 24: POST /api/groups */
router.post(
  "/",
  handle(async (req, res) => {
    const group = await StudyGroup.createGroup({ ...req.body, userId: req.user.userId });
    res.status(201).json({ group });
  })
);

/* FR 25: GET /api/groups/:groupId/members */
router.get(
  "/:groupId/members",
  handle(async (req, res) => {
    if (!(await membershipOf(req, res))) return;
    const members = await Membership.find({ groupId: Number(req.params.groupId) });
    res.json({ members });
  })
);

/* FR 24: DELETE /api/groups/:groupId/members/:membershipId */
router.delete(
  "/:groupId/members/:membershipId",
  handle(async (req, res) => {
    const me = await membershipOf(req, res);
    if (!me) return;
    if (!me.hasPermission("remove_member")) {
      return res.status(403).json({ error: "Only a group owner can remove members" });
    }
    const removed = await StudyGroup.removeMember(
      Number(req.params.groupId),
      Number(req.params.membershipId)
    );
    if (!removed) return res.status(404).json({ error: "That member was not found" });
    res.json({ message: "Member removed" });
  })
);

/* FR 26: POST /api/groups/:groupId/invitations */
router.post(
  "/:groupId/invitations",
  handle(async (req, res) => {
    if (!(await membershipOf(req, res))) return;
    const invitation = await Invitation.send({
      groupId: Number(req.params.groupId),
      senderId: req.user.userId,
      recipientEmail: req.body.recipientEmail,
    });
    res.status(201).json({ invitation });
  })
);

/* FR 27: GET /api/groups/invitations/mine */
router.get(
  "/invitations/mine",
  handle(async (req, res) => {
    const invitations = await Invitation.find({ recipientEmail: req.user.email });
    for (const inv of invitations) if (inv.isExpired()) await inv.expire();
    res.json({ invitations });
  })
);

/* FR 27: POST /api/groups/invitations/:inviteId/accept */
router.post(
  "/invitations/:inviteId/accept",
  handle(async (req, res) => {
    const inv = await Invitation.findOne({
      inviteId: Number(req.params.inviteId),
      recipientEmail: req.user.email,
    });
    if (!inv) return res.status(404).json({ error: "Invitation not found" });
    await inv.accept(req.user.userId);
    res.json({ invitation: inv });
  })
);

/* FR 27: POST /api/groups/invitations/:inviteId/decline */
router.post(
  "/invitations/:inviteId/decline",
  handle(async (req, res) => {
    const inv = await Invitation.findOne({
      inviteId: Number(req.params.inviteId),
      recipientEmail: req.user.email,
    });
    if (!inv) return res.status(404).json({ error: "Invitation not found" });
    await inv.decline();
    res.json({ invitation: inv });
  })
);

/* FR 28: GET /api/groups/:groupId/tasks */
router.get(
  "/:groupId/tasks",
  handle(async (req, res) => {
    if (!(await membershipOf(req, res))) return;
    const tasks = await GroupTask.find({ groupId: Number(req.params.groupId) }).sort({
      dueDate: 1,
    });
    res.json({ tasks });
  })
);

/* FR 28: POST /api/groups/:groupId/tasks */
router.post(
  "/:groupId/tasks",
  handle(async (req, res) => {
    const me = await membershipOf(req, res);
    if (!me) return;
    const { title, dueDate, assigneeId } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: "Title and due date are required" });
    }
    const task = await GroupTask.create({
      groupId: Number(req.params.groupId),
      userId: req.user.userId,
      title,
      dueDate,
    });
    if (assigneeId != null) await task.assignTo(Number(assigneeId));
    res.status(201).json({ task });
  })
);

/* FR 28: PATCH /api/groups/:groupId/tasks/:taskId/assign */
router.patch(
  "/:groupId/tasks/:taskId/assign",
  handle(async (req, res) => {
    const me = await membershipOf(req, res);
    if (!me) return;
    if (!me.hasPermission("assign_task")) {
      return res.status(403).json({ error: "You cannot assign tasks in this group" });
    }
    const task = await GroupTask.findOne({
      taskId: Number(req.params.taskId),
      groupId: Number(req.params.groupId),
    });
    if (!task) return res.status(404).json({ error: "Group task not found" });
    await task.assignTo(Number(req.body.membershipId));
    res.json({ task });
  })
);

/* FR 29: GET /api/groups/:groupId/progress */
router.get(
  "/:groupId/progress",
  handle(async (req, res) => {
    if (!(await membershipOf(req, res))) return;
    const group = await StudyGroup.findOne({ groupId: Number(req.params.groupId) });
    if (!group) return res.status(404).json({ error: "Group not found" });
    res.json({ progress: await group.groupProgress() });
  })
);

export default router;
