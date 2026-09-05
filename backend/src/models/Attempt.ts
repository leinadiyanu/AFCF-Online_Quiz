import { Schema, model, Document, Types } from "mongoose";

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export interface IAnswer {
  question: Types.ObjectId;
  selectedOptionIndex: number | null;
}

export interface IAttempt extends Document {
  student: Types.ObjectId;
  subjectCombinationCode: string;
  exam: Types.ObjectId | null;
  questionIds: Types.ObjectId[];
  startedAt: Date;
  durationMinutes: number;
  submittedAt: Date | null;
  status: AttemptStatus;
  answers: IAnswer[];
  score: number | null;
  // Overall-ranking snapshot taken right after this attempt was graded.
  rankAfter: number | null;
  // rankAfter compared to the student's previous overall rank: positive = moved up,
  // negative = moved down, 0 = no change, null = first ranked attempt (nothing to compare).
  rankChange: number | null;
}

const AnswerSchema = new Schema<IAnswer>(
  {
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    selectedOptionIndex: { type: Number, default: null },
  },
  { _id: false }
);

const AttemptSchema = new Schema<IAttempt>({
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  subjectCombinationCode: { type: String, required: true },
  exam: { type: Schema.Types.ObjectId, ref: "Exam", default: null, index: true },
  questionIds: [{ type: Schema.Types.ObjectId, ref: "Question" }],
  startedAt: { type: Date, required: true, default: Date.now },
  durationMinutes: { type: Number, required: true },
  submittedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ["in_progress", "submitted", "expired"],
    default: "in_progress",
  },
  answers: { type: [AnswerSchema], default: [] },
  score: { type: Number, default: null },
  rankAfter: { type: Number, default: null },
  rankChange: { type: Number, default: null },
});

export const Attempt = model<IAttempt>("Attempt", AttemptSchema);
