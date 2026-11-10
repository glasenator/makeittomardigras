import { useState } from 'react'
import './App.css'
import StartScreen from './StartScreen'
import Game from './Game'
import type { Difficulty } from './computerPlayer'

function App() {
  const [game, setGame] = useState<{ numPlayers: number; difficulty: Difficulty } | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)

  function startGame(numPlayers: number, difficulty: Difficulty) {
    setAudioEnabled(true)
    setGame({ numPlayers, difficulty })
  }

  return (
    game === null ? (
      <StartScreen onStart={startGame} />
    ) : (
      <Game numPlayers={game.numPlayers} difficulty={game.difficulty} audioEnabled={audioEnabled} onExit={() => setGame(null)} />
    )
  )
}

export default App
