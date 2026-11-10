# Bio-Hazard Crucible

A 16-bit style biomechanical side-scrolling shmup by [Ultrademic Studios](https://github.com/Ultrademic). Hazmatic is a working title for this project.

Fly a bio-vessel through five crucible sectors, dock between stages, rank up between runs, and spend harvested biomatter in the ship lab. This public preview is the playable web arcade: custom Canvas 2D engine, studio music, daily challenges, and local plus in-memory cloud saves.

This is an unofficial fan game inspired by Sega's *Bio-Hazard Battle*. It is not affiliated with, endorsed by, or published by Sega.

## Play locally

1. Install dependencies: `npm install`
2. Start the arcade server: `npm run dev`
3. Open http://localhost:3000

No API keys are required. The server listens on port 3000 by default, or `PORT` from `.env`.

## What's in the game

- Five scripted sectors with bosses: Organic Sector, Toxic Swampland, Deep Hive, Mutant Funk, and Overgrown Temple
- Four bio-vessels (Orestes-01, Electra-Gold, Hiob-Carapace, Pyron-Crimson) with charge shots, weapon pods, and bombs
- Ship Lab mutations, pilot ranks, a daily challenge, leaderboards, and cloud-save codes
- Keyboard, mouse, touch, and standard gamepad controls (including clip-on controllers)
- Studio MP3 tracks for the title, lab, and each sector, plus Web Audio FM synth for combat sound

Leaderboards and cloud-save codes are stored in the local server's memory, so they reset when the server restarts. Pilot progress is saved in the browser. A boss-rush mode is named in the API but is not a playable menu option yet.

## Tech stack

TypeScript, React 19, Vite, Tailwind CSS 4, and an Express server (started with `tsx`) that mounts Vite in development and can serve the production build. The game runs on a 640×360 Canvas 2D engine.

## Project layout

- `server.ts` — arcade server, leaderboard / daily / cloud-save API
- `src/App.tsx` — title, main menu, and screens
- `src/game/` — engine, input, audio, sectors, ships, saves
- `src/components/` — Arena, Ship Lab, Daily Challenge, Leaderboard, Cloud Sync
- `src/assets/music/` — original Hazmatic tracks
