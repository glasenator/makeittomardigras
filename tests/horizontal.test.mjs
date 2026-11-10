import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  stdin: { contents: "export * from './src/gameLogic'; export * from './src/scheduleTotals'; export * from './src/computerPlayer'", resolveDir: root },
  bundle: true, write: false, format: 'esm', platform: 'node',
})
const { newGame, startNextWeek, playCard, drawBlind, canPlace, legalMoves, flipTargets, flipCard, scheduleTotals, bustColumn, completedWeekTotals, visibleGrid, chooseComputerMove } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

const empty = () => Array.from({ length: 7 }, () => [null, null, null])
const vertical = (id, top, bottom, placedAt = 1) => ({ id, top, bottom, placedAt })
const horizontal = (id, top, bottom, row, placedAt = 1) => ({ id, top, bottom, orientation: 'horizontal', row, placedAt })
const incoming = (id, top, bottom) => ({ id, top, bottom, orientation: 'horizontal' })
function stateWith(card, schedule = empty()) {
  const cards = [card, ...Array.from({ length: 20 }, (_, i) => ({ id: i + 100, top: 1, bottom: 1 }))]
  const state = newGame(2, [cards, cards, cards])
  state.schedules[0] = schedule
  return state
}

test('horizontal placement covers two columns in one row and opens the next column', () => {
  let state = stateWith(incoming(99, -3, 5))
  assert.equal(canPlace(state.schedules[0], 0, 3, state.drawArea[0]), false)
  assert.equal(canPlace(state.schedules[0], 1, 0, state.drawArea[0]), false)
  assert.equal(canPlace(state.schedules[0], 6, 0, state.drawArea[0]), false)
  assert.deepEqual(legalMoves(state.schedules[0], [state.drawArea[0]]).map(({ day, slot }) => [day, slot]), [[0, 1], [0, 2]])
  state = playCard(state, 99, 0, 2)
  assert.deepEqual(scheduleTotals(state.schedules[0]), { money: 5, energy: 7, points: 0 })
  assert.equal(canPlace(state.schedules[0], 2, 2, { id: 8, top: 1, bottom: 1 }), true)
  assert.equal(canPlace(state.schedules[0], 2, 0, incoming(8, 1, -1)), false)
  assert.equal(canPlace(state.schedules[0], 2, 3, incoming(8, 1, -1)), false)
  assert.equal(canPlace(state.schedules[0], 2, 2, incoming(8, 1, -1)), true)
  assert.equal(state.schedules[0].flat().filter((item) => item?.id === 99).length, 1)
})

test('opening next column requires an actually adjacent section for both orientations', () => {
  for (let row = 0; row < 4; row++) {
    const schedule = empty()
    schedule[0].push(horizontal(1, 1, -1, row))
    const horizontalCard = incoming(2, 2, -2)
    const verticalCard = { id: 3, top: 2, bottom: -2 }
    assert.deepEqual([0, 1, 2, 3].map((r) => canPlace(schedule, 2, r, horizontalCard)),
      [0, 1, 2, 3].map((r) => r === row), `horizontal following row ${row}`)
    assert.deepEqual([0, 1, 2].map((slot) => canPlace(schedule, 2, slot, verticalCard)),
      [0, 1, 2].map((slot) => slot === row || slot + 1 === row), `vertical following row ${row}`)
    const moves = legalMoves(schedule, [horizontalCard, verticalCard]).filter((move) => move.day === 2)
    assert.deepEqual(moves.filter((move) => move.card.id === 2).map((move) => move.slot), [row])
  }
})

test('horizontal cards opening a column must touch a vertical card section', () => {
  for (let slot = 0; slot < 3; slot++) {
    const schedule = empty()
    schedule[0][slot] = vertical(1, 2, -2)
    assert.deepEqual([0, 1, 2, 3].map((row) => canPlace(schedule, 1, row, incoming(2, 1, -1))),
      [0, 1, 2, 3].map((row) => row === slot || row === slot + 1))
  }
})

