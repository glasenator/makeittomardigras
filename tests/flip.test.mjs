import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  stdin: { contents: "export * from './src/gameLogic'; export * from './src/scheduleTotals'; export * from './src/computerPlayer'", resolveDir: root },
  bundle: true, write: false, format: 'esm', platform: 'node',
})
const { newGame, playCard, drawBlind, flipCard, flipTargets, canPlace, legalMoves, backValues, scheduleTotals, visibleSections, bustColumn, completedWeekTotals, chooseFlipTarget, lastPlayStatus } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

const card = (id, top = 2, bottom = 3, placedAt = 1) => ({ id, top, bottom, placedAt })
const empty = () => Array.from({ length: 7 }, () => [null, null, null])
function stateWith(incoming, schedule = empty()) {
  const cards = [incoming, ...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, top: 1, bottom: 1 }))]
  const state = newGame(2, [cards, cards, cards], () => 0)
  state.schedules[0] = schedule
  return state
}

test('top FLIP offers fully uncovered cards to left, right, and above, only in own schedule', () => {
  const schedule = empty()
  schedule[0][2] = card(1)
  schedule[2][1] = card(2)
  schedule[1][0] = card(3)
  let state = stateWith({ id: 99, top: 0, bottom: 4 }, schedule)
  state.schedules[1][0][2] = card(4)
  state = playCard(state, 99, 1, 2)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 2 }, { day: 2, slot: 1 }, { day: 1, slot: 0 }])
  assert.equal(state.turn, 0)
  assert.equal(playCard(state, state.drawArea[0].id, 0, 0), state)
  assert.equal(drawBlind(state), state)
  assert.equal(flipCard(state, 3, 0), state)
  state = flipCard(state, 1, 0)
  assert.equal(state.schedules[0][1][0].faceDown, true)
  assert.equal(state.turn, 1)
  assert.equal(state.pendingFlip, null)
})

test('bottom FLIP offers left, right, and below, excluding partially covered cards', () => {
  const schedule = empty()
  schedule[0][0] = card(1, 2, 3, 1)
  schedule[0][1] = card(2, 2, 3, 2)
  schedule[2][1] = card(3)
  schedule[1][2] = card(4)
  let state = stateWith({ id: 99, top: 1, bottom: 0 }, schedule)
  state = playCard(state, 99, 1, 0)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 1 }, { day: 2, slot: 1 }, { day: 1, slot: 2 }])
  state = flipCard(state, 0, 1)
  assert.equal(state.schedules[0][0][1].faceDown, true)
})

test('two FLIPs resolve separately and may flip the same card down and back up', () => {
  const schedule = empty()
  schedule[0][1] = card(1, 0, -3)
  let state = playCard(stateWith({ id: 99, top: 0, bottom: 0 }, schedule), 99, 1, 1)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 1 }])
  state = flipCard(state, 0, 1)
  assert.equal(state.schedules[0][0][1].faceDown, true)
  assert.equal(state.pendingFlip.halves[0], 'bottom')
  state = flipCard(state, 0, 1)
  assert.equal(state.schedules[0][0][1].faceDown, false)
  assert.equal(state.pendingFlip, null)
  assert.equal(state.turn, 1)
})

test('FLIP skips directions with no targets and no target means turn finishes normally', () => {
  let state = playCard(stateWith({ id: 99, top: 0, bottom: 0 }), 99, 0, 0)
  assert.equal(state.pendingFlip, null)
  assert.equal(state.turn, 1)
  const schedule = empty()
  schedule[0][1] = card(1)
  state = playCard(stateWith({ id: 99, top: 0, bottom: 0 }, schedule), 99, 1, 0)
  assert.equal(state.pendingFlip.halves[0], 'bottom')
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 1 }])
})

