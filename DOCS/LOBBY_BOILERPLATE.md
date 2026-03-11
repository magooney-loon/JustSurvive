# Lobby System Boilerplate

A self-contained reference for reusing this multiplayer lobby system in other SpacetimeDB + Svelte 5 projects. The patterns here were proven in JustSurvive (Forest Run). Copy, adapt names, and wire up.

---

## Table of Contents

1. [Full Flow Diagram](#full-flow-diagram)
2. [Backend Schema Patterns](#backend-schema-patterns)
3. [Deterministic Code Generation (LCG)](#deterministic-code-generation-lcg)
4. [Idempotent Leave Reducer Pattern](#idempotent-leave-reducer-pattern)
5. [Scheduled Countdown Pattern](#scheduled-countdown-pattern)
6. [Lifecycle Hooks](#lifecycle-hooks)
7. [Frontend: game.svelte.ts Singleton](#frontend-gamesveltets-singleton)
8. [Frontend: Global Subscription Pattern](#frontend-global-subscription-pattern)
9. [Frontend: useSpacetimeDB + useTable Stores](#frontend-usespacetimedb--usetable-stores)
10. [Svelte 5 Gotchas](#svelte-5-gotchas)
11. [MenuHud Reconnect Pattern](#menuhud-reconnect-pattern)
12. [Async Reducer Error Handling](#async-reducer-error-handling)
13. [LobbyHud Patterns](#lobbyhud-patterns)
14. [Complete Backend Reference](#complete-backend-reference)

---

## Full Flow Diagram

```
Player opens game
       │
       ▼
  [MenuHud]
  ┌─────────────────────────────────────────────┐
  │  alreadyInLobby?                            │
  │  ├── YES → "Reconnect to Lobby" button      │
  │  │          └─→ setStage('lobby')           │
  │  └── NO  → name input + buttons             │
  │             ├── Quick Play                  │
  │             │    └─→ find open public lobby │
  │             │         ├── found → joinLobby  │
  │             │         └── none  → createLobby (public) │
  │             ├── Host Private Lobby          │
  │             │    └─→ createLobby (private)  │
  │             └── Join by Code               │
  │                  └─→ joinByCode(code)       │
  └─────────────────────────────────────────────┘
       │ (on success, no error)
       ▼
  setStage('lobby')
       │
       ▼
  [LobbyHud]
  ┌─────────────────────────────────────────────┐
  │  Waits for LobbyPlayer row with own identity│
  │  Shows: player list, class selector, ready  │
  │                                             │
  │  Each player:                               │
  │    1. Select class (setClass reducer)       │
  │    2. Ready up (setReady reducer)           │
  │                                             │
  │  Host sees Start button when:               │
  │    - playerCount >= 2                       │
  │    - all players isReady && classChoice     │
  │                                             │
  │  Host clicks Start →                        │
  │    startCountdown reducer                   │
  │    → lobby.status = 'countdown'             │
  │    → LobbyCountdown row inserted            │
  │    → 3-second timer fires fire_start_game   │
  │    → GameSession + PlayerState rows created │
  │    → lobby.status = 'in_progress'           │
  │                                             │
  │  All clients watch lobby.status:            │
  │    'in_progress' → find GameSession row     │
  │    → set currentSessionId                   │
  │    → setStage('game')                       │
  └─────────────────────────────────────────────┘
       │
       ▼
  [GameStage + GameHud]
  Game runs using PlayerState rows
```

---

## Backend Schema Patterns

### Single-File Layout

All tables, schema, helpers, and reducers live in one file (`src/index.ts`). Tables are defined first, then schema is exported, then reducers. This avoids circular import issues between `schema.ts` and `index.ts`.

```
spacetimedb/src/index.ts
  1. imports
  2. table definitions (Lobby, LobbyPlayer, GameSession, PlayerState, LobbyCountdown)
  3. schema({ ... }) export default
  4. helper functions
  5. reducer exports
  6. lifecycle hooks
```

### Table Definitions

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
  id:           t.u64().primaryKey().autoInc(),
  hostIdentity: t.identity(),
  code:         t.string(),
  isPublic:     t.bool(),
  status:       t.string(),     // 'waiting' | 'countdown' | 'in_progress' | 'game_over'
  playerCount:  t.u64(),
  maxPlayers:   t.u64(),
  createdAt:    t.timestamp(),
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
  id:             t.u64().primaryKey().autoInc(),
  lobbyId:        t.u64(),
  status:         t.string(),   // 'active' | 'finished'
  startedAt:      t.timestamp(),
  endedAt:        t.timestamp().optional(),
  mapSeed:        t.u64(),
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
  // add your game-specific fields here
});

// Defined before fire_start_game exists — use lazy arrow to avoid reference error
const LobbyCountdown = table({
  name: 'lobby_countdown',
  scheduled: (): any => fire_start_game,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId:     t.u64(),
});

const spacetimedb = schema({
  lobby:          Lobby,
  lobbyPlayer:    LobbyPlayer,
  gameSession:    GameSession,
  playerState:    PlayerState,
  lobbyCountdown: LobbyCountdown,
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

  // Create session, player states, update lobby status
  const session = ctx.db.gameSession.insert({ ... });
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)) {
    ctx.db.playerState.insert({ ..., sessionId: session.id, ... });
  }
  ctx.db.lobby.id.update({ ...lobby, status: 'in_progress' });
});
```

The guard `if (!lobby || lobby.status !== 'countdown') return` is important — it makes `fire_start_game` idempotent if the countdown is somehow triggered twice or the lobby is deleted before it fires.

---

## Lifecycle Hooks

```typescript
spacetimedb.clientConnected((_ctx) => {
  // Optional: create a player presence row, log connection, etc.
  // ctx.sender is the connecting identity.
});

spacetimedb.clientDisconnected((ctx) => {
  // Remove player from any 'waiting' lobby they're in.
  // Use the lobby_player_identity index for an O(1) lookup.
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

## Frontend: game.svelte.ts Singleton

Create `src/game.svelte.ts` (the `.svelte.ts` extension enables `$state` runes at module level):

```typescript
import type { DbConnection } from './module_bindings/index.js';

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
    } catch (e) {
      setError(e);
    }
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
    } catch (e) {
      setError(e);
    }
  },

  async quickplay(lobbies: readonly { id: bigint; isPublic: boolean; status: string; playerCount: bigint; maxPlayers: bigint }[]) {
    if (!conn) return;
    gameState.error = null;
    const available = lobbies.find(
      l => l.isPublic && l.status === 'waiting' && l.playerCount < l.maxPlayers
    );
    try {
      if (available) {
        await conn.reducers.joinLobby({
          lobbyId: available.id,
          playerName: gameState.localPlayerName,
          classChoice: gameState.localPlayerClass ?? '',
        });
      } else {
        await conn.reducers.createLobby({
          playerName: gameState.localPlayerName,
          classChoice: gameState.localPlayerClass ?? '',
          isPublic: true,
        });
      }
    } catch (e) {
      setError(e);
    }
  },

  async setClass(cls: PlayerClass, lobbyId: bigint) {
    if (!conn) return;
    gameState.localPlayerClass = cls;
    try {
      await conn.reducers.setClass({ lobbyId, classChoice: cls });
    } catch (e) {
      setError(e);
    }
  },

  async setReady(lobbyId: bigint, isReady: boolean) {
    if (!conn) return;
    try {
      await conn.reducers.setReady({ lobbyId, isReady });
    } catch (e) {
      setError(e);
    }
  },

  async startCountdown(lobbyId: bigint) {
    if (!conn) return;
    try {
      await conn.reducers.startCountdown({ lobbyId });
    } catch (e) {
      setError(e);
    }
  },

  leaveLobby(lobbyId: bigint) {
    if (!conn) return;
    gameState.leavingLobby = true; // suppress MenuHud auto-redirect until reducer confirms
    conn.reducers.leaveLobby({ lobbyId }); // fire-and-forget; UI navigates immediately
    gameState.currentLobbyId = null;
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
const [lobbies] = useTable(tables.lobby);
const [lobbyPlayers] = useTable(tables.lobbyPlayer);
const [sessions] = useTable(tables.gameSession);

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

The cleanup function returned from `$effect` is called synchronously when the effect re-runs or the component is destroyed. If the cleanup reads a reactive value (`$derived`, `$state`), it sees the current value at cleanup time, which may be different from the value at setup time.

```typescript
// BAD: cleanup reads the reactive `intervalId` which may have changed
$effect(() => {
  const intervalId = setInterval(() => { ... }, 1000);
  return () => clearInterval(intervalId); // fine — intervalId is a local const
});

// BAD VARIANT: reading a $derived inside the cleanup
$effect(() => {
  if ($someCondition) {
    doSetup();
    return () => {
      doTeardown($someOtherDerived); // $someOtherDerived may be stale here!
    };
  }
});

// GOOD: capture what you need before the return
$effect(() => {
  if ($someCondition) {
    const capturedValue = $someOtherDerived; // capture now
    doSetup();
    return () => {
      doTeardown(capturedValue); // uses captured value
    };
  }
});
```

### 2. Optional Chaining in Reactive Templates

In Svelte 5, reactive template expressions are evaluated eagerly by the reactive graph. A `null` reference mid-transition will throw synchronously, not be caught silently. Any value that can be `null` during a state transition must use optional chaining in the template:

```svelte
<!-- BAD: crashes if currentLobby is null during transition -->
<button onclick={copyCode}>Code: {currentLobby.code}</button>

<!-- GOOD: safe even if currentLobby is transiently null -->
<button onclick={copyCode}>Code: {currentLobby?.code}</button>
```

### 3. $effect Double-Fire in Development (Strict Mode)

In development (Svelte runs effects twice on mount to detect side-effects), `$effect` may run twice. Ensure your effects are idempotent — setting a value to the same thing twice is fine; inserting a row twice is not. This matters less for read-only reactive effects (like watching a lobby status) but matters a lot for effects that call reducers or do DOM operations.

### 4. Do Not Use {:else if} for Stage HUD Routing

Using `{#if} {:else if}` in a HUD router prevents Svelte from running exit transitions on the leaving component before mounting the entering one. Always use separate `{#if}` blocks:

```svelte
<!-- BAD: no exit transitions -->
{#if stage === 'menu'}
  <MenuHud />
{:else if stage === 'lobby'}
  <LobbyHud />
{/if}

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
const [lobbies, lobbiesLoading] = useTable(tables.lobby);
// or if you don't need loading:
const [lobbies] = useTable(tables.lobby);
```

### 6. $state.raw for Three.js Instances

If your game state holds Three.js class instances (e.g. `THREE.Audio`, `THREE.Object3D`), use `$state.raw<T>()` instead of `$state()`. Svelte 5 wraps `$state` values in a Proxy, which breaks Three.js internal methods.

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
  const [lobbies] = useTable(tables.lobby);
  const [lobbyPlayers] = useTable(tables.lobbyPlayer);

  const myEntry = $derived(
    $lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
  );
  const myLobby = $derived(myEntry ? $lobbies.find(l => l.id === myEntry.lobbyId) : null);
  // Only show reconnect for in_progress games; redirect for waiting/countdown
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
  <button onclick={() => stageActions.setStage('game')}>Reconnect to Game</button>
{:else}
  <!-- Normal join/host UI -->
  ...
{/if}
```

**Why `leavingLobby` is needed:** `leaveLobby` fires a reducer and immediately calls `setStage('menu')`. MenuHud mounts and the `$effect` runs before the subscription update removes the `lobbyPlayer` row — so `myLobby` is still `waiting`. The flag blocks the redirect until the row disappears (then clears itself).

This is safe because `subscribeToAllTables()` keeps all table caches up to date. If the player was cleaned up by `clientDisconnected`, `myEntry` will be `undefined` after reconnect.

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
const [lobbies] = useTable(tables.lobby);
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
    const session = $sessions.find(s => s.lobbyId === currentLobby.id);
    if (session) {
      gameState.currentSessionId = session.id;
      stageActions.setStage('game');
    }
  }
});
```

`stageActions.setStage` is a no-op if already on `'game'`, so this effect is safe to re-run.

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

Show in template:
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
  id:           t.u64().primaryKey().autoInc(),
  hostIdentity: t.identity(),
  code:         t.string(),
  isPublic:     t.bool(),
  status:       t.string(),
  playerCount:  t.u64(),
  maxPlayers:   t.u64(),
  createdAt:    t.timestamp(),
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  lobby:          Lobby,
  lobbyPlayer:    LobbyPlayer,
  gameSession:    GameSession,
  playerState:    PlayerState,
  lobbyCountdown: LobbyCountdown,
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

// ─── Reducers ─────────────────────────────────────────────────────────────────

export const create_lobby = spacetimedb.reducer({
  playerName: t.string(),
  classChoice: t.string(),
  isPublic: t.bool(),
}, (ctx, { playerName, classChoice, isPublic }) => {
  if (!playerName) throw new SenderError('playerName required');
  const lobby = ctx.db.lobby.insert({
    id: 0n, hostIdentity: ctx.sender,
    code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
    isPublic, status: 'waiting', playerCount: 1n, maxPlayers: 4n,
    createdAt: ctx.timestamp,
  });
  ctx.db.lobbyPlayer.insert({
    id: 0n, lobbyId: lobby.id, playerIdentity: ctx.sender,
    playerName, classChoice: classChoice || '', isReady: false, joinedAt: ctx.timestamp,
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

export const start_countdown = spacetimedb.reducer({
  lobbyId: t.u64(),
}, (ctx, { lobbyId }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) throw new SenderError('Lobby not found');
  if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can start');
  if (lobby.status !== 'waiting') throw new SenderError('Already starting');
  const players = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
  if (players.length < 2) throw new SenderError('Need at least 2 players');
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
    break;
  }
});
```

---

## Quick Reference: Checklist for a New Project

- [ ] Copy tables, schema, reducers, lifecycle into `spacetimedb/src/index.ts`
- [ ] Run `pnpm spacetime:publish` to publish the module
- [ ] Run `pnpm spacetime:generate` to regenerate client bindings
- [ ] Create `src/game.svelte.ts` with `$state`, `gameActions`, `setError` helper
- [ ] In `Root.svelte` `onConnect`: call `gameActions.init(conn)` and `conn.subscriptionBuilder().subscribeToAllTables()`
- [ ] Create `MenuHud.svelte` with `alreadyInLobby` check, loading state, error display
- [ ] Create `LobbyHud.svelte` with derived lobby/player state, countdown effect, game-start watcher
- [ ] Use separate `{#if}` blocks (not `{:else if}`) for HUD routing
- [ ] Use optional chaining on all reactive template expressions that may be `null` during transitions
- [ ] Confirm identity comparison uses `.toHexString()` on both sides
