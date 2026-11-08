import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformWithEsbuild } from 'vite'

const source = await readFile(new URL('../src/deck.ts', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(source, 'deck.ts')
const { makeDecks } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('week one contains the zero card and five pairs for each magnitude from 1 to 7', () => {
  const [weekOne] = makeDecks()
  const expected = Array.from({ length: 7 }, (_, i) => {
    const n = i + 1
    return [[0, n], [n, 0], [n, -n], [-n, n], [-n, -n]]
  }).flat()
  expected.unshift([0, 0])
  assert.deepEqual(weekOne.map(({ top, bottom }) => [top, bottom]), expected)
  assert.equal(weekOne.length, 36)
})

test('cards have unique ids across all three decks', () => {
  const cards = makeDecks().flat()
  assert.equal(new Set(cards.map(({ id }) => id)).size, cards.length)
})