test('face-down sections score zero and accept any covering value; face-up FLIP is protected', () => {
  const schedule = empty()
  schedule[0][0] = { ...card(1, 0, -9), faceDown: true }
  assert.deepEqual(visibleSections(schedule[0]), [0, 0, null, null])
  assert.deepEqual(scheduleTotals(schedule), { money: 5, energy: 5, points: 0 })
  assert.equal(canPlace(schedule, 0, 1, { id: 9, top: 1, bottom: 2 }), true)
  assert.equal(canPlace(schedule, 0, 1, { id: 9, top: -1, bottom: 2 }), true)
  assert.equal(canPlace(schedule, 0, 0, { id: 9, top: -1, bottom: 2 }), false)
  schedule[0][0].faceDown = false
  assert.equal(canPlace(schedule, 0, 1, { id: 9, top: 1, bottom: 2 }), true)
  assert.equal(canPlace(schedule, 0, 0, { id: 9, top: 1, bottom: 2 }), false)
  schedule[0][0] = card(1, 2, 0)
  assert.equal(canPlace(schedule, 0, 1, { id: 9, top: 1, bottom: 2 }), false)
})

test('double-negative deck backs show opposite values while blind draws use original faces', () => {
  for (const orientation of [undefined, 'horizontal']) {
    const top = { id: 99, top: -2, bottom: -5, ...(orientation ? { orientation } : {}) }
    let state = stateWith({ id: 98, top: 1, bottom: 1 })
    state = { ...state, deck: [top, { id: 97, top: 2, bottom: -5 }, ...state.deck] }
    assert.deepEqual(backValues(state.deck[0]), { top: 2, bottom: 5 })
    state = drawBlind(state)
    assert.deepEqual(state.blindCard, top)
    assert.equal(backValues(state.deck[0]), null)
    state = playCard(state, 99, 0, 1)
    assert.equal(state.schedules[0][0].find((item) => item?.id === 99).faceDown, undefined)
    assert.deepEqual(scheduleTotals(state.schedules[0]), orientation
      ? { money: -2, energy: 5, points: 0 }
      : { money: 3, energy: 0, points: 0 })
  }
  for (const [top, bottom] of [[-2, 0], [0, -2], [2, -2], [-2, 2], [2, 2], [0, 0]]) {
    assert.equal(backValues({ id: 1, top, bottom }), null)
  }
})

test('FLIP turns a double-negative vertical card into positive values and back again', () => {
  const schedule = empty()
  schedule[0][1] = card(1, -2, -5)
  let state = playCard(stateWith({ id: 99, top: 0, bottom: 0 }, schedule), 99, 1, 1)
  assert.deepEqual(scheduleTotals(state.schedules[0]), { money: 3, energy: 0, points: 0 })
  state = flipCard(state, 0, 1)
  assert.deepEqual(visibleSections(state.schedules[0][0]), [null, 2, 5, null])
  assert.deepEqual(scheduleTotals(state.schedules[0]), { money: 7, energy: 10, points: 0 })
  state = flipCard(state, 0, 1)
  assert.deepEqual(visibleSections(state.schedules[0][0]), [null, -2, -5, null])
  assert.deepEqual(scheduleTotals(state.schedules[0]), { money: 3, energy: 0, points: 0 })
})

test('positive backs obey normal covering rules, including partially covered cards', () => {
  const schedule = empty()
  schedule[0][1] = { ...card(1, -2, -5), faceDown: true }
  for (const [value, allowed] of [[-1, true], [0, true], [1, false]]) {
    const upper = { id: 9, top: 1, bottom: value }
    const lower = { id: 10, top: value, bottom: 1 }
    for (const [slot, incoming] of [[0, upper], [2, lower]]) {
      assert.equal(canPlace(schedule, 0, slot, incoming), allowed)
      assert.equal(legalMoves(schedule, [incoming]).some((move) => move.day === 0 && move.slot === slot), allowed)
    }
  }
  schedule[0][0] = card(2, 1, -1, 2)
  assert.equal(canPlace(schedule, 0, 1, { id: 3, top: 1, bottom: -1 }), true)
  assert.equal(canPlace(schedule, 0, 1, { id: 3, top: 1, bottom: 1 }), false)
  assert.equal(canPlace(schedule, 0, 2, { id: 3, top: -1, bottom: 1 }), true)
  assert.equal(canPlace(schedule, 0, 2, { id: 3, top: 1, bottom: 1 }), false)
})

