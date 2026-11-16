/*
 * Invitation: Assignment 3, Figure 2.
 *
 * Attributes:  inviteId, groupId, senderId, recipientEmail, status, expiresOn
 * Operations:  send(), accept(), decline(), expire()
 *
 * Realises FR 26 and FR 27.  StudyGroup 1 --- 0..* Invitation,
 * Invitation 0..* --- 1 NotificationService.
 */
import mongoose from "mongoose";
import { autoIncrement } from "./_counter.js";
import Membership from "./Membership.js";
import NotificationService from "../services/NotificationService.js";

export const INVITE_STATUS = ["pending", "accepted", "declined", "expired"];

const INVITE_VALID_DAYS = 7;

const InvitationSchema = new mongoose.Schema(
  {
    inviteId: { type: Number, unique: true, index: true },
    groupId: { type: Number, required: true, index: true },
    senderId: { type: Number, required: true },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email address is not valid"],
    },
    status: { type: String, enum: INVITE_STATUS, default: "pending" },
    expiresOn: {
      type: Date,
      default: () => new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

autoIncrement(InvitationSchema, "inviteId", "invitation");

/* True once the expiry date has passed (FR 27). */
InvitationSchema.methods.isExpired = function () {
  return this.status === "pending" && this.expiresOn < new Date();
};

/*
 * FR 26: a group owner invites someone by email.
 * The permission check uses Membership.hasPermission (FR 25).
 */
InvitationSchema.statics.send = async function ({ groupId, senderId, recipientEmail }) {
  const membership = await Membership.findOne({ userId: senderId, groupId });
  if (!membership || !membership.hasPermission("invite")) {
    throw Object.assign(
      new Error("Only a group owner can send invitations"),
      { status: 403 }
    );
  }
  const existing = await this.findOne({
    groupId,
    recipientEmail: String(recipientEmail).toLowerCase(),
    status: "pending",
  });
  if (existing && !existing.isExpired()) {
    throw Object.assign(
      new Error("That person already has a pending invitation"),
      { status: 409 }
    );
  }

  const invitation = await this.create({ groupId, senderId, recipientEmail });
  await NotificationService.sendInvitation(invitation);
  return invitation;
};

/* FR 27: the recipient accepts, which creates their Membership (FR 25). */
InvitationSchema.methods.accept = async function (userId) {
  if (this.isExpired()) {
    await this.expire();
    throw Object.assign(new Error("That invitation has expired"), { status: 410 });
  }
  if (this.status !== "pending") {
    throw Object.assign(
      new Error(`Invitation is already ${this.status}`),
      { status: 409 }
    );
  }
  this.status = "accepted";
  await this.save();

  const already = await Membership.findOne({ userId, groupId: this.groupId });
  if (!already) {
    await Membership.create({ userId, groupId: this.groupId, role: "member" });
  }
  return this;
};

/* FR 27: the recipient declines. */
InvitationSchema.methods.decline = async function () {
  if (this.status !== "pending") {
    throw Object.assign(
      new Error(`Invitation is already ${this.status}`),
      { status: 409 }
    );
  }
  this.status = "declined";
  await this.save();
  return this;
};

/* FR 27: mark as expired once the validity window has passed. */
InvitationSchema.methods.expire = async function () {
  this.status = "expired";
  await this.save();
  return this;
};

export default mongoose.model("Invitation", InvitationSchema);
