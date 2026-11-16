/*
 * GroupTask: Assignment 3, Figure 2.  Inherits from Task.
 *
 * Attributes:  groupId, assigneeId
 * Operations:  assignTo(memberId)
 *
 * Realises FR 28.  StudyGroup 1 --- 0..* GroupTask, Membership 1 --- 0..* GroupTask.
 */
import mongoose from "mongoose";
import Task from "./Task.js";

const GroupTaskSchema = new mongoose.Schema({
  groupId: { type: Number, required: true, index: true },
  assigneeId: { type: Number, default: null, index: true },
});

/*
 * FR 28: assign the task to a member of the group.
 *
 * The cardinality "Membership 1 --- 0..* GroupTask" in Assignment 3 means a task
 * can only go to someone who is actually a member, which is checked here.
 */
GroupTaskSchema.methods.assignTo = async function (memberId) {
  const { default: Membership } = await import("./Membership.js");
  const membership = await Membership.findOne({
    membershipId: memberId,
    groupId: this.groupId,
  });
  if (!membership) {
    throw Object.assign(
      new Error("That person is not a member of this group"),
      { status: 400 }
    );
  }
  this.assigneeId = memberId;
  await this.save();
  return this;
};

export default Task.discriminator("GroupTask", GroupTaskSchema);
