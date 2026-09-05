import { Request, Response } from "express";
import { Student } from "../models/Student";
import { SubjectCombination } from "../models/SubjectCombination";
import { Exam } from "../models/Exam";
import { Attempt } from "../models/Attempt";

export async function createStudent(req: Request, res: Response) {
  try {
    const { name, email, phoneNumber, courseOfStudy, subjectCombinationCode, examCode } = req.body;

    if (!name || !email || !phoneNumber || !courseOfStudy || !subjectCombinationCode || !examCode) {
      return res.status(400).json({
        error: "name, email, phoneNumber, courseOfStudy, subjectCombinationCode and examCode are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phoneNumber).trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    const now = new Date();
    const exam = await Exam.findOne({ accessCode: String(examCode).trim().toUpperCase(), isActive: true, scheduledStart: { $lte: now }, scheduledEnd: { $gte: now } });
    if (!exam) return res.status(403).json({ error: "Invalid exam code or the exam is not currently active" });

    const existingStudents = await Student.find({ email: normalizedEmail }).select("_id");
    if (existingStudents.length && await Attempt.exists({ student: { $in: existingStudents.map((student) => student._id) }, exam: exam._id })) {
      return res.status(409).json({ error: "This email has already taken this exam" });
    }
    if (!/^[+\d][\d\s().-]{6,}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "A valid phone number is required" });
    }

    const combo = await SubjectCombination.findOne({
      code: subjectCombinationCode,
    });
    if (!combo) {
      return res.status(400).json({ error: "Unknown subject combination code" });
    }

    const student = await Student.create({
      name,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      courseOfStudy,
      subjectCombinationCode,
    });

    return res.status(201).json({ studentId: student._id, student });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create student" });
  }
}

export async function listSubjectCombinations(_req: Request, res: Response) {
  const combos = await SubjectCombination.find().select("code name subjects");
  return res.json({ subjectCombinations: combos });
}
