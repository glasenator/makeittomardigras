import type { Card, WeekDecks } from './deck'
import { activeValues, bustColumn, entryCells, scheduleEntries, scheduleTotals, STARTING_VALUES, visibleGrid, type PlayerTotals, type Schedule, type ScheduledCard } from './scheduleTotals'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SLOTS = 3
export const WEEKS = 3
export type { Schedule } from './scheduleTotals'
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
  pendingFlip: { player: number; day: number; slot: number; halves: ('top' | 'bottom')[]; extraTurnsAfter: number | null } | null
  extraTurns: number | null
  weekComplete: boolean
  bustColumns: (number | null)[]
  gameOver: boolean
  error: string | null
}

export const slotOpen = (player: Schedule, day: number, slot: number, horizontal = false) => {
  const entries = scheduleEntries(player)
  const rows = horizontal ? [slot] : [slot, slot + 1]
  if (day === 0 && rows.some((row) => row === 1 || row === 2)) return true
  return entries.some((entry) => entryCells(entry).some(([d, row]) =>
    rows.some((incomingRow) =>
      (d === day && Math.abs(row - incomingRow) <= 1) ||
      (d === day - 1 && row === incomingRow))))
}

export const canPlace = (player: Schedule, day: number, slot: number, incoming: Card): boolean => {
  const column = player[day]
  const horizontal = incoming.orientation === 'horizontal'
  if (!column || !Number.isInteger(slot) || slot < 0 || slot >= (horizontal ? 4 : SLOTS) ||
      (horizontal && !player[day + 1]) || !slotOpen(player, day, slot, horizontal)) return false
  const grid = visibleGrid(player)
  const secondDay = horizontal ? day + 1 : day
  const secondRow = horizontal ? slot : slot + 1
  const firstCovered = grid[day][slot]
  const secondCovered = grid[secondDay][secondRow]
  if (firstCovered && firstCovered.card === secondCovered?.card) return false
  const canCover = (d: number, row: number, next: number) => {
    const previous = grid[d][row]
    if (!previous) return true
    const values = activeValues(previous.card)
    if (!values) return true
    const first = previous.card.orientation === 'horizontal' ? d === previous.day : row === previous.row
    const value = first ? values.top : values.bottom
    return value !== 0 && (next === 0 || (value < 0 ? next > 0 : next < 0))
  }
  return canCover(day, slot, incoming.top) && canCover(secondDay, secondRow, incoming.bottom)
}

export const legalMoves = (player: Schedule, cards: Card[]) =>
  cards.flatMap((card) =>
    player.flatMap((_, day) =>
      Array.from({ length: card.orientation === 'horizontal' ? 4 : SLOTS }, (_, slot) => slot)
        .flatMap((slot) => canPlace(player, day, slot, card) ? [{ card, day, slot }] : []),
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
    pendingFlip: null,
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
  const bustColumns = state.schedules.map((schedule, i) => bustColumn(schedule, state.starting[i]))
  return {
    ...state,
    weekComplete: true,
    bustColumns,
    gameOver: state.week === WEEKS,
    extraTurns: null,
  }
}

export function completedWeekTotals(state: GameState): PlayerTotals[] {
  return state.schedules.map((schedule, i) =>
    scheduleTotals(schedule, state.starting[i], state.bustColumns[i]),
  )
}

export function finalScore(totals: PlayerTotals): number {
  return totals.points - totals.money - totals.energy
}

export function sundayCardCount(schedule: Schedule): number {
  return scheduleEntries(schedule).filter((entry) => entryCells(entry).some(([day]) => day === DAYS.length - 1)).length
}

export function winningPlayers(state: GameState): number[] {
  const totals = completedWeekTotals(state)
  let candidates = totals.map((_, i) => i)
  const highest = Math.max(...totals.map(finalScore))
  candidates = candidates.filter((i) => finalScore(totals[i]) === highest)
  const mostCards = Math.max(...candidates.map((i) => sundayCardCount(state.schedules[i])))
  return candidates.filter((i) => sundayCardCount(state.schedules[i]) === mostCards)
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
    pendingFlip: null,
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
    state.weekComplete || state.gameOver || state.error || state.pendingFlip || !card || card.id !== cardId || !player || !player[day] ||
    !canPlace(player, day, slot, card)
  ) return state

  const horizontal = card.orientation === 'horizontal'
  const existing = horizontal ? null : player[day][slot]
  const replaced = existing
  const remaining = player[day].slice(0, SLOTS).filter((item): item is ScheduledCard => item !== null && item !== replaced)
    .sort((a, b) => a.placedAt - b.placedAt)
  const placedAt = remaining.length + 1
  const sequence = Math.max(0, ...scheduleEntries(player).map((entry) => entry.card.sequence ?? entry.card.placedAt)) + 1
  const scheduledCard: ScheduledCard = { ...card, placedAt, sequence, ...(horizontal ? { row: slot } : {}) }
  const scheduledSlot = horizontal ? player[day].length : slot
  const schedules = state.schedules.map((schedule, i) =>
    i === state.turn
      ? schedule.map((column, d) => d === day
          ? horizontal ? [...column, scheduledCard]
            : [
              ...column.map((item, s) => s === slot ? scheduledCard : item && s < SLOTS ? { ...item, placedAt: remaining.indexOf(item) + 1 } : item),
            ]
          : column)
      : schedule,
  )
  const extraTurns = state.extraTurns !== null
    ? state.extraTurns - 1
    : !horizontal && day === DAYS.length - 1 ? state.schedules.length : null
  const next: GameState = {
    ...state,
    schedules,
    setAside: replaced ? [...state.setAside, { id: replaced.id, top: replaced.top, bottom: replaced.bottom,
      ...(replaced.orientation ? { orientation: replaced.orientation } : {}) }] : state.setAside,
    drawArea: state.blindCard ? state.drawArea : state.drawArea.filter((item) => item.id !== cardId),
    blindCard: null,
    blindSkip: state.turn === 0 ? null : state.blindSkip,
    drawPicks: state.drawPicks.map((pick, i) => i === state.turn ? state.blindCard ? 'blind' : card : pick),
    pendingFlip: { player: state.turn, day, slot: scheduledSlot, halves: [
      ...(card.top === 0 ? ['top' as const] : []),
      ...(card.bottom === 0 ? ['bottom' as const] : []),
    ], extraTurnsAfter: extraTurns },
  }
  return advanceFlip(next)
}

