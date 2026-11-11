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
const { canPlace, completedWeekTotals, computersAbleToReachTuesday, drawBlind, finalScore, lastPlayStatus, legalMoves, newGame: createGame, playCard, startNextWeek, tuesdayCardCount, winningPlayers } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
)
const { visibleSections } = await import(
  `data:text/javascript;base64,${Buffer.from((await build({
    entryPoints: [fileURLToPath(new URL('../src/scheduleTotals.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
  })).outputFiles[0].text).toString('base64')}`
)

const deck = (length) => Array.from({ length }, (_, i) => ({ id: i + 1, top: i + 1, bottom: i + 2 }))
const newGame = (players, cards) => createGame(players, [cards, cards.map((c) => ({ ...c })), cards.map((c) => ({ ...c }))], () => 0)
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

test('the first player is randomly selected for every supported player count', () => {
  for (let players = 2; players <= 5; players++) {
    const cards = deck(20)
    for (let starter = 0; starter < players; starter++) {
      const state = createGame(players, [cards, cards, cards], () => (starter + 0.5) / players)
      assert.equal(state.turn, starter)
      assert.equal(state.weekStarter, starter)
      assert.equal(state.drawStarter, starter)
      const next = playCard(state, state.drawArea[0].id, 0, 0)
      assert.equal(next.schedules[starter][0][0].id, state.drawArea[0].id)
      assert.equal(next.turn, (starter + 1) % players)
    }
  }
})

test('a computer starting player anchors clockwise draw and week tie-breaks', () => {
  const cards = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, top: 1, bottom: 1 }))
  let state = createGame(2, [cards, cards, cards], () => 0.9)
  state = playCard(state, state.drawArea[0].id, 0, 0)
  state = playCard(state, state.drawArea[0].id, 0, 0)
  assert.equal(state.turn, 0)
  assert.equal(state.drawStarter, 0)
  state = playCard(state, state.drawArea[0].id, 1, 0)
  state = playCard(state, state.drawArea[0].id, 1, 0)
  assert.equal(state.weekComplete, true)
  state = startNextWeek(state)
  assert.equal(state.weekStarter, 0)
  assert.equal(state.turn, 0)
})

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

test('Tuesday trigger sits out while remaining final turns follow picked-card values', () => {
  const cards = [
    { id: 1, top: 1, bottom: 1 },
    { id: 2, top: 3, bottom: 2 },
    { id: 3, top: -1, bottom: -1 },
    ...deck(9).map((card, i) => ({ ...card, id: i + 4 })),
  ]
  let state = newGame(3, cards)
  state.schedules[0][5][0] = { id: 90, top: 1, bottom: -1, placedAt: 1 }
  state = {
    ...state,
    turn: 0,
    drawPicks: [null, null, null],
    drawArea: cards.slice(0, 4),
    deck: cards.slice(4),
  }
  state = playCard(state, 1, 6, 0)
  assert.equal(state.finalTurnTrigger, 0)
  assert.equal(state.extraTurns, null)
  assert.equal(state.turn, 1)

  state = playCard(state, 2, 0, 1)
  state = playCard(state, 3, 0, 1)
  assert.deepEqual(state.finalTurnOrder, [2, 1])
  assert.equal(state.extraTurns, 2)
  assert.equal(state.turn, 2)

  state = pick(state, 0, 0)
  assert.equal(state.turn, 1)
  assert.equal(state.extraTurns, 1)
  state = pick(state, 0, 0)
  assert.equal(state.weekComplete, true)
  assert.equal(state.finalTurnTrigger, null)
  assert.equal(state.finalTurnOrder, null)
  assert.equal(allCards(state).filter((card) => cards.some((original) => original.id === card.id)).length, cards.length)
})

test('all players reaching Tuesday in the current draw sit out the final draw', () => {
  const cards = deck(20)
  let state = newGame(3, cards)
  for (const player of [0, 1]) {
    state.schedules[player][5][0] = { id: 100 + player, top: 1, bottom: 1, placedAt: 1 }
  }
  state = playCard(state, cards[0].id, 6, 0)
  state = playCard(state, cards[1].id, 6, 0)
  state = playCard(state, cards[2].id, 0, 0)

  assert.deepEqual(state.finalTurnTriggers, [0, 1])
  assert.deepEqual(state.finalTurnOrder, [2])
  assert.equal(state.turn, 2)
  state = playCard(state, state.drawArea[0].id, 0, 2)
  assert.equal(state.weekComplete, true)
  assert.deepEqual(state.finalTurnTriggers, [])
  assert.equal(state.schedules[0].flat().filter(Boolean).length, 2)
  assert.equal(state.schedules[1].flat().filter(Boolean).length, 2)
})

