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

const Enemy = table({
  name: 'enemy',
  public: true,
  indexes: [
    { name: 'enemy_session_id', accessor: 'enemy_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  enemyType: t.string(),        // 'basic' | 'fast' | 'brute' | 'spitter'
  hp: t.u64(),
  maxHp: t.u64(),
  posX: t.i64(),
  posZ: t.i64(),
  speedMultiplier: t.u64(),     // fixed-point: 100 = 1.0x, 110 = 1.1x
  isDazed: t.bool(),
  dazedUntil: t.timestamp().optional(),
  isAlive: t.bool(),
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

// Scheduled: enemy tick (movement + damage)
const EnemyTickJob = table({
  name: 'enemy_tick_job',
  scheduled: (): any => enemy_tick,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Scheduled: spawn a new enemy
const EnemySpawnJob = table({
  name: 'enemy_spawn_job',
  scheduled: (): any => spawn_enemy,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Scheduled: advance day/night phase
const DayPhaseJob = table({
  name: 'day_phase_job',
  scheduled: (): any => advance_day_phase,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Scheduled: eliminate a downed player after 30s
const EliminateJob = table({
  name: 'eliminate_job',
  scheduled: (): any => eliminate_downed,
  indexes: [
    { name: 'eliminate_job_session', accessor: 'eliminate_job_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
  targetIdentity: t.identity(),
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  lobby: Lobby,
  lobbyPlayer: LobbyPlayer,
  gameSession: GameSession,
  playerState: PlayerState,
  enemy: Enemy,
  lobbyCountdown: LobbyCountdown,
  enemyTickJob: EnemyTickJob,
  enemySpawnJob: EnemySpawnJob,
  dayPhaseJob: DayPhaseJob,
  eliminateJob: EliminateJob,
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

// Integer square root (Newton's method) — deterministic distance calcs
function bigintSqrt(n: bigint): bigint {
  if (n < 0n) return 0n;
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

function apply_player_damage(ctx: any, sessionId: bigint, ps: any, damage: bigint) {
  const newHp = ps.hp > damage ? ps.hp - damage : 0n;
  if (newHp <= 0n && ps.status === 'alive') {
    ctx.db.playerState.id.update({ ...ps, hp: 0n, status: 'downed' });
    const eliminateAt = ctx.timestamp.microsSinceUnixEpoch + 30_000_000n;
    ctx.db.eliminateJob.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(eliminateAt),
      sessionId,
      targetIdentity: ps.playerIdentity,
    });
  } else {
    ctx.db.playerState.id.update({ ...ps, hp: newHp });
  }
}

function end_session(ctx: any, sessionId: bigint) {
  const session = ctx.db.gameSession.id.find(sessionId);
  if (!session) return;
  ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });

  // Delete enemies immediately — not needed for game over screen
  for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
    ctx.db.enemy.id.delete(e.id);
  }
  // Note: PlayerState rows are kept until next game starts (game over screen needs them)

  // Reset lobby so players can start a new game immediately
  const lobby = ctx.db.lobby.id.find(session.lobbyId);
  if (lobby) {
    ctx.db.lobby.id.update({ ...lobby, status: 'waiting' });
    for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)) {
      ctx.db.lobbyPlayer.id.update({ ...p, isReady: false });
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
  if (!found) return;

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

  // Clean up previous session(s) for this lobby
  for (const oldSession of ctx.db.gameSession.game_session_lobby_id.filter(arg.lobbyId)) {
    for (const p of ctx.db.playerState.player_state_session_id.filter(oldSession.id)) {
      ctx.db.playerState.id.delete(p.id);
    }
    ctx.db.gameSession.id.delete(oldSession.id);
  }

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

  // Schedule game loop jobs
  const now = ctx.timestamp.microsSinceUnixEpoch;

  // Enemy tick starts immediately
  ctx.db.enemyTickJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(now + 100_000n),
    sessionId: session.id,
  });

  // First enemy spawn after 5 seconds
  ctx.db.enemySpawnJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(now + 5_000_000n),
    sessionId: session.id,
  });

  // First phase advance after 60 seconds
  ctx.db.dayPhaseJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(now + 60_000_000n),
    sessionId: session.id,
  });
});

// ─── Phase 3 Reducers ─────────────────────────────────────────────────────────

export const move_player = spacetimedb.reducer({
  sessionId: t.u64(),
  posX: t.i64(),
  posY: t.i64(),
  posZ: t.i64(),
  isSprinting: t.bool(),
}, (ctx, { sessionId, posX, posY, posZ, isSprinting }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.status !== 'alive') return;

  const SPRINT_DRAIN = 3n;
  const WALK_REGEN = 2n;
  let newStamina = ps.stamina;
  if (isSprinting && ps.stamina > 0n) {
    newStamina = ps.stamina > SPRINT_DRAIN ? ps.stamina - SPRINT_DRAIN : 0n;
  } else if (!isSprinting && ps.stamina < ps.maxStamina) {
    newStamina = ps.stamina + WALK_REGEN > ps.maxStamina ? ps.maxStamina : ps.stamina + WALK_REGEN;
  }

  const distDelta = posZ < ps.posZ ? ps.posZ - posZ : 0n;
  const newScore = ps.score + distDelta / 1000n;

  ctx.db.playerState.id.update({ ...ps, posX, posY, posZ, stamina: newStamina, score: newScore });
});

// Fixed-point speed: moveAmount = speed * TICK_MS(100n) / 1000n = speed/10
// speed = desiredUnitsPerSec * 1000n (e.g. 3 units/sec = 3000n)
const ENEMY_BASE_SPEED: Record<string, bigint> = {
  basic: 3000n,    // 3 units/sec
  fast: 5000n,     // 5 units/sec (near sprint speed)
  brute: 2000n,    // 2 units/sec (slow tank)
  spitter: 1500n,  // 1.5 units/sec (ranged, slow)
};
const MELEE_RANGE = 2000n;
const TICK_MS = 100n;

export const enemy_tick = spacetimedb.reducer({
  arg: EnemyTickJob.rowType,
}, (ctx, { arg }) => {
  const session = ctx.db.gameSession.id.find(arg.sessionId);
  if (!session || session.status !== 'active') return;

  const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)]
    .filter(p => p.status === 'alive');

  const enemies = [...ctx.db.enemy.enemy_session_id.filter(arg.sessionId)]
    .filter(e => e.isAlive);

  for (const enemy of enemies) {
    if (players.length === 0) break;

    let nearest = players[0];
    let nearestDist = BigInt(Number.MAX_SAFE_INTEGER);
    for (const p of players) {
      const dx = p.posX - enemy.posX;
      const dz = p.posZ - enemy.posZ;
      const dist = dx * dx + dz * dz;
      if (dist < nearestDist) { nearest = p; nearestDist = dist; }
    }

    const dx = nearest.posX - enemy.posX;
    const dz = nearest.posZ - enemy.posZ;

    if (nearestDist <= MELEE_RANGE * MELEE_RANGE && !enemy.isDazed) {
      const damage = enemy.enemyType === 'brute' ? 3n : 1n;
      apply_player_damage(ctx, arg.sessionId, nearest, damage);
    } else if (!enemy.isDazed) {
      const speed = (ENEMY_BASE_SPEED[enemy.enemyType] ?? 3000n) * enemy.speedMultiplier / 100n;
      const moveAmount = speed * TICK_MS / 1000n;
      const magnitude = bigintSqrt(dx * dx + dz * dz);
      if (magnitude > 0n) {
        const newX = enemy.posX + dx * moveAmount / magnitude;
        const newZ = enemy.posZ + dz * moveAmount / magnitude;
        ctx.db.enemy.id.update({ ...enemy, posX: newX, posZ: newZ });
      }
    } else {
      if (enemy.dazedUntil && ctx.timestamp.microsSinceUnixEpoch >= enemy.dazedUntil.microsSinceUnixEpoch) {
        ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
      }
    }
  }

  const nextTick = ctx.timestamp.microsSinceUnixEpoch + TICK_MS * 1000n;
  ctx.db.enemyTickJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextTick),
    sessionId: arg.sessionId,
  });
});

