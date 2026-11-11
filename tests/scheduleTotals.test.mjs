import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformWithEsbuild } from 'vite'

const source = await readFile(new URL('../src/scheduleTotals.ts', import.meta.url), 'utf8')
const { code: javascript } = await transformWithEsbuild(source, 'scheduleTotals.ts')
const { bustColumn, scheduleTotals, scheduleTotalsAfterBust } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

const cards = [
  { id: 1, top: 1, bottom: 2, placedAt: 3 },
  { id: 2, top: 10, bottom: 20, placedAt: 2 },
  { id: 3, top: 100, bottom: 200, placedAt: 1 },
]

test('totals count visible halves in their correct section for every overlap', () => {
  const expected = [
    { money: 5, energy: 5, points: 0 },
    { money: 7, energy: 5, points: 1 },
    { money: 15, energy: 25, points: 0 },
    { money: 7, energy: 25, points: 1 },
    { money: 5, energy: 105, points: 200 },
    { money: 7, energy: 105, points: 201 },
    { money: 15, energy: 25, points: 200 },
    { money: 7, energy: 25, points: 201 },
  ]

  expected.forEach((totals, mask) => {
    const column = cards.map((card, slot) => (mask & (1 << slot) ? card : null))
    assert.deepEqual(scheduleTotals([column]), totals, `slot mask ${mask}`)
  })
})

test('totals combine columns and count starting resources once', () => {
  assert.deepEqual(
    scheduleTotals([[cards[0], null, null], [null, cards[1], null]]),
    { money: 17, energy: 25, points: 1 },
  )
})

test('totals preserve zero and negative card values', () => {
  assert.deepEqual(
    scheduleTotals([[{ id: 4, top: 0, bottom: -3, placedAt: 1 }, null, null]]),
    { money: 2, energy: 5, points: 0 },
  )
})

test('all placement orders score only the topmost value in each section', () => {
  const cases = [
    { order: [0, 1, 2], money: 15, energy: 105 },
    { order: [0, 2, 1], money: 15, energy: 25 },
    { order: [1, 0, 2], money: 7, energy: 105 },
    { order: [1, 2, 0], money: 7, energy: 105 },
    { order: [2, 0, 1], money: 15, energy: 25 },
    { order: [2, 1, 0], money: 7, energy: 25 },
  ]

  for (const { order, money, energy } of cases) {
    const column = cards.map((card, slot) => ({ ...card, placedAt: order.indexOf(slot) + 1 }))
    assert.deepEqual(scheduleTotals([column]), { money, energy, points: 201 }, `order ${order}`)
  }
})

test('busting uses the first negative resource column when final resources are negative', () => {
  const column = (id, money, energy) => [null, { id, top: money, bottom: energy, placedAt: 1 }, null]
  const starting = { money: 5, energy: 5, points: 10 }
  assert.equal(bustColumn([column(1, -6, 0), column(2, 3, 0), column(3, -3, 0)], starting), 0)
  assert.equal(bustColumn([column(1, -5, 0), column(2, 0, -6)], starting), 1)
  assert.equal(bustColumn([column(1, -6, 0), column(2, 2, 0)], starting), null)
  assert.equal(bustColumn([column(1, 0, 0)], starting), null)
})

test('week-three Mardi Gras Tuesday prevents a bust on that column and floors negative resources at zero', () => {
  const schedule = Array.from({ length: 7 }, () => [null, null, null])
  schedule[6][0] = { id: 1, top: 4, bottom: -7, placedAt: 1 }
  const starting = { money: 5, energy: 5, points: 10 }
  assert.equal(bustColumn(schedule, starting, true), null)
  assert.deepEqual(scheduleTotalsAfterBust(schedule, starting, true), { money: 0, energy: 5, points: 14 })

  schedule[5][0] = { id: 2, top: 1, bottom: -6, placedAt: 1 }
  assert.equal(bustColumn(schedule, starting, true), 5)
  assert.deepEqual(scheduleTotalsAfterBust(schedule, starting, true), { money: 5, energy: 5, points: 10 })
})

test('final Tuesday totals use only visible sections of overlapping vertical and horizontal cards', () => {
  const schedule = Array.from({ length: 7 }, () => [null, null, null])
  schedule[5].push({ id: 1, top: -1, bottom: 99, orientation: 'horizontal', row: 0, placedAt: 1, sequence: 1 })
  schedule[6][0] = { id: 2, top: 3, bottom: -99, placedAt: 1, sequence: 2 }
  schedule[6][1] = { id: 3, top: 2, bottom: -99, placedAt: 2, sequence: 3 }
  schedule[6][2] = { id: 4, top: 5, bottom: 4, placedAt: 3, sequence: 4 }
  const starting = { money: 5, energy: 5, points: 10 }
  const expected = { money: 7, energy: 10, points: 16 }

  assert.deepEqual(scheduleTotals(schedule, starting), expected)
  assert.deepEqual(scheduleTotalsAfterBust(schedule, starting, true), expected)
  assert.equal(bustColumn(schedule, starting, true), null)

  schedule[6][1] = { ...schedule[6][1], top: -9 }
  assert.deepEqual(scheduleTotalsAfterBust(schedule, starting, true), { money: 0, energy: 10, points: 16 })
})

test('bust calculation uses visible overlap values and carried starting resources', () => {
  const schedule = [[
    { id: 1, top: 4, bottom: -9, placedAt: 1 },
    { id: 2, top: 1, bottom: -3, placedAt: 2 },
    null,
  ]]
  assert.equal(bustColumn(schedule, { money: 2, energy: 2, points: 8 }), 0)
  assert.equal(bustColumn(schedule, { money: 2, energy: 3, points: 8 }), null)
})
