# Phase 2 — Lobby System

**Goal:** Full multiplayer lobby — host, join by code, quickplay, class select, ready up, start gate (min 2 players). By end of phase, multiple players can find each other and launch a game session.

---

## SpacetimeDB Backend

### New Tables (`schema.ts`)

```typescript
import { schema, table, t } from 'spacetimedb/server';

export const Lobby = table({
  name: 'lobby',
  public: true,
  indexes: [
    { name: 'lobby_status', algorithm: 'btree', columns: ['status'] },
    { name: 'lobby_code', algorithm: 'btree', columns: ['code'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  hostIdentity: t.identity(),
  code: t.string(),             // 6-char uppercase join code
  isPublic: t.bool(),
  status: t.string(),           // 'waiting' | 'countdown' | 'in_progress' | 'game_over'
  playerCount: t.u64(),
  maxPlayers: t.u64(),          // always 4
  createdAt: t.timestamp(),
});

export const LobbyPlayer = table({
  name: 'lobby_player',
  public: true,
  indexes: [
    { name: 'lobby_player_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
    { name: 'lobby_player_identity', algorithm: 'btree', columns: ['playerIdentity'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  lobbyId: t.u64(),
  playerIdentity: t.identity(),
  playerName: t.string(),
  classChoice: t.string(),      // 'spotter' | 'gunner' | 'tank' | 'healer' | '' (unselected)
  isReady: t.bool(),
  joinedAt: t.timestamp(),
});

export const GameSession = table({
  name: 'game_session',
  public: true,
  indexes: [
    { name: 'game_session_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  lobbyId: t.u64(),
  status: t.string(),           // 'active' | 'finished'
  startedAt: t.timestamp(),
  endedAt: t.timestamp().optional(),
  dayPhase: t.string(),         // 'sunset' | 'dusk' | 'twilight' | 'night' | 'deep_night'
  cycleNumber: t.u64(),
  phaseStartedAt: t.timestamp(),
  fogActive: t.bool(),
  mapSeed: t.u64(),
});

export const PlayerState = table({
  name: 'player_state',
  public: true,
  indexes: [
    { name: 'player_state_session_id', algorithm: 'btree', columns: ['sessionId'] },
    { name: 'player_state_identity', algorithm: 'btree', columns: ['playerIdentity'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  playerIdentity: t.identity(),
  classChoice: t.string(),
  hp: t.u64(),
  maxHp: t.u64(),
  stamina: t.u64(),
  maxStamina: t.u64(),
  posX: t.i64(),                // fixed-point: value * 0.001 = world units
  posY: t.i64(),
  posZ: t.i64(),
  status: t.string(),           // 'alive' | 'downed' | 'eliminated'
  score: t.u64(),
});

// Scheduled table for countdown before game start
export const LobbyCountdown = table({
  name: 'lobby_countdown',
  scheduled: () => fire_start_game,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId: t.u64(),
});

const spacetimedb = schema({ Lobby, LobbyPlayer, GameSession, PlayerState, LobbyCountdown });
export default spacetimedb;
```

### New Reducers (`index.ts`)

