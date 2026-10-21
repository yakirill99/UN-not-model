/** Human names for the ids the engine speaks: cities and countries from the observation. */
export type Names = Record<string, string>

/** An id with no name is shown as is — a missing translation must not hide a target. */
export function nameOf(names: Names, id: string): string {
  return names[id] ?? id
}
