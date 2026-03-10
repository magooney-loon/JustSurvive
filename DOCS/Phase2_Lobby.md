# Phase 2 — Lobby System

**Goal:** Full multiplayer lobby — host, join by code, quickplay, class select, ready up, start gate (min 2 players). By end of phase, multiple players can find each other and launch a game session.

**Status: COMPLETE**

---

## SpacetimeDB Backend

All backend code lives in a single file: `spacetimedb/src/index.ts`. There is no separate `schema.ts` — tables, schema, helpers, reducers, and lifecycle hooks are all co-located. The schema export lives in the middle of the file after table definitions and before reducer definitions.

### Tables

#### `Lobby`

```
id            u64  primaryKey autoInc
hostIdentity  identity
code          string          — 6-char uppercase join code (LCG-generated, deterministic)
isPublic      bool
status        string          — 'waiting' | 'countdown' | 'in_progress' | 'game_over'
playerCount   u64
maxPlayers    u64             — always 4
createdAt     timestamp
```

Indexes: `lobby_status` (btree on `status`), `lobby_code` (btree on `code`).

#### `LobbyPlayer`

```
id              u64  primaryKey autoInc
lobbyId         u64
playerIdentity  identity
playerName      string
classChoice     string   — 'spotter' | 'gunner' | 'tank' | 'healer' | '' (unselected)
isReady         bool
joinedAt        timestamp
```

Indexes: `lobby_player_lobby_id` (btree on `lobbyId`), `lobby_player_identity` (btree on `playerIdentity`).

#### `GameSession`

```
id             u64  primaryKey autoInc
lobbyId        u64
status         string    — 'active' | 'finished'
startedAt      timestamp
endedAt        timestamp optional
dayPhase       string    — 'sunset' | 'dusk' | 'twilight' | 'night' | 'deep_night'
cycleNumber    u64
phaseStartedAt timestamp
fogActive      bool
mapSeed        u64       — set from ctx.timestamp.microsSinceUnixEpoch at game start
```

Index: `game_session_lobby_id` (btree on `lobbyId`).

#### `PlayerState`

```
id              u64  primaryKey autoInc
sessionId       u64
playerIdentity  identity
classChoice     string
hp              u64
maxHp           u64
stamina         u64
maxStamina      u64
posX            i64   — fixed-point: value * 0.001 = world units
posY            i64
posZ            i64
status          string   — 'alive' | 'downed' | 'eliminated'
score           u64
```

Indexes: `player_state_session_id` (btree on `sessionId`), `player_state_identity` (btree on `playerIdentity`).

#### `LobbyCountdown` (scheduled table)

```
scheduledId  u64  primaryKey autoInc
scheduledAt  scheduleAt
lobbyId      u64
```

Scheduled reducer: `fire_start_game`. The `scheduled` option references `fire_start_game` via a lazy arrow (`(): any => fire_start_game`) to avoid a circular reference since the reducer is defined after the table.

### Schema Export

```typescript
const spacetimedb = schema({
  lobby: Lobby,
  lobbyPlayer: LobbyPlayer,
  gameSession: GameSession,
  playerState: PlayerState,
  lobbyCountdown: LobbyCountdown,
});
export default spacetimedb;
```

Note: keys in the schema object are camelCase (`lobbyPlayer`, `gameSession`, etc.) matching how `ctx.db` will expose them.

### Index Accessor Names

All indexes use explicit `accessor` fields (same as `name`) to ensure the generated accessor on `ctx.db.<table>.<accessor>` matches exactly what's coded:

```typescript
{ name: 'lobby_player_lobby_id', accessor: 'lobby_player_lobby_id', algorithm: 'btree', columns: ['lobbyId'] }
```

This is required because the SpacetimeDB TypeScript SDK does not automatically transform index names to camelCase — they are used verbatim.

---

### Helpers

#### `generateCode(seed: bigint): string`

Uses a Linear Congruential Generator (LCG) to produce a deterministic 6-character join code from the reducer's timestamp. This satisfies SpacetimeDB's requirement that reducers be deterministic (no `Math.random()`).

```typescript
function generateCode(seed: bigint): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no visually confusable chars
  let s = seed;
  let code = '';
  for (let i = 0; i < 6; i++) {
    s = (s * 1664525n + 1013904223n) & 0xFFFFFFFFn;
    code += chars[Number(s % BigInt(chars.length))];
  }
  return code;
}
```

Called as: `generateCode(ctx.timestamp.microsSinceUnixEpoch)`.

