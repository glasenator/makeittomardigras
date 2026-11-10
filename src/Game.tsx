import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { makeDecks, type Card, type WeekDecks } from './deck'
import { canPlace, completedWeekTotals, DAYS, drawBlind, finalScore, flipCard, flipTargets, lastPlayStatus, legalMoves, newGame, playCard, shuffle, SLOTS, startNextWeek, sundayCardCount, WEEKS, winningPlayers } from './gameLogic'
import { activeValues, backValues, scheduleTotals } from './scheduleTotals'
import { formatValue } from './formatValue'
import RulesButton from './RulesButton'
import WalkthroughButton from './WalkthroughButton'
import { chooseBlindDraw, chooseComputerMove, chooseFlipTarget, type Difficulty } from './computerPlayer'

function CardNumber({ value, position }: { value: number; position: 'top' | 'bottom' | 'left' | 'right' }) {
  if (value !== 0) return <span>{formatValue(value)}</span>
  if (position === 'left' || position === 'right') {
    return (
      <span className={`flip-value flip-value-${position}`} aria-label={`FLIP: up, down, and ${position}`}>
        <span aria-hidden="true">↑</span>
        <span aria-hidden="true">{position === 'left' ? '← FLIP' : 'FLIP →'}</span>
        <span aria-hidden="true">↓</span>
      </span>
    )
  }
  return (
    <span className={`flip-value flip-value-${position}`} aria-label={`FLIP: left, right, and ${position === 'top' ? 'up' : 'down'}`}>
      <span className="flip-arrows" aria-hidden="true">{position === 'top' ? '↑' : '↓'}</span>
      <span aria-hidden="true">← FLIP →</span>
    </span>
  )
}

