const MIN_WORD_LENGTH = 4;

export function normalizeWord(raw) {
  return raw.trim().toLowerCase();
}

export function validateWord(rawWord, puzzle, foundWordSet) {
  const word = normalizeWord(rawWord);
  const allowedLetters = new Set([puzzle.centerLetter, ...puzzle.outerLetters]);

  if (!/^[a-z]+$/.test(word)) {
    return { ok: false, reason: "Only letters a-z are allowed.", word };
  }

  if (word.length < MIN_WORD_LENGTH) {
    return { ok: false, reason: "Word is too short.", word };
  }

  if (!word.includes(puzzle.centerLetter)) {
    return { ok: false, reason: "Word must include the center letter.", word };
  }

  for (const letter of word) {
    if (!allowedLetters.has(letter)) {
      return { ok: false, reason: "Word uses letters outside this puzzle.", word };
    }
  }

  if (foundWordSet.has(word)) {
    return { ok: false, reason: "Word already found.", word };
  }

  if (!puzzle.validWordSet.has(word)) {
    return { ok: false, reason: "Word is not in this puzzle word list.", word };
  }

  return { ok: true, word };
}