test('cards in a column must connect to an existing section or a same-row left neighbor', () => {
  for (const down of [false, true]) {
    const schedule = empty()
    schedule[1].push({ ...horizontal(1, 2, 2, 0), faceDown: down })
    const card = { id: 99, top: -1, bottom: 1 }
    assert.equal(canPlace(schedule, 2, 2, card), false)
    assert.equal(canPlace(schedule, 2, 1, card), true)
    assert.equal(canPlace(schedule, 2, 0, card), true)
    assert.equal(legalMoves(schedule, [card]).some((move) => move.day === 2 && move.slot === 2), false)
    const state = stateWith(card, schedule)
    assert.equal(playCard(state, 99, 2, 2), state)
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (const random of [() => 0, () => 0.999]) {
        const move = chooseComputerMove(state, difficulty, random)
        assert.ok(move)
        assert.notDeepEqual([move.day, move.slot], [2, 2])
      }
    }
    schedule[1][2] = vertical(2, 1, 1)
    assert.equal(canPlace(schedule, 2, 2, card), true)
  }
})

test('horizontal placements in an occupied column cannot leave a gap', () => {
  const schedule = empty()
  schedule[1].push(horizontal(1, 2, 2, 0))
  assert.equal(canPlace(schedule, 2, 1, incoming(2, 1, -1)), true)
  assert.equal(canPlace(schedule, 2, 2, incoming(2, 1, -1)), false)
  assert.equal(canPlace(schedule, 2, 3, incoming(2, 1, -1)), false)
})

test('the first placement touches the starting values for each player and each week', () => {
  const first = incoming(99, -3, 5)
  let state = stateWith(first)
  for (const player of state.schedules) {
    assert.deepEqual([0, 1, 2, 3].map((row) => canPlace(player, 0, row, first)), [false, true, true, false])
    assert.deepEqual([0, 1, 2].map((slot) => canPlace(player, 0, slot, { id: 7, top: 1, bottom: 1 })), [true, true, true])
  }
  assert.equal(playCard(state, 99, 0, 0), state)
  assert.equal(playCard(state, 99, 0, 3), state)
  state = playCard(state, 99, 0, 1)
  assert.equal(canPlace(state.schedules[0], 0, 0, incoming(98, 1, -1)), true)
  assert.equal(canPlace(state.schedules[0], 0, 3, incoming(98, 1, -1)), false)
  assert.equal(canPlace(state.schedules[1], 0, 0, first), false)
  state = startNextWeek({ ...state, weekComplete: true })
  assert.equal(state.week, 2)
  for (const player of state.schedules) {
    assert.deepEqual([0, 1, 2, 3].map((row) => canPlace(player, 0, row, first)), [false, true, true, false])
  }
})

test('blind and computer first moves respect the starting rows', () => {
  let state = stateWith({ id: 98, top: 1, bottom: 1 })
  state = drawBlind({ ...state, deck: [incoming(99, -2, 2), ...state.deck] })
  assert.equal(playCard(state, 99, 0, 0), state)
  assert.equal(playCard(state, 99, 0, 3), state)
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const move = chooseComputerMove(state, difficulty, () => 0)
    assert.equal(move.day, 0)
    assert.ok(move.slot === 1 || move.slot === 2)
  }
})

test('both horizontal halves must follow overlap rules and face-up FLIPs block covering', () => {
  const schedule = empty()
  schedule[0][0] = vertical(1, 3, -2)
  schedule[1][0] = vertical(2, -4, 1)
  assert.equal(canPlace(schedule, 0, 0, incoming(9, -1, 1)), true)
  assert.equal(canPlace(schedule, 0, 0, incoming(9, -1, -1)), false)
  schedule[1][0].top = 0
  assert.equal(canPlace(schedule, 0, 0, incoming(9, -1, 1)), false)
  schedule[1][0].faceDown = true
  assert.equal(canPlace(schedule, 0, 0, incoming(9, -1, -1)), true)
})

