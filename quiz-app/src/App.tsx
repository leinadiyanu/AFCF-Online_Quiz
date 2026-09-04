import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

type Combination = { code: string; name: string; subjects: string[] }
type Question = { _id: string; subject: string; text: string; options: string[]; diagramUrl?: string; diagramAltText?: string }
type Result = { score: number; totalQuestions: number; status: string; late: boolean }

class RequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RequestError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  const response = await fetch(`${API_BASE}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options?.headers } }).finally(() => window.clearTimeout(timeout))
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new RequestError(body.error ?? 'Something went wrong', response.status)
  return body as T
}

function App() {
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [courseOfStudy, setCourseOfStudy] = useState('')
  const [subjectCombinationCode, setSubjectCombinationCode] = useState('')
  const [studentId, setStudentId] = useState<string | null>(() => sessionStorage.getItem('studentId'))
  const [attemptId, setAttemptId] = useState<string | null>(() => sessionStorage.getItem('attemptId'))
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    const savedAnswers = sessionStorage.getItem(`answers:${sessionStorage.getItem('attemptId')}`)
    if (!savedAnswers) return {}
    try {
      return JSON.parse(savedAnswers) as Record<string, number>
    } catch {
      return {}
    }
  })
  const [deadline, setDeadline] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(() => {
    const savedResult = sessionStorage.getItem('result')
    if (!savedResult) return null
    try {
      return JSON.parse(savedResult) as Result
    } catch {
      sessionStorage.removeItem('result')
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (attemptId) sessionStorage.setItem(`answers:${attemptId}`, JSON.stringify(answers))
  }, [answers, attemptId])

  const submit = useCallback(async () => {
    if (!attemptId) return
    setBusy(true)
    setError('')
    try {
      const response = await request<Result>(`/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({ questionId, selectedOptionIndex })) }) })
      setResult(response)
      sessionStorage.setItem('result', JSON.stringify(response))
      sessionStorage.removeItem('attemptId')
      sessionStorage.removeItem(`answers:${attemptId}`)
    } catch (err) {
      setSecondsLeft(null)
      if (err instanceof RequestError && err.status === 409) {
        sessionStorage.removeItem('attemptId')
        sessionStorage.removeItem(`answers:${attemptId}`)
        setAttemptId(null)
        setDeadline(null)
        setQuestions([])
        setAnswers({})
        setError('This assessment has already ended. You can start a new assessment.')
      } else {
        setError((err as Error).message)
      }
    } finally { setBusy(false) }
  }, [answers, attemptId])

  useEffect(() => {
    request<{ subjectCombinations: Combination[] }>('/subject-combinations').then(({ subjectCombinations }) => {
      setCombinations(subjectCombinations)
      setSubjectCombinationCode(subjectCombinations[0]?.code ?? '')
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!attemptId) return
    request<{ questions: Question[]; deadline: string }>(`/attempts/${attemptId}/questions`).then(({ questions: loadedQuestions, deadline: loadedDeadline }) => {
      setQuestions(loadedQuestions)
      setDeadline(new Date(loadedDeadline).getTime())
    }).catch((err: Error) => {
      setError(err.message)
      setAttemptId(null)
      sessionStorage.removeItem('attemptId')
      setDeadline(null)
      setSecondsLeft(null)
      setQuestions([])
    }).finally(() => setBusy(false))
  }, [attemptId])

  useEffect(() => {
    if (!deadline || result) return
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [deadline, result])

  useEffect(() => {
    if (secondsLeft === 0 && attemptId && !busy && !result) window.setTimeout(() => void submit(), 0)
  }, [secondsLeft, attemptId, busy, result, submit])

  async function startExam(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const student = await request<{ studentId: string }>('/students', { method: 'POST', body: JSON.stringify({ name, email, phoneNumber, courseOfStudy, subjectCombinationCode }) })
      const attempt = await request<{ attemptId: string }>('/attempts', { method: 'POST', body: JSON.stringify({ studentId: student.studentId }) })
      sessionStorage.setItem('studentId', student.studentId)
      sessionStorage.setItem('attemptId', String(attempt.attemptId))
      setStudentId(student.studentId)
      setAttemptId(String(attempt.attemptId))
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  function reset() {
    if (attemptId) sessionStorage.removeItem(`answers:${attemptId}`)
    sessionStorage.removeItem('studentId')
    sessionStorage.removeItem('attemptId')
    sessionStorage.removeItem('result')
    setStudentId(null); setAttemptId(null); setQuestions([]); setAnswers({}); setDeadline(null); setSecondsLeft(null); setResult(null); setError('')
  }

  if (loading) return <main className="shell"><p className="status">Loading exam desk...</p></main>
  return <main className="shell">
    <header className="masthead"><div className="brand"><img className="brand-logo" src="/image.svg" alt="AFCF-OAU logo" /><span className="eyebrow">AFCF-OAU</span></div><span className="session">{attemptId ? 'EXAMINATION IN PROGRESS' : '2026 POST-UTME MOCK EXAMINATION'}</span></header>
    {error && <div className="alert" role="alert">{error}</div>}
    {!attemptId && !result && <section className="intro"><div><p className="kicker">AFCF-OAU POST-UTME MOCK EXAMINATION · 2026</p><h1>Prepare <br /><em> Practice </em> Perform </h1><p className="lede">This mock examination is designed to simulate the Post-UTME examination environment and help you assess your level of preparation.</p></div><form className="intake" onSubmit={startExam}><label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Enter your full name" /></label><div className="contact-fields"><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" autoComplete="email" /></label><label>Phone number<input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required placeholder="e.g., 08012345678" autoComplete="tel" /></label></div><label>Course of study<input value={courseOfStudy} onChange={(event) => setCourseOfStudy(event.target.value)} required placeholder="e.g., Computer Engineering" /></label><label>Subject combination<select value={subjectCombinationCode} onChange={(event) => setSubjectCombinationCode(event.target.value)} required>{combinations.map((combo) => <option value={combo.code} key={combo.code}>{combo.code} · {combo.name}</option>)}</select></label><button disabled={busy || !combinations.length}>{busy ? 'Loading questions...' : 'Begin assessment'} <span>→</span></button><small>Your timer begins when you begin the assessment.</small></form></section>}
    {attemptId && !result && <section className="exam"><div className="exam-top"><div><p className="kicker">Examination in progress</p><h1>Read each question carefully and select the most appropriate answer.</h1></div><div className="exam-actions"><div className={`timer ${secondsLeft !== null && secondsLeft < 60 ? 'urgent' : ''}`}><small>TIME REMAINING</small><strong>{secondsLeft === null ? '--:--' : `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}</strong></div><button className="submit standby" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting...' : 'Submit assessment'} <span>↗</span></button></div></div>{!questions.length ? <p className="status">Loading questions...</p> : <div className="question-list">{questions.map((question, index) => <fieldset className="question" key={question._id}><legend><span>{String(index + 1).padStart(2, '0')}</span><div><small>{question.subject}</small>{question.text}</div></legend><div className="options">{question.options.map((option, optionIndex) => <label className={answers[question._id] === optionIndex ? 'selected' : ''} key={option}><input type="radio" name={question._id} checked={answers[question._id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question._id]: optionIndex }))} />{option}</label>)}</div></fieldset>)}</div>}</section>}
    {result && <section className="result"><p className="kicker">Assessment complete</p><h1>{result.status === 'expired' ? 'Time was called.' : 'Well considered.'}</h1><div className="score"><strong>{result.score}</strong><span>/ {result.totalQuestions}<br />correct answers</span></div><p>{result.late ? 'Your answers were recorded and graded after the deadline.' : 'Your answers were recorded successfully.'}</p><button onClick={reset}>Return to intake <span>↗</span></button></section>}
    {studentId && !attemptId && !result && <button className="resume" onClick={reset}>Clear saved session</button>}
    <footer>© 2026 Apostolic Faith Campus Fellowship - OAU <span>BE A SHINNING LIGHT</span></footer>
  </main>
}

export default App
