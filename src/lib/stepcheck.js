// Accepts a step locally when it matches the expected one up to spacing, case and math delimiters,
// so obvious answers don't need a model call.
const norm = (s) => s.toLowerCase().replace(/\$|\\[,;!]|\s+|\.$/g, '').replace(/\\left|\\right/g, '')

export const sameStep = (answer, expected) => norm(answer) !== '' && norm(answer) === norm(expected)
