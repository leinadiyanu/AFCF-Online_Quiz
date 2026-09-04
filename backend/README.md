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

- **SubjectCombination** — a managed subject combo (code, name, subjects, exam duration).
- **Student** — created from your intake form (name, course of study, subject combination code).
- **Question** — tagged by `subject` and one or more `subjectCombinationCodes`, so a Physics bank can be shared by many combinations. Each attempt contains 10 questions per subject. Questions can be entered manually or bulk uploaded as CSV, XLSX, or JSON.
- **Exam** — a scheduled exam with enabled combinations, duration, active toggle, and scoreboard publication flag.
- **Admin** — JWT-protected admin account. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET`; run `npm run seed:admin` once.
- **Attempt** — one timed exam session. `startedAt` is set server-side the moment the attempt is created; the deadline (`startedAt + durationMinutes`) is recomputed independently on every request, so a student can't extend their own time by tampering with the client.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/subject-combinations` | List available combinations (for the intake form dropdown) |
| POST | `/api/students` | Create a student — `{ name, email, phoneNumber, courseOfStudy, subjectCombinationCode }` |
| POST | `/api/attempts` | Start the timed 40-question exam — `{ studentId }`. Returns `attemptId`, `startedAt`, `durationMinutes` |
| GET | `/api/attempts/:id/questions` | Fetch that attempt's question set (no answers included) + server-computed `deadline` |
| POST | `/api/attempts/:id/submit` | Submit answers — `{ answers: [{ questionId, selectedOptionIndex }] }`. Server re-checks the deadline before grading |
| POST | `/api/admin/login` | Admin login — `{ email, password }` |
| POST | `/api/admin/subject-combinations` | Create a combination (Bearer admin token) |
| POST | `/api/admin/questions` | Add a question; use `subjectCombinationCodes` to share it |
| POST | `/api/admin/questions/bulk-upload` | Multipart `file` upload for CSV/XLSX/JSON |
| POST | `/api/admin/exams` | Create a scheduled exam |
| PATCH | `/api/admin/exams/:id` | Toggle an exam active/inactive |
| GET | `/api/admin/scoreboard/:examId` | View sorted results |
| PATCH | `/api/admin/scoreboard/:examId/publish` | Publish or unpublish results |
| GET | `/api/exam-status` | Public current/upcoming exam status |
| GET | `/api/scoreboard/public` | Latest published scoreboard |

## Exam flow for the frontend

1. Load `/api/subject-combinations` for the intake dropdown.
2. Submit intake → `POST /api/students` → get `studentId`.
3. `POST /api/attempts` with that `studentId` → get `attemptId`, `startedAt`, `durationMinutes`.
4. Redirect to the exam page. The attempt contains 40 questions: 10 from each of the three selected subjects plus 10 universal Aptitude (English) questions. Compute the countdown as `startedAt + durationMinutes*60000 - Date.now()`, and re-fetch `deadline` from `GET /api/attempts/:id/questions` to stay in sync with the server.
5. On timer expiry (or manual submit), call `POST /api/attempts/:id/submit` with whatever's answered. The server marks it `expired` if it's late, `submitted` if on time — either way it grades and returns the score.

## Admin console

Open the frontend with `#admin` (for example `http://localhost:5173/#admin`) to sign in and schedule exams, add questions, upload a question bank, toggle exams, and publish scoreboards.

CSV headers: `question,optionA,optionB,optionC,optionD,correctAnswer,subject,subjectCombination`. `correctAnswer` must exactly match one option. A question can be shared across combinations by sending the combination codes in `subjectCombinationCodes` through the API.
