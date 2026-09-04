import { Schema, model, Document } from "mongoose";

export interface ISubjectCombination extends Document {
  code: string; // e.g. "SCI01"
  name: string; // e.g. "Physics, Chemistry, Biology"
  subjects: string[];
  durationMinutes: number;
}

const SubjectCombinationSchema = new Schema<ISubjectCombination>({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  subjects: { type: [String], required: true },
  durationMinutes: { type: Number, required: true, default: 40 },
});

export const SubjectCombination = model<ISubjectCombination>(
  "SubjectCombination",
  SubjectCombinationSchema
);
