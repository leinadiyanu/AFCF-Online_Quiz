import "dotenv/config";
import { connectDB } from "./config/db";
import { SubjectCombination } from "./models/SubjectCombination";
import { Question } from "./models/Question";
import mongoose from "mongoose";

async function seed() {
  await connectDB();

  await SubjectCombination.deleteMany({});
  await Question.deleteMany({});

  const combos = await SubjectCombination.insertMany([
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
  ]);

  const questions = [
    {
      subjectCombinationCode: "SCI01",
      subject: "Physics",
      text: "What is the SI unit of force?",
      options: ["Joule", "Newton", "Watt", "Pascal"],
      correctOptionIndex: 1,
    },
    {
      subjectCombinationCode: "SCI01",
      subject: "Chemistry",
      text: "What is the chemical symbol for Sodium?",
      options: ["So", "S", "Na", "Sd"],
      correctOptionIndex: 2,
    },
    {
      subjectCombinationCode: "SCI01",
      subject: "Biology",
      text: "Which organ pumps blood around the body?",
      options: ["Liver", "Lung", "Heart", "Kidney"],
      correctOptionIndex: 2,
    },
    {
      subjectCombinationCode: "ART01",
      subject: "Government",
      text: "What is the term of office for a Nigerian president?",
      options: ["4 years", "5 years", "6 years", "8 years"],
      correctOptionIndex: 0,
    },
    {
      subjectCombinationCode: "ART01",
      subject: "Literature",
      text: "What is a story's main character called?",
      options: ["Protagonist", "Narrator", "Antagonist", "Setting"],
      correctOptionIndex: 0,
    },
    {
      subjectCombinationCode: "ART01",
      subject: "CRS",
      text: "How many books are in the New Testament?",
      options: ["17", "27", "39", "66"],
      correctOptionIndex: 1,
    },
    {
      subjectCombinationCode: "SCI01",
      subject: "Aptitude",
      text: "Choose the word closest in meaning to 'rapid'.",
      options: ["Slow", "Swift", "Quiet", "Heavy"],
      correctOptionIndex: 1,
    },
    {
      subjectCombinationCode: "ART01",
      subject: "Aptitude",
      text: "Choose the word opposite in meaning to 'ancient'.",
      options: ["Modern", "Historic", "Old", "Past"],
      correctOptionIndex: 0,
    },
  ];

  await Question.insertMany(
    questions.flatMap((question) =>
      Array.from({ length: 10 }, (_, index) => ({
        ...question,
        text: `${question.text} (Practice ${index + 1})`,
      }))
    )
  );

  console.log(`Seeded ${combos.length} subject combinations and sample questions.`);
  await mongoose.disconnect();
}

seed();
