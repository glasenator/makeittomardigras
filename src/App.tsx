import { useState } from 'react'
import './App.css'
import StartScreen from './StartScreen'
import Game from './Game'
import type { Difficulty } from './computerPlayer'

function App() {
  const [game, setGame] = useState<{ numPlayers: number; difficulty: Difficulty } | null>(null)

  return game === null ? (
    <StartScreen onStart={(numPlayers, difficulty) => setGame({ numPlayers, difficulty })} />
  ) : (
    <Game numPlayers={game.numPlayers} difficulty={game.difficulty} onExit={() => setGame(null)} />
  )
}

export default App
