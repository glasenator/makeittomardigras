import { useId, useRef, useState, type ReactNode } from 'react'
import WalkthroughVisual from './WalkthroughVisual'

type Step = { title: string; content: ReactNode }

const steps: Step[] = [
  {
    title: 'Welcome to the party!',
    content: (
      <>
        <p>It&apos;s Carnival season in New Orleans! Build a Wednesday-to-Tuesday schedule over three Weeks, earning <span aria-hidden="true">🎭</span> CARNIVAL POINTS while managing your <span aria-hidden="true">💰</span> MONEY and <span aria-hidden="true">⚡</span> ENERGY.</p>
        <div className="walkthrough-example">
          <strong>Getting started</strong>
          <p>Choose 2–5 players and a computer difficulty. Everyone starts with <span aria-hidden="true">💰</span> 5 MONEY and <span aria-hidden="true">⚡</span> 5 ENERGY. A random player draws first in Week 1.</p>
          <p>Each Week has its own deck. Card values range from 1–8 in Week 1, 2–9 in Week 2, and 3–10 in Week 3. Each card has two sections: its number values have the same magnitude, such as -5 / +5 or -5 / -5.</p>
        </div>
        <p>This walkthrough uses examples only; it won&apos;t place cards in your game.</p>
      </>
    ),
  },
  {
    title: 'Draw a card',
    content: (
      <>
        <p>Starting with the first player, draw in clockwise order. Choose one face-up card from the draw area, or draw blind from the top of the deck.</p>
        <div className="walkthrough-example">
          <strong>Example: 3 players</strong>
          <p>The draw area starts with one more card than the number of players. With 3 players, that is 4 cards. If everyone takes a face-up card, one card remains.</p>
        </div>
        <p>The deck shows the top card&apos;s back: double-negative cards show positive values, while other backs are blank. A blind draw reveals the front. If you can&apos;t place it, set it aside and skip your turn. You can&apos;t draw blind from an empty deck.</p>
        <p>After everyone draws, players add their cards to their schedules simultaneously.</p>
      </>
    ),
  },
  {
    title: 'Build your schedule',
    content: (
      <>
        <p>Your schedule has seven days, Wednesday through Tuesday, with four sections in each column. A vertical card covers two sections in one column; a horizontal card covers one section in each of two neighboring columns. Cards must fit within the schedule.</p>
        <div className="walkthrough-example">
          <strong>Example: your first card</strong>
          <p>Your starting values sit just left of Wednesday&apos;s two middle rows. A first vertical card can touch either starting value in any of its three positions. A first horizontal card must use one of those two rows.</p>
        </div>
        <p>Every new card must connect to an existing section: place it directly above, below, left, or right of that section, or overlap it. Gaps and diagonal sections don&apos;t connect. In the app, drag a card to a highlighted space, or tap the card and then a highlighted space.</p>
      </>
    ),
  },
  {
    title: 'Make the numbers fit',
    content: (
      <>
        <p>New cards can cover existing cards. Cover a positive value with a negative value or FLIP, and a negative value with a positive value or FLIP. You can&apos;t cover a visible FLIP; any value can cover a blank card back.</p>
        <p>For example, the +5 section of a +5 / -5 card can cover the -3 section of a +3 / -3 card. Positive values on a double-negative card&apos;s back follow the same covering rules.</p>
        <p>Each covered section must follow these rules. You can&apos;t cover both sections of a fully uncovered card in one placement, whether it&apos;s face up or face down.</p>
      </>
    ),
  },
  {
    title: 'Flip a card',
    content: (
      <>
        <p>FLIP counts as zero. When you play a FLIP, turn over one fully uncovered adjacent card in your schedule, if possible. Follow the arrows on the FLIP to find eligible cards.</p>
        <div className="walkthrough-example">
          <strong>Face down and back up</strong>
          <p>A double-negative card flips to positive values: -2 / -2 becomes +2 / +2. Other cards have blank backs that count as zero. A later FLIP can turn an uncovered card face up again without triggering that card&apos;s FLIP.</p>
        </div>
        <p>Follow the arrows on each FLIP to find an adjacent card; if none is eligible, nothing happens. Resolve two FLIPs one at a time: they may turn over the same card twice.</p>
      </>
    ),
  },
  {
    title: 'See what counts',
    content: (
      <>
        <p>Each column has four sections. From top to bottom, they count as <strong><span aria-hidden="true">🎭</span> CARNIVAL POINTS, <span aria-hidden="true">💰</span> MONEY, <span aria-hidden="true">⚡</span> ENERGY, and <span aria-hidden="true">🎭</span> CARNIVAL POINTS</strong>. Only visible values count; a blank card back counts as zero.</p>
        <div className="walkthrough-example">
          <strong>Example: one column</strong>
          <ul className="walkthrough-score-example">
            <li>Top: <span aria-hidden="true">🎭</span> +2 CARNIVAL POINTS</li>
            <li>Second: <span aria-hidden="true">💰</span> -2 MONEY</li>
            <li>Third: <span aria-hidden="true">⚡</span> +3 ENERGY</li>
            <li>Bottom: <span aria-hidden="true">🎭</span> +3 CARNIVAL POINTS</li>
          </ul>
          <p>Starting from <span aria-hidden="true">💰</span> 5 MONEY and <span aria-hidden="true">⚡</span> 5 ENERGY, the result is <strong><span aria-hidden="true">🎭</span> 5 CARNIVAL POINTS, <span aria-hidden="true">💰</span> 3 MONEY, and <span aria-hidden="true">⚡</span> 8 ENERGY</strong>. Covered values do not count.</p>
        </div>
      </>
    ),
  },
  {
    title: 'Who picks first next?',
    content: (
      <>
        <p>After everyone has placed, leave unpicked cards in the draw area and refill it to its starting size. Anyone who drew blind can&apos;t start the next draw. Everyone else adds the two values on their picked card; FLIP counts as zero. The lowest sum starts.</p>
        <div className="walkthrough-example">
          <strong>Example: a tie</strong>
          <p>-8 / +8 and -2 / +2 both total 0. The -8 / +8 card wins because -8 is the lower individual value.</p>
        </div>
        <p>If still tied, the first tied player clockwise from the previous starting player goes first. If everyone drew blind, the next player clockwise goes first. Final Mardi Gras turns use the picked-card order described in the next step.</p>
      </>
    ),
  },
  {
    title: 'The Week wraps up',
    content: (
      <>
        <p>The Week ends when the deck can&apos;t refill the draw area, or when someone places a <strong>vertical card in Tuesday</strong>. A horizontal card spanning Tuesday doesn&apos;t trigger final turns.</p>
        <div className="walkthrough-example">
          <strong>Example: reaching Tuesday</strong>
          <p>If you and a computer both place vertically in Tuesday, you both sit out. Refill the draw area; everyone else gets one final draw and placement.</p>
        </div>
        <p>For final draws, eligible players go in picked-card value order, lowest first, using the usual tie-breakers. Blind draws go last. If the deck can&apos;t fully refill the area, use the cards that remain; if there aren&apos;t enough for everyone, no one gets a final turn.</p>
      </>
    ),
  },
  {
    title: 'Check for a bust',
    content: (
      <>
        <p>At the end of the Week, check your <span aria-hidden="true">💰</span> MONEY and <span aria-hidden="true">⚡</span> ENERGY from left to right. If either running total ever falls below zero, find the first column where that happens, even if a later column brings it back above zero.</p>
        <div className="walkthrough-example">
          <strong>Example: MONEY runs short</strong>
          <p>You start with 5 MONEY. Wednesday adds -2, leaving 3. Thursday adds -4, bringing the total to -1. Eliminate Thursday and every later column: their values, including CARNIVAL POINTS, count as zero. Keep the 3 MONEY you had before Thursday.</p>
        </div>
        <p>A horizontal card&apos;s section before the bust still counts. In Week 3, you can&apos;t bust on Mardi Gras Tuesday: if a resource first falls below zero there, keep Tuesday&apos;s CARNIVAL POINTS and count that resource as zero. A bust from an earlier day still eliminates Tuesday.</p>
      </>
    ),
  },
  {
    title: 'Ready for the next Week!',
    content: (
      <>
        <p>After the bust check, carry each player&apos;s remaining <span aria-hidden="true">🎭</span> CARNIVAL POINTS, <span aria-hidden="true">💰</span> MONEY, and <span aria-hidden="true">⚡</span> ENERGY into the next Week. In Weeks 2 and 3, the player with the fewest carried-over CARNIVAL POINTS starts. Break ties clockwise from the previous Week&apos;s starting player.</p>
        <div className="walkthrough-example">
          <strong>Example: starting Week 2</strong>
          <p>If you have 8 CARNIVAL POINTS and a computer has 5, the computer starts because it has fewer carried-over CARNIVAL POINTS.</p>
        </div>
        <p>After Week 3, calculate <strong><span aria-hidden="true">🎭</span> CARNIVAL POINTS − <span aria-hidden="true">💰</span> remaining MONEY − <span aria-hidden="true">⚡</span> remaining ENERGY</strong>. For example, <span aria-hidden="true">🎭</span> 18 CARNIVAL POINTS, <span aria-hidden="true">💰</span> 6 MONEY, and <span aria-hidden="true">⚡</span> 4 ENERGY gives a final score of 8. The highest score wins. If tied, the player with the most cards occupying Tuesday wins. Count covered cards, horizontal cards, and cards in a busted column. If still tied, share the win.</p>
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
          <WalkthroughVisual step={step} />
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
