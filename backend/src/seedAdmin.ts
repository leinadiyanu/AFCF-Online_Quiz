import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { Admin } from "./models/Admin";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running seed:admin");
  await connectDB();
  await Admin.findOneAndUpdate({ email: email.toLowerCase() }, { email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: "admin" }, { upsert: true, returnDocument: "after" });
  console.log(`Admin seeded for ${email}`);
  await mongoose.disconnect();
}

seedAdmin();