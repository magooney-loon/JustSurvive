import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

// ─── Tables ───────────────────────────────────────────────────────────────────

const Lobby = table({
  name: 'lobby',
  public: true,
  indexes: [
    { name: 'lobby_status', accessor: 'lobby_status', algorithm: 'btree', columns: ['status'] },
    { name: 'lobby_code', accessor: 'lobby_code', algorithm: 'btree', columns: ['code'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  hostIdentity: t.identity(),
  code: t.string(),
  isPublic: t.bool(),
  status: t.string(),           // 'waiting' | 'countdown' | 'in_progress' | 'game_over'
  playerCount: t.u64(),
  maxPlayers: t.u64(),
  createdAt: t.timestamp(),
});

const LobbyPlayer = table({
  name: 'lobby_player',
  public: true,
  indexes: [
    { name: 'lobby_player_lobby_id', accessor: 'lobby_player_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
    { name: 'lobby_player_identity', accessor: 'lobby_player_identity', algorithm: 'btree', columns: ['playerIdentity'] },
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

const GameSession = table({
  name: 'game_session',
  public: true,
  indexes: [
    { name: 'game_session_lobby_id', accessor: 'game_session_lobby_id', algorithm: 'btree', columns: ['lobbyId'] },
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

const PlayerState = table({
  name: 'player_state',
  public: true,
  indexes: [
    { name: 'player_state_session_id', accessor: 'player_state_session_id', algorithm: 'btree', columns: ['sessionId'] },
    { name: 'player_state_identity', accessor: 'player_state_identity', algorithm: 'btree', columns: ['playerIdentity'] },
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

// LobbyCountdown is defined before fire_start_game but references it lazily
const LobbyCountdown = table({
  name: 'lobby_countdown',
  scheduled: (): any => fire_start_game,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  lobbyId: t.u64(),
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  lobby: Lobby,
  lobbyPlayer: LobbyPlayer,
  gameSession: GameSession,
  playerState: PlayerState,
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

function classMaxHp(cls: string): bigint {
  return cls === 'tank' ? 150n : 100n;
}

function classMaxStamina(cls: string): bigint {
  if (cls === 'spotter') return 150n;
  if (cls === 'tank') return 200n;
  return 80n;
}

// ─── Reducers ─────────────────────────────────────────────────────────────────

export const create_lobby = spacetimedb.reducer({
  playerName: t.string(),
  classChoice: t.string(),
  isPublic: t.bool(),
}, (ctx, { playerName, classChoice, isPublic }) => {
  if (!playerName) throw new SenderError('playerName required');

  const lobby = ctx.db.lobby.insert({
    id: 0n,
    hostIdentity: ctx.sender,
    code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
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

  let found = false;
  for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) {
      ctx.db.lobbyPlayer.id.delete(p.id);
      found = true;
      break;
    }
  }
  if (!found) return; // already left — skip decrement

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

spacetimedb.clientConnected((_ctx) => {
  // Phase 2: create/update player presence
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
