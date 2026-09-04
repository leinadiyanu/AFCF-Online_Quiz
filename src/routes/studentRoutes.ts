import { Router } from "express";
import { createStudent, listSubjectCombinations } from "../controllers/studentController";

const router = Router();

router.post("/students", createStudent);
router.get("/subject-combinations", listSubjectCombinations);

export default router;
