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
        <p className="rules-intro">Build a seven-day schedule over three weeks. Earn carnival points, manage your money and energy, and finish with the highest final score.</p>

        <section>
          <h3>1. Set up</h3>
          <ul>
            <li>Choose <strong>2–5 players</strong>. You are one player; the rest are computers.</li>
            <li>Choose one difficulty for all computers: Easy makes random legal plays; Medium favors carnival points and resources; Hard also considers busts, future moves, and when to end the week.</li>
            <li>Each player starts with <strong>5 money and 5 energy</strong>. The game lasts three weeks, with a separate shuffled deck each week.</li>
            <li>Card number values range from <strong>1–8 in week 1</strong>, <strong>2–9 in week 2</strong>, and <strong>3–10 in week 3</strong>. The range increases by 1 each week.</li>
            <li>Put <strong>one more card than the number of players</strong> face up in the draw area. For example, 3 players start with 4 cards.</li>
          </ul>
        </section>

        <section>
          <h3>2. Take turns</h3>
          <p>You take the first turn in week 1. On your turn, either take a face-up card from the draw area or draw blind from the top of the deck. Place that card in your schedule. Play then passes clockwise.</p>
          <p>The deck shows the back of its top card. A double-negative card has positive values on its back; other cards have blank backs. When you draw blind, reveal and play the card&apos;s front instead. If you have no legal place for it, set it aside and skip your turn. You cannot draw blind from an empty deck.</p>
          <p>When everyone has taken one turn, leave unpicked cards in the draw area. Draw enough cards from the deck to bring it back to its starting size.</p>
          <h4>Who starts the next draw?</h4>
          <p>A blind draw makes you <strong>ineligible to start the next draw</strong>. For everyone else, add the two values on the card they picked; FLIP counts as zero. The lowest total starts the next draw. Break ties in this order:</p>
          <ol>
            <li>The tied card with the lowest single value starts. For example, -3 / +4 beats -2 / +3.</li>
            <li>If still tied, the first tied player clockwise from the previous starting player goes first.</li>
          </ol>
          <p>If everyone drew blind, the next player clockwise after the previous starting player goes first. Then play continues clockwise. Final turns use a different order; see <strong>End the week</strong>.</p>
        </section>

        <section>
          <h3>3. Place cards in your schedule</h3>
          <p>Your schedule has <strong>seven columns, Wednesday through Tuesday</strong>. Vertical cards cover two sections in one column. Horizontal cards cover one section in each of two neighboring columns. New cards go on top of cards they overlap.</p>
          <p>A horizontal card scores its left value in the left column and its right value in the next column. It must fit within the schedule. Its left section must connect to your schedule; its right section can connect to a card in the next column.</p>
          <h4>Adjacent placements</h4>
          <p>Every card must connect in its leftmost column. At least one section of the new card must do one of the following:</p>
          <ul>
            <li>Overlap a section, or sit directly above or below one, in the same column.</li>
            <li>Sit in the same row as a section in the column immediately to the left.</li>
          </ul>
          <p>Your starting values count as sections just left of Wednesday, in the two middle rows. So your first horizontal card must use one of those rows; any vertical position can touch a starting value. Diagonal sections and gaps do not connect.</p>
          <h4>Covering numbers</h4>
          <ul>
            <li>Cover a positive number with a negative number or FLIP.</li>
            <li>Cover a negative number with a positive number or FLIP.</li>
            <li>You cannot cover a visible FLIP. You may cover a blank card back with any value. Positive values on a double-negative card&apos;s back follow the normal positive-number rule.</li>
          </ul>
          <p>If a card covers two sections, each section must follow these rules. You cannot cover both visible sections of the same card with one play, whether that card is face up or face down.</p>
          <h4>Reusing a position</h4>
          <p>You may replace a partially covered vertical card if the new card can legally cover its visible section. Set the replaced card aside for the rest of the week. Cards hidden underneath do not prevent the replacement. A horizontal card stays in your schedule when only part of it is covered.</p>
          <h4>FLIP</h4>
          <p>FLIP counts as zero. When you place a card with FLIP, turn over one fully uncovered adjacent card in your schedule, if possible. Follow the arrows: a vertical FLIP points to the left and right, plus above it if it is on top or below it if it is on bottom. A horizontal FLIP points above and below its section, plus outward from the card&apos;s nearest edge.</p>
          <p>A double-negative card has the opposite positive values on its back. For example, -2 / -5 becomes +2 / +5. These values score and are covered like other positive numbers. Other cards have blank backs that count as zero and can be covered by any value. A later FLIP can turn an uncovered card back to its front; doing so does not trigger that card&apos;s FLIP effect. If your card has two FLIPs, resolve the top or left one first, then the bottom or right one. Both may turn over the same card.</p>
        </section>

        <section>
          <h3>4. Count your schedule</h3>
          <p>Each column has four number sections. From top to bottom, they count as:</p>
          <ol className="rules-scoring">
            <li className="score-points"><strong>Carnival points</strong></li>
            <li className="score-money"><strong>Money</strong></li>
            <li className="score-energy"><strong>Energy</strong></li>
            <li className="score-points"><strong>Carnival points</strong></li>
          </ol>
          <p>Only visible values count; covered values do not. Add visible money and energy to your starting amounts. Your carnival-point total appears beside your schedule; your running money and energy appear on the card at its right.</p>
        </section>

        <section>
          <h3>5. End the week</h3>
          <p>A week ends when the deck cannot refill the draw area. There is one exception: if a player places a <strong>vertical card in Tuesday</strong>, that player ends their turns for the week. Finish the current draw so every player has a picked card, then each other player gets one final turn. Order those turns by the picked cards&apos; combined values, lowest first. Break ties with the usual lowest-single-value and clockwise rules; anyone who drew blind goes after players with a picked card. A horizontal card spanning Tuesday does not trigger final turns. If the deck cannot fully refill the draw area, use the cards that remain; if there are not enough for everyone&apos;s final turn, the game reports the shortage.</p>
          <h4>Check for a bust</h4>
          <p>After the week ends, check each player&apos;s final money and energy:</p>
          <ul>
            <li>If both are zero or higher, no columns are busted. This is true even if a resource was negative earlier.</li>
            <li>If either is negative, start with your starting amounts and add each column from left to right. Find the first column where money or energy drops below zero. Gray out that column and every column after it; all their values, including carnival points, count as zero. If a horizontal card crosses the bust line, its section before the line still counts. Busting does not turn cards over.</li>
            <li className="rules-important">In week 3, you cannot bust on Mardi Gras Tuesday. If a resource first drops below zero in Tuesday, keep Tuesday&apos;s carnival points and count that resource as zero instead. Tuesday is not grayed out for a bust that starts there; a bust from an earlier day still grays it out.</li>
          </ul>
          <h4>Start the next week</h4>
          <p>Carry each player&apos;s remaining carnival points, money, and energy into the next week. The player with the fewest carried-over carnival points starts weeks 2 and 3. If players tie, the first tied player clockwise from the previous week&apos;s starting player goes first.</p>
          <p>The game ends after <strong>week 3</strong>. Calculate each final score:</p>
          <p><strong>Final score = carnival points − remaining money − remaining energy.</strong></p>
          <p>The highest final score wins. If players tie, the one with the most cards occupying Tuesday wins. Count every card that touches Tuesday, including covered cards, horizontal cards, and cards in a busted column. If they are still tied, they share the win.</p>
        </section>
      </dialog>
    </>
  )
}

export default RulesButton
