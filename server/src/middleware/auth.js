/*
 * Authentication and error handling: Application layer.
 * NFR 05: protect API routes with expiring JWTs.
 */
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const SECRET = process.env.JWT_SECRET || "studysync-dev-secret-change-me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

export function issueToken(user) {
  return jwt.sign({ userId: user.userId, email: user.email }, SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

/* Rejects a request without a valid, unexpired token. Attaches req.user. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in to use this endpoint" });
  }
  try {
    const payload = jwt.verify(token, SECRET);
    const user = await User.findOne({ userId: payload.userId });
    if (!user) return res.status(401).json({ error: "Account no longer exists" });

    // Tokens issued before the last logout or password reset are refused (FR 04, FR 05).
    //
    // jwt truncates "iat" to whole seconds while tokensValidFrom keeps milliseconds,
    // so a token issued at 10:00:00.410 carries iat 10:00:00.000 and looks 410 ms
    // older than the account it was just issued for. One second of leeway covers
    // that truncation; a logout is still seconds away from any token it must revoke.
    const issuedAtMs = payload.iat * 1000;
    if (issuedAtMs + 1000 < user.tokensValidFrom.getTime()) {
      return res.status(401).json({ error: "Session has ended, please sign in again" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired or token invalid" });
  }
}

/* Wraps an async route so a rejected promise reaches the error handler. */
export const handle = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* NFR 06: every failure leaves as a structured JSON error. */
export function errorHandler(err, req, res, _next) {
  const status = err.status || (err.name === "ValidationError" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: err.message || "Something went wrong",
    ...(err.name === "ValidationError" && {
      details: Object.values(err.errors).map((e) => e.message),
    }),
  });
}