#### `classMaxHp(cls: string): bigint`

Returns `150n` for `'tank'`, `100n` for all others.

#### `classMaxStamina(cls: string): bigint`

Returns `150n` for `'spotter'`, `200n` for `'tank'`, `80n` for `'gunner'` and `'healer'`.

---

### Reducers

#### `create_lobby`

Parameters: `{ playerName: string, classChoice: string, isPublic: bool }`

1. Validates `playerName` is non-empty.
2. Inserts a `Lobby` row with `status: 'waiting'`, `playerCount: 1n`, `maxPlayers: 4n`, and a LCG-generated code.
3. Inserts a `LobbyPlayer` row for `ctx.sender`.

#### `join_lobby`

Parameters: `{ lobbyId: u64, playerName: string, classChoice: string }`

1. Looks up lobby by primary key — throws if not found.
2. Rejects if status is not `'waiting'`, or lobby is full.
3. Checks existing `LobbyPlayer` rows for the sender — throws `'Already in lobby'` if found.
4. Inserts `LobbyPlayer` row.
5. Updates lobby `playerCount + 1n`.

#### `join_by_code`

Parameters: `{ code: string, playerName: string, classChoice: string }`

1. Filters `lobby_code` index with `code.toUpperCase()`.
2. Rejects if not found, already started, or full.
3. Does **not** re-check for duplicate join (relies on UI to prevent it; `clientDisconnected` handles cleanup).
4. Inserts `LobbyPlayer` row, increments `playerCount`.

#### `set_class`

Parameters: `{ lobbyId: u64, classChoice: string }`

1. Validates class is one of `['spotter', 'gunner', 'tank', 'healer']`.
2. Finds the caller's `LobbyPlayer` row via the `lobby_player_lobby_id` index.
3. Updates `classChoice` and resets `isReady` to `false` (changing class un-readies the player).

#### `set_ready`

Parameters: `{ lobbyId: u64, isReady: bool }`

1. Finds caller's `LobbyPlayer` row.
2. Throws `'Select a class first'` if trying to ready without a class selected.
3. Updates `isReady`.

#### `leave_lobby`

Parameters: `{ lobbyId: u64 }`

Idempotent pattern: if the caller is not in the lobby (row not found), sets `found = false` and returns early without decrementing `playerCount`. This prevents a double-decrement if `leave_lobby` is called after `clientDisconnected` already cleaned up.

1. Looks up lobby — returns silently if not found.
2. Scans `lobby_player_lobby_id` for the caller's row. Deletes it if found, sets `found = true`.
3. If `!found`, returns immediately.
4. Re-queries remaining players. If zero, deletes the lobby and returns.
5. Otherwise, decrements `playerCount` and transfers host if the leaver was the host.

#### `start_countdown`

Parameters: `{ lobbyId: u64 }`

1. Validates caller is host and lobby is `'waiting'`.
2. Requires `players.length >= 2`.
3. Requires all players to have `isReady && classChoice`.
4. Sets lobby status to `'countdown'`.
5. Inserts a `LobbyCountdown` row scheduled 3 seconds in the future (`ctx.timestamp.microsSinceUnixEpoch + 3_000_000n`).

#### `fire_start_game` (scheduled)

Parameter: `{ arg: LobbyCountdown.rowType }`

Fires automatically when the `LobbyCountdown` row's `scheduledAt` time is reached. The row is auto-deleted by SpacetimeDB after the reducer completes.

1. Guards against stale or cancelled countdowns: returns early if lobby is not in `'countdown'` state.
2. Inserts a `GameSession` row with `status: 'active'`, initial day phase `'sunset'`, `mapSeed` from `ctx.timestamp.microsSinceUnixEpoch`.
3. Iterates all `LobbyPlayer` rows for the lobby and inserts a `PlayerState` row for each, setting HP and stamina from class helpers.
4. Updates lobby status to `'in_progress'`.

### Lifecycle Hooks

#### `clientConnected`

Stub — no-op in Phase 2.

#### `clientDisconnected`

Iterates the caller's `LobbyPlayer` rows via the `lobby_player_identity` index. For any lobby in `'waiting'` status:

1. Deletes the `LobbyPlayer` row.
2. Re-queries remaining players. Deletes lobby if empty.
3. Otherwise decrements `playerCount` and transfers host if needed.

Uses `break` after processing the first matching row (a player should only be in one lobby at a time).

---

## Frontend

### `src/game.svelte.ts`

Reactive singleton (`$state` at module level in a `.svelte.ts` file) that holds client-side game state and wraps all reducer calls.

