import type { ReactNode } from 'react'

// Turns admin-typed shorthand into real math/chemistry notation for display:
//   x^2       -> x with a superscript 2   (exponents, ionic charges)
//   H~2O      -> H with a subscript 2, O  (chemical formula subscripts)
//   5*6       -> 5×6
// ~ was chosen for subscript (not _) because underscores are already used
// for fill-in-the-blank questions and would collide.
// Kept as a small parser (not dangerouslySetInnerHTML) so question content
// from the question bank can never inject arbitrary HTML.
export function renderMathText(text: string): ReactNode {
  const markupPattern = /([~^])(-?\d+(?:\.\d+)?)/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = markupPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index).replace(/\*/g, '×'))
    const [, marker, digits] = match
    parts.push(marker === '^' ? <sup key={key++}>{digits}</sup> : <sub key={key++}>{digits}</sub>)
    lastIndex = markupPattern.lastIndex
  }
  parts.push(text.slice(lastIndex).replace(/\*/g, '×'))
  return parts
}
