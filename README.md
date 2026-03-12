<div align="center">

<h1>⚔️ JustSurvive</h1>

<p>Multiplayer real-time endless shooter survival arena game</p>

<br/>

<a href="https://magooney-loon.github.io/spaceplate/">
  <span style="font-size: 1.5em; font-weight: bold;">▶ PLAY NOW</span>
</a>

<br/> <br/>

<table>
  <tr>
    <td align="center"><a href="https://svelte.dev"><img src="https://img.shields.io/badge/Svelte-5-ff3e00.svg" alt="Svelte 5"></a></td>
    <td align="center"><a href="https://threlte.xyz"><img src="https://img.shields.io/badge/Threlte-8-ff3e00.svg" alt="Threlte 8"></a></td>
    <td align="center"><a href="https://threejs.org"><img src="https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js" alt="Three.js"></a></td>
    <td align="center"><a href="https://spacetimedb.com"><img src="https://img.shields.io/badge/SpacetimeDB-2.0-7b2ff7.svg" alt="SpacetimeDB"></a></td>
    <td align="center"><a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-6-646cff.svg" alt="Vite 6"></a></td>
    <td align="center"><a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-blue.svg" alt="TypeScript 5"></a></td>
  </tr>
</table>

<p>Built on <a href="https://github.com/magooney-loon/spaceplate">🪐 Spaceplate</a> — Svelte 5 + Threlte + SpacetimeDB boilerplate</p>

</div>

---

Squad-based survival arena. Up to 4 players pick a class, drop into a circular arena, and hold out against escalating enemy waves across a real-time day/night cycle. Every cycle the enemies get faster, hit harder, and spawn more often. Last squad standing wins.

## Gameplay

- **4 classes** — Spotter (marks/pings), Gunner (DPS/suppress), Tank (bash/brace), Healer (heal/revive)
- **5 enemy types** — Basic, Fast, Brute, Spitter (acid pools), Caster (beam + strafe)
- **Day/night cycle** — 5 phases × 60s each (Sunset → Dusk → Twilight → Night → Deep Night), loops every 5 minutes
- **Escalating difficulty** — spawn interval drops from 6s to 1.5s, enemies gain +5 HP and +2%/s speed per cycle
- **Downed system** — go to 0 HP and you're downed with 30s for a teammate to revive you
- **Leaderboard** — squad scores and survival times tracked globally

## Classes

| Class   | Role      | HP  | Abilities                                |
| ------- | --------- | --- | ---------------------------------------- |
| Spotter | Scout     | 100 | Mark enemy (LMB), Ping location (RMB)    |
| Gunner  | DPS       | 100 | Shoot (LMB), every 3rd shot suppresses   |
| Tank    | Frontline | 150 | Shield Bash (LMB), Brace (RMB hold)      |
| Healer  | Support   | 100 | Heal teammate (LMB), Revive downed (RMB) |

## Tech Stack

- **Frontend** — Svelte 5 (runes), Threlte 8, Three.js, Vite
- **Backend** — SpacetimeDB 2.0 (TypeScript module, server-authoritative)
- **Real-time** — all game state lives in SpacetimeDB; clients subscribe and react
- **3D** — instanced meshes, LineSegments rain, dynamic lighting, day/night sky shader

---

## Getting Started

```sh
# install dependencies
pnpm install

# run dev server
pnpm dev

# build for production
pnpm build
```

### SpacetimeDB

```sh
# start local SpacetimeDB server
spacetime start

# publish module (local)
pnpm spacetime:publish:local

# publish module (local, wipe db)
pnpm spacetime:publish:local:fresh

# publish to maincloud
pnpm spacetime:publish

# regenerate client bindings after schema changes
pnpm spacetime:generate
```

---

## Configuration

Copy `.env.example` to `.env.local` and fill in your values.

| Variable                   | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| `VITE_SPACETIMEDB_DB_NAME` | SpacetimeDB database name                                            |
| `VITE_SPACETIMEDB_HOST`    | SpacetimeDB host (`https://maincloud.spacetimedb.com` for maincloud) |
| `SPACETIMEDB_DB_NAME`      | Same as above, used by the `spacetime` CLI                           |
| `SPACETIMEDB_HOST`         | Same as above, used by the `spacetime` CLI                           |
| `VITE_GAME_ENGINE`         | `true` to enable Threlte Studio + PerfMonitor in dev                 |
| `VITE_GAME_ENGINE_LOGS`    | `true` to enable debug logging                                       |
