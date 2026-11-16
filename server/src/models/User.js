/*
 * User: Assignment 3, Figure 2.
 *
 * Attributes:  userId, name, email, passwordHash, timeZone
 * Operations:  register(), login(email, pwd), logout(), updateProfile(), resetPassword()
 *
 * Realises FR 01-05.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { autoIncrement } from "./_counter.js";

const UserSchema = new mongoose.Schema(
  {
    userId: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email address is not valid"],
    },
    passwordHash: { type: String, required: true },
    timeZone: { type: String, default: "America/New_York" },

    // Supports logout() with stateless JWTs: any token issued before this
    // moment is rejected by the auth middleware. (NFR 05)
    tokensValidFrom: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

autoIncrement(UserSchema, "userId", "user");

/* Never send the password hash to the client. */
UserSchema.methods.toJSON = function () {
  const { passwordHash, tokensValidFrom, _id, __v, ...rest } = this.toObject();
  return rest;
};

/* FR 01: register with a unique email and password. */
UserSchema.statics.register = async function ({ name, email, password, timeZone }) {
  if (!name || !email || !password) {
    throw Object.assign(new Error("Name, email and password are required"), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), { status: 400 });
  }
  if (await this.findOne({ email: email.toLowerCase() })) {
    throw Object.assign(new Error("An account with that email already exists"), { status: 409 });
  }
  // NFR 04: store a salted hash, never the plain password.
  const passwordHash = await bcrypt.hash(password, 10);
  return this.create({ name, email, passwordHash, timeZone });
};

/* FR 02: authenticate. Returns the user, or null when the credentials are wrong. */
UserSchema.statics.login = async function (email, pwd) {
  const user = await this.findOne({ email: String(email || "").toLowerCase() });
  if (!user) return null;
  const ok = await bcrypt.compare(pwd || "", user.passwordHash);
  return ok ? user : null;
};

/* FR 04: end the session by invalidating every token issued so far. */
UserSchema.methods.logout = async function () {
  this.tokensValidFrom = new Date();
  await this.save();
  return true;
};

/* FR 03: update the editable profile fields. */
UserSchema.methods.updateProfile = async function ({ name, timeZone }) {
  if (name !== undefined) this.name = name;
  if (timeZone !== undefined) this.timeZone = timeZone;
  await this.save();
  return this;
};

/* FR 05: reset the password and invalidate existing sessions. */
UserSchema.statics.resetPassword = async function (email, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), { status: 400 });
  }
  const user = await this.findOne({ email: String(email || "").toLowerCase() });
  if (!user) return null;
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokensValidFrom = new Date();
  await user.save();
  return user;
};

export default mongoose.model("User", UserSchema);
