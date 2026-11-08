import type { Card } from './deck'

export const STARTING_VALUES = { money: 5, energy: 5 } as const

export type PlayerTotals = { money: number; energy: number; points: number }
export type ScheduledCard = Card & { placedAt: number }

export function visibleSections(column: (ScheduledCard | null)[]): (number | null)[] {
  const sections: ({ value: number; placedAt: number } | null)[] = [null, null, null, null]
  column.forEach((card, slot) => {
    if (!card) return
    for (const [section, value] of [[slot, card.top], [slot + 1, card.bottom]]) {
      if (!sections[section] || sections[section].placedAt < card.placedAt) {
        sections[section] = { value, placedAt: card.placedAt }
      }
    }
  })
  return sections.map((entry) => entry?.value ?? null)
}

export function scheduleTotals(
  schedule: (ScheduledCard | null)[][],
  starting: PlayerTotals = { ...STARTING_VALUES, points: 0 },
) {
  const totals = { ...starting }

  const addSection = (section: number, value: number) => {
    if (section === 0 || section === 3) totals.points += value
    else if (section === 1) totals.money += value
    else if (section === 2) totals.energy += value
  }

  for (const column of schedule) {
    visibleSections(column).forEach((value, section) => {
      if (value !== null) addSection(section, value)
    })
  }

  return totals
}

export function bustColumn(schedule: (ScheduledCard | null)[][], starting: PlayerTotals): number | null {
  const final = scheduleTotals(schedule, starting)
  if (final.money >= 0 && final.energy >= 0) return null

  let totals = { ...starting }
  for (let day = 0; day < schedule.length; day++) {
    totals = scheduleTotals([schedule[day]], totals)
    if (totals.money < 0 || totals.energy < 0) return day
  }
  return null
}
