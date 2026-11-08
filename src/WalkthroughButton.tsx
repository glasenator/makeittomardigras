import { useId, useRef, useState, type ReactNode } from 'react'

type Step = { title: string; content: ReactNode }

const steps: Step[] = [
  {
    title: 'Welcome to the party!',
    content: (
      <>
        <p>Let&apos;s make a plan for Mardi Gras! Over three weeks, you&apos;ll build a schedule, collect victory points, and keep an eye on your money and energy.</p>
        <div className="walkthrough-example">
          <strong>Getting started</strong>
          <p>Choose 2–5 players and a computer difficulty. Everyone begins with 5 money and 5 energy. You take the first turn in week 1.</p>
        </div>
        <p>This walkthrough uses examples only; it won&apos;t place cards in your game.</p>
      </>
    ),
  },
  {
    title: 'Pick a card',
    content: (
      <>
        <p>On your turn, choose a face-up card from the draw area and drag it into your schedule. Then play passes clockwise.</p>
        <div className="walkthrough-example">
          <strong>Example: 3 players</strong>
          <p>The draw area starts with 4 cards: one more than the number of players. Each player picks one, leaving one card behind.</p>
          <div className="walkthrough-cards" aria-label="Example draw area: plus 2 and minus 1, minus 3 and plus 4, zero and plus 2, plus 1 and plus 3">
            <span className="walkthrough-card" aria-hidden="true"><span>+2</span><span>-1</span></span>
            <span className="walkthrough-card" aria-hidden="true"><span>-3</span><span>+4</span></span>
            <span className="walkthrough-card" aria-hidden="true"><span>0</span><span>+2</span></span>
            <span className="walkthrough-card" aria-hidden="true"><span>+1</span><span>+3</span></span>
          </div>
        </div>
        <p>When one card remains, it stays put. New cards are added around it to refill the draw area.</p>
      </>
    ),
  },
  {
    title: 'Build your schedule',
    content: (
      <>
        <p>Your schedule has five columns, Monday through Friday. Each column has three overlapping card positions: top, middle, and bottom.</p>
        <div className="walkthrough-example">
          <strong>Example: opening Tuesday</strong>
          <p>If Monday has a card in the middle position, you can start Tuesday in the top, middle, or bottom position. Each is the same as or adjacent to Monday&apos;s card.</p>
        </div>
        <p>The first column needs no left neighbor. Once a later column already has a card, you don&apos;t need a left neighbor for additional placements in that column.</p>
      </>
    ),
  },
  {
    title: 'Make the numbers fit',
    content: (
      <>
        <p>New cards go on top. When you cover a visible number, the new number must have the opposite sign, or be zero.</p>
        <div className="walkthrough-example">
          <strong>Example: covering a -3</strong>
          <p>A +2 or a 0 can cover it. Another negative number cannot. A visible 0 can never be covered.</p>
        </div>
        <p>If a card covers two numbers, both must follow the rule. A fully visible card can&apos;t be replaced in its position; once a newer card covers part of it, you can replace it there if the placement is legal. The old card is set aside for the week.</p>
      </>
    ),
  },
  {
    title: 'See what counts',
    content: (
      <>
        <p>Each column has four number sections. From top to bottom, they count as <strong>points, money, energy, and points</strong>. Only visible numbers count.</p>
        <div className="walkthrough-example">
          <strong>Example: one column</strong>
          <ul className="walkthrough-score-example">
            <li>Top: +2 points</li>
            <li>Second: -1 money</li>
            <li>Third: +3 energy</li>
            <li>Bottom: +4 points</li>
          </ul>
          <p>Starting from 5 money and 5 energy, that&apos;s <strong>6 points, 4 money, and 8 energy</strong>. Numbers hidden underneath another card don&apos;t count.</p>
        </div>
      </>
    ),
  },
  {
    title: 'Who picks first next?',
    content: (
      <>
        <p>After everyone has picked and the draw area is refilled, compare the sums of the two numbers on each picked card. The lowest sum picks first in the new draw.</p>
        <div className="walkthrough-example">
          <strong>Example: a tie</strong>
          <p>Cards [-3, +4] and [-2, +3] both add up to 1. The player who picked [-3, +4] goes first because -3 is the lowest individual number.</p>
        </div>
        <p>If that is tied too, the first tied player clockwise after the previous draw&apos;s starting player goes first. Play continues clockwise. During final turns, clockwise order takes priority instead.</p>
      </>
    ),
  },
  {
    title: 'The week wraps up',
    content: (
      <>
        <p>Normally, the week ends when the deck can&apos;t fully refill the draw area. But placing a card in the fifth column starts the <strong>final turns</strong>.</p>
        <div className="walkthrough-example">
          <strong>Example: reaching Friday</strong>
          <p>After your Friday placement, the next player goes first and everyone, including you, gets one more turn. Those turns continue clockwise, even if the draw area is refilled.</p>
        </div>
        <p>If there aren&apos;t enough cards for a full refill during final turns, the remaining available cards can still be picked.</p>
      </>
    ),
  },
  {
    title: 'Check for a bust',
    content: (
      <>
        <p>At the end of the week, check your final money and energy. If either is negative, find the first column where either running resource became negative, counting from left to right.</p>
        <div className="walkthrough-example">
          <strong>Example: money runs short</strong>
          <p>You start with 5 money. Monday changes it by -2 (leaving 3), and Tuesday changes it by -4 (leaving -1). If your final money is still negative, Tuesday and every later column are flipped and count as zero, including their points. You keep the 3 money from before Tuesday.</p>
        </div>
        <p>If both final money and energy are zero or higher, no cards are flipped—even if a resource was negative earlier.</p>
      </>
    ),
  },
  {
    title: 'Ready for the next week!',
    content: (
      <>
        <p>Take a moment to review the finished schedules. Then carry each player&apos;s remaining points, money, and energy into the next week and start with that week&apos;s shuffled deck.</p>
        <div className="walkthrough-example">
          <strong>Example: starting week 2</strong>
          <p>If you have 8 points and a computer has 5, the computer starts. The fewest carried-over points starts weeks 2 and 3; ties go to the first tied player clockwise after the previous week&apos;s starter.</p>
        </div>
        <p>After week 3, the most points wins! If players tie on points, the one with the most energy wins. If they&apos;re still tied, compare money. If all three are tied, they share the win. You&apos;re ready to let the good times roll!</p>
      </>
    ),
  },
]

