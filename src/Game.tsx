import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { makeDecks, type Card, type WeekDecks } from './deck'
import { canPlace, completedWeekTotals, computersAbleToReachTuesday, DAYS, drawBlind, finalScore, flipCard, flipTargets, lastPlayStatus, legalMoves, newGame, playCard, shuffle, SLOTS, startNextWeek, tuesdayCardCount, WEEKS, winningPlayers } from './gameLogic'
import { activeValues, backValues, scheduleTotals } from './scheduleTotals'
import { formatValue } from './formatValue'
import cardDealUrl from './assets/carddeal.m4a'
import shuffleUrl from './assets/shuffle.m4a'
import placeUrl from './assets/place.m4a'
import flipUrl from './assets/flip.m4a'
import bustUrl from './assets/bust.m4a'
import RulesButton from './RulesButton'
import WalkthroughButton from './WalkthroughButton'
import NeonTitle from './NeonTitle'
import ComputerSchedules from './ComputerSchedules'
import { chooseBlindDraw, chooseComputerMove, chooseFlipTarget, type Difficulty } from './computerPlayer'
import CardNumber from './CardNumber'

function CardFace({ top, bottom, horizontal = false }: { top: ReactNode; bottom: ReactNode; horizontal?: boolean }) {
  return (
    <div className={`card-face${horizontal ? ' card-face-horizontal' : ''}`}>
      {typeof top === 'number' ? <CardNumber value={top} position={horizontal ? 'left' : 'top'} /> : <span>{top}</span>}
      <hr />
      {typeof bottom === 'number' ? <CardNumber value={bottom} position={horizontal ? 'right' : 'bottom'} /> : <span>{bottom}</span>}
    </div>
  )
}

function CarnivalPointsLabel() {
  return (
    <>
      <span className="sr-only">Carnival points: </span>
      <span className="carnival-points-icon" aria-hidden="true">🎭</span>
    </>
  )
}

type Props = { numPlayers: number; difficulty: Difficulty; onExit: () => void; audioEnabled: boolean }

