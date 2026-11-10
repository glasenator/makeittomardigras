import { useId, useRef, useState, type ReactNode } from 'react'

type Step = { title: string; content: ReactNode }

const steps: Step[] = [
  {
    title: 'Welcome to the party!',
    content: (
      <>
        <p>Build a Monday-to-Sunday schedule over three weeks. Earn victory points, manage your money and energy, and finish with the highest final score.</p>
        <div className="walkthrough-example">
          <strong>Getting started</strong>
          <p>Choose 2–5 players and a computer difficulty. Each player starts with 5 money and 5 energy. You start week 1. Card values range from 1–8 in week 1, 2–9 in week 2, and 3–10 in week 3: the range moves up by 1 each week.</p>
        </div>
        <p>This walkthrough uses examples only; it won&apos;t place cards in your game.</p>
      </>
    ),
  },
  {
    title: 'Pick a card',
    content: (
      <>
        <p>On your turn, take a face-up card from the draw area or draw blind from the deck. Place that card in your schedule. Play then passes clockwise.</p>
        <div className="walkthrough-example">
          <strong>Example: 3 players</strong>
          <p>The draw area starts with one more card than the number of players. With 3 players, that is 4 cards. If everyone takes a face-up card, one card remains.</p>
          <div className="walkthrough-cards" aria-label="Example draw area: plus 2 and minus 1, minus 3 and plus 4, FLIP and plus 2, plus 1 and plus 3">
            <span className="walkthrough-card" aria-hidden="true"><span>+2</span><span>-1</span></span>
            <span className="walkthrough-card" aria-hidden="true"><span>-3</span><span>+4</span></span>
            <span className="walkthrough-card" aria-hidden="true"><span className="flip-value flip-value-top"><span className="flip-arrows">↑</span><span>← FLIP →</span></span><span>+2</span></span>
            <span className="walkthrough-card" aria-hidden="true"><span>+1</span><span>+3</span></span>
          </div>
        </div>
        <p>The deck shows the top card&apos;s back. A double-negative card shows its positive values; other backs are blank. A blind draw reveals the card&apos;s front, which you must play. If you have no legal placement, set it aside and skip your turn. A blind draw also makes you ineligible to start the next draw. After everyone takes a turn, leave unpicked cards in place and refill the draw area.</p>
      </>
    ),
  },
  {
    title: 'Build your schedule',
    content: (
      <>
        <p>Your schedule has seven columns, Monday through Sunday. A vertical card covers two adjacent sections in one column. A horizontal card covers one section in each of two neighboring columns.</p>
        <div className="walkthrough-example">
          <strong>Example: opening Tuesday</strong>
          <p>A card in Monday&apos;s middle row lets you connect a new card in any row of Tuesday. Each new card must overlap or touch a card in its leftmost column, or touch a card in the same row of the previous column.</p>
        </div>
        <p>Your starting values count as sections just left of Monday, in its two middle rows. So your first horizontal card must use one of those rows; any vertical position can connect to a starting value. Gaps and diagonal sections do not connect.</p>
      </>
    ),
  },
  {
    title: 'Make the numbers fit',
    content: (
      <>
        <p>New cards go on top. Cover a positive value with a negative value or FLIP. Cover a negative value with a positive value or FLIP. You cannot cover a visible FLIP.</p>
        <div className="walkthrough-example">
          <strong>Example: covering a -3</strong>
          <p>A +2 or FLIP can cover -3. Another negative value cannot. Any value can cover a blank back. The positive values on a double-negative card&apos;s back follow the usual covering rules.</p>
        </div>
        <p>If your card covers two sections, both must follow the rules. You cannot cover both visible sections of the same card in one play. Hidden cards do not count. You may replace a partially covered vertical card if the play is legal; set the replaced card aside for the week. A partially covered horizontal card stays in place.</p>
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
          <p>A double-negative card flips to its opposite positive values: -2 / -5 becomes +2 / +5. Those positive values score and follow the usual covering rules. Other cards have blank backs that count as zero. A later FLIP can turn an uncovered card back to its front without triggering its FLIP effect.</p>
        </div>
        <p>If a card has two FLIPs, resolve the top or left one first, then the bottom or right one. Both may turn over the same card.</p>
      </>
    ),
  },
  {
    title: 'See what counts',
    content: (
      <>
        <p>Each column has four sections. From top to bottom, they count as <strong>points, money, energy, and points</strong>. Only visible values count; a blank card back counts as zero.</p>
        <div className="walkthrough-example">
          <strong>Example: one column</strong>
          <ul className="walkthrough-score-example">
            <li>Top: +2 points</li>
            <li>Second: -1 money</li>
            <li>Third: +3 energy</li>
            <li>Bottom: +4 points</li>
          </ul>
          <p>Starting from 5 money and 5 energy, the result is <strong>6 points, 4 money, and 8 energy</strong>. Covered values do not count.</p>
        </div>
      </>
    ),
  },
  {
    title: 'Who picks first next?',
    content: (
      <>
        <p>After everyone has taken a turn, refill the draw area. Anyone who drew blind cannot start the next draw. The other players add the two values on their picked card; FLIP counts as zero. The lowest total starts.</p>
        <div className="walkthrough-example">
          <strong>Example: a tie</strong>
          <p>Both cards total 1. The first card wins the tie because its lowest value, -3, is lower than -2.</p>
        </div>
        <p>If still tied, the first tied player clockwise from the previous starting player goes first. If everyone drew blind, the next player clockwise goes first. During final turns, play stays clockwise.</p>
      </>
    ),
  },
  {
    title: 'The week wraps up',
    content: (
      <>
        <p>The week ends when the deck cannot refill the draw area. Placing a vertical card in Sunday starts the <strong>final turns</strong>. A horizontal card spanning Sunday does not.</p>
        <div className="walkthrough-example">
          <strong>Example: reaching Sunday</strong>
          <p>After your vertical Sunday placement, the next player goes first. Everyone, including you, gets one more turn. Continue clockwise, even if the draw area refills.</p>
        </div>
        <p>If the deck cannot fully refill the draw area, use any cards that remain. The week ends after everyone takes one final turn.</p>
      </>
    ),
  },
  {
    title: 'Check for a bust',
    content: (
      <>
        <p>At the end of the week, check your final money and energy. If either is negative, find the first column where a running total falls below zero.</p>
        <div className="walkthrough-example">
          <strong>Example: money runs short</strong>
          <p>You start with 5 money. Monday adds -2, leaving 3. Tuesday adds -4, bringing the total to -1. If your final money or energy is negative, gray out Tuesday and every later column. Those columns count as zero, including their points. Keep the 3 money you had before Tuesday.</p>
        </div>
        <p>If a horizontal card crosses the bust line, its section before the line still counts; its section in the busted column does not. Busting does not turn cards over. If both final resources are zero or higher, no columns are busted, even if a resource was negative earlier.</p>
      </>
    ),
  },
  {
    title: 'Ready for the next week!',
    content: (
      <>
        <p>After the bust check, carry each player&apos;s remaining points, money, and energy into the next week. In weeks 2 and 3, the player with the fewest carried-over points starts. Break ties clockwise from the previous week&apos;s starting player.</p>
        <div className="walkthrough-example">
          <strong>Example: starting week 2</strong>
          <p>If you have 8 points and a computer has 5, the computer starts because it has fewer carried-over points.</p>
        </div>
        <p>After week 3, calculate <strong>victory points − remaining money − remaining energy</strong>. For example, 18 points, 6 money, and 4 energy gives a final score of 8. The highest score wins. If tied, the player with the most cards occupying Sunday wins. Count covered cards, horizontal cards, and cards in a busted column. If still tied, share the win.</p>
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
