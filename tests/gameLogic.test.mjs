import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/gameLogic.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
})
const { canPlace, completedWeekTotals, drawBlind, lastPlayStatus, legalMoves, newGame: createGame, playCard, startNextWeek, winningPlayers } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
)
const { visibleSections } = await import(
  `data:text/javascript;base64,${Buffer.from((await build({
    entryPoints: [fileURLToPath(new URL('../src/scheduleTotals.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
  })).outputFiles[0].text).toString('base64')}`
)

const deck = (length) => Array.from({ length }, (_, i) => ({ id: i + 1, top: i + 1, bottom: i + 2 }))
const newGame = (players, cards) => createGame(players, [cards, cards.map((c) => ({ ...c })), cards.map((c) => ({ ...c }))])
const pick = (state, day, slot) => {
  const [card, ...rest] = state.drawArea
  const column = state.schedules[state.turn][day]
  const visible = visibleSections(column)
  const opposite = (value, existing) =>
    existing === null || existing === 0 ? value : existing > 0 ? -Math.abs(value) : Math.abs(value)
  const adjusted = { ...card, top: opposite(card.top, visible[slot]), bottom: opposite(card.bottom, visible[slot + 1]) }
  const prepared = { ...state, drawArea: [adjusted, ...rest] }
  const result = playCard(prepared, adjusted.id, day, slot)
  return result === prepared ? state : result
}
const neutral = { id: -1, top: 0, bottom: 0 }
const allCards = (state) => [
  ...state.deck,
  ...state.drawArea,
  ...state.setAside,
  ...state.schedules.flat(2).filter(Boolean),
]

test('refill retains the last card and deals exactly one new card per player', () => {
  for (let players = 2; players <= 5; players++) {
    const cards = deck(players * 3 + 1)
    let state = newGame(players, cards)
    const leftover = state.drawArea[players]
    for (let i = 0; i < players; i++) state = playCard(state, state.drawArea[0].id, 0, 0)
    assert.deepEqual(state.drawArea, [leftover, ...cards.slice(players + 1, 2 * players + 1)])
    assert.deepEqual(state.deck, cards.slice(2 * players + 1))
    assert.deepEqual(state.setAside, [])
    assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), cards.map((card) => card.id))
    const picker = state.turn
    state = playCard(state, leftover.id, 1, 0)
    assert.equal(state.schedules[picker][1][0].id, leftover.id)
    assert.equal(state.drawPicks[picker].id, leftover.id)
  }
})

test('unpicked cards can persist across multiple refills', () => {
  const cards = deck(9)
  let state = newGame(2, cards)
  const leftover = state.drawArea[2]
  for (let draw = 0; draw < 3; draw++) {
    state = playCard(state, state.drawArea[draw === 0 ? 0 : 1].id, draw, 0)
    state = playCard(state, state.drawArea[draw === 0 ? 0 : 1].id, draw, 0)
    assert.equal(state.drawArea[0].id, leftover.id)
    assert.equal(state.drawArea.length, 3)
  }
  assert.equal(state.deck.length, 0)
  assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), cards.map((card) => card.id))
})

test('a week ends only when fewer than the required new cards remain in the deck', () => {
  for (let players = 2; players <= 5; players++) {
    const cards = deck(2 * players + 1)
    let state = newGame(players, cards)
    for (let i = 0; i < players; i++) state = playCard(state, state.drawArea[0].id, 0, 0)
    assert.equal(state.weekComplete, false)
    assert.equal(state.deck.length, 0)
    assert.equal(state.drawArea.length, players + 1)
    for (let i = 0; i < players; i++) state = playCard(state, state.drawArea[0].id, 1, 0)
    assert.equal(state.weekComplete, true)
    assert.equal(state.drawArea.length, 1)
    assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), cards.map((card) => card.id))
  }
})

test('a short deck ends a week, carrying scores and resources to the next deck', () => {
  const cards = deck(6)
  let state = newGame(2, cards)
  state = pick(state, 0, 0)
  state = pick(state, 0, 0)
  assert.equal(state.week, 1)
  assert.equal(state.setAside.length, 0)
  state = pick(state, 1, 0)
  state = pick(state, 1, 0)

  assert.equal(state.weekComplete, true)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
  assert.equal(state.turn, 0)
  assert.equal(state.drawArea.length, 3)
  assert.deepEqual(state.starting, [
    { money: 11, energy: 5, points: 4 },
    { money: 13, energy: 5, points: 6 },
  ])
  assert.equal(state.schedules.flat(2).filter(Boolean).length, 0)
  assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), cards.map((card) => card.id))
})

