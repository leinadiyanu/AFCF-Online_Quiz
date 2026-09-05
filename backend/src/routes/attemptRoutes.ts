import { Router } from "express";
import {
  startAttempt,
  getAttemptQuestions,
  submitAttempt,
  getAttemptReview,
} from "../controllers/attemptController";

const router = Router();

router.post("/attempts", startAttempt);
router.get("/attempts/:id/questions", getAttemptQuestions);
router.post("/attempts/:id/submit", submitAttempt);
router.get("/attempts/:id/review", getAttemptReview);

export default router;
