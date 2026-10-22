/**
 * The palette lives apart from the charts so that both stay fast-refreshable:
 * a module that exports components must export nothing else.
 */

/** Distinct enough on a projector, and readable for the colour-blind. */
export const COLORS = ['#6ea8fe', '#ffd166', '#06d6a0', '#ef476f', '#c77dff', '#f78c6b']

/** More countries than colours is fine: the palette wraps round. */
export function colorOf(index: number): string {
  return COLORS[index % COLORS.length]
}
