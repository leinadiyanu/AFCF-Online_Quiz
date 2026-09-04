import { Schema, model, Document } from "mongoose";

export interface IQuestion extends Document {
  subjectCombinationCode: string;
  subjectCombinationCodes: string[];
  subject: string; // which subject within the combination this question belongs to
  text: string;
  options: string[];
  correctOptionIndex: number;
  difficulty?: "easy" | "medium" | "hard";
  diagramUrl?: string;
  diagramAltText?: string;
}

const QuestionSchema = new Schema<IQuestion>({
  subjectCombinationCode: { type: String, required: true, index: true },
  subjectCombinationCodes: { type: [String], default: [] },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: (v: string[]) => v.length >= 2,
  },
  correctOptionIndex: { type: Number, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"] },
  diagramUrl: { type: String, trim: true },
  diagramAltText: { type: String, trim: true },
});

export const Question = model<IQuestion>("Question", QuestionSchema);
