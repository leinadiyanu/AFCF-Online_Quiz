import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import studentRoutes from "./routes/studentRoutes";
import attemptRoutes from "./routes/attemptRoutes";
import adminRoutes from "./routes/adminRoutes";

const app = express();
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) throw new Error("JWT_SECRET is required in production");
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`));
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", studentRoutes);
app.use("/api", attemptRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