test('fifth-column placement grants exactly one more turn to each player', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  for (let day = 0; day < 4; day++) {
    state = pick(state, day, 0)
    state = pick(state, day, 0)
  }
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 2)
  assert.equal(state.turn, 1)
  state = pick(state, 4, 0)
  assert.equal(state.week, 1)
  assert.equal(state.extraTurns, 1)
  assert.equal(state.turn, 0)
  state = pick(state, 4, 1)
  assert.equal(state.weekComplete, true)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
  assert.equal(state.extraTurns, null)
  assert.equal(state.starting[0].points > 0, true)
  assert.equal(allCards(state).length, cards.length)
})

test('game ends after the third week and retains final schedules and scores', () => {
  const cards = deck(4)
  let state = newGame(2, cards)
  for (let week = 1; week <= 3; week++) {
    assert.equal(state.week, week)
    state = pick(state, 0, 0)
    state = pick(state, 0, 0)
    assert.equal(state.gameOver, week === 3)
    if (week < 3) state = startNextWeek(state)
  }
  assert.equal(state.week, 3)
  assert.equal(state.schedules.flat(2).filter(Boolean).length, 2)
  assert.equal(playCard(state, state.drawArea[0].id, 1, 0), state)
})

test('the last available card can complete the extra turns', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  for (let day = 0; day < 4; day++) {
    state = pick(state, day, 0)
    state = pick(state, day, 0)
  }
  state = { ...state, deck: [] }
  state = pick(state, 4, 0)
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 1)
  assert.equal(state.drawArea.length, 1)
  state = pick(state, 4, 1)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
})

test('shortage during extra turns is explicit and does not end the week early', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  for (let day = 0; day < 4; day++) {
    state = pick(state, day, 0)
    state = pick(state, day, 0)
  }
  state = { ...state, deck: [], drawArea: state.drawArea.slice(0, 2) }
  state = pick(state, 4, 0)
  assert.equal(state.week, 1)
  assert.equal(state.extraTurns, 2)
  assert.match(state.error, /Not enough cards/)
})

test('five players each receive one additional turn after a fifth-column placement', () => {
  const cards = deck(100)
  let state = newGame(5, cards)
  for (let day = 0; day < 4; day++) {
    for (let player = 0; player < 5; player++) state = pick(state, day, 0)
  }
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 5)
  for (let player = 1; player < 5; player++) {
    assert.equal(state.turn, player)
    state = pick(state, 4, 0)
    assert.equal(state.week, 1)
  }
  assert.equal(state.extraTurns, 1)
  assert.equal(state.turn, 0)
  state = pick(state, 4, 1)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
  assert.equal(allCards(state).length, 100)
})

test('too-small decks and invalid placements are handled without losing cards', () => {
  assert.match(newGame(5, deck(5)).error, /at least 6 cards/)
  const cards = deck(8)
  const state = newGame(2, cards)
  assert.equal(playCard(state, state.drawArea[0].id, 1, 0), state)
  assert.equal(playCard(state, 999, 0, 0), state)
})

test('later cards are on top regardless of slot order and layering resets next week', () => {
  const cards = deck(6)
  let state = newGame(2, cards)
  state = pick(state, 0, 0)
  state = pick(state, 0, 0)
  state = pick(state, 0, 1)
  assert.equal(state.schedules[0][0][0].placedAt, 1)
  assert.equal(state.schedules[0][0][1].placedAt, 2)
  state = pick(state, 0, 1)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
  assert.deepEqual(state.starting[0], { money: 2, energy: 9, points: 1 })
  assert.ok(allCards(state).every((card) => !('placedAt' in card)))
})

