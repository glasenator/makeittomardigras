import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const result = await build({
  entryPoints: [
    fileURLToPath(new URL('../src/computerPlayer.ts', import.meta.url)),
    fileURLToPath(new URL('../src/gameLogic.ts', import.meta.url)),
    fileURLToPath(new URL('../src/scheduleTotals.ts', import.meta.url)),
  ],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  outdir: 'out',
})
const load = (name) => import(`data:text/javascript;base64,${Buffer.from(
  result.outputFiles.find((file) => file.path.endsWith(`/${name}.js`)).text,
).toString('base64')}`)
const { chooseBlindDraw, chooseComputerMove, chooseFlipTarget } = await load('computerPlayer')
const { drawBlind, finalScore, legalMoves, newGame, playCard } = await load('gameLogic')
const { bustColumn, scheduleTotals } = await load('scheduleTotals')

const cards = [
  { id: 1, top: 4, bottom: 1 },
  { id: 2, top: 2, bottom: 0 },
  { id: 3, top: -1, bottom: 2 },
  { id: 4, top: 3, bottom: 1 },
  { id: 5, top: 5, bottom: 0 },
  { id: 6, top: 0, bottom: 4 },
  { id: 7, top: 1, bottom: 1 },
]
const game = () => ({ ...newGame(2, [cards, cards, cards], () => 0), turn: 1 })

test('easy selects a random playable card and then a random legal position', () => {
  const state = game()
  const values = [0.9, 0.9]
  const move = chooseComputerMove(state, 'easy', () => values.shift())
  assert.equal(move.card.id, 3)
  assert.equal(move.day, 0)
  assert.equal(move.slot, 2)
})

test('all difficulties choose valid moves without mutating state', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const state = game()
    const before = structuredClone(state)
    const move = chooseComputerMove(state, difficulty, () => 0)
    assert.ok(legalMoves(state.schedules[1], state.drawArea).some((m) =>
      m.card.id === move.card.id && m.day === move.day && m.slot === move.slot))
    const next = playCard(state, move.card.id, move.day, move.slot)
    assert.equal(next.schedules[1][move.day][move.slot].id, move.card.id)
    assert.deepEqual(state, before)
    assert.equal(chooseComputerMove({ ...state, weekComplete: true }, difficulty), null)
    assert.equal(chooseComputerMove({ ...state, drawArea: [] }, difficulty), null)
  }
})

test('medium favors visible victory points and avoids negative resources', () => {
  const state = game()
  state.drawArea = [
    { id: 21, top: 8, bottom: 0 },
    { id: 22, top: 2, bottom: 0 },
    { id: 23, top: 7, bottom: -20 },
  ]
  const move = chooseComputerMove(state, 'medium', () => 0)
  const next = playCard(state, move.card.id, move.day, move.slot)
  const totals = scheduleTotals(next.schedules[1], state.starting[1])
  assert.equal(totals.points, 8)
  assert.ok(totals.money >= 0 && totals.energy >= 0)
})

test('hard chooses a non-busting placement over a tempting point gain', () => {
  const state = game()
  state.schedules[1][0][0] = { id: 30, top: -1, bottom: -6, placedAt: 1 }
  state.drawArea = [
    { id: 21, top: 10, bottom: -2 },
    { id: 22, top: -5, bottom: 0 },
    { id: 23, top: -3, bottom: 4 },
  ]
  const medium = chooseComputerMove(state, 'medium', () => 0)
  const mediumNext = playCard(state, medium.card.id, medium.day, medium.slot)
  const move = chooseComputerMove(state, 'hard', () => 0)
  const next = playCard(state, move.card.id, move.day, move.slot)
  assert.equal(bustColumn(mediumNext.schedules[1], state.starting[1]), 0)
  assert.equal(bustColumn(next.schedules[1], state.starting[1]), null)
})

