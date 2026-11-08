# Make it to Mardi Gras

**Make your plans, mind your energy, and let the good times roll.**

A colorful card-game playtest for **2–5 players**: you and up to four computer opponents. Build your schedule over three weeks and finish with the most victory points.

<p align="center">
  <img src="docs/images/start-screen.png" alt="Start screen showing player count and computer difficulty options" width="520">
</p>

## At the table

![A game in progress, showing computer schedules, the draw area, and the player's schedule](docs/images/gameplay.png)

1. **Pick a card** from the draw area and drag it onto your schedule.
2. **Build your week** by overlapping cards and balancing points, money, and energy.
3. **Watch for a bust:** if your final money or energy is negative, affected columns are flipped and count as zero.
4. **Play three weeks.** The most points wins; ties are broken by energy, then money.

Each schedule column scores its **visible** numbers from top to bottom:

| Section | Counts as |
|:---:|:---|
| 1 | Victory points |
| 2 | Money |
| 3 | Energy |
| 4 | Victory points |

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
