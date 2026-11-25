const norm = (s) => s.toLowerCase().replace(/\$|\\[,;!]|\s+|\.$/g, '').replace(/\\left|\\right/g, '')

export const sameStep = (answer, expected) => norm(answer) !== '' && norm(answer) === norm(expected)
