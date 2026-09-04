import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import studentRoutes from "./routes/studentRoutes";
import attemptRoutes from "./routes/attemptRoutes";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", studentRoutes);
app.use("/api", attemptRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