test('the week ends immediately if all players reach Tuesday in the current draw', () => {
  const cards = deck(10)
  let state = newGame(2, cards)
  for (const player of [0, 1]) {
    state.schedules[player][5][0] = { id: 100 + player, top: 1, bottom: 1, placedAt: 1 }
  }
  state = playCard(state, cards[0].id, 6, 0)
  state = playCard(state, cards[1].id, 6, 0)
  assert.equal(state.weekComplete, true)
  assert.deepEqual(state.finalTurnTriggers, [])
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

test('shortage of cards for value-ordered final turns is explicit', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  state.schedules[0][5][0] = { id: 90, top: 1, bottom: -1, placedAt: 1 }
  state = { ...state, deck: [], drawArea: state.drawArea.slice(0, 2) }
  state = playCard(state, state.drawArea[0].id, 6, 0)
  assert.equal(state.week, 1)
  assert.equal(state.finalTurnTrigger, 0)
  state = playCard(state, state.drawArea[0].id, 0, 1)
  assert.equal(state.weekComplete, false)
  assert.match(state.error, /Not enough cards/)
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

test('partially covered cards may be replaced repeatedly', () => {
  const cards = deck(40)
  let state = newGame(2, cards)
  const first = state.drawArea[0]
  state = playCard(state, first.id, 0, 1)
  state = playCard(state, state.drawArea[0].id, 0, 0)
  for (const slot of [0, 1, 0, 1]) {
    if (state.turn !== 0) {
      const move = legalMoves(state.schedules[state.turn], state.drawArea)[0]
      state = playCard(state, move.card.id, move.day, move.slot)
    }
    const oldCard = state.schedules[0][0][slot]
    const replacement = state.drawArea[0]
    const before = state
    state = pick(state, 0, slot)
    assert.notEqual(state, before)
    assert.equal(state.schedules[0][0][slot].id, replacement.id)
    if (oldCard) assert.ok(state.setAside.some((card) => card.id === oldCard.id))
  }
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

test('placements can connect to an existing card in the same column or to the left', () => {
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
  let state = createGame(2, decks, () => 0)
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
  const state = createGame(2, [deck(4), deck(2), deck(4)], () => 0)
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

test('last-play status accounts for final turns, deck shortage, and seventh-column exceptions', () => {
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

  const schedule = state.schedules[0].map((column, day) => day < 6
    ? [{ id: -10 - day, top: 1, bottom: 1, placedAt: 1 }, ...column.slice(1)]
    : column)
  state = { ...state, schedules: [schedule, state.schedules[1]], deck: [] }
  assert.equal(lastPlayStatus(state), 'possible')
})

test('computer Tuesday threats use legal vertical placements and stop once final turns begin', () => {
  const state = newGame(4, deck(20))
  const nearTuesday = state.schedules[1].map((column, day) => day === 5
    ? [{ id: -10, top: 1, bottom: 1, placedAt: 1 }, ...column.slice(1)]
    : column)
  const schedules = [state.schedules[0], nearTuesday, nearTuesday, state.schedules[3]]
  const threatened = { ...state, schedules }

  assert.deepEqual(computersAbleToReachTuesday(state), [])
  assert.deepEqual(computersAbleToReachTuesday(threatened), [1, 2])
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, finalTurnTrigger: 0 }), [])
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, extraTurns: 1 }), [])
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, weekComplete: true }), [])
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, error: 'error' }), [])

  const horizontal = { id: 100, top: 1, bottom: -1, orientation: 'horizontal' }
  const vertical = { id: 101, top: 1, bottom: -1 }
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, deck: [], drawArea: [horizontal] }), [])
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, deck: [], drawArea: [vertical] }), [1, 2])
  assert.deepEqual(computersAbleToReachTuesday({ ...threatened, deck: [], drawArea: [horizontal], blindCard: vertical, turn: 1 }), [1])
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

test('completed weeks mark bust columns, preserve earlier totals, and lock play until continuing', () => {
  const cards = deck(4)
  cards[0] = { id: 1, top: -1, bottom: 2 }
  let state = newGame(2, cards)
  const schedule = (columns) => [...columns, ...Array.from({ length: 7 - columns.length }, () => [null, null, null])]
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
  assert.equal(state.schedules[0][0][0].faceDown, undefined)
  assert.ok(state.schedules[0].slice(1).flat().filter(Boolean).every((card) => !card.faceDown))
  assert.ok(state.schedules[1].flat().filter(Boolean).every((card) => !card.faceDown))
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
  assert.ok(state.schedules[0].flat().filter(Boolean).every((card) => !card.faceDown))
  assert.equal(state.starting[0].points, 11)
  assert.deepEqual(completedWeekTotals(state), [
    { money: 2, energy: 5, points: 11 },
    { money: 8, energy: 5, points: 2 },
  ])
  assert.equal(startNextWeek(state), state)
})

