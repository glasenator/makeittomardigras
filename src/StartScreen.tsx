import { useEffect, useState } from 'react'
import RulesButton from './RulesButton'
import WalkthroughButton from './WalkthroughButton'
import type { Difficulty } from './computerPlayer'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5

type Props = {
  onStart: (numPlayers: number, difficulty: Difficulty) => void
}

const difficulties: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Random legal moves.' },
  { value: 'medium', label: 'Medium', description: 'Favors carnival points and safe resources.' },
  { value: 'hard', label: 'Hard', description: 'Plans ahead and considers when to end the week.' },
]

function StartScreen({ onStart }: Props) {
  const [players, setPlayers] = useState(MIN_PLAYERS)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [flickeringLetters, setFlickeringLetters] = useState<number[]>([])
  const options = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let intervalTimer = 0
    let flickerTimer = 0
    const letterIndices = Array.from('Mardi Gras')
      .map((character, index) => character === ' ' ? null : index)
      .filter((index): index is number => index !== null)

    function scheduleFlicker() {
      intervalTimer = window.setTimeout(() => {
        const index = letterIndices[Math.floor(Math.random() * letterIndices.length)]
        setFlickeringLetters([index])
        flickerTimer = window.setTimeout(() => {
          setFlickeringLetters([])
          scheduleFlicker()
        }, 90 + Math.random() * 300)
      }, 700 + Math.random() * 3000)
    }

    scheduleFlicker()
    return () => {
      window.clearTimeout(intervalTimer)
      window.clearTimeout(flickerTimer)
    }
  }, [])

  return (
    <main className="start">
      <div className="start-hero">
        <div className="hero-ornament" aria-hidden="true">✦ <span>⚜</span> ✦</div>
        <p className="eyebrow">Alpha Version</p>
        <h1>Make it to <em><span className="sr-only">Mardi Gras</span><span className="neon-title" aria-hidden="true">{Array.from('Mardi Gras').map((character, index) => (
          <span className={`neon-letter neon-letter-${index % 3}${flickeringLetters.includes(index) ? ' flickering-off' : ''}`} key={`${character}-${index}`}>{character === ' ' ? '\u00a0' : character}</span>
        ))}</span></em></h1>
        <p className="hero-copy">Plan your schedule, conserve energy, spend money,<br></br> and let the good times roll.</p>
        <div className="bead-divider" aria-hidden="true"><span>✦</span></div>
        <section className="setup-card" aria-labelledby="setup-heading">
          <p className="eyebrow">Gather your krewe</p>
          <h2 id="setup-heading">How many are playing?</h2>
          <p className="setup-hint">You + computer players</p>
          <div className="player-options" role="group" aria-label="Number of players">
            {options.map((n) => (
              <button key={n} className={n === players ? 'selected' : ''} aria-pressed={n === players} onClick={() => setPlayers(n)}>
                {n}
              </button>
            ))}
          </div>
          <p className="player-summary">
            You vs. {players - 1} computer player{players - 1 > 1 ? 's' : ''}
          </p>
          <div className="difficulty-setup">
            <p className="difficulty-label" id="difficulty-label">Computer difficulty</p>
            <div className="difficulty-options" role="group" aria-labelledby="difficulty-label">
              {difficulties.map((option) => (
                <button key={option.value} className={difficulty === option.value ? 'selected' : ''} aria-pressed={difficulty === option.value} onClick={() => setDifficulty(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <p className="setup-hint">{difficulties.find((option) => option.value === difficulty)?.description}</p>
          </div>
          <div className="start-actions">
            <button className="primary-button" onClick={() => onStart(players, difficulty)}>Start game <span aria-hidden="true">✦</span></button>
            <RulesButton />
            <WalkthroughButton />
          </div>
        </section>
        <p className="start-footer"><a href="https://www.glaserbeamgames.com" target="_blank" rel="noreferrer">GLASERBEAM GAMES</a></p>
      </div>
    </main>
  )
}

export default StartScreen