test('partially and fully covered cards may be replaced repeatedly', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  state = pick(state, 0, 1)
  state = pick(state, 0, 0)
  assert.equal(canPlace(state.schedules[0], 0, 1, neutral), false)
  assert.equal(pick(state, 0, 1), state)
  state = pick(state, 0, 0)
  state = pick(state, 0, 1)
  assert.equal(canPlace(state.schedules[0], 0, 1, neutral), true)
  state = pick(state, 0, 2)
  state = pick(state, 0, 2)
  if (state.turn !== 0) {
    const move = legalMoves(state.schedules[state.turn], state.drawArea)[0]
    state = playCard(state, move.card.id, move.day, move.slot)
  }
  const column = state.schedules[0][0]
  assert.equal(canPlace(state.schedules[0], 0, 1, neutral), true)
  assert.equal(canPlace(state.schedules[0], 0, 0, neutral), false)
  assert.equal(canPlace(state.schedules[0], 0, 2, neutral), false)
  const oldCard = column[1]
  const replacement = state.drawArea[0]
  state = pick(state, 0, 1)
  assert.equal(state.schedules[0][0][1].id, replacement.id)
  assert.ok(state.schedules[0][0][1].placedAt > state.schedules[0][0][0].placedAt)
  assert.ok(state.schedules[0][0][1].placedAt > state.schedules[0][0][2].placedAt)
  assert.ok(state.setAside.some((card) => card.id === oldCard.id))
  assert.equal(canPlace(state.schedules[0], 0, 1, neutral), false)
  assert.equal(canPlace(state.schedules[0], 0, 0, neutral), true)
  assert.equal(canPlace(state.schedules[0], 0, 2, neutral), true)
  if (state.turn !== 0) {
    const move = legalMoves(state.schedules[state.turn], state.drawArea)[0]
    state = playCard(state, move.card.id, move.day, move.slot)
  }
  const top = state.schedules[0][0][0]
  const newTop = state.drawArea[0]
  state = pick(state, 0, 0)
  assert.equal(state.schedules[0][0][0].id, newTop.id)
  assert.ok(state.setAside.some((card) => card.id === top.id))
  assert.equal(canPlace(state.schedules[0], 0, 1, neutral), true)
  assert.equal(canPlace(state.schedules[0], 0, 0, neutral), false)
  assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), cards.map((card) => card.id))
})

test('only newer neighbors cover a card when replacing a slot', () => {
  const card = (id, placedAt) => ({ id, top: 1, bottom: 1, placedAt })
  const blocked = [[card(1, 1), card(2, 2), card(3, 3)], [null, card(4, 1), null]]
  assert.equal(canPlace(blocked, 0, 1, neutral), true)
  assert.equal(canPlace(blocked, 0, 0, neutral), true)
  assert.equal(canPlace(blocked, 0, 2, neutral), false)
  const covered = [[card(1, 2), card(2, 1), card(3, 3)]]
  assert.equal(canPlace(covered, 0, 1, neutral), true)
  assert.equal(canPlace([[], covered[0]], 1, 1, neutral), true)
})

test('left adjacency is required only when placing the first card in a column', () => {
  const top = { id: 101, top: 0, bottom: 6, placedAt: 1 }
  const middle = { id: 102, top: -5, bottom: -5, placedAt: 2 }
  const incoming = { id: 103, top: 2, bottom: 0 }
  const empty = () => [null, null, null]
  const schedule = [empty(), empty(), [top, null, null], [top, middle, null], empty()]
  assert.equal(canPlace(schedule, 3, 2, incoming), true)
  assert.ok(legalMoves(schedule, [incoming]).some((move) => move.day === 3 && move.slot === 2))
  assert.equal(canPlace([empty(), empty(), [top, null, null], empty(), empty()], 3, 2, incoming), false)
  assert.equal(canPlace([empty(), empty(), [top, null, null], empty(), empty()], 3, 1, incoming), true)
  assert.equal(canPlace([empty(), empty(), empty(), empty(), empty()], 3, 0, incoming), false)
  assert.equal(canPlace(schedule, 3, 2, { ...incoming, top: -2 }), false)
  assert.equal(canPlace(schedule, 3, 0, incoming), false)
  const zeroColumn = [top, { ...middle, bottom: 0 }, null]
  assert.equal(canPlace([empty(), empty(), [top, null, null], zeroColumn, empty()], 3, 2, incoming), false)
})

