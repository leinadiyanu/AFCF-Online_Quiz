import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { parse } from "csv-parse/sync";
import XLSX from "xlsx";
import { Admin } from "../models/Admin";
import { Exam } from "../models/Exam";
import { Question } from "../models/Question";
import { SubjectCombination } from "../models/SubjectCombination";
import { Attempt } from "../models/Attempt";
import { ScoreboardPublication } from "../models/ScoreboardPublication";
import mongoose from "mongoose";
import crypto from "crypto";
import { JWT_SECRET } from "../middleware/requireAdmin";

function normalize(value: unknown) { return String(value ?? "").trim(); }

async function combinationIds(values: unknown): Promise<{ ids: string[]; codes: string[] }> {
  const requested = Array.isArray(values) ? values : [values];
  const combos = await SubjectCombination.find({ $or: [
    { _id: { $in: requested.filter((value) => /^[a-f\d]{24}$/i.test(String(value))) } },
    { code: { $in: requested.map((value) => normalize(value)) } },
  ] });
  return { ids: combos.map((combo) => combo._id.toString()), codes: combos.map((combo) => combo.code) };
}

export async function adminLogin(req: Request, res: Response) {
  const email = normalize(req.body.email).toLowerCase();
  const password = normalize(req.body.password);
  const admin = await Admin.findOne({ email });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: "Invalid admin credentials" });
  const token = jwt.sign({ id: admin._id.toString(), email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: "8h" });
  return res.json({ token, admin: { email: admin.email, role: admin.role } });
}

export async function createCombination(req: Request, res: Response) {
  const { code, name, subjects, durationMinutes } = req.body;
  if (!code || !name || !Array.isArray(subjects) || !subjects.length) return res.status(400).json({ error: "code, name and subjects are required" });
  const normalizedCode = normalize(code).toUpperCase();
  const existing = await SubjectCombination.exists({ code: normalizedCode });
  if (existing) return res.status(409).json({ error: `Subject combination ${normalizedCode} already exists` });
  try {
    const combo = await SubjectCombination.create({ code: normalizedCode, name: normalize(name), subjects: subjects.map(normalize), durationMinutes: Number(durationMinutes) || 60 });
    return res.status(201).json({ subjectCombination: combo });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return res.status(409).json({ error: `Subject combination ${normalizedCode} already exists` });
    throw err;
  }
}

export async function deleteUnbatchedQuestions(_req: Request, res: Response) {
  const result = await Question.deleteMany({ $or: [{ uploadBatchId: { $exists: false } }, { uploadBatchId: "" }] });
  return res.json({ deleted: result.deletedCount });
}

export async function bulkUploadQuestions(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: "Upload a CSV, XLSX or JSON file" });
  let rows: Record<string, unknown>[] = [];
  const fileName = req.file.originalname.toLowerCase();
  try {
    if (fileName.endsWith(".json")) rows = JSON.parse(req.file.buffer.toString("utf8"));
    else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    }
    else rows = parse(req.file.buffer.toString("utf8"), { columns: true, skip_empty_lines: true, trim: true });
  } catch { return res.status(400).json({ error: "Could not parse the uploaded file" }); }

  const batchId = crypto.randomUUID();
  const uploadedAt = new Date();
  const valid: Record<string, unknown>[] = [];
  const errors: { row: number; error: string }[] = [];
  for (const [index, row] of rows.entries()) {
    const options = [row.optionA, row.optionB, row.optionC, row.optionD].map(normalize);
    const answer = normalize(row.correctAnswer);
    const resolved = await combinationIds(row.subjectCombination ?? row.subjectCombinationCode ?? row.subjectCombinationCodes);
    const missing = !normalize(row.question) || !normalize(row.subject) || !answer || options.some((option) => !option) || !resolved.codes.length;
    if (missing || !options.includes(answer)) { errors.push({ row: index + 2, error: missing ? "Missing required field or unknown subject combination" : "correctAnswer must match optionA-optionD" }); continue; }
    valid.push({ text: normalize(row.question), options, correctOptionIndex: options.indexOf(answer), subject: normalize(row.subject), subjectCombinationCode: resolved.codes[0], subjectCombinationCodes: resolved.codes, difficulty: normalize(row.difficulty) || undefined, uploadBatchId: batchId, uploadFileName: req.file.originalname, uploadedAt });
  }
  if (valid.length) await Question.insertMany(valid);
  return res.json({ batchId, fileName: req.file.originalname, inserted: valid.length, failed: errors.length, errors });
}

export async function listQuestionBatches(_req: Request, res: Response) {
  const batches = await Question.aggregate([
    { $match: { uploadBatchId: { $exists: true, $ne: "" } } },
    { $group: { _id: "$uploadBatchId", fileName: { $first: "$uploadFileName" }, uploadedAt: { $first: "$uploadedAt" }, questionCount: { $sum: 1 }, subjects: { $addToSet: "$subject" } } },
    { $sort: { uploadedAt: -1 } },
    { $project: { _id: 0, batchId: "$_id", fileName: 1, uploadedAt: 1, questionCount: 1, subjects: 1 } },
  ]);
  return res.json({ batches });
}

export async function deleteQuestionBatch(req: Request, res: Response) {
  if (!req.params.batchId || req.params.batchId.length > 100) return res.status(400).json({ error: "Invalid batch ID" });
  const result = await Question.deleteMany({ uploadBatchId: req.params.batchId });
  if (!result.deletedCount) return res.status(404).json({ error: "Question batch not found" });
  return res.json({ batchId: req.params.batchId, deleted: result.deletedCount });
}

