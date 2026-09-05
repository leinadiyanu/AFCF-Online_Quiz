import { Request, Response } from "express";
import { Exam } from "../models/Exam";
import { Attempt } from "../models/Attempt";
import { ScoreboardPublication } from "../models/ScoreboardPublication";

export async function getExamStatus(_req: Request, res: Response) {
  const now = new Date();
  const exams = await Exam.find({ isActive: true, scheduledEnd: { $gte: now } }).sort({ scheduledStart: 1 }).populate("subjectCombinations", "code name subjects durationMinutes");
  const activeExams = exams.filter((exam) => exam.scheduledStart <= now && exam.scheduledEnd >= now);
  const upcomingExams = exams.filter((exam) => exam.scheduledStart > now);
  const exam = activeExams[0] ?? upcomingExams[0];
  if (!exam) return res.json({ status: "none", active: false, exams: [], exam: null });
  const active = activeExams.length > 0;
  return res.json({ status: active ? "active" : "upcoming", active, exams: exams.map((item) => ({ _id: item._id, title: item.title, scheduledStart: item.scheduledStart, scheduledEnd: item.scheduledEnd })), exam: { _id: exam._id, title: exam.title, scheduledStart: exam.scheduledStart, scheduledEnd: exam.scheduledEnd, duration: exam.duration, subjectCombinations: exam.subjectCombinations } });
}

export async function getExamAccess(req: Request, res: Response) {
  const accessCode = String(req.params.code ?? "").trim().toUpperCase();
  const exam = await Exam.findOne({ accessCode, isActive: true }).populate("subjectCombinations", "code name subjects durationMinutes");
  if (!exam) return res.status(404).json({ error: "Invalid exam access code" });
  return res.json({ exam: { _id: exam._id, title: exam.title, subjectCombinations: exam.subjectCombinations } });
}

export async function getPublicScoreboard(_req: Request, res: Response) {
  const exam = await Exam.findOne({ scoreboardPublished: true }).sort({ scheduledEnd: -1 });
  if (!exam) return res.json({ published: false, exam: null, results: [] });
  const results = await Attempt.find({ exam: exam._id, status: { $in: ["submitted", "expired"] } }).populate("student", "name courseOfStudy").sort({ score: -1, submittedAt: 1 }).select("student score submittedAt status");
  return res.json({ published: true, exam: { _id: exam._id, title: exam.title }, results });
}

export async function getPublicOverallScoreboard(_req: Request, res: Response) {
  const publication = await ScoreboardPublication.findOne({ key: "overall" });
  if (!publication?.published) return res.json({ published: false, results: [] });
  const results = await Attempt.aggregate([
    { $match: { status: { $in: ["submitted", "expired"] }, score: { $ne: null } } },
    { $group: { _id: "$student", totalScore: { $sum: "$score" }, totalQuestions: { $sum: { $size: "$questionIds" } }, quizzesTaken: { $sum: 1 }, latestSubmittedAt: { $max: "$submittedAt" } } },
    { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
    { $addFields: { percentage: { $round: [{ $multiply: [{ $divide: ["$totalScore", "$totalQuestions"] }, 100] }, 1] } } },
    { $sort: { percentage: -1, latestSubmittedAt: 1 } },
    { $project: { _id: 0, student: { name: "$student.name", courseOfStudy: "$student.courseOfStudy" }, totalScore: 1, totalQuestions: 1, quizzesTaken: 1, percentage: 1, latestSubmittedAt: 1 } },
  ]);
  return res.json({ published: true, results });
}