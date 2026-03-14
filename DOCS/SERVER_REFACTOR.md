# Server Refactor Plan

> **Goal:** Break `spacetimedb/src/index.ts` (~2200 lines) into focused modules
> without violating SpacetimeDB bundler constraints.

---

## Constraint: What Must Stay in `index.ts`

The SpacetimeDB bundler has one hard rule:

- **`schema({...})` must be called in `index.ts`** (the module entry point)
- **`export default spacetimedb`** must be in `index.ts`
- **Scheduled tables** must stay in `index.ts` — they forward-reference their
  reducer via a lazy `(): any => reducerFn` which requires both to be in scope

Everything else (tables, constants, helpers, reducers) **can** be in separate
files and imported into `index.ts`. Tables are already split (`tables.ts`) and
working — reducers are the next step.

> ⚠️ If `spacetime generate` fails after splitting reducers, the fix is simple:
> re-export every reducer from `index.ts` (`export { create_lobby } from './reducers/lobby.js'`).
> The generator only needs the exports visible from `index.ts`.

---

## Target File Structure

```
spacetimedb/src/
  index.ts                  — Entry: schema(), scheduled tables, lifecycle hooks, re-exports
  tables.ts                 — All table definitions            (already done ✓)
  constants.ts              — All game constants               (already done ✓)
  helpers.ts                — Pure math/utility functions      (already done ✓)

  reducers/
    lobby.ts                — Lobby CRUD + chat
    game.ts                 — Session start, move, day phase, enemy tick, spawn
    abilities.ts            — All per-class abilities
    boss.ts                 — Boss lifecycle (spawn, tick, phase transitions)
```

---

## `reducers/lobby.ts`

Reducers to move here:

| Reducer             | Purpose                          |
| ------------------- | -------------------------------- |
| `create_lobby`      | Host creates lobby               |
| `join_lobby`        | Join by lobby ID                 |
| `join_by_code`      | Join by 6-char code              |
| `quick_join`        | Join any public lobby or create  |
| `set_class`         | Choose class in lobby            |
| `set_ready`         | Toggle ready state               |
| `leave_lobby`       | Leave/disband lobby              |
| `kick_player`       | Host kicks a player              |
| `start_countdown`   | Host initiates countdown         |
| `send_lobby_message`| Lobby chat                       |

Also move: `fire_lobby_afk_kick` (AFK kick scheduled reducer).

---

## `reducers/game.ts`

Reducers to move here:

| Reducer            | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `fire_start_game`  | **⚠️ Must be re-exported from index.ts** (scheduled) |
| `move_player`      | Player movement + collision + stamina         |
| `advance_day_phase`| Progress through sunset → deep_night          |
| `spawn_enemy`      | Weighted random enemy spawn                   |
| `enemy_tick`       | AI movement, attacks, acid pools, caster bolts |

> `fire_start_game` is referenced by the `LobbyCountdown` scheduled table
> in `index.ts`. Move the reducer to `reducers/game.ts` but re-export it
> from `index.ts` to keep the forward reference working:
>
> ```ts
> // index.ts
> export { fire_start_game } from './reducers/game.js';
> const LobbyCountdown = table({ scheduled: (): any => fire_start_game }, ...)
> ```

---

## `reducers/abilities.ts`

Reducers to move here:

| Reducer          | Class       | Ability           |
| ---------------- | ----------- | ----------------- |
| `steady_shot`    | Spotter     | Ranged shot       |
| `spotter_flash`  | Spotter     | Flash cone        |
| `attack_enemy`   | Gunner/Healer | Basic attack    |
| `heal_player`    | Healer      | Heal beam         |
| `adrenaline`     | Healer      | Speed boost       |
| `axe_swing`      | Tank        | Melee swing       |
| `brace_start`    | Tank        | Enter brace       |
| `brace_end`      | Tank        | Exit brace        |
| `revive_start`   | Healer      | Begin revive      |
| `complete_revive`| Healer      | Finish revive     |
| `clear_debris`   | (all)       | Interact          |

---

## `reducers/boss.ts`

Reducers to move here + new boss-specific logic:

| Reducer          | Purpose                             |
| ---------------- | ----------------------------------- |
| `fire_boss_spawn`| **⚠️ Must be re-exported from index.ts** (scheduled) |
| `boss_tick`      | *(new)* Boss AI, phase transitions, special attacks |
| `boss_ability`   | *(new)* Per-boss special ability trigger |

---

## Boss: Special Enemy Entity

### Current (single Enemy table, `enemyType = 'boss'`)

The boss is a plain enemy row. All boss logic is scattered inside `enemy_tick`
and `fire_boss_spawn` using `if (e.enemyType === 'boss')` branches.

### Proposed: Dedicated `Boss` Table

Separate the boss into its own table so each boss type can have unique fields,
phases, and scheduled abilities — without bloating the shared `Enemy` table.

#### New `Boss` table (add to `tables.ts`)

