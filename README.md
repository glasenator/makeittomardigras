# Make it to Mardi Gras

**Make your plans, mind your energy, and let the good times roll.**

A colorful card-game playtest for **2–5 players**: you and up to four computer opponents. Build your schedule over three weeks and finish with the highest final score.

<p align="center">
  <img src="docs/images/start-screen.png" alt="Start screen showing player count and computer difficulty options" width="520">
</p>

## At the table

![A game in progress, showing computer schedules, the draw area, and the player's schedule](docs/images/gameplay.png)

1. **Pick a card** from the draw area, or risk a blind draw from the deck, and place it on your schedule. The deck shows its top card's back, including positive values on double-negative cards; blind cards are played on their original faces. Blind draws cannot start the next draw; an unplaceable blind card is set aside and the turn is skipped.
2. **Build your week** by overlapping vertical and two-column horizontal cards and balancing points, money, and energy. FLIP counts as zero and turns an adjacent uncovered card over; double-negative cards have opposite positive values on their backs.
3. **Watch for a bust:** if your final money or energy is negative, the first negative column and later columns are grayed out and count as zero. A horizontal card still scores its section before the bust.
4. **Play three weeks.** Final score is victory points minus remaining money and energy after busts. Ties go to the most cards touching Sunday, including covered cards, horizontal cards, and cards in a busted column; remaining ties share the win.

Each schedule column scores its **visible** numbers from top to bottom:

| Section | Counts as |
|:---:|:---|
| 1 | Victory points |
| 2 | Money |
| 3 | Energy |
| 4 | Victory points |

Card values start in the **1–8** range in week 1, then increase to **2–9** in week 2 and **3–10** in week 3.

New here? Open **Walkthrough** in the app for guided examples, or **Rules** for the complete rulebook.

## Run locally

Requires Node.js **20.19+ or 22.12+** and npm.

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

```bash
npm run build                 # Production build
npm run lint                  # Lint
node --test tests/*.test.mjs  # Game tests
```

## Customize the decks

Edit the three independent card lists in [`src/deck.ts`](src/deck.ts). Weeks 2 and 3 currently use placeholder values.
