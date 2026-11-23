/** Number formatting matching the prototype (en-IN grouping, e.g. 2,200). */
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-IN");

/** One decimal, dropping ".0": 25 → "25", 25.4 → "25.4". */
export const fmt1 = (n: number) => String(Math.round(n * 10) / 10);

export const kcal = (n: number) => `${fmtInt(n)} kcal`;
export const grams = (n: number) => `${fmt1(n)}g`;

/** Unknown values (null) are shown as "—", never as 0. */
export const maybe = (n: number | null | undefined, f: (n: number) => string = fmt1) =>
  n === null || n === undefined ? "—" : f(n);
