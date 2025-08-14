import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import redisClient from "./redis/redisClient.js";
import setupSocket from "./socket.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import codeRoutes from "./routes/codeRoutes.js";
import testCaseRoutes from "./routes/testCaseRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());

// Redis events
redisClient.on("connect", () => console.log("✅ Connected to Redis"));
redisClient.on("ready", () => console.log("✅ Redis is ready to use"));
redisClient.on("error", (err) => console.error("❌ Redis error:", err));
redisClient.on("reconnecting", () =>
  console.log("🔄 Reconnecting to Redis...")
);
redisClient.on("end", () => console.log("❌ Redis closed"));

// Attach Redis to app
app.set("redisClient", redisClient);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/room", roomRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/testcases", testCaseRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/teacher", teacherRoutes);

// Default route
app.get("/", (req, res) => res.send("API is running..."));

// Setup socket.io
setupSocket(server, app);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