test('game accepts the newly legal placement for every player', () => {
  const cards = deck(10)
  cards[0] = { id: 1, top: 2, bottom: 0 }
  cards[1] = { id: 2, top: 3, bottom: 0 }
  let state = newGame(2, cards)
  const column = [
    { id: 101, top: 0, bottom: 6, placedAt: 1 },
    { id: 102, top: -5, bottom: -5, placedAt: 2 },
    null,
  ]
  state = {
    ...state,
    schedules: state.schedules.map((schedule) =>
      schedule.map((day, i) => i === 2 ? [{ id: 100, top: 1, bottom: 1, placedAt: 1 }, null, null] : i === 3 ? column : day),
    ),
  }
  state = playCard(state, 1, 3, 2)
  assert.equal(state.schedules[0][3][2].id, 1)
  state = playCard(state, 2, 3, 2)
  assert.equal(state.schedules[1][3][2].id, 2)
})

test('a new week starts with its complete deck after cards were replaced', () => {
  const cards = deck(10)
  let state = newGame(2, cards)
  for (const [human, computer] of [[1, 0], [0, 1], [2, 2], [1, 0]]) {
    state = pick(state, 0, human)
    if (computer === 0 && state.schedules[1][0][0]) {
      state = pick(state, 1, 0)
    } else {
      state = pick(state, 0, computer)
    }
  }
  state = startNextWeek(state)
  assert.equal(state.week, 2)
  assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), cards.map((card) => card.id))
})

test('distinct decks are used in order without mixing cards between weeks', () => {
  const decks = [0, 100, 200].map((offset) =>
    deck(4).map((card) => ({ ...card, id: card.id + offset, top: card.top + offset })),
  )
  let state = createGame(2, decks)
  for (let week = 0; week < 3; week++) {
    assert.equal(state.week, week + 1)
    assert.deepEqual(allCards(state).map((card) => card.id).sort((a, b) => a - b), decks[week].map((card) => card.id))
    state = pick(state, 0, 0)
    state = pick(state, 0, 0)
    if (week < 2) state = startNextWeek(state)
  }
  assert.equal(state.gameOver, true)
  assert.deepEqual(state.starting[0], { money: 9, energy: 5, points: 102 })
})

test('an undersized later deck reports an error instead of dealing a partial draw area', () => {
  const state = createGame(2, [deck(4), deck(2), deck(4)])
  const after = startNextWeek(pick(pick(state, 0, 0), 0, 0))
  assert.equal(after.week, 2)
  assert.equal(after.drawArea.length, 0)
  assert.equal(after.deck.length, 2)
  assert.match(after.error, /at least 3 cards/)
})

test('only zero or the opposite sign can cover a nonzero visible number', () => {
  for (const previous of [-2, 0, 2]) {
    for (const incoming of [-3, 0, 3]) {
      const expected = previous !== 0 && (incoming === 0 || Math.sign(previous) !== Math.sign(incoming))
      const above = [[{ id: 1, top: 8, bottom: previous, placedAt: 1 }, null, null]]
      const below = [[null, { id: 2, top: previous, bottom: 8, placedAt: 1 }, null]]
      assert.equal(canPlace(above, 0, 1, { id: 3, top: incoming, bottom: 7 }), expected, `${incoming} over ${previous}, top half`)
      assert.equal(canPlace(below, 0, 0, { id: 3, top: 7, bottom: incoming }), expected, `${incoming} over ${previous}, bottom half`)
    }
  }
})

test('a reused slot must satisfy both visible sections, not hidden card values', () => {
  const column = [
    { id: 1, top: 1, bottom: -5, placedAt: 2 },
    { id: 2, top: 0, bottom: 0, placedAt: 1 },
    { id: 3, top: 6, bottom: 1, placedAt: 3 },
  ]
  const schedule = [column]
  assert.equal(canPlace(schedule, 0, 1, { id: 4, top: 4, bottom: -3 }), true)
  assert.equal(canPlace(schedule, 0, 1, { id: 4, top: 4, bottom: 3 }), false)
  assert.equal(canPlace(schedule, 0, 1, { id: 4, top: -4, bottom: -3 }), false)
  assert.equal(canPlace(schedule, 0, 1, { id: 4, top: 0, bottom: 0 }), true)
  column[0].bottom = 0
  assert.equal(canPlace(schedule, 0, 1, { id: 4, top: 0, bottom: -3 }), false)
})