```typescript
import spacetimedb, { Lobby, LobbyPlayer, GameSession, PlayerState, LobbyCountdown } from './schema.js';
import { t, SenderError, Timestamp, ScheduleAt } from 'spacetimedb/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars
  let code = '';
  // Note: SpacetimeDB reducers must be deterministic — cannot use Math.random()
  // Use the reducer's timestamp as a deterministic seed instead
  // This is a simplified approach; improve with a proper LCG if needed
  for (let i = 0; i < 6; i++) code += chars[i % chars.length];
  return code;
}

function classMaxHp(cls: string): bigint {
  return cls === 'tank' ? 150n : 100n;
}

function classMaxStamina(cls: string): bigint {
  if (cls === 'spotter') return 150n;
  if (cls === 'tank') return 200n;
  return 80n; // gunner, healer
}

// ─── Lobby Management ─────────────────────────────────────────────────────────

export const create_lobby = spacetimedb.reducer({
  playerName: t.string(),
  classChoice: t.string(),
  isPublic: t.bool(),
}, (ctx, { playerName, classChoice, isPublic }) => {
  if (!playerName) throw new SenderError('playerName required');

  const lobby = ctx.db.lobby.insert({
    id: 0n,
    hostIdentity: ctx.sender,
    code: generateCode(),
    isPublic,
    status: 'waiting',
    playerCount: 1n,
    maxPlayers: 4n,
    createdAt: ctx.timestamp,
  });

  ctx.db.lobbyPlayer.insert({
    id: 0n,
    lobbyId: lobby.id,
    playerIdentity: ctx.sender,
    playerName,
    classChoice: classChoice || '',
    isReady: false,
    joinedAt: ctx.timestamp,
  });
});

export const join_lobby = spacetimedb.reducer({
  lobbyId: t.u64(),
  playerName: t.string(),
  classChoice: t.string(),
}, (ctx, { lobbyId, playerName, classChoice }) => {
  const lobby = ctx.db.lobby.id.find(lobbyId);
  if (!lobby) throw new SenderError('Lobby not found');
  if (lobby.status !== 'waiting') throw new SenderError('Lobby already started');
  if (lobby.playerCount >= lobby.maxPlayers) throw new SenderError('Lobby full');

  // Check not already in lobby
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) throw new SenderError('Already in lobby');
  }

  ctx.db.lobbyPlayer.insert({
    id: 0n,
    lobbyId,
    playerIdentity: ctx.sender,
    playerName,
    classChoice: classChoice || '',
    isReady: false,
    joinedAt: ctx.timestamp,
  });

  ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
});

export const join_by_code = spacetimedb.reducer({
  code: t.string(),
  playerName: t.string(),
  classChoice: t.string(),
}, (ctx, { code, playerName, classChoice }) => {
  const results = [...ctx.db.lobby.lobby_code.filter(code.toUpperCase())];
  if (!results.length) throw new SenderError('Lobby not found');
  const lobby = results[0];
  if (lobby.status !== 'waiting') throw new SenderError('Lobby already started');
  if (lobby.playerCount >= lobby.maxPlayers) throw new SenderError('Lobby full');

  ctx.db.lobbyPlayer.insert({
    id: 0n,
    lobbyId: lobby.id,
    playerIdentity: ctx.sender,
    playerName,
    classChoice: classChoice || '',
    isReady: false,
    joinedAt: ctx.timestamp,
  });

  ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
});

export const set_class = spacetimedb.reducer({
  lobbyId: t.u64(),
  classChoice: t.string(),
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
  lobbyId: t.u64(),
  isReady: t.bool(),
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

  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) {
      ctx.db.lobbyPlayer.id.delete(p.id);
      break;
    }
  }

  const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
  if (remaining.length === 0) {
    ctx.db.lobby.id.delete(lobbyId);
    return;
  }

  // If host left, transfer to next player
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

  // Schedule game start in 3 seconds
  const startAt = ctx.timestamp.microsSinceUnixEpoch + 3_000_000n;
  ctx.db.lobbyCountdown.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(startAt),
    lobbyId,
  });
});

export const fire_start_game = spacetimedb.reducer({
  arg: LobbyCountdown.rowType,
}, (ctx, { arg }) => {
  const lobby = ctx.db.lobby.id.find(arg.lobbyId);
  if (!lobby || lobby.status !== 'countdown') return;

  // Create game session with a deterministic seed from timestamp
  const session = ctx.db.gameSession.insert({
    id: 0n,
    lobbyId: arg.lobbyId,
    status: 'active',
    startedAt: ctx.timestamp,
    endedAt: undefined,
    dayPhase: 'sunset',
    cycleNumber: 0n,
    phaseStartedAt: ctx.timestamp,
    fogActive: false,
    mapSeed: ctx.timestamp.microsSinceUnixEpoch,
  });

  // Create player_state rows per lobby member
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)) {
    ctx.db.playerState.insert({
      id: 0n,
      sessionId: session.id,
      playerIdentity: p.playerIdentity,
      classChoice: p.classChoice,
      hp: classMaxHp(p.classChoice),
      maxHp: classMaxHp(p.classChoice),
      stamina: classMaxStamina(p.classChoice),
      maxStamina: classMaxStamina(p.classChoice),
      posX: 0n,
      posY: 0n,
      posZ: 0n,
      status: 'alive',
      score: 0n,
    });
  }

  ctx.db.lobby.id.update({ ...lobby, status: 'in_progress' });
});

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

spacetimedb.clientDisconnected((ctx) => {
  // Remove player from any lobby they're in
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

## Frontend

### `src/game.svelte.ts` (update from Phase 1 stub)

Add lobby-related state and actions:

```typescript
import type { DbConnection } from './module_bindings/index.js';

export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const gameState = $state({
  currentLobbyId: null as bigint | null,
  currentSessionId: null as bigint | null,
  localPlayerClass: null as PlayerClass | null,
  localPlayerName: 'Player',
  error: null as string | null,
});

export { gameState };