test('horizontal double-negative backs score by column and follow covering and bust rules', () => {
  const schedule = empty()
  schedule[0].push({ ...card(1, -3, -8), orientation: 'horizontal', row: 1 })
  let state = playCard(stateWith({ id: 99, top: 0, bottom: 1 }, schedule), 99, 0, 2)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 3 }])
  state = flipCard(state, 0, 3)
  assert.deepEqual(scheduleTotals(state.schedules[0]), { money: 16, energy: 5, points: 1 })
  assert.equal(canPlace(state.schedules[0], 1, 0, { id: 8, top: 1, bottom: -1 }), true)
  assert.equal(canPlace(state.schedules[0], 1, 0, { id: 8, top: 1, bottom: 1 }), false)
  assert.equal(canPlace(state.schedules[0], 0, 1, { id: 8, top: -1, bottom: -1, orientation: 'horizontal' }), false)
  state.schedules[0][2][1] = card(2, -20, 1)
  assert.equal(bustColumn(state.schedules[0], state.starting[0]), 2)
  state = { ...state, weekComplete: true, bustColumns: [2, null] }
  assert.deepEqual(completedWeekTotals(state)[0], { money: 16, energy: 5, points: 1 })
})

test('a face-down card can be covered and a partially covered card cannot be flipped', () => {
  const schedule = empty()
  schedule[0][0] = { ...card(1, 0, -9), faceDown: true }
  let state = playCard(stateWith({ id: 99, top: -1, bottom: 2 }, schedule), 99, 0, 1)
  assert.equal(state.schedules[0][0][0].faceDown, true)
  assert.deepEqual(visibleSections(state.schedules[0][0]), [0, -1, 2, null])
  state = { ...state, turn: 0, drawArea: [{ id: 98, top: 0, bottom: 1 }, ...state.drawArea] }
  state = playCard(state, 98, 1, 0)
  assert.equal(state.pendingFlip, null)
  assert.equal(state.schedules[0][0][0].faceDown, true)
})

test('refill and next starter wait until a mandatory FLIP is resolved', () => {
  const schedule = empty()
  schedule[0][0] = card(1)
  let state = stateWith({ id: 99, top: 0, bottom: 1 }, schedule)
  state.drawPicks[1] = { id: 50, top: 2, bottom: 2 }
  state = playCard(state, 99, 1, 0)
  assert.equal(state.drawArea.length, 2)
  assert.equal(state.turn, 0)
  state = flipCard(state, 0, 0)
  assert.equal(state.drawArea.length, 3)
  assert.equal(state.turn, 0)
  assert.deepEqual(state.drawPicks, [null, null])
})

test('blind FLIP selection delays the final turn, bust check, and game over', () => {
  const schedule = empty()
  schedule[0][0] = card(1, 2, -8)
  let state = stateWith({ id: 98, top: 1, bottom: 1 }, schedule)
  state = { ...state, week: 3, extraTurns: 1, deck: [{ id: 99, top: 0, bottom: 1 }, ...state.deck] }
  state = drawBlind(state)
  assert.equal(state.blindCard.id, 99)
  assert.equal(lastPlayStatus(state), 'last')
  state = playCard(state, 99, 1, 0)
  assert.equal(state.extraTurns, 1)
  assert.equal(state.weekComplete, false)
  assert.equal(state.gameOver, false)
  assert.equal(state.drawPicks[0], 'blind')
  state = flipCard(state, 0, 0)
  assert.equal(state.weekComplete, true)
  assert.equal(state.gameOver, true)
  assert.equal(state.bustColumns[0], null)
})

test('computers select an eligible target and favor removing a negative card', () => {
  const schedule = empty()
  schedule[0][0] = card(1, -3, -2)
  schedule[2][0] = card(2, 4, 3)
  const state = playCard(stateWith({ id: 99, top: 0, bottom: 2 }, schedule), 99, 1, 0)
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const target = chooseFlipTarget(state, difficulty, () => 0)
    assert.ok(flipTargets(state).some((item) => item.day === target.day && item.slot === target.slot))
  }
  assert.deepEqual(chooseFlipTarget(state, 'hard', () => 0), { day: 0, slot: 0 })
})
