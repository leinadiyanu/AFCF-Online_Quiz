import { Request, Response } from "express";
import mongoose from "mongoose";
import { Attempt } from "../models/Attempt";
import { Student } from "../models/Student";
import { SubjectCombination } from "../models/SubjectCombination";
import { Question } from "../models/Question";
import { Exam } from "../models/Exam";

const QUESTIONS_PER_SUBJECT = 10;

// Recomputes the cumulative overall leaderboard and returns this student's current rank
// (1-based), or null if they have no graded attempts yet (shouldn't happen right after grading).
async function getOverallRank(studentId: mongoose.Types.ObjectId): Promise<number | null> {
  const standings = await Attempt.aggregate([
    { $match: { status: { $in: ["submitted", "expired"] }, score: { $ne: null } } },
    { $group: { _id: "$student", totalScore: { $sum: "$score" }, totalQuestions: { $sum: { $size: "$questionIds" } }, latestSubmittedAt: { $max: "$submittedAt" } } },
    { $addFields: { percentage: { $divide: ["$totalScore", "$totalQuestions"] } } },
    { $sort: { percentage: -1, latestSubmittedAt: 1 } },
    { $project: { _id: 1 } },
  ]);
  const index = standings.findIndex((entry) => entry._id.toString() === studentId.toString());
  return index === -1 ? null : index + 1;
}

function getDeadline(startedAt: Date, durationMinutes: number): Date {
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

// POST /attempts  { studentId }
// Creates the timed session. This is the moment the clock starts — server-side.
export async function startAttempt(req: Request, res: Response) {
  try {
    const { studentId, examCode } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: "studentId must be a valid ID" });
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const now = new Date();
    const exam = await Exam.findOne({
      accessCode: String(examCode ?? "").trim().toUpperCase(),
      isActive: true,
      scheduledStart: { $lte: now },
      scheduledEnd: { $gte: now },
    }).sort({ scheduledEnd: 1 });
    if (!exam) return res.status(409).json({ error: "There is no active exam right now" });

    const completedAttempt = await Attempt.exists({ student: student._id, exam: exam._id, status: { $in: ["submitted", "expired"] } });
    if (completedAttempt) return res.status(409).json({ error: "This email has already taken this exam" });

    // Prevent starting a second attempt while one is already in progress
    const existing = await Attempt.findOne({
      student: student._id,
      exam: exam._id,
      status: "in_progress",
    });
    if (existing) {
      const existingDeadline = getDeadline(existing.startedAt, existing.durationMinutes);
      if (new Date() >= existingDeadline) {
        existing.status = "expired";
        existing.submittedAt = new Date();
        await existing.save();
      } else {
      return res.status(200).json({
        attemptId: existing._id,
        startedAt: existing.startedAt,
        durationMinutes: existing.durationMinutes,
        resumed: true,
      });
      }
    }

    const combo = await SubjectCombination.findOne({
      code: student.subjectCombinationCode,
    });
    if (!combo) {
      return res.status(400).json({ error: "Subject combination not configured" });
    }
    if (!exam.subjectCombinations.some((id) => id.toString() === combo._id.toString())) {
      return res.status(400).json({ error: `Subject combination ${student.subjectCombinationCode} is not enabled for exam ${exam.title}. Select one of the combinations assigned to this exam.` });
    }

    // Pick an even set of questions so every subject contributes equally.
    const questionGroups = await Promise.all(
      combo.subjects.map((subject) =>
        Question.aggregate([
          { $match: { subject, $or: [{ subjectCombinationCodes: combo.code }, { subjectCombinationCode: combo.code }] } },
          { $sample: { size: QUESTIONS_PER_SUBJECT } },
        ])
      )
    );
    const questions = questionGroups.flat();

    if (questions.length !== combo.subjects.length * QUESTIONS_PER_SUBJECT) {
      return res
        .status(400)
        .json({
          error: `This subject combination needs ${QUESTIONS_PER_SUBJECT} questions for each subject before an attempt can start`,
        });
    }

    const startedAt = new Date();

    const attempt = await Attempt.create({
      student: student._id,
      exam: exam._id,
      subjectCombinationCode: combo.code,
      questionIds: questions.map((q) => q._id),
      startedAt,
      durationMinutes: exam.duration,
      status: "in_progress",
      answers: questions.map((q) => ({ question: q._id, selectedOptionIndex: null })),
    });

    return res.status(201).json({
      attemptId: attempt._id,
      startedAt: attempt.startedAt,
      durationMinutes: attempt.durationMinutes,
      resumed: false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to start attempt" });
  }
}

// GET /attempts/:id/questions
// Returns the question set WITHOUT correct answers, plus the server-computed deadline.
export async function getAttemptQuestions(req: Request, res: Response) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "attemptId must be a valid ID" });
    }
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });

    const deadline = getDeadline(attempt.startedAt, attempt.durationMinutes);

    if (attempt.status === "in_progress" && new Date() > deadline) {
      attempt.status = "expired";
      await attempt.save();
    }

    if (attempt.status !== "in_progress") {
      return res.status(410).json({
        error: "This attempt is no longer active",
        status: attempt.status,
      });
    }

    const questions = await Question.find({
      _id: { $in: attempt.questionIds },
    }).select("_id subject text options diagramUrl diagramAltText"); // correctOptionIndex intentionally excluded

    return res.json({
      attemptId: attempt._id,
      startedAt: attempt.startedAt,
      deadline,
      questions,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch attempt questions" });
  }
}

