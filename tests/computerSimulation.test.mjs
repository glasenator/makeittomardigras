import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const result = await build({
  stdin: {
    contents: "export * from './src/gameLogic'; export * from './src/computerPlayer'; export * from './src/deck'",
    resolveDir: root,
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
})
const { newGame, playCard, flipCard, drawBlind, startNextWeek, chooseBlindDraw, chooseComputerMove, chooseFlipTarget, makeDecks, winningPlayers } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function shuffled(items, random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

test('hard wins at least 60 of 100 seeded games against medium', () => {
  let wins = 0
  for (let seed = 1; seed <= 100; seed++) {
    const deckRandom = randomGenerator(seed)
    const decks = makeDecks().map((deck) => shuffled(deck, deckRandom))
    const randoms = [randomGenerator(seed * 19 + 1), randomGenerator(seed * 19 + 2)]
    const hard = seed % 2
    let state = newGame(2, decks, randomGenerator(Math.imul(seed, 2654435761)))
    for (let turn = 0; turn < 500 && !state.gameOver && !state.error; turn++) {
      if (state.weekComplete) {
        state = startNextWeek(state)
        continue
      }
      const player = state.turn
      const difficulty = player === hard ? 'hard' : 'medium'
      if (state.pendingFlip) {
        const target = chooseFlipTarget(state, difficulty, randoms[player])
        assert.ok(target, `Game ${seed}: player ${player} has no FLIP target`)
        state = flipCard(state, target.day, target.slot)
        continue
      }
      if (chooseBlindDraw(state, difficulty, randoms[player])) {
        state = drawBlind(state)
        continue
      }
      const move = chooseComputerMove(state, difficulty, randoms[player])
      assert.ok(move, `Game ${seed}: player ${player} has no legal move`)
      state = playCard(state, move.card.id, move.day, move.slot)
    }
    assert.equal(state.error, null, `Game ${seed}: ${state.error}`)
    assert.equal(state.gameOver, true, `Game ${seed} did not finish`)
    const winners = winningPlayers(state)
    if (winners.length === 1 && winners[0] === hard) wins++
  }
  assert.ok(wins >= 60, `Hard won only ${wins} of 100 games`)
})