export type FlipTarget = { day: number; slot: number }

export function flipTargets(state: GameState): FlipTarget[] {
  const pending = state.pendingFlip
  if (!pending || pending.halves.length === 0) return []
  const { player, day, slot, halves } = pending
  const schedule = state.schedules[player]
  const source = schedule[day][slot]
  if (!source) return []
  const second = halves[0] === 'bottom'
  const row = source.orientation === 'horizontal' ? source.row! : slot
  const section = row + (second ? 1 : 0)
  const positions = source.orientation === 'horizontal'
    ? [[day + (second ? 1 : 0), row - 1], [day + (second ? 1 : 0), row + 1], [second ? day + 2 : day - 1, row]]
    : [[day - 1, section], [day + 1, section], [day, second ? row + 2 : row - 1]]
  const targets: FlipTarget[] = []
  const grid = visibleGrid(schedule)
  for (const [targetDay, targetSection] of positions) {
    const entry = grid[targetDay]?.[targetSection]
    if (!entry || entry.card === source) continue
    if (!entryCells(entry).every(([d, r]) => grid[d]?.[r]?.card === entry.card)) continue
    if (!targets.some((target) => target.day === entry.day && target.slot === entry.slot)) {
      targets.push({ day: entry.day, slot: entry.slot })
    }
  }
  return targets
}

function advanceFlip(state: GameState): GameState {
  let pending = state.pendingFlip
  while (pending && pending.halves.length > 0) {
    if (flipTargets({ ...state, pendingFlip: pending }).length > 0) return { ...state, pendingFlip: pending }
    pending = { ...pending, halves: pending.halves.slice(1) }
  }
  return finishTurn({ ...state, pendingFlip: null, extraTurns: pending?.extraTurnsAfter ?? null, turn: (state.turn + 1) % state.schedules.length })
}

export function flipCard(state: GameState, day: number, slot: number): GameState {
  const pending = state.pendingFlip
  if (!pending || !flipTargets(state).some((target) => target.day === day && target.slot === slot)) return state
  const schedules = state.schedules.map((schedule, player) => player !== pending.player ? schedule :
    schedule.map((column, d) => d !== day ? column :
      column.map((card, s) => s !== slot || !card ? card : { ...card, faceDown: !card.faceDown })))
  return advanceFlip({ ...state, schedules, pendingFlip: { ...pending, halves: pending.halves.slice(1) } })
}

export function drawBlind(state: GameState): GameState {
  if (state.weekComplete || state.gameOver || state.error || state.pendingFlip || state.blindCard || state.deck.length === 0) return state
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
  if (state.weekComplete || state.gameOver || state.error || state.pendingFlip) return null
  const moves = legalMoves(state.schedules[state.turn], state.blindCard ? [state.blindCard] : state.drawArea)
  if (moves.length === 0) return !state.blindCard && state.deck.length > 0 && state.extraTurns === 1 ? 'last' : null
  const endingMoves = moves.filter((move) => {
    let next = playCard(state, move.card.id, move.day, move.slot)
    while (next.pendingFlip) {
      const target = flipTargets(next)[0]
      next = flipCard(next, target.day, target.slot)
    }
    return next.weekComplete
  }).length
  const blindMayEnd = !state.blindCard && state.deck.length > 0 && state.extraTurns === null &&
    state.drawPicks.every((pick, i) => i === state.turn || pick !== null) &&
    state.deck.length - 1 < state.schedules.length + 1 - state.drawArea.length
  if (endingMoves === 0) return blindMayEnd ? 'possible' : null
  return endingMoves === moves.length && (state.blindCard || state.deck.length === 0 || state.extraTurns === 1) ? 'last' : 'possible'
}
