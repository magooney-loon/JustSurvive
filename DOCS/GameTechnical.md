# Forest Run — Technical Overview

Built on the **Spaceplate** boilerplate: Svelte 5 + Threlte (Three.js) + SpacetimeDB.

→ See `CLAUDE.md` for all boilerplate rules, patterns, and constraints.

---

## Phase Overview

| Phase | Name | Goal |
|-------|------|------|
| [Phase 1](Phase1_Foundation.md) | Foundation | Strip boilerplate, wire game stages/HUDs shell |
| [Phase 2](Phase2_Lobby.md) | Lobby | Host/join/class select/ready/start gate |
| [Phase 3](Phase3_GameLoop.md) | Core Game Loop | Movement, enemies, day/night, death |
| [Phase 4](Phase4_Abilities.md) | Classes & Items | All class abilities, items, acid pools |
| [Phase 5](Phase5_HazardsEvents.md) | Hazards & Events | Map hazards, fog, branching paths, difficulty scaling |
| [Phase 6](Phase6_Polish.md) | Polish & Score | Score formula, leaderboard, audio, tuning |

---

## Authority Model

### SpacetimeDB owns (source of truth)
- Lobby state and membership
- Game session status, day/night phase, fog events, map seed
- Player HP, stamina, position, status (`alive | downed | eliminated`)
- Enemy positions, HP, marks, speed stacks
- Item spawn locations and collection state
- Acid pool positions and expiry
- Revive channel state
- Score and leaderboard entries

### Client owns (local/visual only)
- Local player input and predicted position (corrected by server)
- Camera angle
- Three.js visuals: particles, VFX, light cones, animations
- Post-processing parameters driven by server state (vignette, fog density)
- Sound triggers (derived from server state changes via `$effect`)
- All `settings.svelte.ts` state (graphics, audio)

### Hybrid
- Player position: client predicts locally at 60fps, sends to server at ~15Hz via `move_player` reducer. Server broadcasts confirmed position; client lerps to it if drift exceeds threshold.
- Ability activation: client triggers reducer, server validates and applies effect, client renders VFX on confirmation.

---

## SpacetimeDB Schema Summary

Full reducer signatures are in each phase doc. Table list:

| Table | Purpose |
|-------|---------|
| `lobby` | Active lobbies (public/private, host, status) |
| `lobby_player` | Players in a lobby (class choice, ready state) |
| `game_session` | Active game (day phase, fog, map seed) |
| `player_state` | Per-player in-game state (HP, stamina, pos, status) |
| `enemy` | Active enemies (type, HP, pos, speed stack, marks) |
| `acid_pool` | Spitter acid puddles (pos, radius, expiry) |
| `item_spawn` | Collectible items in world |
| `mark` | Active marks/pings (Spotter, Flare) |
| `revive_channel` | Active Healer revive (who is reviving whom) |
| `run_score` | Final score per run |
| `leaderboard_entry` | Public top scores |

**Position encoding:** all world positions stored as `i64` fixed-point (multiply by `0.001` for Three.js world units). Avoids floating-point precision issues across languages.

**Enemy tick:** a scheduled reducer `enemy_tick` fires every 100ms (10Hz), moves all enemies toward their target, checks melee range, applies damage. Clients interpolate enemy positions between ticks.

**Procedural generation:** server sets a random `mapSeed` (u64) in `game_session`. All clients run the same deterministic seeded PRNG in TypeScript to produce identical forest layouts (trees, hazards, path forks, dead ends). Only dynamic state (items collected, debris cleared) is stored in tables.

---

## Stage & HUD Structure

### Stages (in `stage.svelte.ts` STAGES array)

