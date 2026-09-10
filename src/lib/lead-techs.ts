/**
 * Techs recorded in the processor notes thread.
 *
 * The "Add tech" button writes a fixed shape so the entries can be counted later without a
 * schema change:
 *
 *   Tech 1
 *   Name:
 *   Number:
 *
 * Counting is deliberately forgiving about spacing and case, since notes are free text that
 * people edit by hand afterwards.
 */

const TECH_HEADING = /^[ \t]*tech[ \t]*#?[ \t]*(\d+)[ \t]*$/gim;

/** Every tech number found in a note body, in the order they appear. */
export function findTechNumbers(content: string | null | undefined): number[] {
  if (!content) return [];

  const numbers: number[] = [];
  // Regex carries the global flag, so reset before each use.
  TECH_HEADING.lastIndex = 0;

  let match = TECH_HEADING.exec(content);
  while (match !== null) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) numbers.push(parsed);
    match = TECH_HEADING.exec(content);
  }

  return numbers;
}

/** How many techs are recorded across a set of note bodies. */
export function countTechs(contents: Array<string | null | undefined>): number {
  return contents.reduce((total, content) => total + findTechNumbers(content).length, 0);
}

/**
 * The number the next tech should get: one past the highest already used, so deleting Tech 2
 * of 3 does not hand out a number that is still on screen.
 */
export function nextTechNumber(contents: Array<string | null | undefined>): number {
  const highest = contents.reduce((max, content) => {
    return findTechNumbers(content).reduce((inner, n) => Math.max(inner, n), max);
  }, 0);

  return highest + 1;
}

/** The block the "Add tech" button inserts, ready for the name and number to be typed in. */
export function buildTechTemplate(techNumber: number): string {
  return `Tech ${techNumber}\nName: \nNumber: `;
}

/** "3 techs" / "1 tech" — the summary shown on the collapsed notes row. */
export function formatTechCount(count: number): string {
  return `${count} ${count === 1 ? "tech" : "techs"}`;
}
