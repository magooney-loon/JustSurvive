# Lobby System Boilerplate

A self-contained reference for reusing this multiplayer lobby system in other SpacetimeDB + Svelte 5 projects. The patterns here were proven in JustSurvive (Forest Run). Copy, adapt names, and wire up.

---

## Table of Contents

1. [Full Flow Diagram](#full-flow-diagram)
2. [Backend Schema Patterns](#backend-schema-patterns)
3. [Deterministic Code Generation (LCG)](#deterministic-code-generation-lcg)
4. [Timestamp Helper](#timestamp-helper)
5. [Idempotent Leave Reducer Pattern](#idempotent-leave-reducer-pattern)
6. [Scheduled Countdown Pattern](#scheduled-countdown-pattern)
7. [Idle Host Detection Pattern](#idle-host-detection-pattern)
8. [Server-Side Quick Join Pattern](#server-side-quick-join-pattern)
9. [Kick Player Pattern](#kick-player-pattern)
10. [End Session & Leaderboard Pattern](#end-session--leaderboard-pattern)
11. [Lifecycle Hooks](#lifecycle-hooks)
12. [Frontend: game.svelte.ts Singleton](#frontend-gamesveltets-singleton)
13. [Frontend: Global Subscription Pattern](#frontend-global-subscription-pattern)
14. [Frontend: useSpacetimeDB + useTable Stores](#frontend-usespacetimedb--usetable-stores)
15. [Svelte 5 Gotchas](#svelte-5-gotchas)
16. [MenuHud Reconnect Pattern](#menuhud-reconnect-pattern)
17. [Async Reducer Error Handling](#async-reducer-error-handling)
18. [LobbyHud Patterns](#lobbyhud-patterns)
19. [Complete Backend Reference](#complete-backend-reference)
20. [Quick Reference: Checklist for a New Project](#quick-reference-checklist-for-a-new-project)

---

## Full Flow Diagram

```
Player opens game
       │
       ▼
  [MenuHud]
  ┌─────────────────────────────────────────────────────┐
  │  alreadyInLobby?                                    │
  │  ├── YES (in_progress) → "Reconnect to Lobby" btn  │
  │  │          └─→ setStage('lobby')                  │
  │  ├── YES (waiting/countdown) → auto-redirect        │
  │  │          └─→ setStage('lobby')                  │
  │  └── NO  → name input + buttons                    │
  │             ├── Quick Play  ──→ quick_join reducer  │
  │             │    (server picks open lobby or creates)│
  │             ├── Host Private Lobby                  │
  │             │    └─→ createLobby (private)          │
  │             └── Join by Code                       │
  │                  └─→ joinByCode(code)               │
  └─────────────────────────────────────────────────────┘
       │ (on success, no error)
       ▼
  setStage('lobby')
       │
       ▼
  [LobbyHud]
  ┌─────────────────────────────────────────────────────┐
  │  Waits for LobbyPlayer row with own identity        │
  │  Shows: player list, class selector, ready, code    │
  │                                                     │
  │  [Idle Host Timer — server-side]                    │
  │    If host is not ready for 2 min:                  │
  │      Solo → lobby deleted                           │
  │      Others present → host transferred, timer reset │
  │    UI shows countdown to deadline                   │
  │                                                     │
  │  Each player:                                       │
  │    1. Select class (setClass reducer)               │
  │    2. Ready up (setReady reducer)                   │
  │                                                     │
  │  Host sees Start button when all players are ready  │
  │  Host clicks Start →                                │
  │    startCountdown reducer                           │
  │    → lobby.status = 'countdown'                     │
  │    → LobbyCountdown row inserted (3s delay)         │
  │    → fire_start_game fires                          │
  │    → GameSession + PlayerState rows created         │
  │    → lobby.status = 'in_progress'                   │
  │                                                     │
  │  All clients watch lobby.status:                    │
  │    'in_progress' → find active GameSession row      │
  │    → set currentSessionId → setStage('game')        │
  └─────────────────────────────────────────────────────┘
       │
       ▼
  [GameStage + GameHud]
  Game runs using PlayerState rows
       │
       ▼
  end_session() (called by game-over logic)
  ┌─────────────────────────────────────────────────────┐
  │  1. Sets GameSession status = 'finished'            │
  │  2. Writes GlobalStats (upsert by id=1)             │
  │  3. Writes SquadRecord (upsert by class combo)      │
  │  4. Writes LobbyResult if score is top-20           │
  │     (evicts lowest if already 20 entries)           │
  │  5. Writes LobbyResultPlayer for each player        │
  │  6. Resets lobby → status='waiting', isReady=false  │
  └─────────────────────────────────────────────────────┘
```

---

## Backend Schema Patterns

### Single-File Layout

All tables, schema, helpers, and reducers live in one file (`src/index.ts`). Tables are defined first, then schema is exported, then reducers. This avoids circular import issues between `schema.ts` and `index.ts`.

```
spacetimedb/src/index.ts
  1. imports
  2. table definitions (Lobby, LobbyPlayer, GameSession, PlayerState,
                        LobbyCountdown, LobbyIdleJob,
                        LobbyResult, LobbyResultPlayer, GlobalStats, SquadRecord)
  3. schema({ ... }) export default
  4. helper functions (generateCode, ts, ...)
  5. reducer exports
  6. lifecycle hooks
```

### Core Table Definitions

```typescript
import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

const Lobby = table({
  name: 'lobby',
  public: true,
  indexes: [
    { name: 'lobby_status', accessor: 'lobby_status', algorithm: 'btree', columns: ['status'] },
    { name: 'lobby_code',   accessor: 'lobby_code',   algorithm: 'btree', columns: ['code'] },
  ],
}, {
  id:               t.u64().primaryKey().autoInc(),
  hostIdentity:     t.identity(),
  code:             t.string(),
  isPublic:         t.bool(),
  status:           t.string(),          // 'waiting' | 'countdown' | 'in_progress'
  playerCount:      t.u64(),
  maxPlayers:       t.u64(),
  createdAt:        t.timestamp(),
  hostIdleDeadline: t.timestamp(),       // server-managed: when idle job fires
});

const LobbyPlayer = table({
  name: 'lobby_player',
  public: true,
  indexes: [
    { name: 'lobby_player_lobby_id', accessor: 'lobby_player_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
    { name: 'lobby_player_identity', accessor: 'lobby_player_identity', algorithm: 'btree', columns: ['playerIdentity'] },
  ],
}, {
  id:             t.u64().primaryKey().autoInc(),
  lobbyId:        t.u64(),
  playerIdentity: t.identity(),
  playerName:     t.string(),
  classChoice:    t.string(),   // '' = unselected
  isReady:        t.bool(),
  joinedAt:       t.timestamp(),
});

const GameSession = table({
  name: 'game_session',
  public: true,
  indexes: [
    { name: 'game_session_lobby_id', accessor: 'game_session_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
  ],
}, {
  id:        t.u64().primaryKey().autoInc(),
  lobbyId:   t.u64(),
  status:    t.string(),   // 'active' | 'finished'
  startedAt: t.timestamp(),
  endedAt:   t.timestamp().optional(),
  mapSeed:   t.u64(),
  // add your game-specific fields here
});

const PlayerState = table({
  name: 'player_state',
  public: true,
  indexes: [
    { name: 'player_state_session_id', accessor: 'player_state_session_id', algorithm: 'btree', columns: ['sessionId'] },
    { name: 'player_state_identity',   accessor: 'player_state_identity',   algorithm: 'btree', columns: ['playerIdentity'] },
  ],
}, {
  id:             t.u64().primaryKey().autoInc(),
  sessionId:      t.u64(),
  playerIdentity: t.identity(),
  classChoice:    t.string(),
  status:         t.string(),   // 'alive' | 'downed' | 'eliminated'
  score:          t.u64(),
  // add your game-specific fields here
});

// Scheduled tables — reference reducers lazily ((): any => reducerFn) to break circular TS inference
const LobbyCountdown = table({
  name: 'lobby_countdown',
  scheduled: (): any => fire_start_game,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),
});

const LobbyIdleJob = table({
  name: 'lobby_idle_job',
  scheduled: (): any => fire_lobby_idle,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),
});
```

### Leaderboard Table Definitions

```typescript
// Per-session leaderboard entry (top 20, enforced server-side)
const LobbyResult = table({
  name: 'lobby_result',
  public: true,
  indexes: [
    { name: 'lobby_result_score',   accessor: 'lobby_result_score',   algorithm: 'btree', columns: ['totalScore'] },
    { name: 'lobby_result_session', accessor: 'lobby_result_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id:           t.u64().primaryKey().autoInc(),
  sessionId:    t.u64(),
  lobbyCode:    t.string(),
  combo:        t.string(),        // sorted, comma-joined class names, e.g. "gunner,healer,spotter"
  playerCount:  t.u64(),
  totalScore:   t.u64(),
  survivalSecs: t.u64(),
  cycleNumber:  t.u64(),
  createdAt:    t.timestamp(),
});

// Players in a leaderboard entry (for display only — no identity exposed)
const LobbyResultPlayer = table({
  name: 'lobby_result_player',
  public: true,
  indexes: [
    { name: 'lobby_result_player_session', accessor: 'lobby_result_player_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id:          t.u64().primaryKey().autoInc(),
  sessionId:   t.u64(),
  playerName:  t.string(),
  classChoice: t.string(),
});

// Single-row global stats (id always 1n)
const GlobalStats = table({
  name: 'global_stats',
  public: true,
}, {
  id:                t.u64().primaryKey(),
  totalGames:        t.u64(),
  totalSurvivalSecs: t.u64(),
  bestSurvivalSecs:  t.u64(),
  classSpotter:      t.u64(),
  classGunner:       t.u64(),
  classTank:         t.u64(),
  classHealer:       t.u64(),
});

// Per-class-combo records (key = sorted class string)
const SquadRecord = table({
  name: 'squad_record',
  public: true,
  indexes: [
    { name: 'squad_record_combo',        accessor: 'squad_record_combo',        algorithm: 'btree', columns: ['combo'] },
    { name: 'squad_record_times_played', accessor: 'squad_record_times_played', algorithm: 'btree', columns: ['timesPlayed'] },
    { name: 'squad_record_best_score',   accessor: 'squad_record_best_score',   algorithm: 'btree', columns: ['bestScore'] },
  ],
}, {
  id:              t.u64().primaryKey().autoInc(),
  combo:           t.string(),
  timesPlayed:     t.u64(),
  bestScore:       t.u64(),
  bestSurvivalSecs: t.u64(),
});
```

### Schema Registration

```typescript
const spacetimedb = schema({
  lobby:             Lobby,
  lobbyPlayer:       LobbyPlayer,
  gameSession:       GameSession,
  playerState:       PlayerState,
  lobbyCountdown:    LobbyCountdown,
  lobbyIdleJob:      LobbyIdleJob,
  lobbyResult:       LobbyResult,
  lobbyResultPlayer: LobbyResultPlayer,
  globalStats:       GlobalStats,
  squadRecord:       SquadRecord,
});
export default spacetimedb;
```

#### Index Naming Rules

- Name indexes as `{tableName}_{columnName}` to avoid collisions across the module.
- Always provide an explicit `accessor` field equal to the `name`. Without it, the generated accessor on `ctx.db.<table>` may not match.
- Index names are used **verbatim** — no camelCase transformation. Use the exact name string when calling `.filter()`.
- Never add an index on a primary key column — SpacetimeDB already indexes it, and a duplicate name causes a compile error.

---

## Deterministic Code Generation (LCG)

SpacetimeDB reducers must be deterministic — they cannot use `Math.random()`, `Date.now()`, timers, or any other source of non-determinism. Use a Linear Congruential Generator seeded with `ctx.timestamp.microsSinceUnixEpoch`:

```typescript
function generateCode(seed: bigint): string {
  // Exclude visually confusable characters: O, 0, I, 1, L
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = seed;
  let code = '';
  for (let i = 0; i < 6; i++) {
    // LCG parameters from Numerical Recipes
    s = (s * 1664525n + 1013904223n) & 0xFFFFFFFFn;
    code += chars[Number(s % BigInt(chars.length))];
  }
  return code;
}

// Usage inside create_lobby reducer:
code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
```

The `& 0xFFFFFFFFn` keeps `s` in the u32 range after each step, preventing BigInt overflow while maintaining the LCG cycle length.

---

## Timestamp Helper

SpacetimeDB's `t.timestamp()` columns expect a specific wire format. Use this helper to create a timestamp from a raw microsecond bigint (e.g. when setting scheduled deadlines):

```typescript
function ts(micros: bigint): any {
  return { __timestamp_micros_since_unix_epoch__: micros };
}

// Usage:
const deadline = ctx.timestamp.microsSinceUnixEpoch + 120_000_000n; // 2 minutes
ctx.db.lobby.id.update({ ...lobby, hostIdleDeadline: ts(deadline) });
```

On the client side, `timestamp` columns arrive as objects with `.microsSinceUnixEpoch: bigint`. Convert to a JS Date with:

```typescript
const date = new Date(Number(row.hostIdleDeadline.microsSinceUnixEpoch / 1000n));
```

Note the division by `1000n` — timestamps are in **microseconds**, `Date` expects **milliseconds**.

---

## Idempotent Leave Reducer Pattern

A player can be removed from a lobby in two ways: explicitly via `leave_lobby`, or automatically via `clientDisconnected`. If both run (e.g. the player reconnects and the UI calls `leaveLobby`, but `clientDisconnected` already fired), a naive implementation would double-decrement `playerCount`.

The fix: track whether you actually found and deleted the player row before doing any counting:

```typescript
export const leave_lobby = spacetimedb.reducer({
  lobbyId: t.u64(),
}, (ctx, { lobbyId }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) return; // already deleted — silent success

  let found = false;
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) {
      ctx.db.lobbyPlayer.id.delete(p.id);
      found = true;
      break;
    }
  }
  if (!found) return; // player already removed — skip decrement

  const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
  if (remaining.length === 0) {
    ctx.db.lobby.id.delete(lobbyId);
    return;
  }

  const newCount = lobby.playerCount - 1n;
  const isHost = lobby.hostIdentity.isEqual(ctx.sender);
  const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
  ctx.db.lobby.id.update({ ...lobby, playerCount: newCount, hostIdentity: newHost });
});
```

Apply the same `found` pattern in `clientDisconnected`.

---

## Scheduled Countdown Pattern

Use a scheduled table to trigger game start after a fixed delay. The scheduled table row is auto-deleted by SpacetimeDB after the reducer fires.

```typescript
// 1. Scheduled table — references reducer lazily
const LobbyCountdown = table({
  name: 'lobby_countdown',
  scheduled: (): any => fire_start_game,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),         // carry any context you need
});

// 2. start_countdown reducer — sets status and inserts the scheduled row
export const start_countdown = spacetimedb.reducer({
  lobbyId: t.u64(),
}, (ctx, { lobbyId }) => {
  // ... validation ...
  ctx.db.lobby.id.update({ ...lobby, status: 'countdown' });

  const startAt = ctx.timestamp.microsSinceUnixEpoch + 3_000_000n; // 3 seconds
  ctx.db.lobbyCountdown.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(startAt),
    lobbyId,
  });
});

// 3. Scheduled reducer — receives the full row as `arg`
export const fire_start_game = spacetimedb.reducer({
  arg: LobbyCountdown.rowType,
}, (ctx, { arg }) => {
  // Guard: if status is no longer 'countdown', this is stale — bail out
  const lobby = ctx.db.lobby.id.find(arg.lobbyId);
  if (!lobby || lobby.status !== 'countdown') return;

  // Clean up old session data, create new session + player states
  const session = ctx.db.gameSession.insert({ ... });
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)) {
    ctx.db.playerState.insert({ ..., sessionId: session.id, ... });
  }
  ctx.db.lobby.id.update({ ...lobby, status: 'in_progress' });
});
```

The guard `if (!lobby || lobby.status !== 'countdown') return` is important — it makes `fire_start_game` idempotent if the countdown is somehow triggered twice or the lobby is deleted before it fires.

---

## Idle Host Detection Pattern

Prevent stale lobbies with AFK hosts using a scheduled job. On lobby creation, set a `hostIdleDeadline` timestamp and schedule a `LobbyIdleJob`. When it fires:
- If host is already ready → do nothing.
- If host is alone → delete lobby.
- If others are present → transfer host, reset deadline, schedule a new job for the new host.

This chains naturally: the new host also gets a deadline. No job is ever left dangling.

```typescript
// Table (defined before fire_lobby_idle, so use lazy arrow)
const LobbyIdleJob = table({
  name: 'lobby_idle_job',
  scheduled: (): any => fire_lobby_idle,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),
});

// In create_lobby — set deadline and schedule first job
const IDLE_MICROS = 120_000_000n; // 2 minutes

export const create_lobby = spacetimedb.reducer({
  playerName: t.string(),
  classChoice: t.string(),
  isPublic: t.bool(),
}, (ctx, { playerName, classChoice, isPublic }) => {
  if (!playerName) throw new SenderError('playerName required');
  const idleDeadline = ctx.timestamp.microsSinceUnixEpoch + IDLE_MICROS;
  const lobby = ctx.db.lobby.insert({
    id: 0n, hostIdentity: ctx.sender,
    code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
    isPublic, status: 'waiting', playerCount: 1n, maxPlayers: 4n,
    createdAt: ctx.timestamp,
    hostIdleDeadline: ts(idleDeadline),
  });
  ctx.db.lobbyPlayer.insert({
    id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
    playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
  });
  ctx.db.lobbyIdleJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(idleDeadline),
    lobbyId: lobby.id,
  });
});

// Scheduled reducer
export const fire_lobby_idle = spacetimedb.reducer({
  arg: LobbyIdleJob.rowType,
}, (ctx, { arg }) => {
  const lobby = ctx.db.lobby.id.find(arg.lobbyId);
  if (!lobby || lobby.status !== 'waiting') return; // gone or in-game

  const allPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)];
  const hostPlayer = allPlayers.find(p => p.playerIdentity.isEqual(lobby.hostIdentity));

  if (hostPlayer?.isReady) return; // host became ready before deadline

  const others = allPlayers.filter(p => !p.playerIdentity.isEqual(lobby.hostIdentity));

  if (others.length === 0) {
    // Solo idle host — kill the lobby
    for (const p of allPlayers) ctx.db.lobbyPlayer.id.delete(p.id);
    ctx.db.lobby.id.delete(lobby.id);
  } else {
    // Transfer host to first other player, reset deadline
    const newHost = others[0];
    const newDeadline = ctx.timestamp.microsSinceUnixEpoch + IDLE_MICROS;
    ctx.db.lobby.id.update({
      ...lobby,
      hostIdentity: newHost.playerIdentity,
      hostIdleDeadline: ts(newDeadline),
    });
    ctx.db.lobbyIdleJob.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(newDeadline),
      lobbyId: lobby.id,
    });
  }
});
```

### Client-Side Idle Countdown UI

In `LobbyHud.svelte`, drive a live countdown from the `hostIdleDeadline` field on the lobby row. Because it's a reactive derived value, it automatically updates after host transfers.

```svelte
<script lang="ts">
  // currentLobby is derived from table data (see LobbyHud Patterns section)

  let idleSecsLeft = $state(0);

  $effect(() => {
    if (!currentLobby || currentLobby.status !== 'waiting') return;

    function tick() {
      const deadlineMicros = currentLobby!.hostIdleDeadline.microsSinceUnixEpoch;
      const nowMicros = BigInt(Date.now()) * 1000n;
      const diff = deadlineMicros - nowMicros;
      idleSecsLeft = diff > 0n ? Number(diff / 1_000_000n) : 0;
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });

  // Derive the current host player
  const hostEntry = $derived(players.find(p => p.playerIdentity.isEqual(currentLobby?.hostIdentity)));
  const hostNotReady = $derived(!hostEntry?.isReady);
  const isSolo = $derived(players.length <= 1);
  const amHost = $derived(hostEntry?.playerIdentity.isEqual($conn.identity));
</script>

{#if hostNotReady && idleSecsLeft > 0}
  <div style="
    color: {idleSecsLeft <= 10 ? '#f87171' : idleSecsLeft <= 30 ? '#fb923c' : 'rgba(255,255,255,0.5)'};
    font-size: 0.8rem; text-align: right;
  ">
    {#if amHost}
      {isSolo ? 'Solo lobby auto-closes' : 'You will be removed as host'} in {idleSecsLeft}s
    {:else}
      Host idle — transfers in {idleSecsLeft}s
    {/if}
  </div>
{/if}
```

---

## Server-Side Quick Join Pattern

**Do not** implement Quick Play client-side by filtering the subscribed `$lobbies` array — two players can race to pick the same lobby simultaneously. Implement it as a server-side reducer that atomically finds or creates a lobby:

```typescript
export const quick_join = spacetimedb.reducer({
  playerName: t.string(),
  classChoice: t.string(),
}, (ctx, { playerName, classChoice }) => {
  if (!playerName) throw new SenderError('playerName required');

  // Guard: already in a lobby?
  const existing = [...ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)];
  if (existing.length > 0) throw new SenderError('Already in a lobby');

  // Find any available public waiting lobby (use status index for efficiency)
  let joined = false;
  for (const lobby of ctx.db.lobby.lobby_status.filter('waiting')) {
    if (!lobby.isPublic) continue;
    if (lobby.playerCount >= lobby.maxPlayers) continue;

    ctx.db.lobbyPlayer.insert({
      id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
      playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
    });
    ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
    joined = true;
    break;
  }

  if (!joined) {
    // No available lobby — create a new public one (with idle job)
    const idleDeadline = ctx.timestamp.microsSinceUnixEpoch + 120_000_000n;
    const lobby = ctx.db.lobby.insert({
      id: 0n, hostIdentity: ctx.sender,
      code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
      isPublic: true, status: 'waiting', playerCount: 1n, maxPlayers: 4n,
      createdAt: ctx.timestamp, hostIdleDeadline: ts(idleDeadline),
    });
    ctx.db.lobbyPlayer.insert({
      id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
      playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
    });
    ctx.db.lobbyIdleJob.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(idleDeadline),
      lobbyId: lobby.id,
    });
  }
});
```

**Client side** — `game.svelte.ts`:

```typescript
async quickplay() {
  if (!conn) return;
  gameState.error = null;
  try {
    await conn.reducers.quickJoin({
      playerName: gameState.localPlayerName,
      classChoice: gameState.localPlayerClass ?? '',
    });
  } catch (e) {
    setError(e);
  }
},
```

No lobby list needed on the client. The `$lobbies` subscription is still useful for displaying counts in the menu.

---

## Kick Player Pattern

Only the host can kick players. The kicked player's `lobbyPlayer` row is deleted and `playerCount` decremented.

```typescript
export const kick_player = spacetimedb.reducer({
  lobbyId: t.u64(),
  playerIdentity: t.identity(),
}, (ctx, { lobbyId, playerIdentity }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) throw new SenderError('Lobby not found');
  if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can kick');
  if (playerIdentity.isEqual(ctx.sender)) throw new SenderError('Cannot kick yourself');

  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(playerIdentity)) {
      ctx.db.lobbyPlayer.id.delete(p.id);
      ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount - 1n });
      return;
    }
  }
  throw new SenderError('Player not in lobby');
});
```

**Client side:**

```typescript
kickPlayer(lobbyId: bigint, playerIdentity: Identity) {
  if (!conn) return;
  conn.reducers.kickPlayer({ lobbyId, playerIdentity }); // fire-and-forget
},
```

**Ghost player note:** If a player disconnected mid-game and the game ended while they were offline, their `lobbyPlayer` row persists in the `waiting` lobby (server intentionally keeps it to allow reconnect during `in_progress`). After the game ends their `isReady` is reset to `false`, which blocks the next `start_countdown` since all players must be ready. The host can kick them to unblock the lobby.

---

## End Session & Leaderboard Pattern

Call `end_session()` as a private helper function (not a reducer) from wherever the game over condition is detected (e.g. a scheduled tick reducer). It handles all cleanup and leaderboard writes atomically in one transaction.

```typescript
function end_session(ctx: any, sessionId: bigint) {
  const session = ctx.db.gameSession.id.find(sessionId);
  if (!session) return;
  ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });

  // Clean up game-specific rows (enemies, effects, etc.)
  // ...

  // Reset lobby for next game
  const lobby = ctx.db.lobby.id.find(session.lobbyId);
  if (lobby) {
    ctx.db.lobby.id.update({ ...lobby, status: 'waiting' });
    for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)) {
      ctx.db.lobbyPlayer.id.update({ ...p, isReady: false });
    }
  }

  // ─── Leaderboard ─────────────────────────────────────
  const sessionPlayers = [...ctx.db.playerState.player_state_session_id.filter(sessionId)];
  const sessionLobbyPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(session.lobbyId)];

  // Class combo = sorted class names joined by comma
  const classes = sessionLobbyPlayers.map(p => p.classChoice).filter(c => c !== '').sort();
  const combo = classes.length > 0 ? classes.join(',') : 'none';
  const totalScore = sessionPlayers.reduce((acc, p) => acc + p.score, 0n);

  // CRITICAL: both sides must be cast to bigint before subtraction
  // `ctx.timestamp.microsSinceUnixEpoch` has type `any` — subtracting two `any` values
  // gives TypeScript type `number`, making `/ 1_000_000n` fail. Cast explicitly:
  const survivalMicros =
    (ctx.timestamp.microsSinceUnixEpoch as bigint) -
    (session.startedAt.microsSinceUnixEpoch as bigint);
  const survivalSecs = survivalMicros > 0n ? survivalMicros / 1_000_000n : 0n;

  // 1. GlobalStats upsert (singleton row, id = 1n)
  const gs = ctx.db.globalStats.id.find(1n);
  const spotterCount = BigInt(classes.filter(c => c === 'spotter').length);
  const gunnerCount  = BigInt(classes.filter(c => c === 'gunner').length);
  const tankCount    = BigInt(classes.filter(c => c === 'tank').length);
  const healerCount  = BigInt(classes.filter(c => c === 'healer').length);
  if (gs) {
    ctx.db.globalStats.id.update({
      ...gs,
      totalGames:        gs.totalGames + 1n,
      totalSurvivalSecs: gs.totalSurvivalSecs + survivalSecs,
      bestSurvivalSecs:  survivalSecs > gs.bestSurvivalSecs ? survivalSecs : gs.bestSurvivalSecs,
      classSpotter:      gs.classSpotter + spotterCount,
      classGunner:       gs.classGunner  + gunnerCount,
      classTank:         gs.classTank    + tankCount,
      classHealer:       gs.classHealer  + healerCount,
    });
  } else {
    ctx.db.globalStats.insert({
      id: 1n, totalGames: 1n,
      totalSurvivalSecs: survivalSecs, bestSurvivalSecs: survivalSecs,
      classSpotter: spotterCount, classGunner: gunnerCount,
      classTank: tankCount, classHealer: healerCount,
    });
  }

  // 2. SquadRecord upsert (keyed by combo string)
  const existingSquad = [...ctx.db.squadRecord.squad_record_combo.filter(combo)][0];
  if (existingSquad) {
    ctx.db.squadRecord.id.update({
      ...existingSquad,
      timesPlayed:      existingSquad.timesPlayed + 1n,
      bestScore:        totalScore > existingSquad.bestScore ? totalScore : existingSquad.bestScore,
      bestSurvivalSecs: survivalSecs > existingSquad.bestSurvivalSecs ? survivalSecs : existingSquad.bestSurvivalSecs,
    });
  } else {
    ctx.db.squadRecord.insert({ id: 0n, combo, timesPlayed: 1n, bestScore: totalScore, bestSurvivalSecs: survivalSecs });
  }

  // 3. Top-20 gate (deduplicated by sessionId)
  const alreadyRecorded = [...ctx.db.lobbyResult.lobby_result_session.filter(sessionId)].length > 0;
  if (!alreadyRecorded) {
    const allResults = [...ctx.db.lobbyResult.iter()];
    let qualified = false;
    let evictRow: any = null;

    if (allResults.length < 20) {
      qualified = true;
    } else {
      // Find lowest-scoring entry
      let minRow = allResults[0];
      for (const r of allResults) { if (r.totalScore < minRow.totalScore) minRow = r; }
      if (totalScore > minRow.totalScore) { qualified = true; evictRow = minRow; }
    }

    if (qualified) {
      if (evictRow) {
        // Evict the lowest entry and its player records
        for (const p of ctx.db.lobbyResultPlayer.lobby_result_player_session.filter(evictRow.sessionId)) {
          ctx.db.lobbyResultPlayer.id.delete(p.id);
        }
        ctx.db.lobbyResult.id.delete(evictRow.id);
      }
      ctx.db.lobbyResult.insert({
        id: 0n, sessionId, lobbyCode: lobby?.code ?? '??????',
        combo, playerCount: BigInt(classes.length),
        totalScore, survivalSecs, cycleNumber: session.cycleNumber ?? 0n,
        createdAt: ctx.timestamp,
      });
      for (const lp of sessionLobbyPlayers) {
        ctx.db.lobbyResultPlayer.insert({
          id: 0n, sessionId,
          playerName: lp.playerName,
          classChoice: lp.classChoice,
        });
      }
    }
  }
}
```

**Critical BigInt pitfall** — `ctx.timestamp.microsSinceUnixEpoch` has TypeScript type `any`. Subtracting two `any` values gives type `number` in TypeScript, so `survivalMicros / 1_000_000n` would fail to compile. Always cast both operands to `bigint` explicitly before arithmetic.

---

## Lifecycle Hooks

```typescript
spacetimedb.clientConnected((_ctx) => {
  // Optional: create a player presence row, log connection, etc.
  // ctx.sender is the connecting identity.
  // Leave empty if no presence tracking needed.
});

spacetimedb.clientDisconnected((ctx) => {
  // Remove player from any 'waiting' lobby they're in.
  // Use the lobby_player_identity index for an O(1) lookup.
  // In-progress lobbies: intentionally skip — player can reconnect during the game.
  for (const p of ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)) {
    const lobby = ctx.db.lobby.id.find(p.lobbyId);
    if (lobby && lobby.status === 'waiting') {
      ctx.db.lobbyPlayer.id.delete(p.id);
      const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(p.lobbyId)];
      if (remaining.length === 0) {
        ctx.db.lobby.id.delete(p.lobbyId);
      } else {
        const isHost = lobby.hostIdentity.isEqual(ctx.sender);
        const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
        ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount - 1n, hostIdentity: newHost });
      }
    }
    break; // a player is in at most one lobby
  }
});
```

**Reconnect behavior for `in_progress` lobbies:** The player's `lobbyPlayer` and `PlayerState` rows remain intact during disconnection. When they reconnect, their subscription resyncs these rows and the UI detects the in-progress game automatically. The host can kick ghost players manually if they never return.

---

## Frontend: game.svelte.ts Singleton

Create `src/game.svelte.ts` (the `.svelte.ts` extension enables `$state` runes at module level):

```typescript
import type { DbConnection } from './module_bindings/index.js';
import type { Identity } from 'spacetimedb';

export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const gameState = $state({
  currentLobbyId:   null as bigint | null,
  currentSessionId: null as bigint | null,
  localPlayerClass: null as PlayerClass | null,
  localPlayerName:  'Player',
  error:            null as string | null,
  leavingLobby:     false,  // prevents MenuHud auto-redirect while leave reducer processes
});

export { gameState };

let conn: DbConnection | null = null;

// Strip the 'SenderError: ' prefix SpacetimeDB prepends to thrown errors.
function setError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  gameState.error = msg.replace(/^SenderError:\s*/i, '');
}

export const gameActions = {
  init(connection: DbConnection) {
    conn = connection;
  },

  setPlayerName(name: string) {
    gameState.localPlayerName = name.trim() || 'Player';
  },

  async hostLobby(isPublic: boolean) {
    if (!conn) return;
    gameState.error = null;
    try {
      await conn.reducers.createLobby({
        playerName: gameState.localPlayerName,
        classChoice: gameState.localPlayerClass ?? '',
        isPublic,
      });
    } catch (e) { setError(e); }
  },

  async joinByCode(code: string) {
    if (!conn) return;
    gameState.error = null;
    try {
      await conn.reducers.joinByCode({
        code: code.toUpperCase(),
        playerName: gameState.localPlayerName,
        classChoice: gameState.localPlayerClass ?? '',
      });
    } catch (e) { setError(e); }
  },

  // Server-side: no lobby list argument needed
  async quickplay() {
    if (!conn) return;
    gameState.error = null;
    try {
      await conn.reducers.quickJoin({
        playerName: gameState.localPlayerName,
        classChoice: gameState.localPlayerClass ?? '',
      });
    } catch (e) { setError(e); }
  },

  async setClass(cls: PlayerClass, lobbyId: bigint) {
    if (!conn) return;
    gameState.localPlayerClass = cls;
    try {
      await conn.reducers.setClass({ lobbyId, classChoice: cls });
    } catch (e) { setError(e); }
  },

  async setReady(lobbyId: bigint, isReady: boolean) {
    if (!conn) return;
    try {
      await conn.reducers.setReady({ lobbyId, isReady });
    } catch (e) { setError(e); }
  },

  async startCountdown(lobbyId: bigint) {
    if (!conn) return;
    try {
      await conn.reducers.startCountdown({ lobbyId });
    } catch (e) { setError(e); }
  },

  leaveLobby(lobbyId: bigint) {
    if (!conn) return;
    gameState.leavingLobby = true; // suppress MenuHud auto-redirect until reducer confirms
    conn.reducers.leaveLobby({ lobbyId }); // fire-and-forget; UI navigates immediately
    gameState.currentLobbyId = null;
  },

  kickPlayer(lobbyId: bigint, playerIdentity: Identity) {
    if (!conn) return;
    conn.reducers.kickPlayer({ lobbyId, playerIdentity }); // fire-and-forget
  },

  clearError() {
    gameState.error = null;
  },
};
```

Wire `gameActions.init(conn)` inside the `onConnect` callback in `Root.svelte`.

---

## Frontend: Global Subscription Pattern

Subscribe to all tables once, globally, in the `onConnect` callback. This populates the SpacetimeDB client cache so that `useTable` calls in any component always return live data without needing per-component SQL subscriptions.

```typescript
// Root.svelte <script>
const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  gameActions.init(conn);
  conn.subscriptionBuilder().subscribeToAllTables();
};
```

Do **not** use per-component `subscriptionBuilder().subscribe([...])` calls alongside `subscribeToAllTables()` — it creates redundant subscriptions. Pick one approach and use it consistently.

---

## Frontend: useSpacetimeDB + useTable Stores

`useSpacetimeDB()` and `useTable()` from `spacetimedb/svelte` return Svelte stores. Access their values with the `$` prefix inside `.svelte` files.

```typescript
import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
import { tables } from '../module_bindings/index.js';

// conn is a store — access with $conn
const conn = useSpacetimeDB();

// useTable returns a tuple [store, isLoadingStore]
const [lobbies]      = useTable(tables.lobby);
const [lobbyPlayers] = useTable(tables.lobbyPlayer);
const [sessions]     = useTable(tables.gameSession);

// Read values with $
const myEntry = $derived(
  $lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
);
```

`$conn.identity` is `undefined` until the WebSocket handshake completes. Always use optional chaining when comparing identities.

**Identity comparison:** Use `.toHexString()` on both sides. Direct object comparison (`===`) does not work because each fetch may return a different object instance.

---

## Svelte 5 Gotchas

### 1. Do Not Read $derived Inside $effect Cleanup

The cleanup function returned from `$effect` is called synchronously when the effect re-runs or the component is destroyed. Capture values you need before the return:

```typescript
// GOOD: capture what you need before the return
$effect(() => {
  if ($someCondition) {
    const capturedValue = $someOtherDerived; // capture now
    doSetup();
    return () => {
      doTeardown(capturedValue); // uses captured value, not reactive stale read
    };
  }
});
```

### 2. Optional Chaining in Reactive Templates

In Svelte 5, reactive template expressions are evaluated eagerly. A `null` reference mid-transition will throw synchronously. Any value that can be `null` during a state transition must use optional chaining:

```svelte
<!-- BAD: crashes if currentLobby is null during transition -->
<button>{currentLobby.code}</button>

<!-- GOOD: safe even if currentLobby is transiently null -->
<button>{currentLobby?.code}</button>
```

### 3. $effect Double-Fire in Development (Strict Mode)

In development, Svelte runs effects twice on mount to detect side-effects. Ensure your effects are idempotent — setting a value to the same thing twice is fine; inserting a row twice is not.

### 4. Do Not Use {:else if} for Stage HUD Routing

Using `{#if} {:else if}` in a HUD router prevents Svelte from running exit transitions on the leaving component before mounting the entering one. Always use separate `{#if}` blocks:

```svelte
<!-- GOOD: both transitions run independently -->
{#if stage === 'menu'}
  <MenuHud />
{/if}

{#if stage === 'lobby'}
  <LobbyHud />
{/if}
```

### 5. useTable Returns a Tuple

`useTable` returns `[rowsStore, isLoadingStore]`, not just a store. Always destructure the tuple:

```typescript
// BAD
const lobbies = useTable(tables.lobby); // lobbies is [store, store], not a store

// GOOD
const [lobbies] = useTable(tables.lobby);
// or
const [lobbies, lobbiesLoading] = useTable(tables.lobby);
```

### 6. $state.raw for Three.js Instances

If your game state holds Three.js class instances, use `$state.raw<T>()` instead of `$state()`. Svelte 5 wraps `$state` values in a Proxy which breaks Three.js internal methods.

```typescript
let audioInstance = $state.raw<THREE.Audio | null>(null);
```

---

## MenuHud Reconnect Pattern

When a player is in an **active game** (`in_progress`) and lands on the menu (e.g. page refresh), show a reconnect button. For `waiting`/`countdown` lobbies, auto-redirect to the lobby stage immediately.

The `leavingLobby` flag in `gameState` prevents a redirect loop: when a player clicks Leave, the `lobbyPlayer` row briefly still exists while the reducer processes — without the flag, MenuHud would see `myLobby.status === 'waiting'` and redirect back to the lobby.

```svelte
<script lang="ts">
  import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { stageActions } from '../stage.svelte.js';
  import { gameState } from '../game.svelte.js';

  const conn = useSpacetimeDB();
  const [lobbies]      = useTable(tables.lobby);
  const [lobbyPlayers] = useTable(tables.lobbyPlayer);

  const myEntry = $derived(
    $lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
  );
  const myLobby = $derived(myEntry ? $lobbies.find(l => l.id === myEntry.lobbyId) : null);
  // Show reconnect button only for in_progress games; auto-redirect handles waiting/countdown
  const inActiveGame = $derived(myLobby?.status === 'in_progress');

  $effect(() => {
    if (!myLobby) {
      gameState.leavingLobby = false; // clear flag once player row is gone
      return;
    }
    if (myLobby.status !== 'in_progress' && !gameState.leavingLobby) {
      stageActions.setStage('lobby'); // auto-redirect for waiting/countdown lobbies
    }
  });
</script>

{#if inActiveGame}
  <!-- Reconnect to an in-progress game only -->
  <p>Welcome back, {myEntry?.playerName}!</p>
  <button onclick={() => stageActions.setStage('lobby')}>Reconnect to Lobby</button>
{:else}
  <!-- Normal join/host UI -->
  ...
{/if}
```

**Why `leavingLobby` is needed:** `leaveLobby` fires a reducer and immediately calls `setStage('menu')`. MenuHud mounts and the `$effect` runs before the subscription update removes the `lobbyPlayer` row — so `myLobby` is still `waiting`. The flag blocks the redirect until the row disappears (then clears itself).

---

## Async Reducer Error Handling

Reducer calls on the client (`conn.reducers.x(...)`) return a Promise that rejects if the server throws a `SenderError`. Always `await` and `catch`:

```typescript
async function hostPrivate() {
  loading = true;
  gameActions.setPlayerName(playerName);
  await gameActions.hostLobby(false);
  loading = false;
  // Only navigate if no error was set
  if (!gameState.error) stageActions.setStage('lobby');
}
```

The `gameState.error` check must come **after** `await` so it reads the result of the specific call.

**The `setError` helper** in `game.svelte.ts` strips the `SenderError: ` prefix that SpacetimeDB prepends:

```typescript
function setError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  gameState.error = msg.replace(/^SenderError:\s*/i, '');
}
```

Display `gameState.error` in your UI and call `gameActions.clearError()` when the user takes a new action (e.g. switching menu modes).

---

## LobbyHud Patterns

### Finding Your Own Lobby

Never store a `lobbyId` in local state to find the current lobby. Instead, derive it from the live table data by looking for your identity in `LobbyPlayer`:

```typescript
const conn = useSpacetimeDB();
const [lobbies]      = useTable(tables.lobby);
const [lobbyPlayers] = useTable(tables.lobbyPlayer);

const myEntry = $derived(
  $lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
);
const currentLobby = $derived(
  myEntry ? $lobbies.find(l => l.id === myEntry.lobbyId) : null
);
const players = $derived(
  currentLobby ? $lobbyPlayers.filter(p => p.lobbyId === currentLobby.id) : []
);
```

This automatically reacts when any row changes and handles reconnect correctly.

### Detecting Game Start

```typescript
const [sessions] = useTable(tables.gameSession);

$effect(() => {
  if (currentLobby?.status === 'in_progress') {
    // ⚠️ Filter by status === 'active' — the lobby may have a previous finished session
    // with the same lobbyId. Picking it up would set currentSessionId to stale data.
    const session = $sessions.find(s => s.lobbyId === currentLobby.id && s.status === 'active');
    if (session) {
      gameState.currentSessionId = session.id;
      stageActions.setStage('game');
    }
  }
});
```

### Countdown UI

```typescript
let countdownValue = $state(3);

$effect(() => {
  if (currentLobby?.status === 'countdown') {
    countdownValue = 3;
    const interval = setInterval(() => {
      countdownValue = Math.max(0, countdownValue - 1);
    }, 1000);
    return () => clearInterval(interval);
  }
});
```

```svelte
{#if currentLobby?.status === 'countdown'}
  <p>Starting in {countdownValue}...</p>
{/if}
```

### Empty Slot Placeholders

```svelte
{#each { length: 4 - players.length } as _}
  <div>Waiting for player...</div>
{/each}
```

### Loading State

Show "Connecting to lobby..." while `currentLobby` is still `null` (waiting for the server round-trip after the reducer call):

```svelte
{#if !currentLobby}
  <p>Connecting to lobby...</p>
  <button onclick={() => stageActions.setStage('menu')}>Back</button>
{:else}
  <!-- full lobby UI -->
{/if}
```

---

## Complete Backend Reference

The complete working backend for the lobby system. Copy this into `spacetimedb/src/index.ts` and adapt names.

```typescript
import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

// ─── Tables ───────────────────────────────────────────────────────────────────

const Lobby = table({
  name: 'lobby',
  public: true,
  indexes: [
    { name: 'lobby_status', accessor: 'lobby_status', algorithm: 'btree', columns: ['status'] },
    { name: 'lobby_code',   accessor: 'lobby_code',   algorithm: 'btree', columns: ['code'] },
  ],
}, {
  id:               t.u64().primaryKey().autoInc(),
  hostIdentity:     t.identity(),
  code:             t.string(),
  isPublic:         t.bool(),
  status:           t.string(),          // 'waiting' | 'countdown' | 'in_progress'
  playerCount:      t.u64(),
  maxPlayers:       t.u64(),
  createdAt:        t.timestamp(),
  hostIdleDeadline: t.timestamp(),
});

const LobbyPlayer = table({
  name: 'lobby_player',
  public: true,
  indexes: [
    { name: 'lobby_player_lobby_id', accessor: 'lobby_player_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
    { name: 'lobby_player_identity', accessor: 'lobby_player_identity', algorithm: 'btree', columns: ['playerIdentity'] },
  ],
}, {
  id:             t.u64().primaryKey().autoInc(),
  lobbyId:        t.u64(),
  playerIdentity: t.identity(),
  playerName:     t.string(),
  classChoice:    t.string(),
  isReady:        t.bool(),
  joinedAt:       t.timestamp(),
});

const GameSession = table({
  name: 'game_session',
  public: true,
  indexes: [
    { name: 'game_session_lobby_id', accessor: 'game_session_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
  ],
}, {
  id:        t.u64().primaryKey().autoInc(),
  lobbyId:   t.u64(),
  status:    t.string(),
  startedAt: t.timestamp(),
  endedAt:   t.timestamp().optional(),
  mapSeed:   t.u64(),
});

const PlayerState = table({
  name: 'player_state',
  public: true,
  indexes: [
    { name: 'player_state_session_id', accessor: 'player_state_session_id', algorithm: 'btree', columns: ['sessionId'] },
    { name: 'player_state_identity',   accessor: 'player_state_identity',   algorithm: 'btree', columns: ['playerIdentity'] },
  ],
}, {
  id:             t.u64().primaryKey().autoInc(),
  sessionId:      t.u64(),
  playerIdentity: t.identity(),
  classChoice:    t.string(),
  status:         t.string(),   // 'alive' | 'downed' | 'eliminated'
  score:          t.u64(),
});

const LobbyCountdown = table({
  name: 'lobby_countdown',
  scheduled: (): any => fire_start_game,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),
});

const LobbyIdleJob = table({
  name: 'lobby_idle_job',
  scheduled: (): any => fire_lobby_idle,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),
});

const LobbyResult = table({
  name: 'lobby_result',
  public: true,
  indexes: [
    { name: 'lobby_result_score',   accessor: 'lobby_result_score',   algorithm: 'btree', columns: ['totalScore'] },
    { name: 'lobby_result_session', accessor: 'lobby_result_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id:           t.u64().primaryKey().autoInc(),
  sessionId:    t.u64(),
  lobbyCode:    t.string(),
  combo:        t.string(),
  playerCount:  t.u64(),
  totalScore:   t.u64(),
  survivalSecs: t.u64(),
  cycleNumber:  t.u64(),
  createdAt:    t.timestamp(),
});

const LobbyResultPlayer = table({
  name: 'lobby_result_player',
  public: true,
  indexes: [
    { name: 'lobby_result_player_session', accessor: 'lobby_result_player_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id:          t.u64().primaryKey().autoInc(),
  sessionId:   t.u64(),
  playerName:  t.string(),
  classChoice: t.string(),
});

const GlobalStats = table({
  name: 'global_stats',
  public: true,
}, {
  id:                t.u64().primaryKey(),
  totalGames:        t.u64(),
  totalSurvivalSecs: t.u64(),
  bestSurvivalSecs:  t.u64(),
  classSpotter:      t.u64(),
  classGunner:       t.u64(),
  classTank:         t.u64(),
  classHealer:       t.u64(),
});

const SquadRecord = table({
  name: 'squad_record',
  public: true,
  indexes: [
    { name: 'squad_record_combo',        accessor: 'squad_record_combo',        algorithm: 'btree', columns: ['combo'] },
    { name: 'squad_record_times_played', accessor: 'squad_record_times_played', algorithm: 'btree', columns: ['timesPlayed'] },
    { name: 'squad_record_best_score',   accessor: 'squad_record_best_score',   algorithm: 'btree', columns: ['bestScore'] },
  ],
}, {
  id:               t.u64().primaryKey().autoInc(),
  combo:            t.string(),
  timesPlayed:      t.u64(),
  bestScore:        t.u64(),
  bestSurvivalSecs: t.u64(),
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  lobby:             Lobby,
  lobbyPlayer:       LobbyPlayer,
  gameSession:       GameSession,
  playerState:       PlayerState,
  lobbyCountdown:    LobbyCountdown,
  lobbyIdleJob:      LobbyIdleJob,
  lobbyResult:       LobbyResult,
  lobbyResultPlayer: LobbyResultPlayer,
  globalStats:       GlobalStats,
  squadRecord:       SquadRecord,
});
export default spacetimedb;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(seed: bigint): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = seed;
  let code = '';
  for (let i = 0; i < 6; i++) {
    s = (s * 1664525n + 1013904223n) & 0xFFFFFFFFn;
    code += chars[Number(s % BigInt(chars.length))];
  }
  return code;
}

// Create a Timestamp from raw microseconds (required when setting timestamp columns from bigint math)
function ts(micros: bigint): any {
  return { __timestamp_micros_since_unix_epoch__: micros };
}

const IDLE_MICROS = 120_000_000n; // 2 minutes

// ─── Private: End Session ─────────────────────────────────────────────────────

function end_session(ctx: any, sessionId: bigint) {
  const session = ctx.db.gameSession.id.find(sessionId);
  if (!session) return;
  ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });

  const lobby = ctx.db.lobby.id.find(session.lobbyId);
  if (lobby) {
    ctx.db.lobby.id.update({ ...lobby, status: 'waiting' });
    for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)) {
      ctx.db.lobbyPlayer.id.update({ ...p, isReady: false });
    }
  }

  const sessionPlayers     = [...ctx.db.playerState.player_state_session_id.filter(sessionId)];
  const sessionLobbyPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(session.lobbyId)];
  const classes  = sessionLobbyPlayers.map(p => p.classChoice).filter(c => c !== '').sort();
  const combo    = classes.length > 0 ? classes.join(',') : 'none';
  const totalScore = sessionPlayers.reduce((acc, p) => acc + p.score, 0n);

  const survivalMicros =
    (ctx.timestamp.microsSinceUnixEpoch as bigint) -
    (session.startedAt.microsSinceUnixEpoch as bigint);
  const survivalSecs = survivalMicros > 0n ? survivalMicros / 1_000_000n : 0n;

  // GlobalStats (singleton, id = 1n)
  const gs = ctx.db.globalStats.id.find(1n);
  const spotterCount = BigInt(classes.filter(c => c === 'spotter').length);
  const gunnerCount  = BigInt(classes.filter(c => c === 'gunner').length);
  const tankCount    = BigInt(classes.filter(c => c === 'tank').length);
  const healerCount  = BigInt(classes.filter(c => c === 'healer').length);
  if (gs) {
    ctx.db.globalStats.id.update({
      ...gs,
      totalGames: gs.totalGames + 1n,
      totalSurvivalSecs: gs.totalSurvivalSecs + survivalSecs,
      bestSurvivalSecs: survivalSecs > gs.bestSurvivalSecs ? survivalSecs : gs.bestSurvivalSecs,
      classSpotter: gs.classSpotter + spotterCount,
      classGunner:  gs.classGunner  + gunnerCount,
      classTank:    gs.classTank    + tankCount,
      classHealer:  gs.classHealer  + healerCount,
    });
  } else {
    ctx.db.globalStats.insert({
      id: 1n, totalGames: 1n,
      totalSurvivalSecs: survivalSecs, bestSurvivalSecs: survivalSecs,
      classSpotter: spotterCount, classGunner: gunnerCount,
      classTank: tankCount, classHealer: healerCount,
    });
  }

  // SquadRecord (keyed by combo string)
  const existingSquad = [...ctx.db.squadRecord.squad_record_combo.filter(combo)][0];
  if (existingSquad) {
    ctx.db.squadRecord.id.update({
      ...existingSquad,
      timesPlayed: existingSquad.timesPlayed + 1n,
      bestScore: totalScore > existingSquad.bestScore ? totalScore : existingSquad.bestScore,
      bestSurvivalSecs: survivalSecs > existingSquad.bestSurvivalSecs ? survivalSecs : existingSquad.bestSurvivalSecs,
    });
  } else {
    ctx.db.squadRecord.insert({ id: 0n, combo, timesPlayed: 1n, bestScore: totalScore, bestSurvivalSecs: survivalSecs });
  }

  // LobbyResult top-20 gate
  const alreadyRecorded = [...ctx.db.lobbyResult.lobby_result_session.filter(sessionId)].length > 0;
  if (!alreadyRecorded) {
    const allResults = [...ctx.db.lobbyResult.iter()];
    let qualified = false;
    let evictRow: any = null;
    if (allResults.length < 20) {
      qualified = true;
    } else {
      let minRow = allResults[0];
      for (const r of allResults) { if (r.totalScore < minRow.totalScore) minRow = r; }
      if (totalScore > minRow.totalScore) { qualified = true; evictRow = minRow; }
    }
    if (qualified) {
      if (evictRow) {
        for (const p of ctx.db.lobbyResultPlayer.lobby_result_player_session.filter(evictRow.sessionId)) {
          ctx.db.lobbyResultPlayer.id.delete(p.id);
        }
        ctx.db.lobbyResult.id.delete(evictRow.id);
      }
      ctx.db.lobbyResult.insert({
        id: 0n, sessionId, lobbyCode: lobby?.code ?? '??????',
        combo, playerCount: BigInt(classes.length),
        totalScore, survivalSecs, cycleNumber: 0n,
        createdAt: ctx.timestamp,
      });
      for (const lp of sessionLobbyPlayers) {
        ctx.db.lobbyResultPlayer.insert({ id: 0n, sessionId, playerName: lp.playerName, classChoice: lp.classChoice });
      }
    }
  }
}

// ─── Reducers ─────────────────────────────────────────────────────────────────

export const create_lobby = spacetimedb.reducer({
  playerName: t.string(),
  classChoice: t.string(),
  isPublic: t.bool(),
}, (ctx, { playerName, classChoice, isPublic }) => {
  if (!playerName) throw new SenderError('playerName required');
  const idleDeadline = ctx.timestamp.microsSinceUnixEpoch + IDLE_MICROS;
  const lobby = ctx.db.lobby.insert({
    id: 0n, hostIdentity: ctx.sender,
    code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
    isPublic, status: 'waiting', playerCount: 1n, maxPlayers: 4n,
    createdAt: ctx.timestamp, hostIdleDeadline: ts(idleDeadline),
  });
  ctx.db.lobbyPlayer.insert({
    id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
    playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
  });
  ctx.db.lobbyIdleJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(idleDeadline),
    lobbyId: lobby.id,
  });
});

export const join_lobby = spacetimedb.reducer({
  lobbyId: t.u64(), playerName: t.string(), classChoice: t.string(),
}, (ctx, { lobbyId, playerName, classChoice }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) throw new SenderError('Lobby not found');
  if (lobby.status !== 'waiting') throw new SenderError('Lobby already started');
  if (lobby.playerCount >= lobby.maxPlayers) throw new SenderError('Lobby full');
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) throw new SenderError('Already in lobby');
  }
  ctx.db.lobbyPlayer.insert({
    id: 0n, lobbyId, playerIdentity: ctx.sender,
    playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
  });
  ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
});

export const join_by_code = spacetimedb.reducer({
  code: t.string(), playerName: t.string(), classChoice: t.string(),
}, (ctx, { code, playerName, classChoice }) => {
  const results = [...ctx.db.lobby.lobby_code.filter(code.toUpperCase())];
  if (!results.length) throw new SenderError('Lobby not found');
  const lobby = results[0];
  if (lobby.status !== 'waiting') throw new SenderError('Lobby already started');
  if (lobby.playerCount >= lobby.maxPlayers) throw new SenderError('Lobby full');
  ctx.db.lobbyPlayer.insert({
    id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
    playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
  });
  ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
});

export const quick_join = spacetimedb.reducer({
  playerName: t.string(), classChoice: t.string(),
}, (ctx, { playerName, classChoice }) => {
  if (!playerName) throw new SenderError('playerName required');
  const existing = [...ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)];
  if (existing.length > 0) throw new SenderError('Already in a lobby');
  let joined = false;
  for (const lobby of ctx.db.lobby.lobby_status.filter('waiting')) {
    if (!lobby.isPublic || lobby.playerCount >= lobby.maxPlayers) continue;
    ctx.db.lobbyPlayer.insert({
      id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
      playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
    });
    ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
    joined = true;
    break;
  }
  if (!joined) {
    const idleDeadline = ctx.timestamp.microsSinceUnixEpoch + IDLE_MICROS;
    const lobby = ctx.db.lobby.insert({
      id: 0n, hostIdentity: ctx.sender,
      code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
      isPublic: true, status: 'waiting', playerCount: 1n, maxPlayers: 4n,
      createdAt: ctx.timestamp, hostIdleDeadline: ts(idleDeadline),
    });
    ctx.db.lobbyPlayer.insert({
      id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
      playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
    });
    ctx.db.lobbyIdleJob.insert({
      scheduledId: 0n, scheduledAt: ScheduleAt.time(idleDeadline), lobbyId: lobby.id,
    });
  }
});

export const set_class = spacetimedb.reducer({
  lobbyId: t.u64(), classChoice: t.string(),
}, (ctx, { lobbyId, classChoice }) => {
  const valid = ['spotter', 'gunner', 'tank', 'healer'];
  if (!valid.includes(classChoice)) throw new SenderError('Invalid class');
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) {
      ctx.db.lobbyPlayer.id.update({ ...p, classChoice, isReady: false });
      return;
    }
  }
  throw new SenderError('Not in this lobby');
});

export const set_ready = spacetimedb.reducer({
  lobbyId: t.u64(), isReady: t.bool(),
}, (ctx, { lobbyId, isReady }) => {
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) {
      if (isReady && !p.classChoice) throw new SenderError('Select a class first');
      ctx.db.lobbyPlayer.id.update({ ...p, isReady });
      return;
    }
  }
  throw new SenderError('Not in this lobby');
});

export const leave_lobby = spacetimedb.reducer({
  lobbyId: t.u64(),
}, (ctx, { lobbyId }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) return;
  let found = false;
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) {
      ctx.db.lobbyPlayer.id.delete(p.id);
      found = true;
      break;
    }
  }
  if (!found) return;
  const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
  if (remaining.length === 0) { ctx.db.lobby.id.delete(lobbyId); return; }
  const newCount = lobby.playerCount - 1n;
  const isHost = lobby.hostIdentity.isEqual(ctx.sender);
  const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
  ctx.db.lobby.id.update({ ...lobby, playerCount: newCount, hostIdentity: newHost });
});

export const kick_player = spacetimedb.reducer({
  lobbyId: t.u64(), playerIdentity: t.identity(),
}, (ctx, { lobbyId, playerIdentity }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) throw new SenderError('Lobby not found');
  if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can kick');
  if (playerIdentity.isEqual(ctx.sender)) throw new SenderError('Cannot kick yourself');
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(playerIdentity)) {
      ctx.db.lobbyPlayer.id.delete(p.id);
      ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount - 1n });
      return;
    }
  }
  throw new SenderError('Player not in lobby');
});

export const start_countdown = spacetimedb.reducer({
  lobbyId: t.u64(),
}, (ctx, { lobbyId }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) throw new SenderError('Lobby not found');
  if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can start');
  if (lobby.status !== 'waiting') throw new SenderError('Already starting');
  const players = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
  if (players.length < 1) throw new SenderError('Need at least 1 player');
  if (!players.every(p => p.isReady && p.classChoice)) {
    throw new SenderError('All players must be ready with a class selected');
  }
  ctx.db.lobby.id.update({ ...lobby, status: 'countdown' });
  ctx.db.lobbyCountdown.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 3_000_000n),
    lobbyId,
  });
});

export const fire_start_game = spacetimedb.reducer({
  arg: LobbyCountdown.rowType,
}, (ctx, { arg }) => {
  const lobby = ctx.db.lobby.id.find(arg.lobbyId);
  if (!lobby || lobby.status !== 'countdown') return;

  // Clean up previous session(s) for this lobby
  for (const oldSession of ctx.db.gameSession.game_session_lobby_id.filter(arg.lobbyId)) {
    for (const p of ctx.db.playerState.player_state_session_id.filter(oldSession.id)) {
      ctx.db.playerState.id.delete(p.id);
    }
    ctx.db.gameSession.id.delete(oldSession.id);
  }

  const session = ctx.db.gameSession.insert({
    id: 0n, lobbyId: arg.lobbyId, status: 'active',
    startedAt: ctx.timestamp, endedAt: undefined,
    mapSeed: ctx.timestamp.microsSinceUnixEpoch,
  });
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)) {
    ctx.db.playerState.insert({
      id: 0n, sessionId: session.id, playerIdentity: p.playerIdentity,
      classChoice: p.classChoice, status: 'alive', score: 0n,
    });
  }
  ctx.db.lobby.id.update({ ...lobby, status: 'in_progress' });
});

export const fire_lobby_idle = spacetimedb.reducer({
  arg: LobbyIdleJob.rowType,
}, (ctx, { arg }) => {
  const lobby = ctx.db.lobby.id.find(arg.lobbyId);
  if (!lobby || lobby.status !== 'waiting') return;

  const allPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)];
  const hostPlayer = allPlayers.find(p => p.playerIdentity.isEqual(lobby.hostIdentity));
  if (hostPlayer?.isReady) return; // host became ready before deadline

  const others = allPlayers.filter(p => !p.playerIdentity.isEqual(lobby.hostIdentity));
  if (others.length === 0) {
    for (const p of allPlayers) ctx.db.lobbyPlayer.id.delete(p.id);
    ctx.db.lobby.id.delete(lobby.id);
  } else {
    const newHost = others[0];
    const newDeadline = ctx.timestamp.microsSinceUnixEpoch + IDLE_MICROS;
    ctx.db.lobby.id.update({
      ...lobby,
      hostIdentity: newHost.playerIdentity,
      hostIdleDeadline: ts(newDeadline),
    });
    ctx.db.lobbyIdleJob.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(newDeadline),
      lobbyId: lobby.id,
    });
  }
});

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

spacetimedb.clientConnected((_ctx) => {
  // add presence logic here if needed
});

spacetimedb.clientDisconnected((ctx) => {
  for (const p of ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)) {
    const lobby = ctx.db.lobby.id.find(p.lobbyId);
    if (lobby && lobby.status === 'waiting') {
      ctx.db.lobbyPlayer.id.delete(p.id);
      const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(p.lobbyId)];
      if (remaining.length === 0) {
        ctx.db.lobby.id.delete(p.lobbyId);
      } else {
        const isHost = lobby.hostIdentity.isEqual(ctx.sender);
        const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
        ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount - 1n, hostIdentity: newHost });
      }
    }
    break; // a player is in at most one lobby
  }
});
```

---

## Quick Reference: Checklist for a New Project

- [ ] Copy all tables and schema into `spacetimedb/src/index.ts` (single file — no split schema/index)
- [ ] Add `hostIdleDeadline: t.timestamp()` to Lobby, `LobbyIdleJob` scheduled table, `fire_lobby_idle` reducer
- [ ] Include leaderboard tables if persistence is needed: `LobbyResult`, `LobbyResultPlayer`, `GlobalStats`, `SquadRecord`
- [ ] Run `npm run spacetime:publish:local:fresh` to publish the module
- [ ] Run `npm run spacetime:generate` to regenerate client bindings
- [ ] Create `src/game.svelte.ts` with `$state`, `gameActions`, `setError` helper
- [ ] `quickplay()` takes no arguments — calls `conn.reducers.quickJoin(...)` (server-side selection)
- [ ] In `Root.svelte` `onConnect`: call `gameActions.init(conn)` and `conn.subscriptionBuilder().subscribeToAllTables()`
- [ ] Create `MenuHud.svelte` with `inActiveGame` check, `leavingLobby` flag, loading state, error display
- [ ] Create `LobbyHud.svelte`: derive lobby/players from identity lookup (not stored lobbyId), add countdown effect, idle deadline UI, game-start watcher
- [ ] Use separate `{#if}` blocks (not `{:else if}`) for HUD routing
- [ ] Use optional chaining on all reactive template expressions that may be `null` during transitions
- [ ] Confirm identity comparison uses `.toHexString()` on both sides
- [ ] Cast both sides to `bigint` before timestamp arithmetic — `any - any = number` in TypeScript
- [ ] Client timestamps: `new Date(Number(row.someTimestamp.microsSinceUnixEpoch / 1000n))`
