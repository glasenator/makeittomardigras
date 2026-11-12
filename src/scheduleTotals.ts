import type { Card } from './deck'

export const STARTING_VALUES = { money: 5, energy: 5 } as const

export type PlayerTotals = { money: number; energy: number; points: number }
export type ScheduledCard = Card & { placedAt: number; sequence?: number; row?: number; faceDown?: boolean }
export type Schedule = (ScheduledCard | null)[][]
export type ScheduleEntry = { card: ScheduledCard; day: number; slot: number; row: number }

export function backValues(card: Card): { top: number; bottom: number } | null {
  return card.top < 0 && card.bottom < 0 ? { top: -card.top, bottom: -card.bottom } : null
}

export function activeValues(card: ScheduledCard): { top: number; bottom: number } | null {
  if (!card.faceDown) return { top: card.top, bottom: card.bottom }
  return backValues(card)
}

export function scheduleEntries(schedule: Schedule): ScheduleEntry[] {
  return schedule.flatMap((column, day) => column.flatMap((card, slot) =>
    card ? [{ card, day, slot, row: card.row ?? slot }] : [],
  ))
}

export function entryCells(entry: ScheduleEntry): [number, number][] {
  return entry.card.orientation === 'horizontal'
    ? [[entry.day, entry.row], [entry.day + 1, entry.row]]
    : [[entry.day, entry.row], [entry.day, entry.row + 1]]
}

export function visibleGrid(schedule: Schedule): (ScheduleEntry | null)[][] {
  const grid: (ScheduleEntry | null)[][] = schedule.map(() => Array<ScheduleEntry | null>(4).fill(null))
  for (const entry of scheduleEntries(schedule)) {
    for (const [day, row] of entryCells(entry)) {
      if (!grid[day] || row < 0 || row >= 4) continue
      const current = grid[day][row]
      if (!current || (current.card.sequence ?? current.card.placedAt) < (entry.card.sequence ?? entry.card.placedAt)) {
        grid[day][row] = entry
      }
    }
  }
  return grid
}

export function visibleSectionCards(column: (ScheduledCard | null)[]): (ScheduledCard | null)[] {
  return visibleGrid([column])[0].map((entry) => entry?.card ?? null)
}

function entryValue(entry: ScheduleEntry, day: number, row: number): number {
  const values = activeValues(entry.card)
  if (!values) return 0
  const first = entry.card.orientation === 'horizontal' ? day === entry.day : row === entry.row
  return first ? values.top : values.bottom
}

export function visibleSections(column: (ScheduledCard | null)[]): (number | null)[] {
  return visibleGrid([column])[0].map((entry, row) => entry ? entryValue(entry, 0, row) : null)
}

export function scheduleTotals(
  schedule: Schedule,
  starting: PlayerTotals = { ...STARTING_VALUES, points: 0 },
  cutoff: number | null = null,
) {
  const totals = { ...starting }
  const grid = visibleGrid(schedule)
  grid.forEach((column, day) => {
    if (cutoff !== null && day >= cutoff) return
    column.forEach((entry, row) => {
      if (!entry) return
      const value = entryValue(entry, day, row)
      if (row === 0 || row === 3) totals.points += value
      else if (row === 1) totals.money += value
      else totals.energy += value
    })
  })
  return totals
}

export function bustColumn(schedule: Schedule, starting: PlayerTotals, protectFinalColumn = false): number | null {
  const columnsToCheck = protectFinalColumn ? schedule.length - 1 : schedule.length
  for (let day = 0; day < columnsToCheck; day++) {
    const totals = scheduleTotals(schedule, starting, day + 1)
    if (totals.money < 0 || totals.energy < 0) return day
  }
  return null
}

export function bustWarningSections(schedule: Schedule, starting: PlayerTotals, protectFinalColumn = false) {
  const day = bustColumn(schedule, starting, protectFinalColumn)
  if (day === null) return []

  const before = scheduleTotals(schedule, starting, day)
  const column = visibleGrid(schedule)[day]
  return ([1, 2] as const).flatMap((row) => {
    const entry = column[row]
    if (!entry) return []
    const value = entryValue(entry, day, row)
    const resource: 'money' | 'energy' = row === 1 ? 'money' : 'energy'
    if (value >= 0 || before[resource] + value >= 0) return []
    const first = entry.card.orientation === 'horizontal' ? day === entry.day : row === entry.row
    return [{ card: entry.card, half: first ? 'top' as const : 'bottom' as const, resource }]
  })
}

export function scheduleTotalsAfterBust(
  schedule: Schedule,
  starting: PlayerTotals,
  protectFinalColumn = false,
): PlayerTotals {
  const bust = bustColumn(schedule, starting, protectFinalColumn)
  const totals = scheduleTotals(schedule, starting, bust)
  if (protectFinalColumn && bust === null) {
    totals.money = Math.max(0, totals.money)
    totals.energy = Math.max(0, totals.energy)
  }
  return totals
}
