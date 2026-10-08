/**
 * Open questions need a written answer rather than a profile detail.
 * Mirrors OPEN_QUESTION_RE in backend/app/services/answers.py.
 */
const OPEN_QUESTION_RE =
  /^(why|what|how|describe|tell|explain|share|briefly|in\s+\d+\s+words|give\s+an\s+example)\b|\?\s*$|\b(statement of purpose|cover letter|motivation|about yourself|why (?:do|are|should)|interest(?:ed)? in)\b/i

export function isOpenQuestion(label: string, profileKey?: string | null): boolean {
  return !profileKey && OPEN_QUESTION_RE.test(label.trim())
}