```ts
export const Boss = table(
  {
    name: 'boss',
    public: true,
    indexes: [
      { name: 'boss_session_id', accessor: 'boss_session_id', algorithm: 'btree', columns: ['sessionId'] }
    ]
  },
  {
    id:           t.u64().primaryKey().autoInc(),
    sessionId:    t.u64(),
    bossType:     t.string(),      // 'forest_guardian' | 'night_horror' | ...
    hp:           t.u64(),
    maxHp:        t.u64(),
    posX:         t.i64(),
    posZ:         t.i64(),
    phase:        t.u64(),         // 0 = normal, 1 = enraged (≤50% HP), etc.
    isAlive:      t.bool(),
    spawnedAt:    t.timestamp(),
    diedAt:       t.timestamp().optional(),
    // Per-type ability cooldowns
    abilityCooldownUntil: t.timestamp().optional(),
    ability2CooldownUntil: t.timestamp().optional()
  }
);
```

#### Rationale

| Concern             | Before (shared Enemy)            | After (Boss table)                         |
| ------------------- | --------------------------------- | ------------------------------------------ |
| HP scaling          | `ENEMY_HP['boss']` single value   | Per-type constants in `constants.ts`       |
| Phase transitions   | Impossible without extra columns  | `phase` column, drives behavior in `boss_tick` |
| Ability cooldowns   | Shoe-horned into Enemy columns    | Own ability columns, easy to extend        |
| Adding a new boss   | Giant if-chain in `enemy_tick`    | New `bossType` + constants + one branch    |
| Frontend rendering  | Filters Enemy table by type       | Subscribe directly to `Boss` table         |

#### Boss Types (roadmap, not implement yet)

```
forest_guardian  — current boss, enrages at 50% HP, charge attack
night_horror     — invisible phases, screech AoE
bone_colossus    — spawns skeleton minions, armor phases
```

#### Migration: Remove boss from Enemy table

Once `Boss` table is live:

1. Remove `boss` from `ENEMY_WEIGHTS`, `ENEMY_HP`, `ENEMY_BASE_SPEED`
2. Remove `if (e.enemyType === 'boss')` branches from `enemy_tick`
3. `boss_tick` in `reducers/boss.ts` handles all boss AI independently
4. Frontend: change `EnemyEntity.svelte` boss logic → new `BossEntity.svelte`

---

## `index.ts` After Refactor

```ts
import { schema, table, t } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

// Tables
import { Lobby, LobbyPlayer, GameSession, PlayerState, Enemy, Boss, /* ... */ } from './tables.js';

// Reducers (re-exported so spacetime generate sees them)
export * from './reducers/lobby.js';
export * from './reducers/game.js';      // includes fire_start_game
export * from './reducers/abilities.js';
export * from './reducers/boss.js';      // includes fire_boss_spawn

// Import for scheduled table forward refs
import { fire_start_game } from './reducers/game.js';
import { fire_boss_spawn }  from './reducers/boss.js';

// Scheduled tables (must stay here — forward-reference reducers)
const LobbyCountdown = table(
  { name: 'lobby_countdown', scheduled: (): any => fire_start_game },
  { scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt(), lobbyId: t.u64() }
);
const BossSpawnTimer = table(
  { name: 'boss_spawn_timer', scheduled: (): any => fire_boss_spawn },
  { scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt(), sessionId: t.u64() }
);

// Schema (must stay here)
const spacetimedb = schema({ lobby: Lobby, /* ... */ lobbyCountdown: LobbyCountdown, bossSpawnTimer: BossSpawnTimer });
export default spacetimedb;

// Lifecycle
spacetimedb.clientConnected(...);
spacetimedb.clientDisconnected(...);
```

---

## Execution Order

1. ✅ **Create `reducers/shared.ts`** — ctx helpers (clearLobbyMessages, endSession, applyPlayerDamage, applyAccumulatedDamage)
2. ✅ **Create `reducers/lobby.ts`** — lobby CRUD + chat
3. ✅ **Create `reducers/abilities.ts`** — all per-class abilities
4. ✅ **Create `reducers/game.ts`** — session start, move, day phase, enemy tick/spawn, boss spawn
5. ✅ **Rewrite `index.ts`** — thin registrations + scheduled tables + schema + lifecycle (~280 lines)
6. ✅ **Publish + regenerate** — `npm run spacetime:publish:local:fresh && npm run spacetime:generate` — clean build
7. **Add `Boss` table** to `tables.ts`
8. **Move + expand `boss.ts`** — new `boss_tick`, remove boss from Enemy
9. **Update frontend** — `BossEntity.svelte`, subscribe to `boss` table

> Regenerate and do a quick `spacetime publish --clear-database` smoke test
> after each step before moving on.

---

## What Does NOT Change

- `tables.ts` structure (only adding `Boss`)
- `constants.ts` / `helpers.ts` (only adding boss constants)
- All reducer names and signatures (client bindings stay the same)
- `module_bindings/` (regenerated, not manually edited)