test('one play cannot cover both visible sections of a card in either orientation', () => {
  for (const faceDown of [false, true]) {
    for (const row of [0, 1, 2, 3]) {
      const schedule = empty()
      schedule[0].push({ ...horizontal(1, 2, -2, row), faceDown })
      const whole = incoming(99, -5, 5)
      assert.equal(canPlace(schedule, 0, row, whole), false)
      assert.equal(legalMoves(schedule, [whole]).some((move) => move.day === 0 && move.slot === row), false)
      const state = stateWith(whole, schedule)
      assert.equal(playCard(state, 99, 0, row), state)
      const verticalSlot = Math.min(row, 2)
      assert.equal(canPlace(schedule, 0, verticalSlot, { id: 8, top: -1, bottom: -1 }), true)
    }
    for (const slot of [0, 1, 2]) {
      const schedule = empty()
      schedule[0][slot] = { ...vertical(1, 2, -2), faceDown }
      const whole = { id: 99, top: -5, bottom: 5 }
      assert.equal(canPlace(schedule, 0, slot, whole), false)
      assert.equal(legalMoves(schedule, [whole]).some((move) => move.day === 0 && move.slot === slot), false)
      const state = stateWith(whole, schedule)
      assert.equal(playCard(state, 99, 0, slot), state)
      assert.equal(canPlace(schedule, 0, slot, incoming(8, -1, -1)), true)
    }
  }
})

test('a horizontal card cannot directly replace a visible card in columns two and three', () => {
  const schedule = empty()
  schedule[1].push(horizontal(1, 2, -2, 1))
  const card = incoming(99, -5, 5)
  const state = stateWith(card, schedule)
  assert.equal(canPlace(schedule, 1, 1, card), false)
  assert.equal(playCard(state, 99, 1, 1), state)
  assert.equal(playCard({ ...state, blindCard: card }, 99, 1, 1).blindCard, card)
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const move = chooseComputerMove({ ...state, drawArea: [card] }, difficulty, () => 0)
    assert.ok(move)
    assert.notDeepEqual([move.day, move.slot], [1, 1])
  }
})

test('separate face-down cards can each be partially covered in one play', () => {
  const schedule = empty()
  schedule[0][0] = { ...vertical(1, 1, 1), faceDown: true }
  schedule[1][0] = { ...vertical(2, 1, 1), faceDown: true }
  assert.equal(canPlace(schedule, 0, 1, incoming(99, 1, -1)), true)
  const state = playCard(stateWith(incoming(99, 1, -1), schedule), 99, 0, 1)
  assert.equal(state.schedules[0][0][3].id, 99)
})

test('a partially covered face-down card can be overlapped and replaced legally', () => {
  const schedule = empty()
  schedule[0][0] = { ...vertical(1, 1, -1), faceDown: true }
  schedule[0][1] = vertical(2, -1, 1, 2)
  const card = { id: 99, top: -1, bottom: 1 }
  assert.equal(canPlace(schedule, 0, 0, card), true)
  const state = playCard(stateWith(card, schedule), 99, 0, 0)
  assert.ok(state.setAside.some((item) => item.id === 1))
  assert.equal(state.schedules[0][0][0].id, 99)
})

test('a partially covered card can be replaced without considering hidden sections', () => {
  const schedule = empty()
  schedule[0][0] = vertical(1, 3, 4)
  schedule[0][1] = vertical(2, -1, 2, 2)
  const card = { id: 99, top: -1, bottom: 2 }
  assert.equal(canPlace(schedule, 0, 0, card), true)
  const state = playCard(stateWith(card, schedule), 99, 0, 0)
  assert.ok(state.setAside.some((item) => item.id === 1))
  assert.equal(visibleGrid(state.schedules[0])[0][0].card.id, 99)
})

test('horizontal FLIP points above, below, and outward and toggles a whole target', () => {
  const schedule = empty()
  schedule[0][1] = vertical(1, 2, 2)
  schedule[1][0] = vertical(2, 2, 2)
  schedule[1].push(horizontal(3, -2, 3, 3))
  let state = playCard(stateWith(incoming(99, 0, 2), schedule), 99, 1, 2)
  assert.deepEqual(flipTargets(state), [{ day: 1, slot: 0 }, { day: 1, slot: 3 }, { day: 0, slot: 1 }])
  state = flipCard(state, 1, 3)
  assert.equal(state.schedules[0][1][3].faceDown, true)
  assert.equal(state.pendingFlip, null)
  assert.deepEqual(scheduleTotals(state.schedules[0]), { money: 9, energy: 9, points: 2 })
})

