# HELLWAKE

A fast, browser-based wave-survival FPS built with [Three.js](https://threejs.org/). Hold a demonic arena against escalating waves of enemies. Loot their corpses, deploy turrets, and stay moving.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). Click to lock the mouse and descend.

To build a production bundle:

```bash
npm run build
npm run preview
```

## Controls

| Key | Action |
| --- | --- |
| `WASD` | Move |
| `Mouse` | Aim |
| `Click` | Shoot |
| `Shift` | Sprint |
| `Space` | Jump |
| `Q` | Dash |
| `1`–`4` / `Scroll` | Switch weapon |
| `R` | Reload |
| `F` | Deploy sentry |

## Gameplay

- **Waves** pour in from the perimeter and get bigger and deadlier as you survive.
- **Weapons:** start with the pistol, shotgun, and ripper. Demons drop an **AR** with a 30-round magazine and reloading — grab it off a corpse to unlock it.
- **Sentries:** demons also drop deployable turrets. Carry up to 3 and drop one with `F`. It auto-targets nearby demons — but they'll turn and tear it down if it draws their attention.
- **Pickups:** killed enemies may drop health, ammo, weapons, or sentry kits. Walk over them to grab them.

## Project layout

All game code lives in `src/`, split by system:

| File | Responsibility |
| --- | --- |
| `main.js` | Boot, render loop, game state |
| `world.js` | Arena geometry, lighting, spawn points |
| `player.js` | Movement, dash, collisions, camera |
| `weapons.js` | Weapons, firing, reloading |
| `enemies.js` | Enemy AI, projectiles, drops |
| `sentries.js` | Deployable turrets |
| `waves.js` | Wave spawning and scoring |
| `effects.js` | Tracers, sparks, gibs, screenshake |
| `audio.js` | Synthesized sound effects (Web Audio) |
| `hud.js` | DOM HUD and overlays |
| `input.js` | Keyboard/mouse state |

All art and audio are generated procedurally — there are no asset files.