test('game and move enumeration reject forbidden overlaps for every player', () => {
  const cards = deck(10)
  let state = newGame(2, cards)
  state = playCard(state, 1, 0, 0)
  state = playCard(state, 2, 0, 0)
  const candidate = state.drawArea[0]
  const blocked = state.schedules[0]
  assert.equal(canPlace(blocked, 0, 1, candidate), false)
  assert.equal(playCard(state, candidate.id, 0, 1), state)
  assert.ok(!legalMoves(blocked, [candidate]).some((move) => move.day === 0 && move.slot === 1))
  const compatible = { ...candidate, top: -1 }
  assert.ok(legalMoves(blocked, [compatible]).some((move) => move.day === 0 && move.slot === 1))
  const computer = state.schedules[1]
  assert.equal(canPlace(computer, 0, 1, candidate), false)
  assert.ok(legalMoves(computer, [compatible]).some((move) => move.day === 0 && move.slot === 1))
})

test('lowest picked card sum starts next draw, followed by clockwise order', () => {
  const cards = deck(20)
  cards[0] = { id: 1, top: 3, bottom: 4 }
  cards[1] = { id: 2, top: -3, bottom: 1 }
  cards[2] = { id: 3, top: 0, bottom: 4 }
  let state = newGame(3, cards)
  for (let i = 0; i < 3; i++) state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 1)
  assert.equal(state.drawStarter, 1)
  assert.deepEqual(state.drawPicks, [null, null, null])
  state = playCard(state, state.drawArea[0].id, 1, 0)
  assert.equal(state.turn, 2)
  state = playCard(state, state.drawArea[0].id, 1, 0)
  assert.equal(state.turn, 0)
})

test('tied lowest scores rotate clockwise from the previous starter, including wraparound', () => {
  const cards = deck(24).map((card) => ({ ...card, top: -1, bottom: 1 }))
  let state = newGame(3, cards)
  for (let draw = 0; draw < 3; draw++) {
    for (let player = 0; player < 3; player++) state = playCard(state, state.drawArea[0].id, draw, 0)
    assert.equal(state.turn, (draw + 1) % 3)
  }
})

test('a lowest-sum tie goes to the card with the lowest individual number', () => {
  const cards = deck(12)
  cards[0] = { id: 1, top: 7, bottom: -7 }
  cards[1] = { id: 2, top: -5, bottom: 8 }
  cards[2] = { id: 3, top: -3, bottom: 3 }
  let state = newGame(3, cards)
  for (let i = 0; i < 3; i++) state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 0)
})

test('the individual-number tiebreaker applies only to the lowest sums', () => {
  const cards = deck(12)
  cards[0] = { id: 1, top: 0, bottom: 4 }
  cards[1] = { id: 2, top: 3, bottom: 1 }
  cards[2] = { id: 3, top: -10, bottom: 15 }
  let state = newGame(3, cards)
  for (let i = 0; i < 3; i++) state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 0)
})

test('a remaining tie on both sum and lowest number rotates among only those tied', () => {
  const cards = deck(16)
  cards[0] = { id: 1, top: -4, bottom: 4 }
  cards[1] = { id: 2, top: -3, bottom: 3 }
  cards[2] = { id: 3, top: 4, bottom: -4 }
  let state = newGame(3, cards)
  for (let i = 0; i < 3; i++) state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 2)
})

test('starting order is not reset when a pick ends the draw cycle mid-week', () => {
  const cards = deck(12)
  cards[0] = { id: 1, top: 5, bottom: 5 }
  cards[1] = { id: 2, top: -5, bottom: -5 }
  let state = newGame(2, cards)
  state = playCard(state, 1, 0, 0)
  state = playCard(state, 2, 0, 0)
  assert.equal(state.turn, 1)
  state = playCard(state, state.drawArea[0].id, 1, 0)
  assert.equal(state.turn, 0)
})

test('refill during final turns retains clockwise order instead of changing starter', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  for (let day = 0; day < 4; day++) {
    state = pick(state, day, 0)
    state = pick(state, day, 0)
  }
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 2)
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 1)
  assert.equal(state.turn, 0)
  state = pick(state, 4, 1)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
  assert.equal(state.turn, 0)
  assert.deepEqual(state.drawPicks, [null, null])
})