function CardFace({ top, bottom, horizontal = false }: { top: ReactNode; bottom: ReactNode; horizontal?: boolean }) {
  return (
    <div className={`card-face${horizontal ? ' card-face-horizontal' : ''}`}>
      {typeof top === 'number' ? <CardNumber value={top} position={horizontal ? 'left' : 'top'} /> : <span>{top}</span>}
      <hr />
      {typeof bottom === 'number' ? <CardNumber value={bottom} position={horizontal ? 'right' : 'bottom'} /> : <span>{bottom}</span>}
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

  const availableCards = state.blindCard ? [state.blindCard] : state.drawArea
  const noMoves = !state.pendingFlip && !state.weekComplete && !state.gameOver &&
    legalMoves(state.schedules[state.turn], availableCards).length === 0 && (state.blindCard !== null || state.deck.length === 0)

  const canPick = state.turn === 0 && !state.pendingFlip && !state.weekComplete && !isOver && !state.error && !noMoves

  const pick = useCallback((card: Card, day: number, slot: number) => {
    setState((s) => playCard(s, card.id, day, slot))
  }, [])

  useEffect(() => {
    if (state.weekComplete || isOver || state.error || noMoves || state.turn === 0) return
    const t = setTimeout(() => {
      if (state.pendingFlip) {
        const target = chooseFlipTarget(state, difficulty)
        if (!target) throw new Error('Computer FLIP has no eligible target.')
        setState((s) => flipCard(s, target.day, target.slot))
        return
      }
      if (chooseBlindDraw(state, difficulty)) {
        setState((s) => drawBlind(s))
        return
      }
      const move = chooseComputerMove(state, difficulty)
      if (!move) throw new Error('Computer turn has no eligible move.')
      pick(move.card, move.day, move.slot)
    }, 800)
    return () => clearTimeout(t)
  }, [state, isOver, noMoves, pick, difficulty])

  const spotAt = (e: DragEvent<HTMLDivElement>) => {
    const cardLeft = e.clientX - grab.current.x
    const cardTop = e.clientY - grab.current.y
    const days = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.day-inner'))
    const cardW = days[0].getBoundingClientRect().width
    const centerX = cardLeft + cardW / 2
    const day = days.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return centerX >= r.left && centerX <= r.right
    })
    if (day < 0) return null
    const rect = days[day].getBoundingClientRect()
    const slotH = rect.height / 4
    const slot = Math.min(Math.max(Math.round((cardTop - rect.top) / slotH), 0), draggedCard?.orientation === 'horizontal' ? SLOTS : SLOTS - 1)
    const player = state.schedules[0]
    return draggedCard && canPlace(player, day, slot, draggedCard) ? { day, slot } : null
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const spot = spotAt(e)
    const id = Number(e.dataTransfer.getData('text/plain'))
    const card = (state.blindCard ? [state.blindCard] : state.drawArea).find((c) => c.id === id)
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
    const totals = scheduleTotals(state.schedules[i], state.starting[i], bust)
    const targets = state.pendingFlip?.player === i && i === 0 ? flipTargets(state) : []
    return (
      <section className={`zone schedule-zone${i === 0 ? ' your-schedule' : ''}`}>
        <h2 className={i === state.turn && !state.weekComplete ? 'active' : ''}>
          {i === 0 ? 'Your' : `Computer ${i}'s`} Schedule Area{' '}
          <strong aria-live="polite">Points: {totals.points}</strong>
        </h2>
        {bust !== null && <p>Busted on {DAYS[bust]}; values in this column and later columns count as zero.</p>}
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
              <div key={day} className={`day${bust !== null && d >= bust ? ' busted-day' : ''}`}>
                <div className="day-label">{day}{bust !== null && d >= bust && <span className="sr-only"> (busted, values count as zero)</span>}</div>
                <div className="day-inner">
                  {state.schedules[i][d].map((card, slot) => {
                    if (!card) return null
                    const horizontal = card.orientation === 'horizontal'
                    const row = card.row ?? slot
                    const busted = bust !== null && d >= bust
                    const partiallyBusted = bust !== null && horizontal && d < bust && d + 1 >= bust
                    const target = targets.some((item) => item.day === d && item.slot === slot)
                    const values = activeValues(card)
                    const positiveBack = card.faceDown && values
                    const description = positiveBack
                      ? `positive back ${formatValue(values.top)}, ${formatValue(values.bottom)}`
                      : card.faceDown ? 'face-down card, counts as zero' : undefined
                    return (
                      <div
                        className={`card slotted${horizontal ? ' horizontal-card' : ''}${card.faceDown && !values ? ' card-back' : ''}${positiveBack ? ' positive-back' : ''}${!card.faceDown && card.top < 0 && card.bottom < 0 ? ' double-negative-card' : ''}${target ? ' flip-target' : ''}`}
                        style={{ '--slot': row, zIndex: card.sequence ?? card.placedAt } as CSSProperties}
                        key={card.id}
                        role={target ? 'button' : undefined}
                        tabIndex={target ? 0 : undefined}
                        aria-label={target ? `Flip ${DAYS[d]} ${horizontal ? `horizontal row ${row + 1}` : ['top', 'middle', 'bottom'][row]} card ${card.faceDown ? 'face up' : 'face down'}${description ? `; ${description}` : ''}` : partiallyBusted ? `Horizontal card: ${DAYS[d + 1]} section is busted and counts as zero${description ? `; ${description}` : ''}` : busted ? `Card in busted column, counts as zero${description ? `; ${description}` : ''}` : description}
                        onClick={target ? () => setState((s) => flipCard(s, d, slot)) : undefined}
                        onKeyDown={target ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setState((s) => flipCard(s, d, slot))
                          }
                        } : undefined}
                      >
                        {values ? <CardFace top={values.top} bottom={values.bottom} horizontal={horizontal} /> : '🂠'}
                      </div>
                    )
                  })}
                  {i === 0 && !isOver && draggedCard && Array.from({ length: draggedCard.orientation === 'horizontal' ? 4 : SLOTS }, (_, slot) => slot).map((slot) =>
                    canPlace(state.schedules[i], d, slot, draggedCard) && (
                      <div
                        key={`slot-${slot}`}
                        className={`slot-zone${draggedCard.orientation === 'horizontal' ? ' horizontal-slot' : ''}${hover?.day === d && hover.slot === slot ? ' hover' : ''}`}
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
  const blindSkipMessage = state.blindSkip &&
    `${state.blindSkip.player === 0 ? 'You drew' : `Computer ${state.blindSkip.player} drew`} ${state.blindSkip.card.top === 0 ? 'FLIP' : formatValue(state.blindSkip.card.top)} / ${state.blindSkip.card.bottom === 0 ? 'FLIP' : formatValue(state.blindSkip.card.bottom)} from the deck. There was no legal placement, so the card was set aside and the turn was skipped.`

  if (isOver) {
    const totals = completedWeekTotals(state)
    const highestScore = Math.max(...totals.map(finalScore))
    const winners = winningPlayers(state).map((i) => i === 0 ? 'You' : `Computer ${i}`)

    return (
      <main className="game game-over">
        <header className="game-over-header">
          <p className="eyebrow">✦ Make it to Mardi Gras ✦</p>
          <h1 ref={gameOverHeading} tabIndex={-1}>Game over</h1>
          <p className="game-over-winner">{winners.length === 1 ? 'Winner' : 'Winners'}: {winners.join(', ')}</p>
          <p>Winning final score: {highestScore}</p>
          <p>Final score = victory points − money − energy. Ties go to the most cards in Sunday.</p>
        </header>
        {toolbar}
        {blindSkipMessage && <p className="blind-notice" role="status">{blindSkipMessage}</p>}
        <section className="final-boards" aria-labelledby="final-boards-heading">
          <h2 id="final-boards-heading">Final schedules</h2>
          <p>Scores use carried-over points and resources after week 3 busts. Sunday counts include covered cards and cards in busted columns.</p>
          {state.schedules.map((schedule, i) => <div key={i}>
            <p className="final-score">{i === 0 ? 'Your' : `Computer ${i}'s`} final score: <strong>{finalScore(totals[i])}</strong> ({totals[i].points} points − {totals[i].money} money − {totals[i].energy} energy); Sunday cards: {sundayCardCount(schedule)}</p>
            {renderSchedule(i)}
          </div>)}
        </section>
      </main>
    )
  }

  const playableIds = new Set(legalMoves(state.schedules[state.turn], availableCards).map((move) => move.card.id))
  const lastPlay = lastPlayStatus(state)
  const topCard = state.deck[0]
  const topBack = topCard ? backValues(topCard) : null
  const renderDrawCard = (card: Card, enabled: boolean) => (
    <div
      className={`card${card.orientation === 'horizontal' ? ' horizontal-card' : ''}${card.top < 0 && card.bottom < 0 ? ' double-negative-card' : ''}${enabled ? ' pickable' : ''}`}
      key={card.id}
      draggable={enabled}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(card.id))
        const rect = e.currentTarget.getBoundingClientRect()
        grab.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width }
        setDraggedCard(card)
      }}
      onDragEnd={clearDrag}
    >
      <CardFace top={card.top} bottom={card.bottom} horizontal={card.orientation === 'horizontal'} />
    </div>
  )

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
          <div
            className={`card${topBack ? ` positive-back${topCard.orientation === 'horizontal' ? ' horizontal-card' : ''}` : ' card-back'}`}
            aria-label={topBack ? `Top of deck: positive back ${formatValue(topBack.top)}, ${formatValue(topBack.bottom)}${topCard.orientation === 'horizontal' ? ', horizontal' : ''}` : state.deck.length ? 'Top of deck: blank card back' : 'Deck empty'}
          >
            {topBack ? <CardFace top={topBack.top} bottom={topBack.bottom} horizontal={topCard.orientation === 'horizontal'} /> : state.deck.length ? '🂠' : 'Empty'}
          </div>
          <button type="button" className="blind-draw-button" disabled={!canPick || !!state.blindCard || state.deck.length === 0} onClick={() => setState((s) => drawBlind(s))}>Draw blind</button>
        </div>
        <div className="draw-area">
          <h2>Draw area ({state.drawArea.length})</h2>
          <div className="cards">
            {state.drawArea.map((card) => renderDrawCard(card, canPick && !state.blindCard && playableIds.has(card.id)))}
          </div>
        </div>
        {state.blindCard && (
          <div className={`blind-reveal${state.blindCard.orientation === 'horizontal' ? ' blind-reveal-horizontal' : ''}`}>
            <h2>Blind draw</h2>
            {renderDrawCard(state.blindCard, canPick && playableIds.has(state.blindCard.id))}
            <p>{state.turn === 0 ? 'Place this card.' : `Computer ${state.turn} is placing this card.`}</p>
          </div>
        )}
      </section>

      {renderSchedule(0)}
      <div className="week-controls">
        {blindSkipMessage && <p className="blind-notice" role="status">{blindSkipMessage}</p>}
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
                  : state.pendingFlip
                    ? state.turn === 0 ? `Choose a highlighted card for the ${state.schedules[0][state.pendingFlip.day][state.pendingFlip.slot]?.orientation === 'horizontal' ? state.pendingFlip.halves[0] === 'top' ? 'left' : 'right' : state.pendingFlip.halves[0]} FLIP.` : `Computer ${state.turn} is choosing a card to flip…`
                  : noMoves
                    ? `${state.turn === 0 ? 'You have' : `Computer ${state.turn} has`} no eligible placement. Start a new game.`
                    : state.turn === 0
                      ? state.blindCard ? 'Your blind card is revealed: drag it into your schedule.' : 'Your turn: choose a face-up card or draw blind from the deck.'
                      : `Computer ${state.turn} is picking…`}
            {lastPlay === 'last' && ' Last play of the week!'}
            {lastPlay === 'possible' && ' Some plays may end the week.'}
            {state.extraTurns !== null && !state.error && !isOver && ` ${state.extraTurns} final ${state.extraTurns === 1 ? 'turn' : 'turns'} remaining.`}
          </span>
        </p>
        {state.weekComplete && !isOver && <button className="primary-button" onClick={() => setState(startNextWeek)}>Start next week</button>}
      </div>
    </main>
  )
}

export default Game
