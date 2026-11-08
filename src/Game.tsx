import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { makeDecks, type Card, type WeekDecks } from './deck'
import { canPlace, completedWeekTotals, DAYS, lastPlayStatus, legalMoves, newGame, playCard, shuffle, SLOTS, startNextWeek, WEEKS, winningPlayers } from './gameLogic'
import { scheduleTotals } from './scheduleTotals'
import { formatValue } from './formatValue'
import RulesButton from './RulesButton'
import WalkthroughButton from './WalkthroughButton'
import { chooseComputerMove, type Difficulty } from './computerPlayer'

function CardFace({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <div className="card-face">
      <span>{typeof top === 'number' ? formatValue(top) : top}</span>
      <hr />
      <span>{typeof bottom === 'number' ? formatValue(bottom) : bottom}</span>
    </div>
  )
}

type Props = { numPlayers: number; difficulty: Difficulty; onExit: () => void }

function shuffledDecks(): WeekDecks {
  const [first, second, third] = makeDecks()
  return [shuffle(first), shuffle(second), shuffle(third)]
}

function Game({ numPlayers, difficulty, onExit }: Props) {
  const [state, setState] = useState(() => newGame(numPlayers, shuffledDecks()))

  const grab = useRef({ x: 0, y: 0, w: 0 }) // cursor offset within the dragged card
  const gameOverHeading = useRef<HTMLHeadingElement>(null)
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)
  const [hover, setHover] = useState<{ day: number; slot: number } | null>(null)

  const clearDrag = useCallback(() => {
    setDraggedCard(null)
    setHover(null)
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) clearDrag()
    }
    window.addEventListener('blur', clearDrag)
    window.addEventListener('dragend', clearDrag)
    window.addEventListener('drop', clearDrag)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', clearDrag)
      window.removeEventListener('dragend', clearDrag)
      window.removeEventListener('drop', clearDrag)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [clearDrag])

  const isOver = state.gameOver
  useEffect(() => {
    if (isOver) gameOverHeading.current?.focus()
  }, [isOver])

  const noMoves = !state.weekComplete && !state.gameOver && legalMoves(state.schedules[state.turn], state.drawArea).length === 0

  const canPick = state.turn === 0 && !state.weekComplete && !isOver && !state.error && !noMoves

  const pick = useCallback((card: Card, day: number, slot: number) => {
    setState((s) => playCard(s, card.id, day, slot))
  }, [])

  useEffect(() => {
    if (state.weekComplete || isOver || state.error || noMoves || state.turn === 0) return
    const t = setTimeout(() => {
      const move = chooseComputerMove(state, difficulty)
      if (!move) throw new Error('Computer turn has no eligible move.')
      pick(move.card, move.day, move.slot)
    }, 800)
    return () => clearTimeout(t)
  }, [state, isOver, noMoves, pick, difficulty])

  // Resolve the target spot from the dragged card's own position (not the cursor):
  // the day under the card's centre, and the slot whose top edge is nearest the card's top.
  const spotAt = (e: DragEvent<HTMLDivElement>) => {
    const cardLeft = e.clientX - grab.current.x
    const cardTop = e.clientY - grab.current.y
    const days = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.day-inner'))
    const cardW = days[0].querySelector('.slot-zone, .slotted')?.getBoundingClientRect().width ?? grab.current.w
    const centerX = cardLeft + cardW / 2
    const day = days.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return centerX >= r.left && centerX <= r.right
    })
    if (day < 0) return null
    const rect = days[day].getBoundingClientRect()
    const slotH = rect.height / 4
    const slot = Math.min(Math.max(Math.round((cardTop - rect.top) / slotH), 0), SLOTS - 1)
    const player = state.schedules[0]
    return draggedCard && canPlace(player, day, slot, draggedCard) ? { day, slot } : null
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const spot = spotAt(e)
    const id = Number(e.dataTransfer.getData('text/plain'))
    const card = state.drawArea.find((c) => c.id === id)
    if (card && canPick && spot) pick(card, spot.day, spot.slot)
    clearDrag()
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    const spot = spotAt(e)
    if (!spot) return setHover(null)
    e.preventDefault()
    setHover(spot)
  }

  const renderSchedule = (i: number) => {
    const bust = state.bustColumns[i]
    const totals = scheduleTotals(state.schedules[i].slice(0, bust ?? undefined), state.starting[i])
    return (
      <section className={`zone schedule-zone${i === 0 ? ' your-schedule' : ''}`}>
        <h2 className={i === state.turn && !state.weekComplete ? 'active' : ''}>
          {i === 0 ? 'Your' : `Computer ${i}'s`} Schedule Area{' '}
          <strong aria-live="polite">Points: {totals.points}</strong>
        </h2>
        {bust !== null && <p>Busted on {DAYS[bust]}; this column and later cards count as zero.</p>}
        <div className="player-row">
          <div className="card start-card">
            <CardFace top={`💰 ${state.starting[i].money}`} bottom={`⚡ ${state.starting[i].energy}`} />
          </div>
          <div
            className="days"
            onDragOver={i === 0 && canPick ? onDragOver : undefined}
            onDragLeave={i === 0 ? () => setHover(null) : undefined}
            onDrop={i === 0 ? onDrop : undefined}
          >
            {DAYS.map((day, d) => (
              <div key={day} className="day">
                <div className="day-label">{day}</div>
                <div className="day-inner">
                  {state.schedules[i][d].map((card, slot) =>
                    card && (
                      <div className={`card slotted${bust !== null && d >= bust ? ' card-back' : ''}`} style={{ '--slot': slot, zIndex: card.placedAt } as CSSProperties} key={card.id} aria-label={bust !== null && d >= bust ? 'Busted card, counts as zero' : undefined}>
                        {bust !== null && d >= bust ? '🂠' : <CardFace top={card.top} bottom={card.bottom} />}
                      </div>
                    ),
                  )}
                  {i === 0 && !isOver && draggedCard && state.schedules[i][d].map((_, slot) =>
                    canPlace(state.schedules[i], d, slot, draggedCard) && (
                      <div
                        key={`slot-${slot}`}
                        className={`slot-zone${hover?.day === d && hover.slot === slot ? ' hover' : ''}`}
                        style={{ '--slot': slot } as CSSProperties}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
          <div
            className="card total-card"
            aria-label={`Running total: money ${totals.money}, energy ${totals.energy}`}
            aria-live="polite"
          >
            <CardFace top={`💰 ${totals.money}`} bottom={`⚡ ${totals.energy}`} />
          </div>
        </div>
      </section>
    )
  }

  const toolbar = (
    <div className="toolbar">
      <button onClick={() => { clearDrag(); setState(newGame(numPlayers, shuffledDecks())) }}>New game</button>
      <button onClick={onExit}>Back to start</button>
      <RulesButton />
      <WalkthroughButton />
      <span className="difficulty-badge">Computer: {difficulty}</span>
    </div>
  )

  if (isOver) {
    const totals = completedWeekTotals(state)
    const highestPoints = Math.max(...totals.map((total) => total.points))
    const winners = winningPlayers(totals).map((i) => i === 0 ? 'You' : `Computer ${i}`)

    return (
      <main className="game game-over">
        <header className="game-over-header">
          <p className="eyebrow">✦ Make it to Mardi Gras ✦</p>
          <h1 ref={gameOverHeading} tabIndex={-1}>Game over</h1>
          <p className="game-over-winner">{winners.length === 1 ? 'Winner' : 'Winners'}: {winners.join(', ')}</p>
          <p>{highestPoints} victory {highestPoints === 1 ? 'point' : 'points'}</p>
          <p>Point ties are broken by energy, then money.</p>
        </header>
        {toolbar}
        <section className="final-boards" aria-labelledby="final-boards-heading">
          <h2 id="final-boards-heading">Final schedules</h2>
          <p>Final scores include carried-over points and any busts from week 3.</p>
          {state.schedules.map((_, i) => <div key={i}>{renderSchedule(i)}</div>)}
        </section>
      </main>
    )
  }

  const playableIds = new Set(legalMoves(state.schedules[state.turn], state.drawArea).map((move) => move.card.id))
  const lastPlay = lastPlayStatus(state)

  return (
    <main className="game">
      <header className="game-header">
        <div>
          <p className="eyebrow">✦ Make it to Mardi Gras ✦</p>
          <h1>Let the good times roll.</h1>
        </div>
        <div className="week-badge"><span>The celebration</span><strong>Week {state.week} <small>of {WEEKS}</small></strong></div>
      </header>
      {toolbar}

      <div className="computer-schedules" aria-label="Computer schedules">
        {state.schedules.slice(1).map((_, k) => (
          <div className="computer-schedule" key={k + 1}>{renderSchedule(k + 1)}</div>
        ))}
      </div>

      <section className="zone play-area">
        <div className="deck-pile">
          <h2>Deck ({state.deck.length})</h2>
          <div className="card card-back">{state.deck.length ? '🂠' : 'Empty'}</div>
        </div>
        <div className="draw-area">
          <h2>Draw area ({state.drawArea.length})</h2>
          <div className="cards">
            {state.drawArea.map((card) => (
              <div
                className={`card${canPick && playableIds.has(card.id) ? ' pickable' : ''}`}
                key={card.id}
                draggable={canPick && playableIds.has(card.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(card.id))
                  const rect = e.currentTarget.getBoundingClientRect()
                  grab.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width }
                  setDraggedCard(card)
                }}
                onDragEnd={clearDrag}
              >
                <CardFace top={card.top} bottom={card.bottom} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {renderSchedule(0)}
      <div className="week-controls">
        <p className={`status${state.extraTurns !== null ? ' status-final-turns' : ''}${lastPlay ? ' status-last-play' : ''}`} role="status">
          <span className="status-sparkle" aria-hidden="true">✦</span>
          <span>
            {state.extraTurns !== null && !state.error && !isOver && 'Final turns of the week! Each player gets one last turn. '}
            {state.error
              ? state.error
              : isOver
                ? 'Game over — all three weeks are complete.'
                : state.weekComplete
                  ? `Week ${state.week} complete. Review the results before starting the next week.`
                  : noMoves
                    ? `${state.turn === 0 ? 'You have' : `Computer ${state.turn} has`} no eligible placement. Start a new game.`
                    : state.turn === 0
                      ? 'Your turn: drag a card from the draw area into a day.'
                      : `Computer ${state.turn} is picking…`}
            {lastPlay === 'last' && ' Last play of the week!'}
            {lastPlay === 'possible' && ' This play ends the week unless a fifth-column placement starts final turns.'}
            {state.extraTurns !== null && !state.error && !isOver && ` ${state.extraTurns} final ${state.extraTurns === 1 ? 'turn' : 'turns'} remaining.`}
          </span>
        </p>
        {state.weekComplete && !isOver && <button className="primary-button" onClick={() => setState(startNextWeek)}>Start next week</button>}
      </div>
    </main>
  )
}

export default Game
