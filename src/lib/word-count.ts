// Word count as Obsidian shows it: each CJK character counts as one, other text by words
const CJK = new RegExp('[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]', 'gu')
const WORD = new RegExp("[\\p{L}\\p{N}'’_-]+", 'gu')

export function countWords(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0
  const words = text.replace(CJK, ' ').match(WORD)?.length ?? 0
  return cjk + words
}
