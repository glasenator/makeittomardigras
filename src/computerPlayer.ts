import { legalMoves, playCard, type GameState } from './gameLogic'
import { bustColumn, scheduleTotals } from './scheduleTotals'

export type Difficulty = 'easy' | 'medium' | 'hard'
type Move = ReturnType<typeof legalMoves>[number]

export function chooseComputerMove(state: GameState, difficulty: Difficulty, random: () => number = Math.random): Move | null {
  if (state.weekComplete || state.gameOver || state.error) return null
  const player = state.turn
  const moves = legalMoves(state.schedules[player], state.drawArea)
  if (moves.length === 0) return null

  if (difficulty === 'easy') {
    const cards = state.drawArea.filter((card) => moves.some((move) => move.card.id === card.id))
    const card = cards[Math.floor(random() * cards.length)]
    const spots = moves.filter((move) => move.card.id === card.id)
    return spots[Math.floor(random() * spots.length)]
  }

  const scoreMove = (move: Move) => {
    const next = playCard(state, move.card.id, move.day, move.slot)
    const schedule = next.schedules[player]
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
      if (!next.weekComplete) {
        const remainingVisibleCards = state.drawArea.filter((card) => card.id !== move.card.id)
        const futureMoves = legalMoves(schedule, remainingVisibleCards)
        score += Math.min(futureMoves.length, 20) * 0.2
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
