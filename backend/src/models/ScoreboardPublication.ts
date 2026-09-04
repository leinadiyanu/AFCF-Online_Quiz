import { Schema, model, Document } from "mongoose";

export interface IScoreboardPublication extends Document {
  key: "overall";
  published: boolean;
}

const ScoreboardPublicationSchema = new Schema<IScoreboardPublication>({
  key: { type: String, enum: ["overall"], unique: true, default: "overall" },
  published: { type: Boolean, default: false },
});

export const ScoreboardPublication = model<IScoreboardPublication>("ScoreboardPublication", ScoreboardPublicationSchema);
