import { Router } from "express";
import { createStudent, listSubjectCombinations } from "../controllers/studentController";
import { getExamStatus, getPublicOverallScoreboard, getPublicScoreboard } from "../controllers/publicController";

const router = Router();

router.post("/students", createStudent);
router.get("/subject-combinations", listSubjectCombinations);
router.get("/exam-status", getExamStatus);
router.get("/scoreboard/public", getPublicScoreboard);
router.get("/scoreboard/overall/public", getPublicOverallScoreboard);

export default router;
