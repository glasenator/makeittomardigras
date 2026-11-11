import type { ReactNode } from 'react'
import CardNumber from './CardNumber'
import { DAYS } from './gameLogic'

function ExampleCard({ top, bottom, className = '' }: { top: string; bottom: string; className?: string }) {
  return (
    <span className={`tutorial-card ${className}`}>
      <span>{top === 'FLIP' ? <CardNumber value={0} position="top" /> : top}</span>
      <span>{bottom === 'FLIP' ? <CardNumber value={0} position="bottom" /> : bottom}</span>
    </span>
  )
}

const visuals: { caption: string; scene: ReactNode }[] = [
  {
    caption: 'Start with 5 MONEY and 5 ENERGY; play through three Weeks.',
    scene: <><div className="tutorial-weeks">{[1, 2, 3].map((week) => <div className="week-badge" key={week}><span>Carnival Season</span><strong>Week {week} <small>of 3</small></strong></div>)}</div><div className="tutorial-totals"><span className="tutorial-money">💰 5</span><span className="tutorial-energy">⚡ 5</span><span className="tutorial-points">🎭 0</span></div></>,
  },
  {
    caption: 'Three players draw in order from four face-up cards.',
    scene: <><div className="tutorial-cards"><ExampleCard top="+2" bottom="-2" /><ExampleCard top="-3" bottom="+3" className="tutorial-draw" /><ExampleCard top="FLIP" bottom="+2" /><ExampleCard top="+1" bottom="+1" /></div><div className="tutorial-flow"><span>Player 1</span><span>→</span><span>Player 2</span><span>→</span><span>Player 3</span></div></>,
  },
  {
    caption: 'A first card connects to a starting value beside Wednesday.',
    scene: <div className="tutorial-board">
      <div className="card start-card">
        <span className="start-card-mask start-card-mask-above">🎭</span>
        <div className="card-face"><span>💰 5</span><hr /><span>⚡ 5</span></div>
        <span className="start-card-mask start-card-mask-below">🎭</span>
      </div>
      <div className="days">
        {DAYS.slice(0, 3).map((day, index) => <div className="day" key={day}>
          <div className="day-label">{day}</div>
          <div className="day-inner">
            {index === 0 && <div className="card slotted tutorial-placement"><div className="card-face"><span>+2</span><hr /><span>-2</span></div></div>}
          </div>
        </div>)}
      </div>
    </div>,
  },
  {
    caption: 'The +5 covers the -3; the +3 remains visible.',
    scene: <div className="tutorial-overlap"><ExampleCard top="+3" bottom="-3" /><ExampleCard top="+5" bottom="-5" className="tutorial-cover-card" /></div>,
  },
  {
    caption: 'A double-negative card turns over to its positive back.',
    scene: <div className="tutorial-flip-scene"><ExampleCard top="FLIP" bottom="+8" /><span className="tutorial-arrow">→</span><span className="tutorial-flipped"><ExampleCard top="-2" bottom="-2" className="double-negative-card tutorial-flip-front" /><ExampleCard top="+2" bottom="+2" className="positive-back tutorial-flip-back" /></span></div>,
  },
  {
    caption: 'The four rows score CARNIVAL POINTS, MONEY, ENERGY, and CARNIVAL POINTS.',
    scene: <div className="tutorial-score-rows"><span>🎭 <b>+2</b></span><span>💰 <b>-2</b></span><span>⚡ <b>+3</b></span><span>🎭 <b>+3</b></span></div>,
  },
  {
    caption: 'Both sums are zero; -8 wins the lowest-value tie-break.',
    scene: <div className="tutorial-tiebreak"><div className="tutorial-winner"><ExampleCard top="-8" bottom="+8" /><b>First: -8</b></div><span className="tutorial-versus">vs.</span><div><ExampleCard top="-2" bottom="+2" /><b>Lowest: -2</b></div></div>,
  },
  {
    caption: 'Players who place vertically in Tuesday sit out the final draw.',
    scene: <div className="tutorial-final-players"><div><span>YOU</span><ExampleCard top="+2" bottom="-2" /><b>Tuesday · sit out</b></div><div><span>COMPUTER 1</span><ExampleCard top="-3" bottom="+3" /><b>Tuesday · sit out</b></div><div className="tutorial-eligible"><span>COMPUTER 2</span><span className="tutorial-final-arrow">→</span><b>Final draw</b></div></div>,
  },
  {
    caption: 'MONEY first drops below zero on Thursday; Thursday and later days are eliminated.',
    scene: <div className="tutorial-bust"><div><b>Start</b><span>💰 5</span></div><div><b>Wed</b><span>-2 = 3</span></div><div className="tutorial-busted"><b>Thu</b><span>-4 = -1</span></div><div className="tutorial-busted"><b>Fri → Tue</b><span>0</span></div></div>,
  },
  {
    caption: 'After Week 3, subtract remaining MONEY and ENERGY from CARNIVAL POINTS.',
    scene: <div className="tutorial-equation"><span>🎭 18</span><b>−</b><span>💰 6</span><b>−</b><span>⚡ 4</span><b>=</b><strong>8</strong></div>,
  },
]

export default function WalkthroughVisual({ step }: { step: number }) {
  const visual = visuals[step]
  return (
    <figure className="tutorial-visual" key={step}>
      <div className="tutorial-scene" aria-hidden="true">{visual.scene}</div>
      <figcaption>{visual.caption}</figcaption>
    </figure>
  )
}
