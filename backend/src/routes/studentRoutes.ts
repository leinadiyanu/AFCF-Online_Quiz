import { Router } from "express";
import { createStudent, getStudentProfile, listSubjectCombinations } from "../controllers/studentController";
import { getExamAccess, getExamStatus, getPublicOverallScoreboard, getPublicScoreboard } from "../controllers/publicController";

const router = Router();

router.post("/students", createStudent);
router.get("/students/profile", getStudentProfile);
router.get("/subject-combinations", listSubjectCombinations);
router.get("/exam-status", getExamStatus);
router.get("/exam-access/:code", getExamAccess);
router.get("/scoreboard/public", getPublicScoreboard);
router.get("/scoreboard/overall/public", getPublicOverallScoreboard);

export default router;
