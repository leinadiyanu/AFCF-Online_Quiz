import { Schema, model, Document, Types } from "mongoose";

export interface IStudent extends Document {
  name: string;
  email: string;
  phoneNumber: string;
  courseOfStudy: string;
  subjectCombinationCode: string;
  createdAt: Date;
  lastOverallRank: number | null;
}

const StudentSchema = new Schema<IStudent>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phoneNumber: { type: String, required: true, trim: true },
  courseOfStudy: { type: String, required: true, trim: true },
  subjectCombinationCode: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  // Snapshot of this student's position in the cumulative overall ranking,
  // captured the last time one of their attempts was graded. Used to work
  // out whether their latest attempt moved them up or down the leaderboard.
  lastOverallRank: { type: Number, default: null },
});

export const Student = model<IStudent>("Student", StudentSchema);
