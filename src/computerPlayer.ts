import { finalScore, flipCard, flipTargets, legalMoves, playCard, sundayCardCount, WEEKS, type GameState } from './gameLogic'
import { bustColumn, scheduleTotals } from './scheduleTotals'

export type Difficulty = 'easy' | 'medium' | 'hard'
type Move = ReturnType<typeof legalMoves>[number]

export function chooseBlindDraw(state: GameState, difficulty: Difficulty, random: () => number = Math.random): boolean {
  if (state.weekComplete || state.gameOver || state.error || state.pendingFlip || state.blindCard || state.deck.length === 0) return false
  if (legalMoves(state.schedules[state.turn], state.drawArea).length === 0) return true
  const chance = { easy: 0.25, medium: 0.15, hard: 0.02 }[difficulty]
  return random() < chance
}

export function chooseFlipTarget(state: GameState, difficulty: Difficulty, random: () => number = Math.random) {
  const targets = flipTargets(state)
  if (!state.pendingFlip || targets.length === 0) return null
  if (difficulty === 'easy') return targets[Math.floor(random() * targets.length)]
  const player = state.pendingFlip.player
  let best = -Infinity
  let choices = targets.slice(0, 0)
  for (const target of targets) {
    const next = flipCard(state, target.day, target.slot)
    const schedule = next.schedules[player]
    const cutoff = bustColumn(schedule, state.starting[player])
    const totals = scheduleTotals(schedule, state.starting[player], cutoff)
    const score = state.week === WEEKS
      ? finalScore(totals) * 4 + sundayCardCount(schedule) * 0.1
      : totals.points * 4 + Math.min(totals.money, 10) * 0.4 + Math.min(totals.energy, 10) * 0.4
    if (score > best) { best = score; choices = [target] }
    else if (score === best) choices.push(target)
  }
  return choices[Math.floor(random() * choices.length)]
}

function resolveFlips(state: GameState, difficulty: Difficulty): GameState {
  let next = state
  while (next.pendingFlip) {
    const target = chooseFlipTarget(next, difficulty, () => 0)
    if (!target) throw new Error('Pending FLIP has no eligible target.')
    next = flipCard(next, target.day, target.slot)
  }
  return next
}

export function chooseComputerMove(state: GameState, difficulty: Difficulty, random: () => number = Math.random): Move | null {
  if (state.weekComplete || state.gameOver || state.error || state.pendingFlip) return null
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
    if (state.week === WEEKS) {
      const cutoff = bustColumn(schedule, starting)
      const safeTotals = scheduleTotals(schedule, starting, cutoff)
      return finalScore(safeTotals) * 4 + sundayCardCount(schedule) * 0.1
    }
    const resourceScore = (value: number) => value < 0 ? value * 12 : Math.min(value, 10) * 0.4
    let score = totals.points * 4 + resourceScore(totals.money) + resourceScore(totals.energy)

    if (difficulty === 'hard') {
      const cutoff = bustColumn(schedule, starting)
      const safeTotals = scheduleTotals(schedule, starting, cutoff)
      score += (safeTotals.points - totals.points) * 4
      let running = { ...starting }
      for (let day = 0; day < schedule.length; day++) {
        running = scheduleTotals(schedule, starting, day + 1)
        score -= Math.max(0, -running.money) * 3 + Math.max(0, -running.energy) * 3
      }
    }
    return score
  }

  const scoreMove = (move: Move) => {
    const next = resolveFlips(playCard(state, move.card.id, move.day, move.slot), difficulty)
    const schedule = next.schedules[player]
    let score = evaluateSchedule(schedule)
    if (difficulty === 'hard') {
      const remainingVisibleCards = state.drawArea.filter((card) => state.blindCard || card.id !== move.card.id)
      const futureMoves = legalMoves(schedule, remainingVisibleCards)
      if (!next.weekComplete && !next.error && state.extraTurns !== 1 && futureMoves.length > 0) {
        let bestFuture = -Infinity
        const futureState = { ...next, turn: player, drawArea: remainingVisibleCards, blindCard: null }
        for (const future of futureMoves) {
          const simulated = resolveFlips(playCard(futureState, future.card.id, future.day, future.slot), difficulty)
          bestFuture = Math.max(bestFuture, evaluateSchedule(simulated.schedules[player]))
        }
        score += 0.35 * (bestFuture - score)
        score += Math.min(futureMoves.length, 20) * 0.2
      }
      if (state.extraTurns === null && move.day === schedule.length - 1 && move.card.orientation !== 'horizontal') {
        const ownCutoff = bustColumn(schedule, state.starting[player])
        const ownTotals = scheduleTotals(schedule, state.starting[player], ownCutoff)
        const ownPoints = state.week === WEEKS ? finalScore(ownTotals) : ownTotals.points
        const bestOpponent = Math.max(...state.schedules.map((other, i) =>
          i === player ? -Infinity : (() => {
            const totals = scheduleTotals(other, state.starting[i], bustColumn(other, state.starting[i]))
            return state.week === WEEKS ? finalScore(totals) : totals.points
          })(),
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
