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

- **4 classes** — Spotter (sniper/marks), Gunner (DPS/suppress), Tank (axe swing/brace), Healer (heal/revive)
- **5 enemy types** — Basic, Fast, Brute, Spitter (acid pools), Caster (beam + strafe)
- **Day/night cycle** — 5 phases × 60s each (Sunset → Dusk → Twilight → Night → Deep Night), loops every 5 minutes
- **Escalating difficulty** — spawn interval drops from 6s to 1.5s, enemies gain +5 HP and +2%/s speed per cycle
- **Downed system** — go to 0 HP and you're downed with 30s for a teammate to revive you
- **Leaderboard** — squad scores and survival times tracked globally

## Classes

| Class   | Role      | HP  | Stamina | Walk Speed | Sprint Speed | Abilities                                    |
| ------- | --------- | --- | ------- | ---------- | ------------ | -------------------------------------------- |
| Spotter | Scout     | 100 | 450     | 5.0        | 9.0          | Steady Shot (LMB), Flash Stun cone (RMB)     |
| Gunner  | DPS       | 100 | 80      | 4.5        | 7.5          | Shoot (LMB), Adrenaline (RMB), Suppress      |
| Tank    | Frontline | 150 | 200     | 2.5        | 3.5          | Axe Swing cone 0.5s (LMB), Brace (RMB hold)  |
| Healer  | Support   | 100 | 80      | 5.0        | 8.5          | Heal teammate (LMB), Revive + shield (RMB)   |

### Spotter — Scout

- **HP:** 100 | **Stamina:** 450 | **Speed:** 5.0 / 9.0
- **Abilities:**
  - **Steady Shot (LMB)** — High-damage sniper shot at an enemy within 15 units. Deals 45 damage (55 if target is already marked). Marks the target for 5s — marked targets take +10 bonus damage from all sources. Cooldown: 3s. +10 score on new marks.
  - **Flash Stun (RMB)** — Fire a 90° stun cone up to 5 units. Enemies caught are dazed for 2s. Cooldown: 1.5s. +10 score per stunned enemy.
- **Tips:**
  - Steady Shot marks on hit — shoot first, then let your team follow up for the +10 bonus damage.
  - Shooting an already-marked target deals 55 damage total. Chain shots on tough enemies like Brutes.
  - Flash stun has a 90° cone — use it to buy time for teammates when overwhelmed.
  - Your high stamina and speed make you the best scout — stay mobile and keep tagging.

### Gunner — DPS

- **HP:** 100 | **Stamina:** 80 | **Speed:** 4.5 / 7.5
- **Abilities:**
  - **Shoot (LMB)** — Fire at enemies within 10 units. Deals 15 damage per shot (25 vs marked targets). Every 3rd consecutive shot on the same target suppresses (dazes for 1s).
  - **Adrenaline (RMB)** — Instantly restore all stamina. Cooldown: 5s. Essential for maintaining suppression chains or escaping danger.
- **Tips:**
  - Every 3rd shot suppresses (dazes) the target. Chain bursts to keep Brutes permanently staggered.
  - Shoot marked enemies for 25 damage per shot — coordinate with the Spotter for maximum burst.
  - You have low stamina — use Adrenaline strategically, not on cooldown.
  - Suppressed enemies deal no damage. Prioritize high-threat targets like Brutes and Casters.

### Tank — Frontline

- **HP:** 150 | **Stamina:** 200 | **Speed:** 2.5 / 3.5
- **Abilities:**
  - **Axe Swing (LMB)** — Swing your axe in a 90° cone up to 4 units. Deals 25 damage to all enemies in range, knocks them back, and dazes for 1.5s. Cooldown: 0.5s. +5 score per hit, +2 per kill.
  - **Brace (RMB hold)** — Enter a defensive stance. Enemies hitting you are knocked back instead of dealing damage. Lasts up to 5s. Auto-releases at max duration. 1s cooldown after release.
- **Tips:**
  - Axe Swing hits ALL enemies in the cone at 0.5s cooldown — spam it into packs for massive CC.
  - Daze lasts 1.5s and cooldown is only 0.5s — chain swings to keep enemies permanently staggered.
  - Bracing reflects enemies when they melee you. Hold RMB when a Brute or boss charges in.
  - Your slow speed means you cannot escape — axe swing clears space, brace absorbs the rest.

### Healer — Support

- **HP:** 100 | **Stamina:** 80 | **Speed:** 5.0 / 8.5
- **Abilities:**
  - **Heal (LMB)** — Heal an ally within 10 units for 30 HP. You also heal yourself for 8 HP. Cooldown: 2s. +5 score if target was damaged. Deals 35 damage per shot as secondary attack.
  - **Revive (RMB)** — Channel for 2s to revive a downed ally within 3 units. While channeling, a 50 HP shield protects the downed ally — if the shield absorbs 50 damage it breaks and interrupts the revive. On success: ally gets 50 HP + 5s speed boost. Cooldown: 15s after completion. +20 score.
- **Tips:**
  - Reviving gives the ally a speed boost — perfect for pulling them out of a pack.
  - The revive shield absorbs 50 damage before being interrupted. You now have a window even in a fight.
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
| 2 spotters       | Twin Eyes          | Double steady shots, double flash stuns — enemies are marked and stunned constantly. |
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
