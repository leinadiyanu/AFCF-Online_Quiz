import katex from 'katex'
import type { ReactNode } from 'react'

// Renders standard LaTeX math notation wrapped in single $...$ delimiters,
// using KaTeX — the same notation used in textbooks and by most exam/quiz
// platforms. Anything outside $...$ is shown as plain text unchanged.
//
// Examples an admin can type directly into a question or option:
//   The area is $\pi r^2$                -> pi, r-squared
//   $H_2O$ is water                       -> H with subscript 2, O
//   $SO_4^{2-}$ is the sulfate ion        -> S O with subscript 4, superscript 2-
//   $Cr_2O_7^{2-}$ dichromate ion         -> subscripts 2 and 7, superscript 2-
//   Solve $2^{2x+3} - 33(2^x) + 4 = 0$    -> compound/algebraic exponents
//   $Na^+$ and $Cl^-$ form NaCl           -> bare charge, no digit needed
//
// Rule of thumb: wrap ANY math/chemistry notation in $ signs. Use _ for
// subscript and ^ for superscript; wrap the subscript/superscript in {}
// whenever it's more than one character (e.g. ^{2x+3}, not ^2x+3).
//
// KaTeX's renderToString output is sanitized HTML (it does not execute
// arbitrary markup), so this is safe to use even though it goes through
// dangerouslySetInnerHTML — that's KaTeX's documented rendering method.
export function renderMathText(text: string): ReactNode {
  const parts: ReactNode[] = []
  const mathPattern = /\$([^$]+)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = mathPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const html = katex.renderToString(match[1], { throwOnError: false, output: 'html' })
    
    parts.push(<span key={key++} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />)
    lastIndex = mathPattern.lastIndex
  }
  parts.push(text.slice(lastIndex))
  return parts
}
