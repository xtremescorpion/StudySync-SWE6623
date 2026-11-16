/*
 * Membership: Assignment 3, Figure 2.
 *
 * Attributes:  membershipId, userId, groupId, role, joinedOn
 * Operations:  hasPermission(a)
 *
 * Realises FR 25.  User 1 --- 0..* Membership, StudyGroup 1 --- 1..* Membership,
 * Membership 1 --- 0..* GroupTask.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";

export const ROLES = ["owner", "member"];

/* What each role is allowed to do (FR 25). */
const PERMISSIONS = {
  owner: ["invite", "remove_member", "assign_task", "edit_group", "delete_group", "view"],
  member: ["assign_task", "view"],
};

const MembershipSchema = new mongoose.Schema(
  {
    membershipId: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    groupId: { type: Number, required: true, index: true },
    role: { type: String, enum: ROLES, default: "member" },
    joinedOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

autoIncrement(MembershipSchema, "membershipId", "membership");

// NFR 11: a student cannot join the same group twice.
MembershipSchema.index({ userId: 1, groupId: 1 }, { unique: true });

/* FR 25: role-based permission check. */
MembershipSchema.methods.hasPermission = function (a) {
  return (PERMISSIONS[this.role] || []).includes(a);
};

export default mongoose.model("Membership", MembershipSchema);
