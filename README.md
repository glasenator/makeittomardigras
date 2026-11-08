# React + TypeScript + Vite

Select **Rules** on the start screen or during a game to view these rules.
Select **Walkthrough** next to it for a step-by-step introduction with examples.
Choose one computer difficulty for all opponents on the start screen. Easy
selects a random legal card and placement. Medium favors visible points and
avoiding negative resources. Hard also considers bust penalties, earlier
resource deficits, and future placements using the other visible draw cards.
These are heuristics, not guarantees of optimal play; computers do not inspect
the hidden deck to choose moves. New games retain the chosen difficulty.

Each player starts with 5 money and 5 energy, shown on their starting card.
Each schedule column has four sections: the outermost sections score victory
points, the second section adds money, and the third adds energy. Only visible
numbers count. Points appear next to each player's schedule heading; the card
on the right shows money and energy including the starting values. Newly
placed cards go on top of any overlapping cards.
To place the first card in a column after the first, the column to its left
must have a card in the same or an adjacent slot. Once a column has a card,
additional placements in it do not require a left neighbor.
An occupied slot can be reused when at least one half of its card is covered
by a newer card. A fully visible card cannot be replaced. The replaced card is
set aside for the rest of the week.
When placing a card, each number it covers must be nonzero and of the opposite
sign from the incoming number, unless the incoming number is zero. A zero
already visible on the schedule can never be covered. Both halves must satisfy
the rule when a placement covers two numbers.

The game lasts three weeks. Each draw area contains one more card than the
number of players; when one card remains, it stays in the draw area and the
deck supplies enough cards to fill the area again. The player whose card had
the lowest sum starts the next draw.
If sums tie, the tied player with the lowest individual number on their card
starts. If that also ties, the first tied player clockwise after the previous
starter starts. Players then continue clockwise. The human starts week one.
In weeks two and three, the player with the fewest carried-over points starts;
ties go to the first tied player clockwise after the previous week's starter.
If the deck cannot deal a full draw area, the week ends.
Placing a card in the fifth column instead triggers one additional turn for
every player, starting with the next player. The week ends after those turns.
During these final turns, turn order continues clockwise even if the draw area
is refilled, so each player receives exactly one additional turn.
The deck must contain enough cards to complete these extra turns.
If there are too few cards for a full refill during those turns, the remaining
available cards can still be selected.

At the end of each week, if a player's final money or energy is negative, find
the first column where either running resource became negative. That column and
all later columns are flipped over and count as zero, including their points.
If both final resources are nonnegative, no cards are flipped. Review the
completed schedule before starting the next week. Players keep their remaining
points and carry their remaining money and energy forward. Each week uses its own separately shuffled deck; cards from the
previous week are removed from play. After the third week the game ends.
The game-over screen shows the winner and each player's final schedule, including
any flipped bust columns. The most victory points wins; ties are broken by the
most energy, then the most money. Players still tied on all three share the win.
Edit the three independent card lists in `src/deck.ts`; weeks 2 and 3 currently
contain placeholder values.

Run the game logic tests with `node --test tests/*.test.mjs`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