test('final turns stay clockwise across a refill when the trigger is not the first picker', () => {
  const cards = deck(40)
  let state = newGame(3, cards)
  const schedules = state.schedules.map((schedule, player) =>
    schedule.map((column, day) => day < 4
      ? [{ id: -1 - player * 4 - day, top: 1, bottom: 1, placedAt: 1 }, ...column.slice(1)]
      : column),
  )
  state = { ...state, schedules, turn: 2, drawStarter: 1, drawPicks: [null, { id: -20, top: -50, bottom: -50 }, null], drawArea: cards.slice(0, 3), deck: cards.slice(3) }
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 3)
  assert.equal(state.turn, 0)
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 2)
  assert.equal(state.turn, 1)
  state = pick(state, 4, 0)
  assert.equal(state.extraTurns, 1)
  assert.equal(state.turn, 2)
  state = pick(state, 4, 1)
  state = startNextWeek(state)
  assert.equal(state.week, 2)
})

test('a final-turn refill keeps the leftover with exactly enough cards in the deck', () => {
  const cards = deck(10)
  let state = newGame(2, cards)
  state = {
    ...state,
    extraTurns: 2,
    drawArea: cards.slice(0, 2),
    deck: cards.slice(2, 4),
    drawPicks: [null, { id: -20, top: 0, bottom: 0 }],
  }
  state = playCard(state, cards[0].id, 0, 0)
  assert.equal(state.extraTurns, 1)
  assert.equal(state.turn, 1)
  assert.deepEqual(state.drawArea.map((card) => card.id), [2, 3, 4])
  assert.equal(state.deck.length, 0)
  state = playCard(state, 2, 0, 0)
  assert.equal(state.weekComplete, true)
  assert.equal(state.schedules[1][0][0].id, 2)
})

test('last-play status accounts for final turns, deck shortage, and fifth-column exceptions', () => {
  const cards = deck(10)
  let state = newGame(2, cards)
  assert.equal(lastPlayStatus(state), null)
  assert.equal(lastPlayStatus({ ...state, extraTurns: 2 }), null)
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1 }), 'last')
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1, error: 'error' }), null)
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1, weekComplete: true }), null)
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1, drawArea: [] }), 'last')
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1, drawArea: [], deck: [] }), null)

  state = { ...state, drawArea: cards.slice(0, 2), deck: cards.slice(2, 3), drawPicks: [null, { id: -20, top: 0, bottom: 0 }] }
  assert.equal(lastPlayStatus(state), 'possible')
  assert.equal(lastPlayStatus({ ...state, deck: cards.slice(2, 4) }), null)

  const schedule = state.schedules[0].map((column, day) => day < 4
    ? [{ id: -10 - day, top: 1, bottom: 1, placedAt: 1 }, ...column.slice(1)]
    : column)
  state = { ...state, schedules: [schedule, state.schedules[1]], deck: [] }
  assert.equal(lastPlayStatus(state), 'possible')
})

test('blind draws are revealed, must be placed, and cannot start the next draw', () => {
  const cards = deck(12)
  let state = newGame(2, cards)
  const top = state.deck[0]
  const faceUp = state.drawArea[0]
  state = drawBlind(state)
  assert.deepEqual(state.blindCard, top)
  assert.equal(state.deck.length, 8)
  assert.equal(playCard(state, faceUp.id, 0, 0), state)
  assert.equal(drawBlind(state), state)
  state = playCard(state, top.id, 0, 0)
  assert.equal(state.blindCard, null)
  assert.equal(state.drawPicks[0], 'blind')
  assert.equal(state.drawArea.length, 3)
  state = playCard(state, faceUp.id, 0, 0)
  assert.equal(state.turn, 1)
  assert.equal(state.drawStarter, 1)
  assert.deepEqual(state.drawArea, [cards[1], cards[2], cards[4]])
  assert.deepEqual(state.drawPicks, [null, null])
})

test('all-blind draws rotate the starter and retain the whole draw area', () => {
  const cards = deck(12)
  let state = newGame(2, cards)
  const original = state.drawArea
  for (let i = 0; i < 2; i++) {
    state = drawBlind(state)
    state = playCard(state, state.blindCard.id, 0, 0)
  }
  assert.equal(state.turn, 1)
  assert.equal(state.drawStarter, 1)
  assert.deepEqual(state.drawArea, original)
  assert.equal(state.deck.length, 7)
  assert.deepEqual(state.drawPicks, [null, null])
})

