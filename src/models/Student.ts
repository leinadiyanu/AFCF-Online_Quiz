import { Schema, model, Document, Types } from "mongoose";

export interface IStudent extends Document {
  name: string;
  email: string;
  phoneNumber: string;
  courseOfStudy: string;
  subjectCombinationCode: string;
  createdAt: Date;
}

const StudentSchema = new Schema<IStudent>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phoneNumber: { type: String, required: true, trim: true },
  courseOfStudy: { type: String, required: true, trim: true },
  subjectCombinationCode: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

export const Student = model<IStudent>("Student", StudentSchema);
