import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformWithEsbuild } from 'vite'

const source = await readFile(new URL('../src/deck.ts', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(source, 'deck.ts')
const { makeDecks } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('week one contains its vertical and horizontal cards', () => {
  const [weekOne] = makeDecks()
  const expected = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return [[0, n], [n, 0], [n, -n], [-n, n], [-n, -n]]
  }).flat()
  expected.splice(4, 1)
  expected.unshift([0, 0])
  assert.deepEqual(weekOne.filter((card) => !card.orientation).map(({ top, bottom }) => [top, bottom]), expected)
  const horizontal = weekOne.filter((card) => card.orientation === 'horizontal').map(({ top, bottom }) => [top, bottom])
  assert.deepEqual(horizontal, [[0, 0], ...Array.from({ length: 8 }, (_, i) => [[-i - 1, i + 1], [i + 1, -i - 1]]).flat()])
  assert.equal(weekOne.length, 57)
})

test('all weeks have one horizontal double-FLIP and both sign orders for every magnitude', () => {
  for (const [week, cards] of makeDecks().entries()) {
    const horizontal = cards.filter((card) => card.orientation === 'horizontal')
    assert.equal(horizontal.length, 17)
    assert.deepEqual(horizontal.filter(({ top, bottom }) => top === 0 && bottom === 0).length, 1)
    for (let n = week + 1; n <= week + 8; n++) {
      assert.equal(horizontal.filter(({ top, bottom }) => top === -n && bottom === n).length, 1)
      assert.equal(horizontal.filter(({ top, bottom }) => top === n && bottom === -n).length, 1)
    }
  }
})
test('cards have unique ids across all three decks', () => {
  const cards = makeDecks().flat()
  assert.equal(new Set(cards.map(({ id }) => id)).size, cards.length)
})
