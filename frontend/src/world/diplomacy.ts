import { useCallback, useEffect, useState } from 'react'

/**
 * Manual diplomacy for the «Мир» tab (#world): the player decides who is a
 * friend and who is an enemy — no engine mechanics behind it yet, just a
 * marked-up map. The choice is stored in localStorage per game, so it survives
 * reloads but stays a personal overlay: other players see their own colors.
 *
 * When the backend grows real relations, this module is the single place to
 * swap the storage behind.
 */
export type Relation = 'friend' | 'neutral' | 'enemy'
export const RELATIONS: Relation[] = ['friend', 'neutral', 'enemy']

/** Neutral is the absence of a mark, so only the extremes are stored. */
export type Relations = Record<string, Exclude<Relation, 'neutral'>>

const keyOf = (gameId: string) => `arena-diplo:${gameId}`

/** Parse the stored marks; anything unknown or broken reads as empty. */
export function readDiplomacy(gameId: string): Relations {
  try {
    const raw = window.localStorage.getItem(keyOf(gameId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Relations = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (value === 'friend' || value === 'enemy') out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

function writeDiplomacy(gameId: string, value: Relations): void {
  try {
    window.localStorage.setItem(keyOf(gameId), JSON.stringify(value))
  } catch {
    // Private mode with storage disabled: the marks just live in memory.
  }
}

export function relationOf(relations: Relations, countryId: string): Relation {
  return relations[countryId] ?? 'neutral'
}

export function useDiplomacy(gameId: string | undefined) {
  const [relations, setRelations] = useState<Relations>({})

  // A new game id is a new map: reload whatever is stored for it.
  useEffect(() => {
    setRelations(gameId ? readDiplomacy(gameId) : {})
  }, [gameId])

  const setRelation = useCallback((countryId: string, relation: Relation) => {
    setRelations((prev) => {
      const next = { ...prev }
      if (relation === 'neutral') delete next[countryId]
      else next[countryId] = relation
      return next
    })
  }, [])

  // Write-through: every change lands in storage (also the initial echo,
  // which rewrites what was just read — harmless and keeps one code path).
  useEffect(() => {
    if (gameId) writeDiplomacy(gameId, relations)
  }, [gameId, relations])

  return { relations, setRelation }
}
