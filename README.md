# Exam Quiz Backend

Node.js + Express + TypeScript + MongoDB backend for the exam quiz website.

## Setup

```bash
npm install
cp .env.example .env   # then set MONGO_URI to your Atlas/local connection string
npm run seed            # loads sample subject combinations + questions
npm run dev              # starts the API on http://localhost:5000
```

## How the pieces fit together

- **SubjectCombination** — the fixed list of subject combos (code, name, subjects, exam duration). Seed or manage these directly for now.
- **Student** — created from your intake form (name, course of study, subject combination code).
- **Question** — tagged by `subjectCombinationCode` and `subject`. Each attempt contains 10 questions per subject, including the universal `Aptitude` (English) subject. Long text is supported, and diagrams can be attached with optional `diagramUrl` and `diagramAltText` fields. Store diagram files in object storage or a static media host and keep only their URLs in MongoDB. Upload questions via your Google Forms/Sheets pipeline → push into this collection.
- **Attempt** — one timed exam session. `startedAt` is set server-side the moment the attempt is created; the deadline (`startedAt + durationMinutes`) is recomputed independently on every request, so a student can't extend their own time by tampering with the client.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/subject-combinations` | List available combinations (for the intake form dropdown) |
| POST | `/api/students` | Create a student — `{ name, email, phoneNumber, courseOfStudy, subjectCombinationCode }` |
| POST | `/api/attempts` | Start the timed 40-question exam — `{ studentId }`. Returns `attemptId`, `startedAt`, `durationMinutes` |
| GET | `/api/attempts/:id/questions` | Fetch that attempt's question set (no answers included) + server-computed `deadline` |
| POST | `/api/attempts/:id/submit` | Submit answers — `{ answers: [{ questionId, selectedOptionIndex }] }`. Server re-checks the deadline before grading |

## Exam flow for the frontend

1. Load `/api/subject-combinations` for the intake dropdown.
2. Submit intake → `POST /api/students` → get `studentId`.
3. `POST /api/attempts` with that `studentId` → get `attemptId`, `startedAt`, `durationMinutes`.
4. Redirect to the exam page. The attempt contains 40 questions: 10 from each of the three selected subjects plus 10 universal Aptitude (English) questions. Compute the countdown as `startedAt + durationMinutes*60000 - Date.now()`, and re-fetch `deadline` from `GET /api/attempts/:id/questions` to stay in sync with the server.
5. On timer expiry (or manual submit), call `POST /api/attempts/:id/submit` with whatever's answered. The server marks it `expired` if it's late, `submitted` if on time — either way it grades and returns the score.

## Not yet built (next steps)

- Auth/session so a student can't just guess another student's `attemptId`.
- Admin endpoints for managing subject combinations and questions directly (currently seed-only).
- The Google Forms/Sheets → Question collection sync script for question uploads.
