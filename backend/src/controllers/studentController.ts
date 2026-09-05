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
    if (existingStudents.length) return res.status(409).json({ error: "A student record already exists for this email. Choose returning student to continue." });
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

export async function getStudentProfile(req: Request, res: Response) {
  try {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    const examCode = String(req.query.examCode ?? "").trim().toUpperCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !examCode) return res.status(400).json({ error: "A valid email and exam code are required" });

    const now = new Date();
    const exam = await Exam.findOne({ accessCode: examCode, isActive: true, scheduledStart: { $lte: now }, scheduledEnd: { $gte: now } });
    if (!exam) return res.status(403).json({ error: "Invalid exam code or the exam is not currently active" });

    const student = await Student.findOne({ email });
    if (!student) return res.status(404).json({ error: "No student record was found for this email. Choose first exam to create your profile." });

    const attempts = await Attempt.find({ student: student._id, status: { $in: ["submitted", "expired"] } })
      .populate("exam", "title")
      .sort({ submittedAt: -1 })
      .select("exam subjectCombinationCode score submittedAt status");
    const existingAttempt = await Attempt.exists({ student: student._id, exam: exam._id });
    if (existingAttempt) return res.status(409).json({ error: "This email has already taken this exam" });

    const combination = await SubjectCombination.findOne({ code: student.subjectCombinationCode }).select("code name subjects");
    if (!combination || !exam.subjectCombinations.some((id) => id.toString() === combination._id.toString())) {
      return res.status(400).json({ error: `Your subject combination is not enabled for ${exam.title}. Ask the administrator for the correct exam code.` });
    }
    return res.json({
      student: { id: student._id, name: student.name, email: student.email, phoneNumber: student.phoneNumber, courseOfStudy: student.courseOfStudy, subjectCombination: combination },
      previousAttempts: attempts,
      exam: { title: exam.title, accessCode: exam.accessCode },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load student profile" });
  }
}

export async function listSubjectCombinations(_req: Request, res: Response) {
  const combos = await SubjectCombination.find().select("code name subjects");
  return res.json({ subjectCombinations: combos });
}