test('double horizontal FLIP resolves left then right, and may flip the same adjacent horizontal card twice', () => {
  const schedule = empty()
  schedule[0].push(horizontal(1, 2, 3, 0))
  let state = playCard(stateWith(incoming(99, 0, 0), schedule), 99, 0, 1)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 3 }])
  state = flipCard(state, 0, 3)
  assert.equal(state.schedules[0][0][3].faceDown, true)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 3 }])
  state = flipCard(state, 0, 3)
  assert.equal(state.schedules[0][0][3].faceDown, false)
  assert.equal(state.turn, 1)
})

test('right horizontal FLIP points above, below, and right', () => {
  const schedule = empty()
  schedule[0][0] = vertical(1, 1, 1)
  schedule[2][0] = vertical(2, 1, 1)
  schedule[1].push(horizontal(3, 1, 1, 3))
  schedule[3][1] = vertical(4, 1, 1)
  const state = playCard(stateWith(incoming(99, 2, 0), schedule), 99, 1, 2)
  assert.deepEqual(flipTargets(state), [{ day: 2, slot: 0 }, { day: 1, slot: 3 }, { day: 3, slot: 1 }])
})

test('a horizontal card may reuse a hidden footprint when it covers two different visible cards', () => {
  const schedule = empty()
  schedule[0].push(horizontal(1, 2, -3, 1))
  schedule[0][0] = vertical(2, 1, -2, 2)
  schedule[1][0] = vertical(3, 1, 3, 3)
  const card = incoming(99, 2, -3)
  assert.equal(canPlace(schedule, 0, 1, card), true)
  const state = playCard(stateWith(card, schedule), 99, 0, 1)
  assert.deepEqual(state.schedules[0][0].filter(Boolean).map((card) => card.id), [2, 1, 99])
  assert.equal(state.setAside.length, 0)
  assert.equal(visibleGrid(state.schedules[0])[0][1].card.id, 99)
  assert.equal(visibleGrid(state.schedules[0])[1][1].card.id, 99)
})

test('vertical FLIPs can target an uncovered horizontal card but not a partially covered one', () => {
  const schedule = empty()
  schedule[0].push(horizontal(1, 2, 3, 0))
  let state = playCard(stateWith({ id: 99, top: 0, bottom: 2 }, schedule), 99, 1, 1)
  assert.deepEqual(flipTargets(state), [{ day: 0, slot: 3 }])
  state = flipCard(state, 0, 3)
  assert.equal(state.schedules[0][0][3].faceDown, true)
  schedule[0][0] = vertical(2, -1, 1, 2)
  state = playCard(stateWith({ id: 99, top: 0, bottom: 2 }, schedule), 99, 1, 1)
  assert.ok(!flipTargets(state).some((target) => target.day === 0 && target.slot === 3))
})

test('Sunday and Monday do not trigger final turns; Tuesday vertical placement does', () => {
  const schedule = empty()
  schedule[2][0] = vertical(1, 1, 1)
  let state = playCard(stateWith(incoming(99, 2, -2), schedule), 99, 3, 0)
  assert.equal(state.extraTurns, null)
  assert.equal(state.weekComplete, false)
  state = { ...state, turn: 0, drawArea: [{ id: 98, top: 3, bottom: 2 }, ...state.drawArea] }
  state = playCard(state, 98, 4, 0)
  assert.equal(state.extraTurns, null)
  state = { ...state, turn: 0, drawArea: [incoming(97, 2, -2), ...state.drawArea] }
  state = playCard(state, 97, 5, 0)
  assert.equal(state.schedules[0][5][3].id, 97)
  assert.equal(state.extraTurns, null)
  state = { ...state, turn: 0, drawArea: [{ id: 96, top: 3, bottom: 2 }, ...state.drawArea] }
  state = playCard(state, 96, 6, 1)
  assert.equal(state.finalTurnTrigger, 0)
  assert.equal(state.extraTurns, null)
})