const compactSchedulesQuery = '(max-width: 950px) and (max-height: 500px) and (orientation: landscape)'
const subscribeCompactSchedules = (callback: () => void) => {
  const media = window.matchMedia(compactSchedulesQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const getCompactSchedules = () => window.matchMedia(compactSchedulesQuery).matches

function shuffledDecks(): WeekDecks {
  const [first, second, third] = makeDecks()
  return [shuffle(first), shuffle(second), shuffle(third)]
}

function Game({ numPlayers, difficulty, onExit, audioEnabled }: Props) {
  const [state, setState] = useState(() => newGame(numPlayers, shuffledDecks()))
  const previousDealState = useRef<typeof state | null>(null)
  const dealSounds = useRef({ remaining: 0, timer: 0 })
  const deckCardRef = useRef<HTMLDivElement>(null)
  const drawCardRefs = useRef(new Map<number, HTMLDivElement>())
  const scheduleCardRefs = useRef(new Map<number, HTMLDivElement>())
  const previousFaceDownStates = useRef<Map<number, boolean> | null>(null)
  const [dealingCardIds, setDealingCardIds] = useState<number[]>([])

  const touchDrag = useRef<{ pointerId: number; card: Card; startX: number; startY: number; lastX: number; lastY: number; lastTime: number; offsetX: number; offsetY: number; active: boolean } | null>(null)
  const suppressCardClick = useRef(false)
  const scheduleRef = useRef<HTMLDivElement>(null)
  const gameOverHeading = useRef<HTMLHeadingElement>(null)
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)
  const [dragPreview, setDragPreview] = useState<{ card: Card; left: number; top: number; rotation: number; tiltX: number; tiltY: number; scale: number } | null>(null)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [hover, setHover] = useState<{ day: number; slot: number } | null>(null)
  const compactSchedules = useSyncExternalStore(subscribeCompactSchedules, getCompactSchedules, () => false)
  const [computerScheduleOverrides, setComputerScheduleOverrides] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const previous = previousDealState.current
    previousDealState.current = state

    const previousDrawIds = new Set(previous?.drawArea.map((card) => card.id) ?? [])
    const dealSources = previous
      ? [...previous.deck, ...(state.week !== previous.week ? previous.futureDecks[0] ?? [] : [])]
      : []
    const dealSourceIds = new Set(dealSources.map((card) => card.id))
    const dealtCards = previous
      ? state.drawArea.filter((card) => !previousDrawIds.has(card.id) && dealSourceIds.has(card.id))
      : state.drawArea
    setDealingCardIds(dealtCards.map((card) => card.id))

    if (audioEnabled && previous && state.week > previous.week) {
      const audio = new Audio(shuffleUrl)
      audio.volume = 0.5
      void audio.play().catch((error: unknown) => console.warn('Unable to play the shuffle sound.', error))
    }

    if (audioEnabled && previous && !previous.weekComplete && state.weekComplete && state.bustColumns[0] !== null) {
      const audio = new Audio(bustUrl)
      audio.volume = 0.5
      void audio.play().catch((error: unknown) => console.warn('Unable to play the bust sound.', error))
    }

    if (!audioEnabled || dealtCards.length === 0) return

    dealSounds.current.remaining += dealtCards.length
    const playNextDealSound = () => {
      dealSounds.current.timer = 0
      if (dealSounds.current.remaining === 0) return

      dealSounds.current.remaining -= 1
      const audio = new Audio(cardDealUrl)
      audio.volume = 0.28
      void audio.play().catch((error: unknown) => console.warn('Unable to play the card deal sound.', error))

      if (dealSounds.current.remaining > 0) {
        dealSounds.current.timer = window.setTimeout(playNextDealSound, 120)
      }
    }

    if (!dealSounds.current.timer) playNextDealSound()
  }, [audioEnabled, state])

  useLayoutEffect(() => {
    const currentFaceDownStates = new Map(
      state.schedules.flatMap((schedule) => schedule.flatMap((column) =>
        column.filter((card): card is NonNullable<typeof card> => card !== null).map((card) => [card.id, card.faceDown === true] as const),
      )),
    )
    const previous = previousFaceDownStates.current
    previousFaceDownStates.current = currentFaceDownStates
    if (!previous || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    for (const [id, faceDown] of currentFaceDownStates) {
      if (previous.get(id) === undefined || previous.get(id) === faceDown) continue
      const card = scheduleCardRefs.current.get(id)
      if (!card) continue
      const horizontal = card.classList.contains('horizontal-card')
      const positionTransform = horizontal ? '' : ' translateX(-50%)'
      card.animate(
        [
          { transform: `perspective(700px) rotateY(180deg)${positionTransform}` },
          { transform: `perspective(700px) rotateY(90deg)${positionTransform}`, offset: 0.5 },
          { transform: `perspective(700px) rotateY(0deg)${positionTransform}` },
        ],
        { duration: 460, easing: 'ease-in-out' },
      )
    }
  }, [state])

  useLayoutEffect(() => {
    if (dealingCardIds.length === 0) return
    const source = deckCardRef.current?.getBoundingClientRect()
    if (!source || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    dealingCardIds.forEach((id, index) => {
      const card = drawCardRefs.current.get(id)
      if (!card) return
      const target = card.getBoundingClientRect()
      const deltaX = source.left + source.width / 2 - (target.left + target.width / 2)
      const deltaY = source.top + source.height / 2 - (target.top + target.height / 2)
      const rotation = deltaX < 0 ? -9 : 9
      card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.7) rotate(${rotation}deg)`, opacity: 0.35 },
          { transform: 'translate(0, 0) scale(1) rotate(0)', opacity: 1 },
        ],
        { duration: 420, delay: index * 110, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' },
      )
    })
  }, [dealingCardIds])

  const clearDrag = useCallback(() => {
    setDraggedCard(null)
    setDragPreview(null)
    setHover(null)
  }, [])

  const moveDragPreview = useCallback((card: Card, left: number, top: number, deltaX: number, deltaY: number, elapsed: number) => {
    const speedX = deltaX / elapsed
    const speedY = deltaY / elapsed
    const speed = Math.hypot(speedX, speedY)
    const clampAngle = (angle: number) => Math.max(-30, Math.min(30, angle))
    const rotation = clampAngle(speedX * 3 + speedY)
    const tiltX = clampAngle(-speedY * 2.5)
    const tiltY = clampAngle(speedX * 2.5)
    const scale = 1.1 + Math.min(speed / 900, 0.14)
    setDragPreview({ card, left, top, rotation, tiltX, tiltY, scale })
  }, [])

  const isOver = state.gameOver
  useEffect(() => {
    if (isOver) gameOverHeading.current?.focus()
  }, [isOver])

  const availableCards = state.blindCard ? [state.blindCard] : state.drawArea
  const noMoves = !state.pendingFlip && !state.weekComplete && !state.gameOver &&
    legalMoves(state.schedules[state.turn], availableCards).length === 0 && (state.blindCard !== null || state.deck.length === 0)

  const canPick = state.turn === 0 && !state.pendingFlip && !state.weekComplete && !isOver && !state.error && !noMoves

  useEffect(() => {
    if (state.turn === 0 && state.blindCard) setSelectedCard(state.blindCard)
  }, [state.blindCard, state.turn])

  const pick = useCallback((card: Card, day: number, slot: number, human = false) => {
    if (human && audioEnabled && state.turn === 0 && canPlace(state.schedules[0], day, slot, card)) {
      const audio = new Audio(placeUrl)
      audio.volume = 0.5
      void audio.play().catch((error: unknown) => console.warn('Unable to play the card placement sound.', error))
    }
    setState((s) => playCard(s, card.id, day, slot))
    setSelectedCard(null)
  }, [audioEnabled, state])

  const flipPlayerCard = useCallback((day: number, slot: number) => {
    const isPlayerFlip = state.pendingFlip?.player === 0 &&
      flipTargets(state).some((target) => target.day === day && target.slot === slot)
    if (isPlayerFlip && audioEnabled) {
      const audio = new Audio(flipUrl)
      audio.volume = 0.5
      void audio.play().catch((error: unknown) => console.warn('Unable to play the card flip sound.', error))
    }
    setState((s) => flipCard(s, day, slot))
  }, [audioEnabled, state])

  const spotAtPosition = useCallback((clientX: number, clientY: number, card: Card, offsetX: number, offsetY: number) => {
    const daysContainer = scheduleRef.current
    if (!daysContainer) return null
    const days = Array.from(daysContainer.querySelectorAll<HTMLElement>('.day-inner'))
    const cardW = days[0]?.getBoundingClientRect().width
    if (!cardW) return null
    const centerX = clientX - offsetX + cardW / 2
    const day = days.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return centerX >= r.left && centerX <= r.right
    })
    if (day < 0) return null
    const rect = days[day].getBoundingClientRect()
    const slot = Math.min(Math.max(Math.round((clientY - offsetY - rect.top) / (rect.height / 4)), 0), card.orientation === 'horizontal' ? SLOTS : SLOTS - 1)
    return canPlace(state.schedules[0], day, slot, card) ? { day, slot } : null
  }, [state.schedules])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = touchDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return
      if (!drag.active) {
        drag.active = true
        suppressCardClick.current = true
        setSelectedCard(null)
        setDraggedCard(drag.card)
      }
      event.preventDefault()
      const now = performance.now()
      moveDragPreview(
        drag.card,
        event.clientX - drag.offsetX,
        event.clientY - drag.offsetY,
        event.clientX - drag.lastX,
        event.clientY - drag.lastY,
        Math.max(1, now - drag.lastTime),
      )
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      drag.lastTime = now
      const spot = spotAtPosition(event.clientX, event.clientY, drag.card, drag.offsetX, drag.offsetY)
      setHover(spot)
    }
    const onPointerUp = (event: PointerEvent) => {
      const drag = touchDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (drag.active) {
        const spot = spotAtPosition(event.clientX, event.clientY, drag.card, drag.offsetX, drag.offsetY)
        if (spot && canPick) pick(drag.card, spot.day, spot.slot, true)
        clearDrag()
        window.setTimeout(() => { suppressCardClick.current = false }, 0)
      }
      touchDrag.current = null
    }
    const onPointerCancel = (event: PointerEvent) => {
      if (touchDrag.current?.pointerId !== event.pointerId) return
      touchDrag.current = null
      clearDrag()
    }
    const onVisibilityChange = () => {
      if (document.hidden) clearDrag()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('blur', clearDrag)
    window.addEventListener('dragend', clearDrag)
    window.addEventListener('drop', clearDrag)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', clearDrag)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('dragend', clearDrag)
      window.removeEventListener('drop', clearDrag)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [canPick, clearDrag, moveDragPreview, pick, spotAtPosition])

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
      pick(move.card, move.day, move.slot, false)
    }, 800)
    return () => clearTimeout(t)
  }, [state, isOver, noMoves, pick, difficulty])

  const onScheduleTap = (event: MouseEvent<HTMLDivElement>, day: number) => {
    if (!canPick || !selectedCard) return
    const rect = event.currentTarget.getBoundingClientRect()
    const slot = Math.min(Math.max(Math.floor((event.clientY - rect.top) / (rect.height / 4)), 0),
      selectedCard.orientation === 'horizontal' ? SLOTS : SLOTS - 1)
    if (canPlace(state.schedules[0], day, slot, selectedCard)) pick(selectedCard, day, slot, true)
  }

  const lastPlay = lastPlayStatus(state)
  const computersNearTuesday = computersAbleToReachTuesday(state)
  const computersAtRisk = new Set(computersNearTuesday)
  if (state.turn > 0 && lastPlay) computersAtRisk.add(state.turn)

  const renderSchedule = (i: number) => {
    const bust = state.bustColumns[i]
    const totals = state.weekComplete
      ? completedWeekTotals(state)[i]
      : scheduleTotals(state.schedules[i], state.starting[i], bust)
    const targets = state.pendingFlip?.player === i && i === 0 ? flipTargets(state) : []
    const placementCard = draggedCard ?? selectedCard
    return (
      <section className={`zone schedule-zone${i === 0 ? ' your-schedule' : ''}${i === state.turn && !state.weekComplete ? ' active-player' : ''}${computersAtRisk.has(i) ? ' computer-week-threat' : ''}${bust !== null ? i === 0 ? ' player-busted' : ' computer-busted' : ''}`}>
        <div className="schedule-heading">
          <div className="schedule-title">
            <h2 className={i === state.turn && !state.weekComplete ? 'active' : ''}>
              {i === 0 ? 'Your' : `Computer ${i}'s`} Schedule
            </h2>
            {computersAtRisk.has(i) && <span className="sr-only">May end the week.</span>}
            {isOver ? (
              <>
                <span className="sr-only">Final score: {totals.points} carnival points minus {totals.money} money minus {totals.energy} energy equals {finalScore(totals)}. Fat Tuesday cards: {tuesdayCardCount(state.schedules[i])}.</span>
                <div className="final-calculation" aria-hidden="true">
                  <span className="carnival-points final-score-value"><CarnivalPointsLabel /><strong>{totals.points}</strong></span>
                  <span className="final-score-operator">−</span>
                  <span className="final-score-value final-score-money"><span>💰</span><strong>{totals.money}</strong></span>
                  <span className="final-score-operator">−</span>
                  <span className="final-score-value final-score-energy"><span>⚡</span><strong>{totals.energy}</strong></span>
                  <span className="final-score-operator">=</span>
                  <strong className="final-score-result">{finalScore(totals)}</strong>
                </div>
                <span className="final-tuesday-count" aria-hidden="true">Fat Tuesday cards: {tuesdayCardCount(state.schedules[i])}</span>
              </>
            ) : i === 0 && (
              <div className="carnival-points" aria-live="polite">
                <CarnivalPointsLabel />{' '}
                <strong className="carnival-points-score">{totals.points}</strong>
              </div>
            )}
          </div>
          {i === 0 && !isOver && (
            <div className="schedule-tools">
              {state.weekComplete ? (
                <button
                  className="primary-button start-next-week"
                  onClick={() => setState(startNextWeek)}
                >
                  Start next week
                </button>
              ) : (
                <div className="week-badge"><span>Carnival Season</span><strong>Week {state.week} <small>of {WEEKS}</small></strong></div>
              )}
            </div>
          )}
          {i === 0 && (!isOver || bust !== null) && weekControls(bust)}
        </div>
        {i !== 0 && bust !== null && <p className="computer-busted-message">Busted on {DAYS[bust]}; values in this column and later columns count as zero.</p>}
        <div className={`player-row${state.week === WEEKS ? ' final-week-row' : ''}`}>
          <div className="card start-card">
            {i === 0 && <span className="start-card-mask start-card-mask-above" aria-hidden="true">🎭</span>}
            <CardFace top={`💰 ${state.starting[i].money}`} bottom={`⚡ ${state.starting[i].energy}`} />
            {i === 0 && <span className="start-card-mask start-card-mask-below" aria-hidden="true">🎭</span>}
          </div>
          {i !== 0 && !isOver && <strong className="computer-carnival-points" aria-live="polite"><CarnivalPointsLabel />{' '}{totals.points}</strong>}
          <div
            className={`days${state.week === WEEKS ? ' final-week' : ''}`}
            id={i !== 0 ? `computer-schedule-days-${i}` : undefined}
            ref={i === 0 ? scheduleRef : undefined}
          >
            {DAYS.map((day, d) => (
              <div key={day} className={`day${state.week === WEEKS && d === DAYS.length - 1 ? ' mardi-gras-day' : ''}${bust !== null && d >= bust ? ' busted-day' : ''}`}>
                <div className="day-label">
                  {day}
                  {state.week === WEEKS && d === DAYS.length - 1 && <span className="mardi-gras-tag">Mardi Gras</span>}
                  {bust !== null && d >= bust && <span className="sr-only"> (busted, values count as zero)</span>}
                </div>
                <div className="day-inner" onClick={(event) => i === 0 && onScheduleTap(event, d)}>
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
                        ref={(element) => {
                          if (element) scheduleCardRefs.current.set(card.id, element)
                          else scheduleCardRefs.current.delete(card.id)
                        }}
                        className={`card slotted${horizontal ? ' horizontal-card' : ''}${card.faceDown && !values ? ' card-back' : ''}${positiveBack ? ' positive-back' : ''}${!card.faceDown && card.top < 0 && card.bottom < 0 ? ' double-negative-card' : ''}${target ? ' flip-target' : ''}`}
                        style={{ '--slot': row, zIndex: card.sequence ?? card.placedAt } as CSSProperties}
                        key={card.id}
                        role={target ? 'button' : undefined}
                        tabIndex={target ? 0 : undefined}
                        aria-label={target ? `Flip ${DAYS[d]} ${horizontal ? `horizontal row ${row + 1}` : ['top', 'middle', 'bottom'][row]} card ${card.faceDown ? 'face up' : 'face down'}${description ? `; ${description}` : ''}` : partiallyBusted ? `Horizontal card: ${DAYS[d + 1]} section is busted and counts as zero${description ? `; ${description}` : ''}` : busted ? `Card in busted column, counts as zero${description ? `; ${description}` : ''}` : description}
                        onClick={target ? (event) => {
                          event.stopPropagation()
                          flipPlayerCard(d, slot)
                        } : undefined}
                        onKeyDown={target ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            flipPlayerCard(d, slot)
                          }
                        } : undefined}
                      >
                        {values ? <CardFace top={values.top} bottom={values.bottom} horizontal={horizontal} /> : <hr className="card-back-divider" aria-hidden="true" />}
                      </div>
                    )
                  })}
                  {i === 0 && !isOver && placementCard && Array.from({ length: placementCard.orientation === 'horizontal' ? 4 : SLOTS }, (_, slot) => slot).map((slot) =>
                    canPlace(state.schedules[i], d, slot, placementCard) && (
                      <div
                        key={`slot-${slot}`}
                        className={`slot-zone${placementCard.orientation === 'horizontal' ? ' horizontal-slot' : ''}${hover?.day === d && hover.slot === slot ? ' hover' : ''}`}
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

  const gameHeader = (
    <header className="game-header">
      <div>
        <h1>Make it to <NeonTitle /></h1>
        <p className="game-subtitle">Let the good times roll.</p>
      </div>
    </header>
  )
  const toolbar = (
    <div className="toolbar">
      <button onClick={() => { clearDrag(); setState(newGame(numPlayers, shuffledDecks())) }}>New game</button>
      <button onClick={onExit}>Back to start</button>
      <WalkthroughButton />
      <RulesButton />
      <span className="difficulty-badge">Difficulty: {difficulty}</span>
    </div>
  )
  const blindSkipMessage = state.blindSkip &&
    `${state.blindSkip.player === 0 ? 'You drew' : `Computer ${state.blindSkip.player} drew`} ${state.blindSkip.card.top === 0 ? 'FLIP' : formatValue(state.blindSkip.card.top)} / ${state.blindSkip.card.bottom === 0 ? 'FLIP' : formatValue(state.blindSkip.card.bottom)} from the deck. There was no legal placement, so the card was set aside and the turn was skipped.`
  const weekControls = (bust: number | null) => (
    <div className="week-controls schedule-controls">
      {blindSkipMessage && <p className="blind-notice" role="status">{blindSkipMessage}</p>}
      <p className={`status${state.extraTurns !== null ? ' status-final-turns' : ''}${lastPlay || computersNearTuesday.length > 0 ? ' status-last-play' : ''}${bust !== null ? ' status-busted' : ''}`} role="status">
        <span className="status-sparkle" aria-hidden="true">✦</span>
        <span>
          {state.finalTurnOrder !== null && !state.error && !isOver && 'Final Mardi Gras turns! Players go in picked-card value order; players who played vertically into Tuesday sit out. '}
          {state.finalTurnTrigger !== null && state.finalTurnOrder === null && !state.error && !isOver && 'Tuesday reached! Finish the current draw; then players who did not play vertically into Tuesday take one final turn in picked-card value order. '}
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
                    ? state.blindCard ? selectedCard ? 'Tap an open highlighted space to place your blind card.' : 'Your blind card is revealed: drag it or tap it, then tap an open highlighted space.' : selectedCard ? 'Tap an open highlighted space to place your selected card.' : 'Your turn: drag or tap a face-up card, or draw blind.'
                    : `Computer ${state.turn} is picking…`}
          {lastPlay === 'last' && ' Last play of the week!'}
          {lastPlay === 'possible' && <span className="status-warning-line">Some plays may end the week.</span>}
          {computersNearTuesday.length > 0 && ` ${computersNearTuesday.map((player) => `Computer ${player}`).join(', ')} may reach Tuesday on a future turn.`}
          {state.extraTurns !== null && !state.error && !isOver && ` ${state.extraTurns} final ${state.extraTurns === 1 ? 'turn' : 'turns'} remaining.`}
          {bust !== null && <span className="status-warning-line">Busted on {DAYS[bust]}; values in this column and later columns count as zero.</span>}
        </span>
      </p>
    </div>
  )

  if (isOver) {
    const totals = completedWeekTotals(state)
    const highestScore = Math.max(...totals.map(finalScore))
    const winnerIndices = winningPlayers(state)
    const winners = winnerIndices.map((i) => i === 0 ? 'You' : `Computer ${i}`)

    return (
      <main className="game game-over">
        <header className="game-over-header">
          <h1 ref={gameOverHeading} tabIndex={-1}>Game over</h1>
          <p className={`game-over-winner${winnerIndices.includes(0) ? '' : ' computer-winner'}`}>{winners.length === 1 ? 'Winner' : 'Winners'}: {winners.join(', ')}</p>
          <p>Winning final score: {highestScore}</p>
          <p>Final score = carnival points − money − energy. Ties go to the most cards in Fat Tuesday.</p>
        </header>
        <div className="game-over-navigation">
          {gameHeader}
          {toolbar}
        </div>
        {blindSkipMessage && <p className="blind-notice" role="status">{blindSkipMessage}</p>}
        <section className="final-boards" aria-labelledby="final-boards-heading">
          <h2 id="final-boards-heading">Final schedules</h2>
          <p>Final scores use only visible card values after week 3 busts, plus carried-over points and resources. The Fat Tuesday card count is a separate tiebreaker and includes covered cards and cards in busted columns.</p>
          {state.schedules.map((_, i) => <div key={i}>
            {renderSchedule(i)}
          </div>)}
        </section>
      </main>
    )
  }

  const playableIds = new Set(legalMoves(state.schedules[state.turn], availableCards).map((move) => move.card.id))
  const topCard = state.deck[0]
  const topBack = topCard ? backValues(topCard) : null
  const renderDrawCard = (card: Card, enabled: boolean) => (
    <div
      ref={(element) => {
        if (element) drawCardRefs.current.set(card.id, element)
        else drawCardRefs.current.delete(card.id)
      }}
      className={`card${card.orientation === 'horizontal' ? ' horizontal-card' : ''}${card.top < 0 && card.bottom < 0 ? ' double-negative-card' : ''}${enabled ? ' pickable' : ''}${selectedCard?.id === card.id ? ' selected-for-play' : ''}${draggedCard?.id === card.id ? ' drag-source' : ''}`}
      key={card.id}
      draggable={false}
      role={enabled ? 'button' : undefined}
      tabIndex={enabled ? 0 : undefined}
      aria-pressed={enabled ? selectedCard?.id === card.id : undefined}
      onClick={enabled ? () => {
        if (suppressCardClick.current) {
          suppressCardClick.current = false
          return
        }
        setSelectedCard((selected) => selected?.id === card.id ? null : card)
      } : undefined}
      onPointerDown={enabled ? (event) => {
        if (event.button !== 0) return
        const rect = event.currentTarget.getBoundingClientRect()
        touchDrag.current = {
          pointerId: event.pointerId,
          card,
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          lastTime: performance.now(),
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          active: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      } : undefined}
      onKeyDown={enabled ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setSelectedCard((selected) => selected?.id === card.id ? null : card)
        }
      } : undefined}
    >
      <CardFace top={card.top} bottom={card.bottom} horizontal={card.orientation === 'horizontal'} />
    </div>
  )

  return (
    <main className="game">
      {gameHeader}
      <p className="rotate-notice">For a roomier table, rotate your phone sideways. You can also scroll the schedule and cards.</p>
      {toolbar}

      <span className="difficulty-badge computer-section-difficulty">Difficulty: {difficulty}</span>
      <ComputerSchedules>
        {state.schedules.slice(1).map((_, k) => {
          const player = k + 1
          const expanded = computerScheduleOverrides[player] ?? !compactSchedules
          const toggle = () => setComputerScheduleOverrides((current) => ({
            ...current,
            [player]: !(current[player] ?? !compactSchedules),
          }))
          return (
            <div
              className={`computer-schedule${expanded ? ' expanded' : ''}`}
              key={player}
              role="button"
              tabIndex={0}
              aria-label={`Computer ${player}'s schedule`}
              aria-expanded={expanded}
              aria-controls={`computer-schedule-days-${player}`}
              onClick={toggle}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggle()
                }
              }}
            >
              {renderSchedule(player)}
            </div>
          )
        })}
      </ComputerSchedules>

      <section className="zone play-area">
        <div className="deck-pile">
          <h2>Deck ({state.deck.length})</h2>
          <div
            ref={deckCardRef}
            className={`card${topBack ? ` positive-back${topCard.orientation === 'horizontal' ? ' horizontal-card' : ''}` : ' card-back'}`}
            aria-label={topBack ? `Top of deck: positive back ${formatValue(topBack.top)}, ${formatValue(topBack.bottom)}${topCard.orientation === 'horizontal' ? ', horizontal' : ''}` : state.deck.length ? 'Top of deck: blank card back' : 'Deck empty'}
          >
            {topBack ? <CardFace top={topBack.top} bottom={topBack.bottom} horizontal={topCard.orientation === 'horizontal'} /> : state.deck.length ? <hr className="card-back-divider" aria-hidden="true" /> : 'Empty'}
          </div>
          <button type="button" className="blind-draw-button" disabled={!canPick || !!state.blindCard || state.deck.length === 0} onClick={() => setState((s) => drawBlind(s))}>Draw blind</button>
        </div>
        <div className="draw-area">
          <h2>Draw area ({state.drawArea.length})</h2>
          <div className={`cards${state.blindCard ? ' cards-unavailable' : ''}`} aria-label={state.blindCard ? 'Draw area unavailable while placing a blind card' : undefined}>
            {state.drawArea.map((card) => renderDrawCard(card, canPick && !state.blindCard && playableIds.has(card.id)))}
          </div>
        </div>
        {state.blindCard && (
          <div className="blind-reveal" aria-label="Blind draw">
            {renderDrawCard(state.blindCard, canPick && playableIds.has(state.blindCard.id))}
          </div>
        )}
      </section>

      {renderSchedule(0)}
      {dragPreview && (
        <div
          className={`card drag-preview${dragPreview.card.orientation === 'horizontal' ? ' horizontal-card' : ''}${dragPreview.card.top < 0 && dragPreview.card.bottom < 0 ? ' double-negative-card' : ''}`}
          aria-hidden="true"
          style={{
            left: dragPreview.left,
            top: dragPreview.top,
            '--drag-rotation': `${dragPreview.rotation}deg`,
            '--drag-tilt-x': `${dragPreview.tiltX}deg`,
            '--drag-tilt-y': `${dragPreview.tiltY}deg`,
            '--drag-scale': dragPreview.scale,
          } as CSSProperties}
        >
          <CardFace top={dragPreview.card.top} bottom={dragPreview.card.bottom} horizontal={dragPreview.card.orientation === 'horizontal'} />
        </div>
      )}
    </main>
  )
}

export default Game
