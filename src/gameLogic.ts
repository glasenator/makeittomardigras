import type { Card, WeekDecks } from './deck'
import { bustColumn, scheduleTotals, STARTING_VALUES, visibleSections, type PlayerTotals, type ScheduledCard } from './scheduleTotals'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const SLOTS = 3
export const WEEKS = 3
export type Schedule = (ScheduledCard | null)[][]
export type GameState = {
  deck: Card[]
  drawArea: Card[]
  setAside: Card[]
  futureDecks: Card[][]
  schedules: Schedule[]
  starting: PlayerTotals[]
  week: number
  turn: number
  weekStarter: number
  drawStarter: number
  drawPicks: (Card | 'blind' | null)[]
  blindCard: Card | null
  blindSkip: { player: number; card: Card } | null
  extraTurns: number | null
  weekComplete: boolean
  bustColumns: (number | null)[]
  gameOver: boolean
  error: string | null
}

export const slotOpen = (player: Schedule, day: number, slot: number) =>
  day === 0 || player[day].some((card) => card !== null) ||
  player[day - 1].some((card, k) => card && Math.abs(k - slot) <= 1)

export const canPlace = (player: Schedule, day: number, slot: number, incoming: Card): boolean => {
  const column = player[day]
  if (!column || !Number.isInteger(slot) || slot < 0 || slot >= SLOTS || !slotOpen(player, day, slot)) return false
  const card = column[slot]
  if (card) {
    const above = column[slot - 1]
    const below = column[slot + 1]
    if (!(above && above.placedAt > card.placedAt) && !(below && below.placedAt > card.placedAt)) return false
  }
  const visible = visibleSections(column)
  const canCover = (previous: number | null, next: number) =>
    previous === null || (previous !== 0 && (next === 0 || (previous < 0 ? next > 0 : next < 0)))
  return canCover(visible[slot], incoming.top) && canCover(visible[slot + 1], incoming.bottom)
}

export const legalMoves = (player: Schedule, cards: Card[]) =>
  cards.flatMap((card) =>
    player.flatMap((column, day) =>
      column.flatMap((_, slot) => canPlace(player, day, slot, card) ? [{ card, day, slot }] : []),
    ),
  )

const emptySchedule = (): Schedule => DAYS.map(() => Array<ScheduledCard | null>(SLOTS).fill(null))