const ENEMY_WEIGHTS = [
  { type: 'basic', weight: 60 },
  { type: 'fast', weight: 25 },
  { type: 'brute', weight: 10 },
  { type: 'spitter', weight: 5 },
];

const ENEMY_HP: Record<string, bigint> = {
  basic: 50n,
  fast: 25n,
  brute: 150n,
  spitter: 60n,
};

export const spawn_enemy = spacetimedb.reducer({
  arg: EnemySpawnJob.rowType,
}, (ctx, { arg }) => {
  const session = ctx.db.gameSession.id.find(arg.sessionId);
  if (!session || session.status !== 'active') return;

  const seed = Number(ctx.timestamp.microsSinceUnixEpoch % 100n);
  let cumWeight = 0;
  let enemyType = 'basic';
  for (const { type, weight } of ENEMY_WEIGHTS) {
    cumWeight += weight;
    if (seed < cumWeight) { enemyType = type; break; }
  }

  const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)]
    .filter(p => p.status === 'alive');
  if (players.length === 0) return;

  const avgZ = players.reduce((s, p) => s + p.posZ, 0n) / BigInt(players.length);
  const spawnX = (ctx.timestamp.microsSinceUnixEpoch % 30_000n) - 15_000n;
  const spawnZ = avgZ - 30_000n; // 30 units ahead of players (-Z = forward direction)

  const baseMultiplier = 100n + session.cycleNumber * 5n;

  ctx.db.enemy.insert({
    id: 0n,
    sessionId: arg.sessionId,
    enemyType,
    hp: ENEMY_HP[enemyType] ?? 50n,
    maxHp: ENEMY_HP[enemyType] ?? 50n,
    posX: spawnX,
    posZ: spawnZ,
    speedMultiplier: baseMultiplier,
    isDazed: false,
    dazedUntil: undefined,
    isAlive: true,
  });

  const baseInterval = 8_000_000n;
  const minInterval = 2_000_000n;
  const interval = baseInterval - session.cycleNumber * 500_000n;
  const nextSpawn = ctx.timestamp.microsSinceUnixEpoch + (interval < minInterval ? minInterval : interval);
  ctx.db.enemySpawnJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextSpawn),
    sessionId: arg.sessionId,
  });
});

