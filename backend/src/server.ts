import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import studentRoutes from "./routes/studentRoutes";
import attemptRoutes from "./routes/attemptRoutes";
import adminRoutes from "./routes/adminRoutes";

const app = express();
app.use(cors());
app.use(express.json());

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
