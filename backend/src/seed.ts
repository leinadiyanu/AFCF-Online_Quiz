import "dotenv/config";
import { connectDB } from "./config/db";
import { SubjectCombination } from "./models/SubjectCombination";
import mongoose from "mongoose";

async function seed() {
  await connectDB();

  const seedCombinations = [
    {
      code: "SCI01",
      name: "Physics, Chemistry, Biology, Aptitude",
      subjects: ["Physics", "Chemistry", "Biology", "Aptitude"],
      durationMinutes: 40,
    },
    {
      code: "ART01",
      name: "Literature, Government, CRS, Aptitude",
      subjects: ["Literature", "Government", "CRS", "Aptitude"],
      durationMinutes: 40,
    },
  ];

  const combos = await Promise.all(seedCombinations.map((combo) =>
    SubjectCombination.findOneAndUpdate(
      { code: combo.code },
      { $set: combo },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    )
  ));

  console.log(`Seeded ${combos.length} subject combinations. Add questions through batch upload.`);
  await mongoose.disconnect();
}

seed();
