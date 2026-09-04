import { Schema, model, Document } from "mongoose";

export interface IQuestion extends Document {
  subjectCombinationCode: string;
  subject: string; // which subject within the combination this question belongs to
  text: string;
  options: string[];
  correctOptionIndex: number;
  diagramUrl?: string;
  diagramAltText?: string;
}

const QuestionSchema = new Schema<IQuestion>({
  subjectCombinationCode: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: (v: string[]) => v.length >= 2,
  },
  correctOptionIndex: { type: Number, required: true },
  diagramUrl: { type: String, trim: true },
  diagramAltText: { type: String, trim: true },
});

export const Question = model<IQuestion>("Question", QuestionSchema);
