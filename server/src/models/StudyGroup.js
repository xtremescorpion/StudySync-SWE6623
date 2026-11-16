/*
 * StudyGroup: Assignment 3, Figure 2.
 *
 * Attributes:  groupId, name, description, createdOn
 * Operations:  createGroup(), removeMember(id), groupProgress()
 *
 * Realises FR 24 and FR 29.  StudyGroup 1 --- 1..* Membership,
 * 1 --- 0..* GroupTask, 1 --- 0..* Invitation.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";
import Membership from "./Membership.js";

const StudyGroupSchema = new mongoose.Schema(
  {
    groupId: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    createdOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

autoIncrement(StudyGroupSchema, "groupId", "studygroup");

/*
 * FR 24: create a group. The creator becomes its Group Owner, which satisfies
 * the 1..* cardinality on StudyGroup --- Membership: a group is never memberless.
 */
StudyGroupSchema.statics.createGroup = async function ({ name, description, userId }) {
  if (!name) {
    throw Object.assign(new Error("Group name is required"), { status: 400 });
  }
  const group = await this.create({ name, description });
  await Membership.create({ userId, groupId: group.groupId, role: "owner" });
  return group;
};

/* FR 24: remove a member. The last owner cannot be removed. */
StudyGroupSchema.statics.removeMember = async function (groupId, membershipId) {
  const membership = await Membership.findOne({ membershipId, groupId });
  if (!membership) return null;

  if (membership.role === "owner") {
    const owners = await Membership.countDocuments({ groupId, role: "owner" });
    if (owners <= 1) {
      throw Object.assign(
        new Error("A group must keep at least one owner"),
        { status: 409 }
      );
    }
  }
  // Unassign anything that was allocated to them (FR 28).
  const { default: GroupTask } = await import("./GroupTask.js");
  await GroupTask.updateMany({ groupId, assigneeId: membershipId }, { assigneeId: null });

  await membership.deleteOne();
  return membership;
};

/* FR 29: share of the group's tasks that are completed, plus a per-member breakdown. */
StudyGroupSchema.methods.groupProgress = async function () {
  const { default: GroupTask } = await import("./GroupTask.js");
  const tasks = await GroupTask.find({ groupId: this.groupId });
  const members = await Membership.find({ groupId: this.groupId });

  const done = tasks.filter((t) => t.status === "completed").length;
  const byMember = members.map((m) => {
    const theirs = tasks.filter((t) => t.assigneeId === m.membershipId);
    return {
      membershipId: m.membershipId,
      userId: m.userId,
      role: m.role,
      assigned: theirs.length,
      completed: theirs.filter((t) => t.status === "completed").length,
    };
  });

  return {
    groupId: this.groupId,
    totalTasks: tasks.length,
    completedTasks: done,
    percentComplete: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    byMember,
  };
};

export default mongoose.model("StudyGroup", StudyGroupSchema);