test('hard preserves more future placements when immediate points are equal', () => {
  const state = game()
  state.schedules[1][0][0] = { id: 90, top: 3, bottom: 3, placedAt: 1 }
  state.drawArea = [
    { id: 101, top: -6, bottom: 2 },
    { id: 102, top: -2, bottom: 0 },
    { id: 103, top: 0, bottom: 0 },
  ]
  const medium = chooseComputerMove(state, 'medium', () => 0)
  const hard = chooseComputerMove(state, 'hard', () => 0)
  const evaluate = (move) => {
    const schedule = playCard(state, move.card.id, move.day, move.slot).schedules[1]
    return {
      totals: scheduleTotals(schedule, state.starting[1]),
      options: legalMoves(schedule, state.drawArea.filter((card) => card.id !== move.card.id)).length,
    }
  }
  const mediumResult = evaluate(medium)
  const hardResult = evaluate(hard)
  assert.equal(hardResult.totals.points, mediumResult.totals.points)
  assert.ok(hardResult.options > mediumResult.options)
})

test('hard avoids starting final turns while behind when an equivalent earlier placement is available', () => {
  const state = game()
  state.starting[0].points = 100
  for (let day = 0; day < 6; day++) {
    state.schedules[1][day][0] = { id: 100 + day, top: 2, bottom: 1, placedAt: 1 }
  }
  state.drawArea = [{ id: 201, top: 0, bottom: 6 }]
  const move = chooseComputerMove(state, 'hard', () => 0)
  assert.notEqual(move.day, 6)
  assert.equal(move.slot, 2)
})

test('medium and hard optimize final score instead of accumulating unused resources in week three', () => {
  const state = { ...game(), week: 3, drawArea: [{ id: 21, top: 2, bottom: 3 }, { id: 22, top: 2, bottom: -3 }] }
  for (const difficulty of ['medium', 'hard']) {
    const move = chooseComputerMove(state, difficulty, () => 0)
    const next = playCard(state, move.card.id, move.day, move.slot)
    assert.equal(move.card.id, 22)
    assert.equal(finalScore(scheduleTotals(next.schedules[1], state.starting[1])), -5)
  }
})

test('week-three computer FLIP choices account for the final resource penalty', () => {
  const state = { ...game(), week: 3 }
  state.schedules[1][0][1] = { id: 101, top: 5, bottom: 5, placedAt: 1 }
  state.schedules[1][2][1] = { id: 102, top: 1, bottom: 1, placedAt: 1 }
  state.schedules[1][1][1] = { id: 103, top: 0, bottom: 1, placedAt: 1 }
  state.pendingFlip = { player: 1, day: 1, slot: 1, halves: ['top'], extraTurnsAfter: null }
  for (const difficulty of ['medium', 'hard']) {
    assert.deepEqual(chooseFlipTarget(state, difficulty, () => 0), { day: 0, slot: 1 })
  }
})

test('medium and hard choices do not depend on hidden deck order or card values', () => {
  const state = game()
  const differentDeck = { ...state, deck: state.deck.map((card) => ({ ...card, top: -900, bottom: 800 })).reverse() }
  for (const difficulty of ['medium', 'hard']) {
    assert.deepEqual(chooseComputerMove(state, difficulty, () => 0), chooseComputerMove(differentDeck, difficulty, () => 0))
  }
})

test('computers can choose blind without inspecting hidden cards and must play the revealed card', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const state = game()
    const altered = { ...state, deck: state.deck.map((card) => ({ ...card, top: -900, bottom: 800 })).reverse() }
    assert.equal(chooseBlindDraw(state, difficulty, () => 0), true)
    assert.equal(chooseBlindDraw(altered, difficulty, () => 0), true)
    assert.equal(chooseBlindDraw(state, difficulty, () => 0.99), false)
    assert.equal(chooseBlindDraw({ ...state, deck: [] }, difficulty, () => 0), false)
    const revealed = drawBlind(state)
    const move = chooseComputerMove(revealed, difficulty, () => 0)
    assert.equal(move.card.id, revealed.blindCard.id)
    assert.equal(playCard(revealed, move.card.id, move.day, move.slot).schedules[1][move.day][move.slot].id, move.card.id)
  }
})
