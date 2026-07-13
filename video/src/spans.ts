/**
 * ANSI output modelled as spans.
 *
 * Parsing real ANSI escape codes would be a lot of code for no benefit. A span
 * array is type-safe, and the same array works for both the typed reveal (slice
 * it) and the instant output path (render it whole).
 */

export type Span = {
  text: string;
  color?: string;
  bold?: boolean;
  /**
   * Render an SVG glyph instead of `text`, occupying text.length columns.
   * Only needed for the branch mark: recap.py prints U+2387 (⎇), which is
   * missing even from the full JetBrains Mono, so it would tofu. `text` is
   * still used for column accounting.
   */
  icon?: "branch";
};

export const spanLen = (spans: Span[]): number => {
  let n = 0;
  for (const s of spans) {
    n += s.text.length;
  }
  return n;
};

/** Slice a span array to the first `count` characters, preserving colors. */
export const sliceSpans = (spans: Span[], count: number): Span[] => {
  const out: Span[] = [];
  let remaining = count;
  for (const s of spans) {
    if (remaining <= 0) {
      break;
    }
    out.push({ ...s, text: s.text.slice(0, remaining) });
    remaining -= s.text.length;
  }
  return out;
};

/** Left-pad to width n. String.padStart is not in this tsconfig's lib (es2015). */
export const padLeft = (s: string, n: number): string => {
  let out = s;
  while (out.length < n) {
    out = " " + out;
  }
  return out;
};

export const spaces = (n: number): string => (n > 0 ? " ".repeat(n) : "");