**State:**

```typescript
const gameState = $state({
  currentLobbyId: null as bigint | null,
  currentSessionId: null as bigint | null,
  localPlayerClass: null as PlayerClass | null,
  localPlayerName: 'Player',
  error: null as string | null,
});
```

**`setError(e)` helper:** Strips the `SenderError:` prefix that SpacetimeDB prepends to server-thrown errors before storing in `gameState.error`. This keeps the displayed error message clean.

**`gameActions`:**

| Action | Behaviour |
|--------|-----------|
| `init(conn)` | Stores the `DbConnection` reference. Called from `Root.svelte` `onConnect`. |
| `setPlayerName(name)` | Trims and stores player name, falling back to `'Player'`. |
| `hostLobby(isPublic)` | `await conn.reducers.createLobby(...)`. Sets error on failure. |
| `joinById(lobbyId)` | `await conn.reducers.joinLobby(...)`. Sets error on failure. |
| `joinByCode(code)` | `await conn.reducers.joinByCode({ code: code.toUpperCase(), ... })`. |
| `quickplay(lobbies)` | Receives current `lobbies` array. Finds first public waiting lobby with space and calls `joinLobby`; falls back to `createLobby` with `isPublic: true`. |
| `setClass(cls, lobbyId)` | Updates `localPlayerClass` locally, then `await conn.reducers.setClass(...)`. |
| `setReady(lobbyId, isReady)` | `await conn.reducers.setReady(...)`. |
| `startCountdown(lobbyId)` | `await conn.reducers.startCountdown(...)`. |
| `leaveLobby(lobbyId)` | Calls `conn.reducers.leaveLobby(...)` (fire-and-forget), clears `currentLobbyId`. |
| `clearError()` | Sets `gameState.error = null`. |

All async actions `await` the reducer call so that errors propagate synchronously within the action before the calling component navigates to a new stage.

---

### `src/lib/MenuHud.svelte`

Uses `useSpacetimeDB()` and `useTable(tables.lobby)` / `useTable(tables.lobbyPlayer)` to detect if the player is already in a lobby.

**Key pattern — `alreadyInLobby` check:**

When the component mounts, it checks whether the current identity already has a `LobbyPlayer` row. If so, it displays a "Reconnect to Lobby" button instead of the full join/host UI. This handles the case where a player navigated away from the lobby stage without leaving, or refreshed the page while still in a lobby.

```typescript
const conn = useSpacetimeDB();
const [lobbies] = useTable(tables.lobby);
const [lobbyPlayers] = useTable(tables.lobbyPlayer);

const myEntry = $derived(
  $lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
);
const alreadyInLobby = $derived(!!myEntry);
```

**Loading state:** A local `loading = $state(false)` is set before and after each async action. Buttons are disabled while `loading` is true and a "Connecting..." message is shown. On error, the error from `gameState.error` is shown instead.

**Mode switching:** A local `mode = $state<'main' | 'join_code'>('main')` toggles between the main menu buttons and the join-by-code input. `clearError()` is called when switching modes to avoid stale errors.

**Navigation pattern:** After each async action, navigation only proceeds if there is no error:

```typescript
await gameActions.hostLobby(false);
loading = false;
if (!gameState.error) stageActions.setStage('lobby');
```

---

### `src/lib/LobbyHud.svelte`

**Subscriptions:**

```typescript
const conn = useSpacetimeDB();
const [lobbies] = useTable(tables.lobby);
const [lobbyPlayers] = useTable(tables.lobbyPlayer);
const [sessions] = useTable(tables.gameSession);
```

**Derived state:**

```typescript
const myEntry = $derived($lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString()));
const currentLobby = $derived(myEntry ? $lobbies.find(l => l.id === myEntry.lobbyId) : null);
const players = $derived(currentLobby ? $lobbyPlayers.filter(p => p.lobbyId === currentLobby.id) : []);
const isHost = $derived(currentLobby?.hostIdentity.toHexString() === $conn.identity?.toHexString());
const allReady = $derived(players.length >= 2 && players.every(p => p.isReady && p.classChoice));
```

All reactive reads use optional chaining (`currentLobby?.hostIdentity`, `currentLobby?.code`, etc.) to guard against the brief period during transitions when `currentLobby` may be `null` — a Svelte 5 reactive template safety requirement.

**Countdown UI:**

A local `countdownValue = $state(3)` ticks down via `setInterval` while `currentLobby.status === 'countdown'`. The `$effect` returns the cleanup function:

