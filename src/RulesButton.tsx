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
        <p className="rules-intro">Build your schedule over three weeks, collecting victory points while managing your money and energy.</p>

        <section>
          <h3>1. Set up</h3>
          <ul>
            <li>Choose <strong>2–5 players</strong>, including yourself. All other players are computers.</li>
            <li>Choose one difficulty for all computers: <strong>Easy</strong> chooses random legal moves; <strong>Medium</strong> favors points and resources; <strong>Hard</strong> also considers bust risk and future placement options.</li>
            <li>Each player starts with <strong>5 money and 5 energy</strong>. Each week uses its own shuffled deck.</li>
            <li>Deal face-up cards to the draw area: <strong>one more card than the number of players</strong>. For example, with 3 players, deal 4 cards.</li>
          </ul>
        </section>

        <section>
          <h3>2. Take turns</h3>
          <p>You start week 1. On your turn, <strong>choose one card from the draw area and drag it into your schedule</strong>. Play continues clockwise.</p>
          <p>After everyone has picked, one card remains in the draw area. <strong>Leave it there</strong> and add cards from the deck until the draw area is full again.</p>
          <h4>Who starts the next draw?</h4>
          <p>Compare the cards players just picked, adding the two numbers on each card. The player whose card has the <strong>lowest sum</strong> starts the next draw. If there is a tie:</p>
          <ol>
            <li>Among the tied cards, the card with the <strong>lowest individual number</strong> goes first.</li>
            <li>If there is still a tie, the first tied player clockwise after the previous draw&apos;s starting player goes first.</li>
          </ol>
          <p>Play then continues clockwise from that player. Final turns follow a different rule; see <strong>End the week</strong>.</p>
        </section>

        <section>
          <h3>3. Place cards in your schedule</h3>
          <p>Your schedule has <strong>five columns</strong>, each with three overlapping card positions. A new card is placed on top of any cards it overlaps.</p>
          <h4>Opening a column</h4>
          <p>You may place a card in the first column without a neighbor. To place the <strong>first card</strong> in any later column, the column immediately to its left must have a card in the same position or an adjacent position. Once a column has a card, further placements in that column do not need a left neighbor.</p>
          <h4>Covering numbers</h4>
          <ul>
            <li>You can cover a <strong>positive number</strong> with a negative number or zero.</li>
            <li>You can cover a <strong>negative number</strong> with a positive number or zero.</li>
            <li>You can <strong>never cover a visible zero</strong>.</li>
          </ul>
          <p>If your card covers two numbers, <strong>both must follow these rules</strong>. For example, a +3 can cover a -2, but not a +2 or a 0.</p>
          <h4>Reusing a position</h4>
          <p>A card that is fully visible cannot be replaced in the same position. If a newer card covers part of it, you may replace it, following the placement rules above. Set the replaced card aside for the rest of the week.</p>
        </section>

        <section>
          <h3>4. Count your schedule</h3>
          <p>Each column has four number sections. From top to bottom, they count as:</p>
          <ol className="rules-scoring">
            <li><strong>Victory points</strong></li>
            <li><strong>Money</strong></li>
            <li><strong>Energy</strong></li>
            <li><strong>Victory points</strong></li>
          </ol>
          <p>Only <strong>visible numbers</strong> count; covered numbers do not. Add money and energy to your starting amounts. Your points appear beside your schedule, and your current money and energy appear on the card to its right.</p>
        </section>

        <section>
          <h3>5. End the week</h3>
          <p>A week normally ends when the deck cannot fully refill the draw area. But if someone places a card in the <strong>fifth column</strong>, each player gets <strong>one more turn</strong>, starting with the next player. These final turns stay clockwise, even if the draw area is refilled. If there are too few cards for a full refill, use the remaining available cards. The week ends after the final turns.</p>
          <h4>Check for a bust</h4>
          <p>At the end of the week, check each player&apos;s final money and energy:</p>
          <ul>
            <li>If <strong>both are zero or higher</strong>, no cards are flipped, even if a resource was negative earlier in the schedule.</li>
            <li>If <strong>either is negative</strong>, work through the schedule from left to right, adding each column to the starting amounts. Find the first column where either running resource becomes negative. Flip every card in that column and all later columns; they count as zero, including their victory points.</li>
          </ul>
          <h4>Start the next week</h4>
          <p>Review the completed schedules, then carry each player&apos;s remaining points, money, and energy into the next week. For weeks 2 and 3, the player with the <strong>fewest carried-over victory points</strong> starts. If tied, the first tied player clockwise after the previous week&apos;s starting player starts.</p>
          <p>The game ends after <strong>week 3</strong>. The player with the most victory points wins. If tied, the tied player with the most energy wins; if still tied, the tied player with the most money wins. If all three totals are tied, those players share the win.</p>
        </section>
      </dialog>
    </>
  )
}

export default RulesButton
