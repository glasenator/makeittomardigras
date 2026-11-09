import { legalMoves, playCard, type GameState } from './gameLogic'
import { bustColumn, scheduleTotals } from './scheduleTotals'

export type Difficulty = 'easy' | 'medium' | 'hard'
type Move = ReturnType<typeof legalMoves>[number]

export function chooseBlindDraw(state: GameState, difficulty: Difficulty, random: () => number = Math.random): boolean {
  if (state.weekComplete || state.gameOver || state.error || state.blindCard || state.deck.length === 0) return false
  if (legalMoves(state.schedules[state.turn], state.drawArea).length === 0) return true
  const chance = { easy: 0.25, medium: 0.15, hard: 0.02 }[difficulty]
  return random() < chance
}

export function chooseComputerMove(state: GameState, difficulty: Difficulty, random: () => number = Math.random): Move | null {
  if (state.weekComplete || state.gameOver || state.error) return null
  const player = state.turn
  const cards = state.blindCard ? [state.blindCard] : state.drawArea
  const moves = legalMoves(state.schedules[player], cards)
  if (moves.length === 0) return null

  if (difficulty === 'easy') {
    const playableCards = cards.filter((card) => moves.some((move) => move.card.id === card.id))
    const card = playableCards[Math.floor(random() * playableCards.length)]
    const spots = moves.filter((move) => move.card.id === card.id)
    return spots[Math.floor(random() * spots.length)]
  }

  const evaluateSchedule = (schedule: GameState['schedules'][number]) => {
    const starting = state.starting[player]
    const totals = scheduleTotals(schedule, starting)
    const resourceScore = (value: number) => value < 0 ? value * 12 : Math.min(value, 10) * 0.4
    let score = totals.points * 4 + resourceScore(totals.money) + resourceScore(totals.energy)

    if (difficulty === 'hard') {
      const cutoff = bustColumn(schedule, starting)
      const safeTotals = scheduleTotals(schedule.slice(0, cutoff ?? schedule.length), starting)
      score += (safeTotals.points - totals.points) * 4
      let running = { ...starting }
      for (const column of schedule) {
        running = scheduleTotals([column], running)
        score -= Math.max(0, -running.money) * 3 + Math.max(0, -running.energy) * 3
      }
    }
    return score
  }

  const scoreMove = (move: Move) => {
    const next = playCard(state, move.card.id, move.day, move.slot)
    const schedule = next.schedules[player]
    let score = evaluateSchedule(schedule)
    if (difficulty === 'hard') {
      const remainingVisibleCards = state.drawArea.filter((card) => state.blindCard || card.id !== move.card.id)
      const futureMoves = legalMoves(schedule, remainingVisibleCards)
      if (!next.weekComplete && !next.error && state.extraTurns !== 1 && futureMoves.length > 0) {
        let bestFuture = -Infinity
        const futureState = { ...next, turn: player, drawArea: remainingVisibleCards, blindCard: null }
        for (const future of futureMoves) {
          const simulated = playCard(futureState, future.card.id, future.day, future.slot)
          bestFuture = Math.max(bestFuture, evaluateSchedule(simulated.schedules[player]))
        }
        score += 0.35 * (bestFuture - score)
        score += Math.min(futureMoves.length, 20) * 0.2
      }
      if (state.extraTurns === null && move.day === 4) {
        const ownCutoff = bustColumn(schedule, state.starting[player])
        const ownPoints = scheduleTotals(schedule.slice(0, ownCutoff ?? schedule.length), state.starting[player]).points
        const bestOpponent = Math.max(...state.schedules.map((other, i) =>
          i === player ? -Infinity : scheduleTotals(other.slice(0, bustColumn(other, state.starting[i]) ?? other.length), state.starting[i]).points,
        ))
        score += Math.max(-12, Math.min(12, (ownPoints - bestOpponent) * 1.5))
      }
    }
    return score
  }

  let bestScore = -Infinity
  let bestMoves: Move[] = []
  for (const move of moves) {
    const score = scoreMove(move)
    if (score > bestScore) {
      bestScore = score
      bestMoves = [move]
    } else if (score === bestScore) {
      bestMoves.push(move)
    }
  }
  return bestMoves[Math.floor(random() * bestMoves.length)]
}