const DAY_PHASES = ['sunset', 'dusk', 'twilight', 'night', 'deep_night'];

export const advance_day_phase = spacetimedb.reducer({
  arg: DayPhaseJob.rowType,
}, (ctx, { arg }) => {
  const session = ctx.db.gameSession.id.find(arg.sessionId);
  if (!session || session.status !== 'active') return;

  const currentIdx = DAY_PHASES.indexOf(session.dayPhase);
  const nextIdx = (currentIdx + 1) % DAY_PHASES.length;
  const nextPhase = DAY_PHASES[nextIdx];
  const newCycle = nextIdx === 0 ? session.cycleNumber + 1n : session.cycleNumber;

  ctx.db.gameSession.id.update({
    ...session,
    dayPhase: nextPhase,
    cycleNumber: newCycle,
    phaseStartedAt: ctx.timestamp,
  });

  const nextAdvance = ctx.timestamp.microsSinceUnixEpoch + 60_000_000n;
  ctx.db.dayPhaseJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextAdvance),
    sessionId: arg.sessionId,
  });
});

export const eliminate_downed = spacetimedb.reducer({
  arg: EliminateJob.rowType,
}, (ctx, { arg }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
    if (p.playerIdentity.isEqual(arg.targetIdentity)) { ps = p; break; }
  }
  if (!ps || ps.status !== 'downed') return;

  ctx.db.playerState.id.update({ ...ps, status: 'eliminated' });

  const remaining = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)]
    .filter(p => p.status === 'alive' || p.status === 'downed');

  if (remaining.length === 0) {
    end_session(ctx, arg.sessionId);
  }
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
