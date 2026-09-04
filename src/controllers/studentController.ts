import { Request, Response } from "express";
import { Student } from "../models/Student";
import { SubjectCombination } from "../models/SubjectCombination";

export async function createStudent(req: Request, res: Response) {
  try {
    const { name, email, phoneNumber, courseOfStudy, subjectCombinationCode } = req.body;

    if (!name || !email || !phoneNumber || !courseOfStudy || !subjectCombinationCode) {
      return res.status(400).json({
        error: "name, email, phoneNumber, courseOfStudy and subjectCombinationCode are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phoneNumber).trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "A valid email address is required" });
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