export function newGame(numPlayers: number, decks: WeekDecks): GameState {
  const [deck, ...futureDecks] = decks
  const count = numPlayers + 1
  return {
    deck: deck.length >= count ? deck.slice(count) : deck,
    drawArea: deck.length >= count ? deck.slice(0, count) : [],
    setAside: [],
    futureDecks,
    schedules: Array.from({ length: numPlayers }, emptySchedule),
    starting: Array.from({ length: numPlayers }, () => ({ ...STARTING_VALUES, points: 0 })),
    week: 1,
    turn: 0,
    weekStarter: 0,
    drawStarter: 0,
    drawPicks: Array<Card | 'blind' | null>(numPlayers).fill(null),
    blindCard: null,
    blindSkip: null,
    extraTurns: null,
    weekComplete: false,
    bustColumns: Array<number | null>(numPlayers).fill(null),
    gameOver: false,
    error: deck.length < count ? `The deck needs at least ${count} cards to start a week.` : null,
  }
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function finishWeek(state: GameState): GameState {
  return {
    ...state,
    weekComplete: true,
    bustColumns: state.schedules.map((schedule, i) => bustColumn(schedule, state.starting[i])),
    gameOver: state.week === WEEKS,
    extraTurns: null,
  }
}

export function completedWeekTotals(state: GameState): PlayerTotals[] {
  return state.schedules.map((schedule, i) =>
    scheduleTotals(schedule.slice(0, state.bustColumns[i] ?? schedule.length), state.starting[i]),
  )
}

export function winningPlayers(totals: PlayerTotals[]): number[] {
  let candidates = totals.map((_, i) => i)
  for (const field of ['points', 'energy', 'money'] as const) {
    const highest = Math.max(...candidates.map((i) => totals[i][field]))
    candidates = candidates.filter((i) => totals[i][field] === highest)
  }
  return candidates
}

export function startNextWeek(state: GameState): GameState {
  if (!state.weekComplete || state.gameOver) return state
  const starting = completedWeekTotals(state)
  const lowestPoints = Math.min(...starting.map((totals) => totals.points))
  const weekStarter = Array.from({ length: starting.length }, (_, i) =>
    (state.weekStarter + i + 1) % starting.length,
  ).find((player) => starting[player].points === lowestPoints)
  if (weekStarter === undefined) {
    return { ...state, error: 'Cannot determine the next starting player: no players have a score.' }
  }
  const [deck, ...futureDecks] = state.futureDecks
  const count = state.schedules.length + 1

  return {
    ...state,
    deck: deck.length >= count ? deck.slice(count) : deck,
    drawArea: deck.length >= count ? deck.slice(0, count) : [],
    futureDecks,
    setAside: [],
    schedules: state.schedules.map(emptySchedule),
    starting,
    week: state.week + 1,
    turn: weekStarter,
    weekStarter,
    drawStarter: weekStarter,
    drawPicks: state.starting.map(() => null),
    blindCard: null,
    blindSkip: null,
    extraTurns: null,
    weekComplete: false,
    bustColumns: state.bustColumns.map(() => null),
    error: deck.length < count ? `The deck needs at least ${count} cards to start a week.` : null,
  }
}

export function playCard(state: GameState, cardId: number, day: number, slot: number): GameState {
  const card = state.blindCard ?? state.drawArea.find((item) => item.id === cardId)
  const player = state.schedules[state.turn]
  if (
    state.weekComplete || state.gameOver || state.error || !card || card.id !== cardId || !player || !player[day] ||
    !canPlace(player, day, slot, card)
  ) return state

  const replaced = player[day][slot]
  const remaining = player[day].filter((item): item is ScheduledCard => item !== null && item !== replaced)
    .sort((a, b) => a.placedAt - b.placedAt)
  const placedAt = remaining.length + 1
  const scheduledCard: ScheduledCard = { ...card, placedAt }
  const schedules = state.schedules.map((schedule, i) =>
    i === state.turn
      ? schedule.map((column, d) => d === day
          ? column.map((item, s) => s === slot ? scheduledCard : item ? { ...item, placedAt: remaining.indexOf(item) + 1 } : null)
          : column)
      : schedule,
  )
  const extraTurns = state.extraTurns !== null
    ? state.extraTurns - 1
    : day === DAYS.length - 1 ? state.schedules.length : null
  const next: GameState = {
    ...state,
    schedules,
    setAside: replaced ? [...state.setAside, { id: replaced.id, top: replaced.top, bottom: replaced.bottom }] : state.setAside,
    drawArea: state.blindCard ? state.drawArea : state.drawArea.filter((item) => item.id !== cardId),
    blindCard: null,
    blindSkip: state.turn === 0 ? null : state.blindSkip,
    turn: (state.turn + 1) % state.schedules.length,
    drawPicks: state.drawPicks.map((pick, i) => i === state.turn ? state.blindCard ? 'blind' : card : pick),
    extraTurns,
  }
  return finishTurn(next)
}

export function drawBlind(state: GameState): GameState {
  if (state.weekComplete || state.gameOver || state.error || state.blindCard || state.deck.length === 0) return state
  const [card, ...deck] = state.deck
  const next = { ...state, deck, blindCard: card, blindSkip: state.turn === 0 ? null : state.blindSkip }
  if (legalMoves(state.schedules[state.turn], [card]).length > 0) return next
  return finishTurn({
    ...next,
    blindCard: null,
    blindSkip: { player: state.turn, card },
    setAside: [...state.setAside, card],
    turn: (state.turn + 1) % state.schedules.length,
    drawPicks: state.drawPicks.map((pick, i) => i === state.turn ? 'blind' : pick),
    extraTurns: state.extraTurns === null ? null : state.extraTurns - 1,
  })
}

function finishTurn(next: GameState): GameState {
  const extraTurns = next.extraTurns
  if (extraTurns === 0) return finishWeek(next)
  if (extraTurns !== null && next.drawArea.length + next.deck.length < extraTurns) {
    return { ...next, error: 'Not enough cards for the remaining extra turns. Add more cards to the deck and start a new game.' }
  }
  if (next.drawPicks.some((pick) => pick === null)) return next

  const count = next.schedules.length + 1 - next.drawArea.length
  if (next.deck.length < count) {
    if (extraTurns !== null) {
      const available = [...next.drawArea, ...next.deck]
      if (available.length < extraTurns) {
        return { ...next, error: 'Not enough cards for the remaining extra turns. Add more cards to the deck and start a new game.' }
      }
      return { ...next, deck: [], drawArea: available, drawPicks: next.drawPicks.map(() => null), drawStarter: next.turn }
    }
    return finishWeek(next)
  }

  const picks = next.drawPicks
  const pickedCards = picks.filter((pick): pick is Card => pick !== null && pick !== 'blind')
  const minimumSum = Math.min(...pickedCards.map((pick) => pick.top + pick.bottom))
  const minimumNumber = Math.min(...pickedCards
    .filter((pick) => pick.top + pick.bottom === minimumSum)
    .map((pick) => Math.min(pick.top, pick.bottom)))
  const nextStarter = Array.from({ length: picks.length }, (_, i) =>
    (next.drawStarter + i + 1) % picks.length,
  ).find((player) => {
    const pick = picks[player]
    return pick !== null && pick !== 'blind' && pick.top + pick.bottom === minimumSum &&
      Math.min(pick.top, pick.bottom) === minimumNumber
  })
  const starter = nextStarter ?? (next.drawStarter + 1) % picks.length

  return {
    ...next,
    drawArea: [...next.drawArea, ...next.deck.slice(0, count)],
    deck: next.deck.slice(count),
    turn: extraTurns === null ? starter : next.turn,
    drawStarter: extraTurns === null ? starter : next.turn,
    drawPicks: next.drawPicks.map(() => null),
  }
}

export function lastPlayStatus(state: GameState): 'last' | 'possible' | null {
  if (state.weekComplete || state.gameOver || state.error) return null
  const moves = legalMoves(state.schedules[state.turn], state.blindCard ? [state.blindCard] : state.drawArea)
  if (moves.length === 0) return !state.blindCard && state.deck.length > 0 && state.extraTurns === 1 ? 'last' : null
  const endingMoves = moves.filter((move) => playCard(state, move.card.id, move.day, move.slot).weekComplete).length
  const blindMayEnd = !state.blindCard && state.deck.length > 0 && state.extraTurns === null &&
    state.drawPicks.every((pick, i) => i === state.turn || pick !== null) &&
    state.deck.length - 1 < state.schedules.length + 1 - state.drawArea.length
  if (endingMoves === 0) return blindMayEnd ? 'possible' : null
  return endingMoves === moves.length && (state.blindCard || state.deck.length === 0 || state.extraTurns === 1) ? 'last' : 'possible'
}