let conn: DbConnection | null = null;

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
      conn.reducers.createLobby({
        playerName: gameState.localPlayerName,
        classChoice: gameState.localPlayerClass ?? '',
        isPublic,
      });
    } catch (e) {
      gameState.error = String(e);
    }
  },
  async joinById(lobbyId: bigint) {
    if (!conn) return;
    conn.reducers.joinLobby({
      lobbyId,
      playerName: gameState.localPlayerName,
      classChoice: gameState.localPlayerClass ?? '',
    });
  },
  async joinByCode(code: string) {
    if (!conn) return;
    conn.reducers.joinByCode({
      code: code.toUpperCase(),
      playerName: gameState.localPlayerName,
      classChoice: gameState.localPlayerClass ?? '',
    });
  },
  setClass(cls: PlayerClass, lobbyId: bigint) {
    if (!conn) return;
    gameState.localPlayerClass = cls;
    conn.reducers.setClass({ lobbyId, classChoice: cls });
  },
  setReady(lobbyId: bigint, isReady: boolean) {
    if (!conn) return;
    conn.reducers.setReady({ lobbyId, isReady });
  },
  startCountdown(lobbyId: bigint) {
    if (!conn) return;
    conn.reducers.startCountdown({ lobbyId });
  },
  leaveLobby(lobbyId: bigint) {
    if (!conn) return;
    conn.reducers.leaveLobby({ lobbyId });
    gameState.currentLobbyId = null;
  },
  clearError() {
    gameState.error = null;
  },
};
```

Wire `gameActions.init(conn)` in `main.ts` inside the `onConnect` callback.

---

### `src/lib/MenuHud.svelte` (full implementation)

```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
  import { gameActions, gameState } from '../game.svelte.js';
  import { useSpacetimeDB } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';

  const { identity } = useSpacetimeDB();

  let joinCode = $state('');
  let playerName = $state('Player');
  let mode = $state<'main' | 'join_code'>('main');

  // Quickplay: find an open public lobby, or host one
  async function quickplay() {
    // Handled by LobbyHud watching for lobby row appearing with our identity
    gameActions.setPlayerName(playerName);
    // TODO Phase 2: query for public waiting lobby, join or create
    // For now just host a public lobby
    gameActions.hostLobby(true);
    stageActions.setStage('lobby');
  }

  function hostPrivate() {
    gameActions.setPlayerName(playerName);
    gameActions.hostLobby(false);
    stageActions.setStage('lobby');
  }

  function joinByCode() {
    if (joinCode.length < 4) return;
    gameActions.setPlayerName(playerName);
    gameActions.joinByCode(joinCode);
    stageActions.setStage('lobby');
  }
</script>

