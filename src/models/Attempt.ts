import { Schema, model, Document, Types } from "mongoose";

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export interface IAnswer {
  question: Types.ObjectId;
  selectedOptionIndex: number | null;
}

export interface IAttempt extends Document {
  student: Types.ObjectId;
  subjectCombinationCode: string;
  questionIds: Types.ObjectId[];
  startedAt: Date;
  durationMinutes: number;
  submittedAt: Date | null;
  status: AttemptStatus;
  answers: IAnswer[];
  score: number | null;
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
});

export const Attempt = model<IAttempt>("Attempt", AttemptSchema);