function WalkthroughButton() {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [step, setStep] = useState(0)

  const open = () => {
    setStep(0)
    dialog.current?.showModal()
  }

  const goToStep = (nextStep: number) => {
    setStep(nextStep)
    dialog.current?.scrollTo({ top: 0 })
  }

  return (
    <>
      <button type="button" onClick={open}>Walkthrough</button>
      <dialog
        ref={dialog}
        className="rules-dialog walkthrough-dialog"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            dialog.current?.close()
          }
        }}
      >
        <div className="rules-heading">
          <div>
            <p className="rules-kicker">Make it to Mardi Gras</p>
            <h2 id={titleId}>Walkthrough</h2>
          </div>
          <form method="dialog">
            <button type="submit" autoFocus>Close</button>
          </form>
        </div>
        <div className="walkthrough-step" aria-live="polite" aria-atomic="true">
          <p className="walkthrough-progress">Step {step + 1} of {steps.length}</p>
          <h3>{steps[step].title}</h3>
          {steps[step].content}
        </div>
        <div className="walkthrough-actions">
          <button type="button" onClick={() => goToStep(step - 1)} disabled={step === 0}>Back</button>
          <button type="button" className="primary-button" onClick={() => step === steps.length - 1 ? dialog.current?.close() : goToStep(step + 1)}>
            {step === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </dialog>
    </>
  )
}

export default WalkthroughButton
