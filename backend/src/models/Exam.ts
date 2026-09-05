import { Schema, model, Document, Types } from "mongoose";

export type ExamStatus = "scheduled" | "active" | "completed";

export interface IExam extends Document {
  title: string;
  accessCode: string;
  subjectCombinations: Types.ObjectId[];
  scheduledStart: Date;
  scheduledEnd: Date;
  duration: number;
  isActive: boolean;
  status: ExamStatus;
  scoreboardPublished: boolean;
}

const ExamSchema = new Schema<IExam>({
  title: { type: String, required: true, trim: true },
  accessCode: { type: String, required: true, unique: true, sparse: true, uppercase: true, trim: true, minlength: 6, maxlength: 32 },
  subjectCombinations: [{ type: Schema.Types.ObjectId, ref: "SubjectCombination", required: true }],
  scheduledStart: { type: Date, required: true },
  scheduledEnd: { type: Date, required: true },
  duration: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["scheduled", "active", "completed"], default: "scheduled" },
  scoreboardPublished: { type: Boolean, default: false },
}, { timestamps: true });

ExamSchema.index({ scheduledStart: 1, scheduledEnd: 1, isActive: 1 });

export const Exam = model<IExam>("Exam", ExamSchema);