test('unplaceable blind cards are set aside and skipped, including during final turns', () => {
  let state = newGame(2, deck(12))
  state.schedules[0] = state.schedules[0].map((column, day) =>
    column.map((_, slot) => ({ id: 100 + day * 3 + slot, top: 0, bottom: 0, placedAt: slot + 1 })))
  const card = state.deck[0]
  state = drawBlind(state)
  assert.equal(state.blindCard, null)
  assert.deepEqual(state.blindSkip, { player: 0, card })
  assert.deepEqual(state.setAside, [card])
  assert.equal(state.turn, 1)
  assert.equal(state.drawPicks[0], 'blind')
  state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 1)
  assert.deepEqual(state.drawPicks, [null, null])
  const final = drawBlind({ ...state, turn: 0, extraTurns: 1 })
  assert.equal(final.weekComplete, true)
  assert.equal(final.blindSkip.player, 0)
})

test('blind draws respect empty decks and short refills without losing cards', () => {
  let state = newGame(2, deck(5))
  state = drawBlind(state)
  state = playCard(state, state.blindCard.id, 0, 0)
  state = drawBlind(state)
  state = playCard(state, state.blindCard.id, 0, 0)
  assert.equal(state.weekComplete, false)
  assert.equal(state.deck.length, 0)
  assert.equal(drawBlind(state), state)
  state = playCard(state, state.drawArea[0].id, 1, 0)
  state = playCard(state, state.drawArea[0].id, 1, 0)
  assert.equal(state.weekComplete, true)
  assert.equal(allCards(state).length, 5)
})

test('a blind draw can cause a short refill with multiple face-up cards remaining', () => {
  let state = newGame(2, deck(4))
  state = drawBlind(state)
  state = playCard(state, state.blindCard.id, 0, 0)
  state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.weekComplete, true)
  assert.equal(state.drawArea.length, 2)
  assert.equal(allCards(state).length, 4)
})

test('a blind skip still consumes a final turn and preserves clockwise order', () => {
  let state = newGame(3, deck(20))
  state.schedules[1] = state.schedules[1].map((column, day) =>
    column.map((_, slot) => ({ id: 100 + day * 3 + slot, top: 0, bottom: 0, placedAt: slot + 1 })))
  state = { ...state, turn: 1, extraTurns: 3 }
  state = drawBlind(state)
  assert.equal(state.extraTurns, 2)
  assert.equal(state.turn, 2)
  assert.equal(state.drawPicks[1], 'blind')
  state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 0)
  assert.equal(state.extraTurns, 1)
  state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.weekComplete, true)
})

test('a forced blind draw on the last final turn is a last play', () => {
  const state = newGame(2, deck(10))
  state.schedules[0] = state.schedules[0].map((column, day) =>
    column.map((_, slot) => ({ id: 100 + day * 3 + slot, top: 0, bottom: 0, placedAt: slot + 1 })))
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1 }), 'last')
  assert.equal(lastPlayStatus({ ...state, extraTurns: 1, deck: [] }), null)
})

test('completed weeks flip bust columns, preserve earlier totals, and lock play until continuing', () => {
  const cards = deck(4)
  cards[0] = { id: 1, top: -1, bottom: 2 }
  let state = newGame(2, cards)
  const schedule = (columns) => [...columns, ...Array.from({ length: 5 - columns.length }, () => [null, null, null])]
  state = {
    ...state,
    schedules: [
      schedule([
        [{ id: 101, top: 3, bottom: 1, placedAt: 1 }, null, null],
        [{ id: 102, top: 5, bottom: -7, placedAt: 1 }, null, null],
        [{ id: 103, top: 9, bottom: 2, placedAt: 1 }, null, null],
        [null, { id: 104, top: -4, bottom: -9, placedAt: 1 }, null],
      ]),
      schedule([]),
    ],
  }
  state = playCard(state, 1, 2, 1)
  state = playCard(state, 2, 0, 0)
  assert.equal(state.weekComplete, true)
  assert.deepEqual(state.bustColumns, [1, null])
  assert.equal(state.schedules[0][1][0].id, 102)
  assert.equal(playCard(state, state.drawArea[0].id, 0, 0), state)
  state = startNextWeek(state)
  assert.deepEqual(state.starting[0], { money: 6, energy: 5, points: 3 })
  assert.deepEqual(state.bustColumns, [null, null])
  assert.equal(state.weekComplete, false)
  assert.equal(startNextWeek(state), state)
})