// POST /attempts/:id/submit  { answers: [{ questionId, selectedOptionIndex }] }
// Server independently re-checks the deadline. This is the check Google Forms can't do.
export async function submitAttempt(req: Request, res: Response) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "attemptId must be a valid ID" });
    }
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });

    if (attempt.status !== "in_progress") {
      return res.status(409).json({
        error: "Attempt already finalized",
        status: attempt.status,
      });
    }

    const { answers } = req.body as {
      answers: { questionId: string; selectedOptionIndex: number }[];
    };

    const deadline = getDeadline(attempt.startedAt, attempt.durationMinutes);
    const now = new Date();
    const isLate = now > deadline;

    // Merge submitted answers into the attempt's answer list
    const answerMap = new Map(
      (answers || []).map((a) => [a.questionId, a.selectedOptionIndex])
    );
    attempt.answers = attempt.answers.map((a) => {
      const submitted = answerMap.get(a.question.toString());
      return submitted !== undefined
        ? { question: a.question, selectedOptionIndex: submitted }
        : a;
    });

    // Grade
    const questions = await Question.find({ _id: { $in: attempt.questionIds } });
    const correctById = new Map(
      questions.map((q) => [q._id.toString(), q.correctOptionIndex])
    );
    let score = 0;
    for (const a of attempt.answers) {
      if (
        a.selectedOptionIndex !== null &&
        a.selectedOptionIndex === correctById.get(a.question.toString())
      ) {
        score += 1;
      }
    }

    attempt.submittedAt = now;
    attempt.status = isLate ? "expired" : "submitted";
    attempt.score = score;

    // Work out how this attempt moved the student on the cumulative overall leaderboard.
    const student = await Student.findById(attempt.student).select("lastOverallRank");
    const previousRank = student?.lastOverallRank ?? null;
    const newRank = await getOverallRank(attempt.student as mongoose.Types.ObjectId);
    attempt.rankAfter = newRank;
    attempt.rankChange = previousRank !== null && newRank !== null ? previousRank - newRank : null;
    if (student && newRank !== null) {
      student.lastOverallRank = newRank;
      await student.save();
    }

    await attempt.save();

    return res.json({
      attemptId: attempt._id,
      status: attempt.status,
      score,
      totalQuestions: attempt.questionIds.length,
      late: isLate,
      rankAfter: attempt.rankAfter,
      rankChange: attempt.rankChange,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to submit attempt" });
  }
}

// GET /attempts/:id/review?email=...
// Lets a student see their own finished attempt broken down question-by-question,
// like a Google Forms quiz review: their answer, whether it was right, and the correct one.
// Ownership is checked by email since the public flow has no auth token.
export async function getAttemptReview(req: Request, res: Response) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "attemptId must be a valid ID" });
    }
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email is required" });

    const attempt = await Attempt.findById(req.params.id)
      .populate("student", "email")
      .populate("exam", "title");
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });

    const owner = attempt.student as unknown as { email: string } | null;
    if (!owner || owner.email !== email) {
      return res.status(403).json({ error: "This attempt does not belong to that email" });
    }
    if (attempt.status === "in_progress") {
      return res.status(409).json({ error: "This attempt hasn't been submitted yet" });
    }

    const questions = await Question.find({ _id: { $in: attempt.questionIds } })
      .select("_id subject text options correctOptionIndex diagramUrl diagramAltText");
    const questionById = new Map(questions.map((q) => [q._id.toString(), q]));
    const answerByQuestion = new Map(attempt.answers.map((a) => [a.question.toString(), a.selectedOptionIndex]));

    const review = attempt.questionIds
      .map((questionId) => {
        const question = questionById.get(questionId.toString());
        if (!question) return null;
        const selectedOptionIndex = answerByQuestion.get(questionId.toString()) ?? null;
        return {
          questionId: question._id,
          subject: question.subject,
          text: question.text,
          options: question.options,
          diagramUrl: question.diagramUrl,
          diagramAltText: question.diagramAltText,
          correctOptionIndex: question.correctOptionIndex,
          selectedOptionIndex,
          isCorrect: selectedOptionIndex !== null && selectedOptionIndex === question.correctOptionIndex,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const exam = attempt.exam as unknown as { title: string } | null;
    return res.json({
      attemptId: attempt._id,
      exam: exam ? { title: exam.title } : null,
      subjectCombinationCode: attempt.subjectCombinationCode,
      score: attempt.score,
      totalQuestions: attempt.questionIds.length,
      submittedAt: attempt.submittedAt,
      questions: review,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load attempt review" });
  }
}