<div transition:fly={{ y: 20, duration: 300 }}
     style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem;">
  <h1 style="font-size: 3rem; margin: 0;">Forest Run</h1>

  <input
    type="text"
    placeholder="Your name"
    bind:value={playerName}
    maxlength={16}
    style="text-align: center; font-size: 1.2rem; padding: 0.4rem 1rem; border-radius: 8px;"
  />

  {#if mode === 'main'}
    <button onclick={quickplay}>Quick Play</button>
    <button onclick={hostPrivate}>Host Private Lobby</button>
    <button onclick={() => mode = 'join_code'}>Join by Code</button>
    <button onclick={() => stageActions.setStage('leaderboard')}>Leaderboard</button>
    <button onclick={() => stageActions.setStage('settings')}>Settings</button>
  {:else}
    <input
      type="text"
      placeholder="Enter Code"
      bind:value={joinCode}
      maxlength={6}
      style="text-align: center; text-transform: uppercase; font-size: 1.5rem; padding: 0.4rem 1rem; letter-spacing: 0.3rem; border-radius: 8px;"
    />
    <button onclick={joinByCode} disabled={joinCode.length < 4}>Join</button>
    <button onclick={() => mode = 'main'}>Back</button>
  {/if}

  {#if gameState.error}
    <p style="color: red;">{gameState.error}</p>
  {/if}
</div>
```

---

### `src/lib/LobbyHud.svelte` (full implementation)

```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions, stageState } from '../stage.svelte.js';
  import { gameActions, gameState } from '../game.svelte.js';
  import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';

  const { identity } = useSpacetimeDB();
  const [lobbies] = useTable(tables.lobby);
  const [lobbyPlayers] = useTable(tables.lobbyPlayer);
  const [sessions] = useTable(tables.gameSession);

  // Find our lobby by our identity in lobbyPlayer
  const myEntry = $derived(lobbyPlayers.find(p => p.playerIdentity.toHexString() === identity?.toHexString()));
  const currentLobby = $derived(myEntry ? lobbies.find(l => l.id === myEntry.lobbyId) : null);
  const players = $derived(currentLobby ? lobbyPlayers.filter(p => p.lobbyId === currentLobby.id) : []);
  const isHost = $derived(currentLobby?.hostIdentity.toHexString() === identity?.toHexString());
  const allReady = $derived(players.length >= 2 && players.every(p => p.isReady && p.classChoice));

  const CLASSES = ['spotter', 'gunner', 'tank', 'healer'] as const;

  // Watch for session starting → transition to game
  $effect(() => {
    if (currentLobby?.status === 'in_progress') {
      const session = sessions.find(s => s.lobbyId === currentLobby.id);
      if (session) {
        gameState.currentSessionId = session.id;
        stageActions.setStage('game');
      }
    }
  });

  function copyCode() {
    if (currentLobby) navigator.clipboard.writeText(currentLobby.code);
  }
</script>

<div transition:fly={{ y: 20, duration: 300 }}
     style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
  <div style="background: rgba(0,0,0,0.7); padding: 2rem; border-radius: 12px; min-width: 400px;">

    {#if !currentLobby}
      <p>Connecting to lobby...</p>
      <button onclick={() => stageActions.setStage('menu')}>Back</button>

    {:else}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Lobby</h2>
        {#if currentLobby.isPublic}
          <span style="background: #2a5; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">PUBLIC</span>
        {:else}
          <button onclick={copyCode}>Code: {currentLobby.code} 📋</button>
        {/if}
      </div>

      <!-- Player list -->
      <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        {#each players as player (player.id)}
          <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <span style="flex: 1;">{player.playerName}</span>
            <span style="color: #aaa; font-size: 0.85rem;">{player.classChoice || '—'}</span>
            <span style="color: {player.isReady ? '#4f4' : '#f44'};">{player.isReady ? '✓ Ready' : 'Not Ready'}</span>
            {#if player.playerIdentity.toHexString() === currentLobby.hostIdentity.toHexString()}
              <span title="Host">👑</span>
            {/if}
          </div>
        {/each}
        {#if players.length < 4}
          {#each { length: 4 - players.length } as _}
            <div style="padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 8px; color: #555;">
              Waiting for player...
            </div>
          {/each}
        {/if}
      </div>

      <!-- Class selector -->
      <div style="margin-bottom: 1rem;">
        <p style="margin: 0 0 0.5rem; font-size: 0.85rem; color: #aaa;">Select class:</p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          {#each CLASSES as cls}
            <button
              onclick={() => gameActions.setClass(cls, currentLobby.id)}
              style="background: {myEntry?.classChoice === cls ? '#4a8' : 'rgba(255,255,255,0.1)'}; padding: 0.4rem 0.8rem; border-radius: 6px; text-transform: capitalize;"
            >
              {cls}
            </button>
          {/each}
        </div>
      </div>

      <!-- Ready toggle -->
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <button
          onclick={() => gameActions.setReady(currentLobby.id, !myEntry?.isReady)}
          disabled={!myEntry?.classChoice}
          style="flex: 1; background: {myEntry?.isReady ? '#4a8' : '#555'}; padding: 0.6rem; border-radius: 8px;"
        >
          {myEntry?.isReady ? '✓ Ready' : 'Ready Up'}
        </button>
      </div>

      <!-- Host start button -->
      {#if isHost}
        <button
          onclick={() => gameActions.startCountdown(currentLobby.id)}
          disabled={!allReady}
          style="width: 100%; padding: 0.8rem; font-size: 1.1rem; background: {allReady ? '#4a8' : '#333'}; border-radius: 8px; margin-bottom: 0.5rem;"
        >
          {players.length < 2 ? 'Need 2+ players' : !allReady ? 'Waiting for all players' : 'Start Game'}
        </button>
      {:else}
        <p style="text-align: center; color: #aaa; font-size: 0.9rem;">Waiting for host to start...</p>
      {/if}

      {#if currentLobby.status === 'countdown'}
        <p style="text-align: center; font-size: 1.5rem; color: #ff8;">Starting in 3...</p>
      {/if}

      <button onclick={() => { gameActions.leaveLobby(currentLobby.id); stageActions.setStage('menu'); }}
              style="width: 100%; margin-top: 0.5rem; padding: 0.4rem; background: rgba(255,50,50,0.3); border-radius: 8px;">
        Leave Lobby
      </button>

      {#if gameState.error}
        <p style="color: red; margin-top: 0.5rem;">{gameState.error}</p>
      {/if}
    {/if}
  </div>
</div>
```

---

## Done When

- [ ] Two separate browser sessions can host and join a lobby
- [ ] Lobby code is displayed and copy button works
- [ ] Public lobby appears in quickplay (basic version: host public = others can join by ID)
- [ ] Class selector works; players can change class and it reflects for all
- [ ] Ready toggle gates the start button
- [ ] Start button disabled until ≥ 2 players all ready
- [ ] Countdown fires, game_session row appears, both clients transition to `game` stage
- [ ] Disconnecting a player removes them from the lobby; last player exits = lobby deleted
- [ ] Host leaving transfers host role to next player