test('negative resources first reached on final Tuesday count as zero without graying Tuesday', () => {
  let state = newGame(2, deck(4))
  state = {
    ...state,
    week: 3,
    extraTurns: 1,
    starting: [{ money: 5, energy: 5, points: 10 }, state.starting[1]],
    schedules: state.schedules.map((schedule, i) => i === 0
      ? schedule.map((column, day) => day === 6
        ? [{ id: 101, top: 4, bottom: -7, placedAt: 1 }, null, null]
        : column)
      : schedule),
    drawArea: [{ id: 99, top: 2, bottom: 2 }, ...state.drawArea.slice(1)],
  }

  state = playCard(state, 99, 6, 2)

  assert.equal(state.gameOver, true)
  assert.deepEqual(state.bustColumns, [null, null])
  assert.deepEqual(completedWeekTotals(state)[0], { money: 0, energy: 7, points: 16 })
})

test('final score uses visible Tuesday sections, not covered cards', () => {
  const state = newGame(2, deck(4))
  state.week = 3
  state.weekComplete = true
  state.gameOver = true
  state.starting[0] = { money: 5, energy: 5, points: 10 }
  state.schedules[0][5].push({ id: 101, top: -1, bottom: 99, orientation: 'horizontal', row: 0, placedAt: 1, sequence: 1 })
  state.schedules[0][6][0] = { id: 102, top: 3, bottom: -99, placedAt: 1, sequence: 2 }
  state.schedules[0][6][1] = { id: 103, top: 2, bottom: -99, placedAt: 2, sequence: 3 }
  state.schedules[0][6][2] = { id: 104, top: 5, bottom: 4, placedAt: 3, sequence: 4 }

  assert.deepEqual(completedWeekTotals(state)[0], { money: 7, energy: 10, points: 16 })
  assert.equal(finalScore(completedWeekTotals(state)[0]), -1)
  assert.equal(tuesdayCardCount(state.schedules[0]), 4)
})

test('final scores subtract money and energy, including negative final scores', () => {
  const state = newGame(2, deck(4))
  state.starting = [{ points: 30, money: 15, energy: 15 }, { points: 12, money: 5, energy: 5 }]
  assert.deepEqual(completedWeekTotals(state).map(finalScore), [0, 2])
  assert.deepEqual(winningPlayers(state), [1])
  state.starting = [{ points: 0, money: 5, energy: 5 }, { points: 0, money: 6, energy: 5 }]
  assert.deepEqual(completedWeekTotals(state).map(finalScore), [-10, -11])
  assert.deepEqual(winningPlayers(state), [0])
})

test('final scoring uses resources and points after busting', () => {
  const state = newGame(2, deck(4))
  state.starting = [{ points: 10, money: 5, energy: 5 }, { points: 10, money: 5, energy: 6 }]
  state.schedules[0][0][1] = { id: 101, top: 0, bottom: 10, placedAt: 1 }
  state.bustColumns = [0, null]
  assert.deepEqual(completedWeekTotals(state).map(finalScore), [0, -1])
  assert.deepEqual(winningPlayers(state), [0])
})

test('final ties count all cards touching Tuesday, including covered, horizontal and busted cards', () => {
  const state = newGame(3, deck(4))
  state.starting = [
    { points: 20, money: 5, energy: 5 },
    { points: 20, money: 5, energy: 5 },
    { points: 19, money: 5, energy: 5 },
  ]
  state.bustColumns = [0, 0, 0]
  state.schedules[0][6][0] = { id: 101, top: 1, bottom: 1, placedAt: 1 }
  state.schedules[1][6][0] = { id: 102, top: 1, bottom: 1, placedAt: 1 }
  state.schedules[1][6][1] = { id: 103, top: 1, bottom: 1, placedAt: 2 }
  state.schedules[1][5].push({ id: 104, top: 1, bottom: 1, orientation: 'horizontal', row: 0, placedAt: 3 })
  state.schedules[1][5].push({ id: 105, top: 1, bottom: 1, orientation: 'horizontal', row: 0, placedAt: 4 })
  state.schedules[2][6][0] = { id: 106, top: 1, bottom: 1, placedAt: 1 }
  state.schedules[2][6][1] = { id: 107, top: 1, bottom: 1, placedAt: 2 }
  state.schedules[2][6][2] = { id: 108, top: 1, bottom: 1, placedAt: 3 }
  state.schedules[2][5].push({ id: 109, top: 1, bottom: 1, orientation: 'horizontal', row: 0, placedAt: 4 })
  state.schedules[2][5].push({ id: 110, top: 1, bottom: 1, orientation: 'horizontal', row: 0, placedAt: 5 })
  assert.deepEqual(state.schedules.map(tuesdayCardCount), [1, 4, 5])
  assert.deepEqual(winningPlayers(state), [1])
  state.schedules[0][5].push({ id: 111, top: 1, bottom: 1, orientation: 'horizontal', row: 0, placedAt: 2 })
  state.schedules[0][6][1] = { id: 112, top: 1, bottom: 1, placedAt: 3 }
  state.schedules[0][6][2] = { id: 113, top: 1, bottom: 1, placedAt: 4 }
  assert.deepEqual(winningPlayers(state), [0, 1])
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
