export function computeWordScore(word, isPangram) {
  if (word.length < 4) {
    return 0;
  }

  const baseScore = word.length === 4 ? 1 : word.length;
  return isPangram ? baseScore + 7 : baseScore;
}

export function computeMaxScore(validWords, pangramSet) {
  return validWords.reduce((total, word) => {
    return total + computeWordScore(word, pangramSet.has(word));
  }, 0);
}
