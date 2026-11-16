/*
 * Authentication routes: FR 01-05.
 * Presentation layer talks to User through these endpoints.
 */
import { Router } from "express";
import User from "../models/User.js";
import { issueToken, requireAuth, handle } from "../middleware/auth.js";

const router = Router();

/* FR 01: POST /api/auth/register */
router.post(
  "/register",
  handle(async (req, res) => {
    const user = await User.register(req.body);
    res.status(201).json({ user, token: issueToken(user) });
  })
);

/* FR 02: POST /api/auth/login */
router.post(
  "/login",
  handle(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.login(email, password);
    if (!user) return res.status(401).json({ error: "Email or password is incorrect" });
    res.json({ user, token: issueToken(user) });
  })
);

/* FR 04: POST /api/auth/logout */
router.post(
  "/logout",
  requireAuth,
  handle(async (req, res) => {
    await req.user.logout();
    res.json({ message: "Signed out" });
  })
);

/* FR 03: GET /api/auth/me */
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

/* FR 03: PATCH /api/auth/me */
router.patch(
  "/me",
  requireAuth,
  handle(async (req, res) => {
    const user = await req.user.updateProfile(req.body);
    res.json({ user });
  })
);

/* FR 05: POST /api/auth/reset-password */
router.post(
  "/reset-password",
  handle(async (req, res) => {
    const { email, newPassword } = req.body;
    await User.resetPassword(email, newPassword);
    // Always the same reply, so the endpoint cannot be used to discover
    // which email addresses have accounts (NFR 05).
    res.json({ message: "If that account exists, its password has been reset" });
  })
);

export default router;