| Stage ID | 3D Component | HUD Component | Camera Mode |
|----------|-------------|---------------|-------------|
| `menu` | `MenuStage.svelte` | `MenuHud.svelte` | Cinematic — forest vista |
| `lobby` | `MenuStage.svelte` (reuse) | `LobbyHud.svelte` | Cinematic — same |
| `game` | `GameStage.svelte` | `GameHud.svelte` | Follow — lerps to local player pos |
| `game_over` | `GameOverStage.svelte` | `GameOverHud.svelte` | Cinematic — deep night dramatic |
| `leaderboard` | `MenuStage.svelte` (reuse) | `LeaderboardHud.svelte` | Cinematic — same |
| `settings` | `MenuStage.svelte` (reuse) | `Settings.svelte` (existing) | Cinematic — same |

Remove example stages: `home`, `galaxy`.

### New files: 3D Stages (inside Canvas)

```
src/lib/
  MenuStage.svelte       — Forest vista, atmospheric static scene
  GameStage.svelte       — Full gameplay world (the big one)
    ForestWorld.svelte   — Procedural terrain chunk streaming
    PlayerEntity.svelte  — Each player_state row rendered as character
    EnemyEntity.svelte   — Each enemy row, interpolated positions
    HazardLayer.svelte   — Bushes, stumps, pits, debris blockages
    AcidPoolEntity.svelte
    ItemPickupEntity.svelte
    DayNightSky.svelte   — Sky/lighting driven by game_session.dayPhase
    FogLayer.svelte      — Volumetric fog post-processing toggle
    MarkOverlay.svelte   — Mark indicators on enemies/locations
    FlareEntity.svelte   — Dynamic PointLight with TTL
  GameOverStage.svelte   — Deep night static scene
```

### New files: HUDs (in SceneHud, HTML overlays)

```
src/lib/
  MenuHud.svelte         — Title, Play / Join by Code / Quickplay / Leaderboard
  LobbyHud.svelte        — Player list, class select, ready, lobby code, start
  GameHud.svelte         — HP/stamina, day phase timer, score, pings, ability cooldowns
  GameOverHud.svelte     — Score breakdown, play again, main menu
  LeaderboardHud.svelte  — Top runs table
```

### Routing pattern

`Scene.svelte` and `SceneHud.svelte` use **separate `{#if}` blocks** (never `{:else if}`) so transitions fire on every stage switch — this is the existing boilerplate pattern, do not change it.

### Camera follow mode

`Camera.svelte` needs a new mode alongside the existing cinematic mode. When `stageState.currentStage === 'game'`, a `useTask` in Camera.svelte lerps the CameraControls target to the local player's current position each frame. The camera offset (height, distance behind) is a fixed third-person config.

### Game state module

Create `src/game.svelte.ts` — a reactive singleton (`.svelte.ts` pattern) holding client-side game state:
- `currentLobbyId`, `currentSessionId`
- `localPlayerIdentity`, `localPlayerClass`
- `localPos` — predicted local position (updated each frame by input handler)
- `teammates` — derived from `useTable(tables.lobbyPlayer)`
- `gameActions` — `joinLobby()`, `hostLobby()`, `leaveGame()` etc.

---

## Key Architectural Risks

| Risk | Mitigation |
|------|-----------|
| Enemy tick at 10Hz feels choppy | Client interpolates enemy positions between ticks via `useTask` lerp |
| `move_player` reducer called too often | Send at fixed 15Hz interval, not per-frame |
| Procedural map diverging across clients | Pin the seeded PRNG algorithm, never change after launch |
| Healer revive interrupt race condition | Server checks for active `revive_channel` row on any damage event and cancels it |
| Forest rendering performance | InstancedMesh for trees, LOD for distance, chunk streaming, quality tiers from existing `settings.svelte.ts` |
| Spotter mandatory in late game | Graceful degradation — enemies visible without marks, just harder; player count bonus rewards small teams |

---

## SpacetimeDB Backend Location

```
backend/
  spacetimedb/
    src/
      schema.ts    — All table definitions, exports spacetimedb
      index.ts     — All reducers, lifecycle hooks, imports from schema.ts
    package.json
    tsconfig.json
```

Generate bindings after any schema change:
```bash
pnpm spacetime:generate
```

Publish:
```bash
spacetime publish forest-run --module-path backend/spacetimedb
```