export async function createExam(req: Request, res: Response) {
  const { title, accessCode, subjectCombinationIds, scheduledStart, scheduledEnd, duration } = req.body;
  const resolved = await combinationIds(subjectCombinationIds ?? req.body.subjectCombinations);
  const start = new Date(scheduledStart); const end = new Date(scheduledEnd);
  const normalizedAccessCode = normalize(accessCode).toUpperCase() || crypto.randomBytes(5).toString("hex").toUpperCase();
  if (!title || !/^[A-Z0-9-]{6,32}$/.test(normalizedAccessCode) || !resolved.ids.length || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || Number(duration) <= 0) return res.status(400).json({ error: "Valid title, combinations, schedule and duration are required" });
  const exam = await Exam.create({ title: normalize(title), accessCode: normalizedAccessCode, subjectCombinations: resolved.ids, scheduledStart: start, scheduledEnd: end, duration: Number(duration), isActive: true, status: start > new Date() ? "scheduled" : "active" });
  return res.status(201).json({ exam });
}

export async function updateExam(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "examId must be a valid ID" });
  const exam = await Exam.findById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const { isActive, scheduledStart, scheduledEnd, duration } = req.body;
  const editingSchedule = scheduledStart !== undefined || scheduledEnd !== undefined || duration !== undefined;

  if (editingSchedule) {
    const start = scheduledStart !== undefined ? new Date(scheduledStart) : exam.scheduledStart;
    const end = scheduledEnd !== undefined ? new Date(scheduledEnd) : exam.scheduledEnd;
    const nextDuration = duration !== undefined ? Number(duration) : exam.duration;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || !(nextDuration > 0)) {
      return res.status(400).json({ error: "A valid schedule (start before end) and a positive duration are required" });
    }
    exam.scheduledStart = start;
    exam.scheduledEnd = end;
    exam.duration = nextDuration;
    const now = new Date();
    exam.status = start > now ? "scheduled" : end < now ? "completed" : "active";
  }

  if (isActive !== undefined) exam.isActive = Boolean(isActive);
  else if (!editingSchedule) exam.isActive = !exam.isActive;

  await exam.save();
  return res.json({ exam });
}

export async function deleteExam(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "examId must be a valid ID" });
  const exam = await Exam.findById(req.params.id).select("title");
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  const attempts = await Attempt.deleteMany({ exam: exam._id });
  await Exam.deleteOne({ _id: exam._id });
  return res.json({ examId: exam._id, title: exam.title, deletedAttempts: attempts.deletedCount });
}

export async function scoreboard(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "examId must be a valid ID" });
  const attempts = await Attempt.find({ exam: req.params.examId, status: { $in: ["submitted", "expired"] } }).populate("student", "name email courseOfStudy").sort({ score: -1, submittedAt: 1 });
  return res.json({ published: Boolean((await Exam.findById(req.params.examId).select("scoreboardPublished"))?.scoreboardPublished), results: attempts });
}

export async function publishScoreboard(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "examId must be a valid ID" });
  const exam = await Exam.findByIdAndUpdate(req.params.examId, { scoreboardPublished: Boolean(req.body.published ?? true) }, { returnDocument: "after" });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  return res.json({ exam });
}

export async function overallScoreboard(_req: Request, res: Response) {
  const results = await Attempt.aggregate([
    { $match: { status: { $in: ["submitted", "expired"] }, score: { $ne: null } } },
    { $sort: { submittedAt: 1 } },
    { $group: { _id: "$student", totalScore: { $sum: "$score" }, totalQuestions: { $sum: { $size: "$questionIds" } }, quizzesTaken: { $sum: 1 }, latestSubmittedAt: { $max: "$submittedAt" }, rankChange: { $last: "$rankChange" } } },
    { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
    { $addFields: { percentage: { $round: [{ $multiply: [{ $divide: ["$totalScore", "$totalQuestions"] }, 100] }, 1] } } },
    { $sort: { percentage: -1, latestSubmittedAt: 1 } },
    { $project: { _id: 0, student: { name: "$student.name", courseOfStudy: "$student.courseOfStudy" }, totalScore: 1, totalQuestions: 1, quizzesTaken: 1, percentage: 1, latestSubmittedAt: 1, rankChange: 1 } },
  ]);
  const publication = await ScoreboardPublication.findOne({ key: "overall" });
  return res.json({ published: Boolean(publication?.published), results });
}

export async function publishOverallScoreboard(req: Request, res: Response) {
  const publication = await ScoreboardPublication.findOneAndUpdate(
    { key: "overall" },
    { key: "overall", published: Boolean(req.body.published ?? true) },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return res.json({ published: publication.published });
}

// Publishes the scoreboard for every exam that has at least one graded attempt,
// plus the overall cumulative scoreboard, in one action.
export async function publishAllScoreboards(_req: Request, res: Response) {
  const examIds = await Attempt.distinct("exam", { status: { $in: ["submitted", "expired"] }, exam: { $ne: null } });
  await Exam.updateMany({ _id: { $in: examIds } }, { scoreboardPublished: true });
  const publication = await ScoreboardPublication.findOneAndUpdate(
    { key: "overall" },
    { key: "overall", published: true },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return res.json({ publishedExamCount: examIds.length, overallPublished: publication.published });
}

export async function listAdminData(_req: Request, res: Response) {
  const [subjectCombinations, exams, publication] = await Promise.all([
    SubjectCombination.find().sort({ name: 1 }),
    Exam.find().populate("subjectCombinations", "code name").sort({ scheduledStart: -1 }),
    ScoreboardPublication.findOne({ key: "overall" }),
  ]);
  return res.json({ subjectCombinations, exams, overallScoreboardPublished: Boolean(publication?.published) });
}