test('final week applies busting before displaying final scores', () => {
  const cards = deck(4)
  cards[0] = { id: 1, top: 1, bottom: -2 }
  let state = newGame(2, cards)
  state = {
    ...state,
    week: 3,
    starting: [{ money: 2, energy: 5, points: 11 }, state.starting[1]],
    schedules: [
      [[{ id: 101, top: 6, bottom: -3, placedAt: 1 }, null, null], ...state.schedules[0].slice(1)],
      state.schedules[1],
    ],
  }
  state = playCard(state, 1, 1, 0)
  state = playCard(state, 2, 0, 0)
  assert.equal(state.gameOver, true)
  assert.deepEqual(state.bustColumns, [0, null])
  assert.equal(state.starting[0].points, 11)
  assert.deepEqual(completedWeekTotals(state), [
    { money: 2, energy: 5, points: 11 },
    { money: 8, energy: 5, points: 2 },
  ])
  assert.equal(startNextWeek(state), state)
})

test('final winners are ranked by points, then energy, then money', () => {
  const total = (points, energy, money) => ({ points, energy, money })
  assert.deepEqual(winningPlayers([total(10, 0, 0), total(9, 100, 100)]), [0])
  assert.deepEqual(winningPlayers([total(10, 2, 100), total(10, 3, 0), total(9, 50, 50)]), [1])
  assert.deepEqual(winningPlayers([total(10, 3, 2), total(10, 3, 5), total(9, 100, 100)]), [1])
  assert.deepEqual(winningPlayers([total(-1, -2, -3), total(-1, -2, -3), total(-2, 0, 0)]), [0, 1])
  assert.deepEqual(winningPlayers([]), [])
})

test('winner tiebreakers use resources after busting', () => {
  const state = newGame(2, deck(4))
  state.starting = [{ points: 10, money: 5, energy: 5 }, { points: 10, money: 5, energy: 6 }]
  state.schedules[0][0][1] = { id: 101, top: 0, bottom: 10, placedAt: 1 }
  state.bustColumns = [0, null]
  assert.deepEqual(winningPlayers(completedWeekTotals(state)), [1])
})

test('week two starts with the lowest post-bust points and sets the draw starter', () => {
  const cards = deck(4)
  let state = newGame(2, cards)
  state = {
    ...state,
    starting: [{ money: 5, energy: 5, points: 2 }, { money: 5, energy: 5, points: 4 }],
    schedules: [
      [[{ id: 101, top: 10, bottom: 0, placedAt: 1 }, null, null], ...state.schedules[0].slice(1)],
      [[{ id: 102, top: 8, bottom: -6, placedAt: 1 }, null, null], ...state.schedules[1].slice(1)],
    ],
    weekComplete: true,
    bustColumns: [null, 0],
  }
  state = startNextWeek(state)
  assert.deepEqual(state.starting.map((player) => player.points), [12, 4])
  assert.equal(state.turn, 1)
  assert.equal(state.weekStarter, 1)
  assert.equal(state.drawStarter, 1)
  state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 0)
})

test('tied week starters rotate clockwise from the previous week starter, not the last draw starter', () => {
  for (const players of [2, 3, 4, 5]) {
    let state = newGame(players, deck(20))
    state = { ...state, weekComplete: true }
    state = startNextWeek(state)
    assert.equal(state.turn, 1)
    state = { ...state, weekComplete: true, drawStarter: players - 1 }
    state = startNextWeek(state)
    assert.equal(state.week, 3)
    assert.equal(state.turn, 2 % players)
    assert.equal(state.weekStarter, state.turn)
    assert.equal(state.drawStarter, state.turn)
  }
})

test('week starter ties skip higher scores and wrap around', () => {
  let state = newGame(5, deck(20))
  state = {
    ...state,
    week: 2,
    weekStarter: 3,
    weekComplete: true,
    starting: [0, 4, 0, 8, 2].map((points) => ({ money: 5, energy: 5, points })),
  }
  state = startNextWeek(state)
  assert.equal(state.week, 3)
  assert.equal(state.turn, 0)
})
