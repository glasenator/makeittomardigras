import { useId, useRef } from 'react'

function RulesButton() {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}>Rules</button>
      <dialog
        ref={dialog}
        className="rules-dialog"
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
            <h2 id={titleId}>How to play</h2>
          </div>
          <form method="dialog">
            <button type="submit" autoFocus>Close</button>
          </form>
        </div>
        <p className="rules-intro">It's Carnival Season in New Orleans! Build your schedule over the three weeks leading up to Mardi Gras Day. Manage your <span aria-hidden="true">💰</span> MONEY and <span aria-hidden="true">⚡</span> ENERGY, and finish with the most <span aria-hidden="true">🎭</span> CARNIVAL POINTS to win!</p>

        <section>
          <h3>1. (Digital) Set up</h3>
          <ul>
            <li>Choose <strong>2–5 players</strong>. You are one player; the rest are computers.</li>
            <li>Choose one difficulty for all computers: Easy makes random legal plays; Medium favors carnival points and resources; Hard also considers busts, future moves, and when to end the week.</li>
            <li>Each player starts with <strong><span aria-hidden="true">💰</span> 5 MONEY and <span aria-hidden="true">⚡</span> 5 ENERGY</strong>. The game lasts three weeks, with a different deck complilation each week.</li>
            <li>All card faces are divided into two sections with a value on each side. Cards will never have two different integers. For example, a card with a -5 value will never have a -3 value as well, only ever +5 or another -5.</li>
            <li>The number values on cards range from <strong>1–8 in week 1</strong>, <strong>2–9 in week 2</strong>, and <strong>3–10 in week 3</strong>. The range increases by 1 each week. The season is heating up!</li>
            <li>Put <strong>one more card than the number of players</strong> face up in the draw area. For example, 3 players start with 4 cards.</li>
          </ul>
        </section>

        <section>
          <h3>2. Draw Cards</h3>
          <p>A starting player is chosen at random for Week 1. On your turn, either take one face-up card from the draw area or draw one blind from the top of the deck. Drawing then passes clockwise.</p>
          <p>The deck shows the back of its top card. Most cards have blank backs, except for cards with two negative numbers which have two positive numbers on their backs. When you draw blind, reveal and play the card&apos;s front instead. If you have no legal place for it, set it aside and skip your turn. You cannot draw blind from an empty deck.</p>
          <p>After everyone has drawn a card, proceed to step 3.</p>
       </section>

        <section>
          <h3>3. Add Cards to Schedules (Simultaneous)</h3>
          <p>Your schedule has <strong>seven columns representing days of the week, Wednesday through Tuesday</strong>, each with 4 sections for values. Vertically oriented cards cover two sections of one column and cannot extend beyond a height of 4 sections. Horizontally oriented cards cover two section in two neighboring columns and cannot extend before or past the 7 day schedule.</p>
          <h4>Card Placements</h4>
          <p>Every new card must connect to another card. To do this at least one section of the new card must do one of the following:</p>
          <ul>
            <li>Be placed directly above or below an existing card's section, in the same column.</li>
            <li>Be placed directly to the left or right of an existing card's section, in the same row.</li>
            <li>Cover a number on an exisitng card section.</li>
          </ul>
          <p>Your starting values count as two card sections just left of Wednesday, in the two middle rows. So if your first card is horizontal it must use one of those rows; any vertical cards can touch a starting value.</p>
          <p><strong>Diagonal sections and gaps do not connect.</strong></p>
          <h4>Covering Numbers</h4>
          <p>When covering an existing card with another it must follow these rules:</p>
          <ul>
            <li>Positive numbers can only be covered by negative numbers or a FLIP.</li>
            <li>Negative numbers can only be covered by positive numbers or a FLIP.</li>
            <li>FLIPs can <strong>never</strong> be covered.</li>
            <li>Blank card backs can be covered by any value.</li>
          </ul>
          <p><strong>You cannot cover a fully uncovered card in one placement</strong>, regardless if the card is face up or face down, you can only partially overlap.</p>
          <h4>FLIP</h4>
          <p>FLIP counts as zero. When you place a card with a FLIP, you must turn over one fully <strong>uncovered</strong> adjacent card in your schedule, if possible. Follow the arrows: a vertical FLIP points to the left and right, plus above it if it is on top or below it if it is on bottom. A horizontal FLIP points above and below its section, plus outward from the card&apos;s nearest edge. FLIPs that do not point to any adjacent card do nothing.</p>
          <p>The special colored double-negative cards have opposite positive values on its back. For example, -2 | -2 becomes +2 | +2. These values score and are covered like other numbers. Other cards have blank backs which count as zero and can be covered by any value. A later FLIP can turn an uncovered card back to its front; doing so does not retrigger that card&apos;s FLIP effect.</p>
          <p>If your card has two FLIPs, resolve them one at a time. Both may turn over the same card.</p>
        </section>

        <section>
          <h3>4. Who starts the next draw?</h3>
          <p>When everyone has placed a card into their schedule, leave the unpicked cards in the draw area. Then draw enough cards from the deck to bring it back to its starting size.</p>
          <p>Drawing from the top of the deck makes you <strong>ineligible to start the next draw</strong>. For everyone else, add the two values on the card they picked; FLIP counts as zero. The lowest sum starts the next draw. Break ties in this order:</p>
          <ol>
            <li>The tied card with the lowest single value starts.<br></br> For example, -8 | +8 beats -2 | +2.</li>
            <li>If still tied, the first tied player clockwise from the previous starting player goes first.</li>
          </ol>
          <p>If everyone drew blind, the next player clockwise after the previous starting player goes first. Then play continues clockwise. Final turns use a different order; see <strong>End the Week</strong>.</p>
        </section>

        <section>
          <h3>4. Counting your schedule</h3>
          <p>Each column has four number sections. From top to bottom, they count as:</p>
          <ol className="rules-scoring">
            <li className="score-points"><strong><span aria-hidden="true">🎭</span> CARNIVAL POINTS</strong></li>
            <li className="score-money"><strong><span aria-hidden="true">💰</span> MONEY</strong></li>
            <li className="score-energy"><strong><span aria-hidden="true">⚡</span> ENERGY</strong></li>
            <li className="score-points"><strong><span aria-hidden="true">🎭</span> CARNIVAL POINTS</strong></li>
          </ol>
          <p>Only visible values count; covered values do not. Add visible MONEY and ENERGY to your starting amounts. Your CARNIVAL POINT total appears above your schedule on the left; your running money and energy appear on the card at its right.</p>
        </section>

        <section>
          <h3>5. End the Week</h3>
          <p>A week ends when the deck cannot refill the draw area or if a player places a <strong>vertical card in the final column, Tuesday.</strong> Refill the draw area and then every other player who did not play a vertical card into Tuesday will get one more draw and placement. A horizontal card spanning into Tuesday does not trigger final turns. If the deck cannot fully refill the draw area, use the cards that remain; if there are not enough for everyone, then no one gets a final extra turn.</p>
          <h4>Check for a bust</h4>
          <p>After the week ends, check each player&apos;s running <span aria-hidden="true">💰</span> MONEY and <span aria-hidden="true">⚡</span> ENERGY from left to right, even if the final totals are positive:</p>
          <ul>
            <li>If both values never went into the negatives, no columns are busted.</li>
            <li>If either went into the negatives, start with your starting amounts and add each column from left to right. Find the first column where money or energy drops below zero. Eliminate that column and every column after it; all their values, including carnival points, count as zero. If a horizontal card crosses the bust line, its section before the line still counts.</li>
            <li className="rules-important">On the final day of week 3, you cannot bust on Mardi Gras (Fat Tuesday). If your ENGERGY or MONEY drops below zero on Mardi Gras, keep Tuesday&apos;s carnival points and count its' final value as zero instead. Tuesday is not eliminated out for a bust that starts there; although a bust from an earlier day still grays it out.</li>
          </ul>
          <h4>Start the next week</h4>
          <p>Carry each player&apos;s remaining <span aria-hidden="true">🎭</span> carnival points, <span aria-hidden="true">💰</span> money, and <span aria-hidden="true">⚡</span> energy into the next week. The player with the fewest carried-over carnival points starts weeks 2 and 3. If players tie, the first tied player clockwise from the previous week&apos;s starting player goes first.</p>
        </section>

        <section>
          <h3>5. End the Game</h3>
          <p>The game ends after <strong>week 3</strong>. Calculate each final score:</p>
          <p className="rules-important"><strong>Final score = <span aria-hidden="true">🎭</span> carnival points − <span aria-hidden="true">💰</span> remaining money − <span aria-hidden="true">⚡</span> remaining energy.</strong></p>
          <p>The highest final score wins. If players tie, the one with the most cards occupying Tuesday wins. Count every card that touches Tuesday, including covered cards, horizontal cards, and cards in a busted column. If they are still tied, they share the win.</p>
        </section>
      </dialog>
    </>
  )
}

export default RulesButton
