import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri && process.env.NODE_ENV === "production") throw new Error("MONGO_URI is required in production");

  try {
    await mongoose.connect(uri || "mongodb://127.0.0.1:27017/exam_quiz");
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
