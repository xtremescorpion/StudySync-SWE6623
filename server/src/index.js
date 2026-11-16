/*
 * StudySync API: entry point.
 *
 * Application layer of the layered architecture in Assignment 3, Figure 1.
 * Exposes every class operation from Figure 2 as a REST endpoint over JSON
 * (NFR 09, NFR 10), and is the only layer that touches the Data layer.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { pathToFileURL } from "node:url";

import { connectDB } from "./config/db.js";
import { errorHandler } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import assignmentRoutes from "./routes/assignments.js";
import planningRoutes from "./routes/planning.js";
import priorityRoutes from "./routes/priority.js";
import groupRoutes from "./routes/groups.js";
import dashboardRoutes from "./routes/dashboard.js";
import integrationRoutes from "./routes/integrations.js";

// Importing the subclasses registers the Task discriminators with Mongoose.
import "./models/Assignment.js";
import "./models/GroupTask.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "StudySync API", time: new Date().toISOString() })
);

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/priority", priorityRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/integrations", integrationRoutes);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`StudySync API listening on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error("Could not start the server:", err.message);
    process.exit(1);
  }
}

// Start a listener only when this file is the program being run. Importing it
// (from seed.js, smoke.js or verify.js) returns the app without starting a server.
const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) start();

export default app;