test('a horizontal card scores its earlier section across the bust boundary', () => {
  const schedule = empty()
  schedule[0].push(horizontal(1, 4, -10, 1))
  assert.deepEqual(scheduleTotals(schedule), { money: -1, energy: 5, points: 0 })
  assert.equal(bustColumn(schedule, { money: 5, energy: 5, points: 0 }), 1)
  assert.deepEqual(scheduleTotals(schedule, { money: 5, energy: 5, points: 0 }, 1), { money: 9, energy: 5, points: 0 })
  let state = stateWith({ id: 99, top: 1, bottom: -1 }, schedule)
  state = { ...state, extraTurns: 1 }
  state = playCard(state, 99, 2, 0)
  assert.equal(state.weekComplete, true)
  assert.equal(state.bustColumns[0], 1)
  assert.equal(state.schedules[0][0][3].faceDown, undefined)
  assert.equal(state.schedules[0][2][0].faceDown, undefined)
  assert.equal(completedWeekTotals(state)[0].money, 9)
  assert.equal(startNextWeek(state).starting[0].money, 9)
})

test('busting preserves card faces and excludes only affected columns', () => {
  for (const resource of ['money', 'energy']) {
    const schedule = empty()
    schedule[0][0] = vertical(1, 2, 1)
    schedule[1][1] = vertical(2, resource === 'money' ? -10 : 1, resource === 'energy' ? -10 : 1)
    schedule[2][0] = { ...vertical(3, 5, 5), faceDown: true }
    schedule[2][1] = vertical(4, 1, 1, 2)
    schedule[3].push(horizontal(5, 2, 2, 3))
    const initial = structuredClone(schedule)
    let state = stateWith({ id: 99, top: 1, bottom: 1 }, schedule)
    state = { ...state, turn: 1, extraTurns: 1 }
    state = playCard(state, 99, 0, 0)
    assert.equal(state.weekComplete, true)
    assert.equal(state.bustColumns[0], 1)
    assert.equal(state.schedules[0][0][0].faceDown, undefined)
    assert.deepEqual(state.schedules[0], initial)
    assert.deepEqual(schedule, initial)
    assert.deepEqual(completedWeekTotals(state)[0], { money: 6, energy: 5, points: 2 })
  }
})

test('a crossing card scores points in the earlier column but not the busted column', () => {
  const schedule = empty()
  schedule[0].push(horizontal(1, 7, 9, 0))
  schedule[1][1] = vertical(2, -6, 1)
  let state = stateWith({ id: 99, top: 1, bottom: 1 }, schedule)
  state = playCard({ ...state, turn: 1, extraTurns: 1, week: 3 }, 99, 0, 0)
  assert.equal(state.gameOver, true)
  assert.equal(state.bustColumns[0], 1)
  assert.deepEqual(completedWeekTotals(state)[0], { money: 5, energy: 5, points: 7 })
  assert.equal(state.schedules[0][0][3].faceDown, undefined)
})

test('bust calculation uses the final visible grid when examining earlier columns', () => {
  const schedule = empty()
  schedule[0].push(horizontal(1, -8, 2, 1, 1))
  schedule[0][0] = vertical(2, 1, 4, 2)
  schedule[1][1] = vertical(3, -10, 1, 3)
  assert.equal(bustColumn(schedule, { money: 5, energy: 5, points: 0 }), 1)
  assert.deepEqual(scheduleTotals(schedule, { money: 5, energy: 5, points: 0 }, 1), { money: 9, energy: 5, points: 1 })
})

test('blind draws and computer moves accept horizontal cards without mutating state', () => {
  let state = stateWith({ id: 98, top: 1, bottom: 1 })
  state = { ...state, deck: [incoming(99, -2, 2), ...state.deck] }
  state = drawBlind(state)
  assert.equal(state.blindCard.orientation, 'horizontal')
  const snapshot = structuredClone(state)
  const move = chooseComputerMove(state, 'hard', () => 0)
  assert.ok(move)
  assert.deepEqual(state, snapshot)
  state = playCard(state, move.card.id, move.day, move.slot)
  assert.equal(state.schedules[0].flat().filter((card) => card?.id === 99).length, 1)
  assert.equal(state.drawPicks[0], 'blind')
})