```typescript
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

Note: the cleanup reads `countdownValue` at schedule time, not as a reactive variable, so re-entrancy is not an issue. However, as a general rule, do not read `$derived` values inside a `$effect` cleanup function — capture the primitive value you need before scheduling the cleanup.

**Game start watcher:**

```typescript
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

This fires on every update to `currentLobby` or `sessions`, but `setStage` is a no-op if already on `'game'`.

**Loading skeleton:** When `!currentLobby` (waiting for the row to appear after the reducer call), shows a "Connecting to lobby..." message with a Back button. Once the row arrives via subscription the full lobby UI replaces it.

**Empty slots:** The remaining player slots (up to `maxPlayers = 4`) are rendered as "Waiting for player..." placeholders using `{#each { length: 4 - players.length } as _}`.

---

### `src/Root.svelte`

**Connection setup (not main.ts):** The SpacetimeDB connection is bootstrapped in `Root.svelte` using `createSpacetimeDBProvider`. The `connectionBuilder` is constructed at module level (not inside a component effect), so it is created exactly once and does not trigger reconnects.

```typescript
const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'justsurvive-6769';
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;
```

**`onConnect` callback:**

```typescript
const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  log.info('Connected to SpacetimeDB with identity:', identity.toHexString());
  gameActions.init(conn);
  conn.subscriptionBuilder().subscribeToAllTables();
};
```

`subscribeToAllTables()` is used as a global subscription so that all table data is continuously live and `useTable` reads from a populated cache. No per-component SQL subscriptions are needed.

---

## Key Bugs Fixed and Patterns

### LCG Deterministic Code Generation

The naive `generateCode` function in the Phase 2 plan used `i % chars.length`, producing the same code every time. The actual implementation uses a proper LCG seeded with `ctx.timestamp.microsSinceUnixEpoch`, which is deterministic (required by SpacetimeDB) but varies per call.

### Idempotent `leave_lobby`

The `leave_lobby` reducer tracks whether a player row was actually found before decrementing `playerCount`. Without this check, if `clientDisconnected` already removed the player and then the client called `leave_lobby` on reconnect, `playerCount` would decrement below the true value or underflow. The `found` flag prevents this.

### `subscribeToAllTables` vs Per-Component Subscriptions

Using `conn.subscriptionBuilder().subscribeToAllTables()` once in `onConnect` means `useTable(tables.x)` in any component always returns live data from the shared cache. Per-component SQL subscriptions were not needed and would have introduced subscription lifecycle complexity.

### Svelte 5 `$effect` Cleanup Captures

When writing `$effect(() => { ... return () => cleanup })`, the cleanup function is a closure over the outer scope at the time the effect ran. Be careful: if the cleanup reads a `$derived` or `$state` value, it sees the _current_ reactive value at cleanup time, not at setup time. Always capture the value you need into a plain variable _before_ returning the cleanup if the value might have changed.

### Optional Chaining in Reactive Templates

In Svelte 5, reactive template expressions are evaluated eagerly. If `currentLobby` can be `null` during a reactive cycle (e.g. mid-transition), then `currentLobby.code` will throw. Use `currentLobby?.code` throughout LobbyHud to guard against this.

### `useSpacetimeDB()` Returns a Store

`useSpacetimeDB()` from `spacetimedb/svelte` returns a store. Access identity as `$conn.identity`, not `conn.identity`. The `identity` field is `undefined` until the connection handshake completes, so always use optional chaining: `$conn.identity?.toHexString()`.

### Async Reducer Error Pattern

All `gameActions` methods that call reducers are `async` and `await` the call. This ensures that when a component does:

```typescript
loading = true;
await gameActions.hostLobby(false);
loading = false;
if (!gameState.error) stageActions.setStage('lobby');
```

...the `gameState.error` check is guaranteed to reflect the result of that specific call, not a stale error from a previous one.

---

## Done When

- [x] Two separate browser sessions can host and join a lobby
- [x] Lobby code is displayed and copy button works
- [x] Quickplay finds an open public lobby to join, or creates a new one if none available
- [x] Class selector works; players can change class and it reflects for all
- [x] Ready toggle gates the start button
- [x] Start button disabled until >= 2 players all ready
- [x] Countdown fires, `game_session` row appears, both clients transition to `game` stage
- [x] Disconnecting a player removes them from the lobby; last player exits = lobby deleted
- [x] Host leaving transfers host role to next player
- [x] `alreadyInLobby` reconnect path works on page refresh
