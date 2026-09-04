import { Schema, model, Document } from "mongoose";

export interface IAdmin extends Document {
  email: string;
  passwordHash: string;
  role: "admin";
}

const AdminSchema = new Schema<IAdmin>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin"], default: "admin" },
});

export const Admin = model<IAdmin>("Admin", AdminSchema);