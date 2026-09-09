import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { requireAdmin } from "../middleware/requireAdmin";
import { adminLogin, bulkUploadQuestions, createCombination, createExam, deleteExam, deleteQuestionBatch, deleteUnbatchedQuestions, getQuestionCoverage, listAdminData, listQuestionBatches, overallScoreboard, publishAllScoreboards, publishOverallScoreboard, publishScoreboard, scoreboard, updateExam } from "../controllers/adminController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
// Slows down password-guessing: 10 attempts per IP per 15 minutes, regardless of email tried.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many login attempts. Please try again later." } });
router.post("/login", loginLimiter, adminLogin);
router.use(requireAdmin);
router.get("/data", listAdminData);
router.get("/question-coverage", getQuestionCoverage);
router.get("/scoreboard/overall", overallScoreboard);
router.post("/subject-combinations", createCombination);
router.post("/questions/bulk-upload", upload.single("file"), bulkUploadQuestions);
router.get("/question-batches", listQuestionBatches);
router.delete("/questions/unbatched", deleteUnbatchedQuestions);
router.delete("/question-batches/:batchId", deleteQuestionBatch);
router.post("/exams", createExam);
router.patch("/exams/:id", updateExam);
router.delete("/exams/:id", deleteExam);
router.get("/scoreboard/:examId", scoreboard);
router.patch("/scoreboard/overall/publish", publishOverallScoreboard);
router.patch("/scoreboard/publish-all", publishAllScoreboards);
router.patch("/scoreboard/:examId/publish", publishScoreboard);
export default router;