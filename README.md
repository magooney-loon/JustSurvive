<div align="center">

<h1>⚔️ JustSurvive</h1>

<p>Multiplayer real-time endless shooter survival arena game</p>

<br/>

<a href="https://magooney-loon.github.io/JustSurvive/">
  <span style="font-size: 3.6em; font-weight: bold;">▶ PLAY NOW</span>
</a>

<p> <a href="https://www.youtube.com/watch?v=b8tjPXkCyLc">Gameplay/Engine Video</a></p>

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

| Class   | Role      | HP  | Stamina | Walk Speed | Sprint Speed | Abilities                                |
| ------- | --------- | --- | ------- | ---------- | ------------ | ---------------------------------------- |
| Spotter | Scout     | 100 | 450     | 5.0        | 9.0          | Mark enemy (LMB), Flash stun cone (RMB)  |
| Gunner  | DPS       | 100 | 80      | 4.5        | 7.5          | Shoot (LMB), Adrenaline (RMB), Suppress  |
| Tank    | Frontline | 150 | 200     | 2.5        | 3.5          | Shield Bash (LMB), Brace (RMB hold)      |
| Healer  | Support   | 100 | 80      | 5.0        | 8.5          | Heal teammate (LMB), Revive downed (RMB) |

### Spotter — Scout

- **HP:** 100 | **Stamina:** 450 | **Speed:** 5.0 / 9.0
- **Abilities:**
  - **Mark Enemy (LMB)** — Tag an enemy within 15 units. Marked targets take bonus damage and are visible through walls. Lasts 5s. Cooldown: 2s server. +10 score on new marks.
  - **Flash Stun (RMB)** — Fire a 90° stun cone up to 5 units. Enemies caught are dazed for 2s. Cooldown: 1.5s. +10 score per stunned enemy.
- **Tips:**
  - Marked enemies take bonus damage from all sources — always mark before the gunner shoots.
  - Flash stun has a 90° cone — use it to buy time for teammates when overwhelmed.
  - Your high stamina and speed make you the best scout — stay mobile and keep marking.
  - Re-mark enemies before the mark expires to maintain damage bonus.

### Gunner — DPS

- **HP:** 100 | **Stamina:** 80 | **Speed:** 4.5 / 7.5
- **Abilities:**
  - **Shoot (LMB)** — Fire at enemies within 10 units. Deals 15 damage per shot. Every 3rd consecutive shot on the same target suppresses (dazes for 1s).
  - **Adrenaline (RMB)** — Instantly restore all stamina. Cooldown: 5s. Essential for maintaining suppression chains or escaping danger.
- **Tips:**
  - Every 3rd shot suppresses (dazes) the target. Chain bursts to keep Brutes permanently staggered.
  - Adrenaline is essential when you need to sprint or maintain fire — time it before engagements.
  - You have low stamina — use Adrenaline strategically, not on cooldown.
  - Suppressed enemies deal no damage. Prioritize high-threat targets like Brutes and Casters.

### Tank — Frontline

- **HP:** 150 | **Stamina:** 200 | **Speed:** 2.5 / 3.5
- **Abilities:**
  - **Shield Bash (LMB)** — Bash enemies within 5 units. Knocks them back and dazes for 1.5s. Cooldown: 1.5s. +5 score per bash.
  - **Brace (RMB hold)** — Enter a defensive stance. Enemies hitting you are knocked back instead of dealing damage. Lasts up to 5s. Auto-releases at max duration. 1s cooldown after release.
- **Tips:**
  - Shield Bash has a 1.5s cooldown. Use it to knock enemies off downed teammates.
  - Bracing significantly reduces incoming damage. Hold RMB when a Brute or beam is incoming.
  - Your slow speed means you cannot escape — brace and absorb damage instead.
  - Bash enemies out of melee range of teammates to protect them.

### Healer — Support

- **HP:** 100 | **Stamina:** 80 | **Speed:** 5.0 / 8.5
- **Abilities:**
  - **Heal (LMB)** — Heal an ally within 10 units for 30 HP. You also heal yourself for 8 HP. Cooldown: 2s. +5 score if target was damaged. Deals 35 damage per shot as secondary attack.
  - **Revive (RMB)** — Channel for 2s to revive a downed ally within 3 units. Cooldown: 15s after completion. Revived player gets 50 HP and a 5s speed boost. +20 score.
- **Tips:**
  - Reviving a downed ally gives them a speed boost — use it to pull them out of a pile.
  - Taking damage while channeling a revive interrupts it. Tank should cover the heal.
  - You deal 35 damage per shot — use it to finish low-HP enemies between heals.
  - Prioritize keeping the Tank alive — they absorb the most damage.

## Enemies

| Type    | HP   | Base Speed | Abilities                        |
| ------- | ---- | ---------- | -------------------------------- |
| Basic   | 80   | 3.2        | Melee attacks                    |
| Fast    | 50   | 5.2        | Quick melee, hard to hit         |
| Brute   | 250  | 2.1        | Heavy melee, high damage         |
| Spitter | 100  | 1.7        | Acid pools (damage over time)    |
| Caster  | 80   | 1.4        | Beam attack + strafing movement  |
| Boss    | 1500 | 0.6        | Spawns every 90s, clears enemies |

_Enemies gain +5 HP per cycle and +2%/s speed (capped at +50%)._

## Squad Synergies

The game dynamically calculates squad synergies based on class composition:

| Composition      | Synergy            | Description                                                                        |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Full squad       | Full Squad         | Perfect synergy. Every role covered — textbook survival.                           |
| 2 tanks + healer | Immortal Frontline | Two tanks and a healer. Nothing dies — including you.                              |
| 2 spotters       | Twin Eyes          | Double marks, double flash stuns — crowd control everywhere.                       |
| 2 gunners        | Twin Barrels       | Maximum suppression. Enemies barely move.                                          |
| 2 healers        | Eternal Life       | You will never die. You will also never do meaningful damage.                      |
| Gunner + Spotter | Marked for Death   | Spotter reveals, gunner suppresses. Enemies are tagged before they know you exist. |
| Gunner + Healer  | Fire & Life        | Healer keeps the gunner fed. Constant suppression with a safety net.               |
| Healer + Tank    | Ironclad           | Tank braces, healer patches. Nearly unkillable duo.                                |
| Spotter + Tank   | Scout & Shield     | Intel meets armor. Spotter calls threats, tank absorbs them.                       |

For all possible synergies, see the in-game lobby HUD — it displays your squad's unique synergy name and description automatically.

## Tech Stack

- **Frontend** — Svelte 5 (runes), Threlte 8, Three.js, Vite
- **Backend** — SpacetimeDB 2.0 (TypeScript module, server-authoritative)
- **Real-time** — all game state lives in SpacetimeDB; clients subscribe and react
- **3D** — instanced meshes, LineSegments rain, dynamic lighting, day/night sky shader

---

## Getting Started

```sh
# install dependencies
npm install

# run dev server
npm dev

# build for production
npm build
```

### SpacetimeDB

```sh
# start local SpacetimeDB server
spacetime start

# publish module (local)
npm run spacetime:publish:local

# publish module (local, wipe db)
npm run spacetime:publish:local:fresh

# publish to maincloud
npm run spacetime:publish

# regenerate client bindings after schema changes
npm run spacetime:generate
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
