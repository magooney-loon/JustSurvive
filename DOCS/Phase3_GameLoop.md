# Phase 3 — Core Game Loop

**Goal:** The game runs. Players move through a 3D forest, enemies spawn and chase, the day/night cycle advances, players can die and be eliminated. No class abilities yet — just the survival core.

---

## SpacetimeDB Backend

### New Tables (add to `schema.ts`)

```typescript
export const Enemy = table({
  name: 'enemy',
  public: true,
  indexes: [
    { name: 'enemy_session_id', algorithm: 'btree', columns: ['sessionId'] },
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

// Scheduled: enemy tick (movement + damage)
export const EnemyTickJob = table({
  name: 'enemy_tick_job',
  scheduled: () => enemy_tick,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Scheduled: spawn a new enemy
export const EnemySpawnJob = table({
  name: 'enemy_spawn_job',
  scheduled: () => spawn_enemy,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Scheduled: advance day/night phase
export const DayPhaseJob = table({
  name: 'day_phase_job',
  scheduled: () => advance_day_phase,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Scheduled: eliminate a downed player after 30s
export const EliminateJob = table({
  name: 'eliminate_job',
  scheduled: () => eliminate_downed,
  indexes: [
    { name: 'eliminate_job_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
  targetIdentity: t.identity(),
});
```

Update schema export to include new tables.

---

### New Reducers (`index.ts`)

#### Player Movement

```typescript
export const move_player = spacetimedb.reducer({
  sessionId: t.u64(),
  posX: t.i64(),
  posY: t.i64(),
  posZ: t.i64(),
  isSprinting: t.bool(),
}, (ctx, { sessionId, posX, posY, posZ, isSprinting }) => {
  // Find this player's state
  let ps: typeof PlayerState.rowType | undefined;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.status !== 'alive') return;

  // Stamina drain/regen (1000 units = 1 stamina point; called at 15Hz)
  const SPRINT_DRAIN = 3n;  // per tick
  const WALK_REGEN = 2n;    // per tick
  let newStamina = ps.stamina;
  if (isSprinting && ps.stamina > 0n) {
    newStamina = ps.stamina > SPRINT_DRAIN ? ps.stamina - SPRINT_DRAIN : 0n;
  } else if (!isSprinting && ps.stamina < ps.maxStamina) {
    newStamina = ps.stamina + WALK_REGEN > ps.maxStamina ? ps.maxStamina : ps.stamina + WALK_REGEN;
  }

  // Score: distance milestone (1 unit forward = 1 score, simplified)
  const distDelta = posZ < ps.posZ ? ps.posZ - posZ : 0n; // moving in -Z = forward
  const newScore = ps.score + distDelta / 1000n;

  ctx.db.playerState.id.update({ ...ps, posX, posY, posZ, stamina: newStamina, score: newScore });
});
```

#### Enemy Tick (movement + melee damage)

```typescript
const ENEMY_BASE_SPEED: Record<string, bigint> = {
  basic: 40n,    // world units per second * 1000 (fixed-point)
  fast: 70n,
  brute: 25n,
  spitter: 20n,
};
const MELEE_RANGE = 2000n;   // 2 world units in fixed-point
const TICK_MS = 100n;        // 100ms tick
const TICK_SECS_FP = 100n;   // tick fraction * 1000 for fixed-point arithmetic

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
    // Find nearest alive player
    let nearest = players[0];
    let nearestDist = BigInt(Number.MAX_SAFE_INTEGER);
    for (const p of players) {
      const dx = p.posX - enemy.posX;
      const dz = p.posZ - enemy.posZ;
      const dist = dx * dx + dz * dz; // squared distance (avoid sqrt)
      if (dist < nearestDist) { nearest = p; nearestDist = dist; }
    }
    if (!nearest) continue;

    const dx = nearest.posX - enemy.posX;
    const dz = nearest.posZ - enemy.posZ;
    const dist = nearestDist; // still squared

    // Melee range check (squared)
    if (dist <= MELEE_RANGE * MELEE_RANGE && !enemy.isDazed) {
      // Apply damage to player
      const damage = enemy.enemyType === 'brute' ? 30n : 15n;
      apply_player_damage(ctx, arg.sessionId, nearest, damage);
    } else if (!enemy.isDazed) {
      // Move toward player
      const speed = (ENEMY_BASE_SPEED[enemy.enemyType] ?? 40n) * enemy.speedMultiplier / 100n;
      const moveAmount = speed * TICK_MS / 1000n;

      // Normalize direction (simplified integer approximation)
      const magnitude = bigintSqrt(dx * dx + dz * dz);
      if (magnitude > 0n) {
        const newX = enemy.posX + dx * moveAmount / magnitude;
        const newZ = enemy.posZ + dz * moveAmount / magnitude;
        ctx.db.enemy.id.update({ ...enemy, posX: newX, posZ: newZ });
      }
    } else {
      // Check if daze expired
      if (enemy.dazedUntil && ctx.timestamp.microsSinceUnixEpoch >= enemy.dazedUntil.microsSinceUnixEpoch) {
        ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
      }
    }
  }

  // Reschedule next tick
  const nextTick = ctx.timestamp.microsSinceUnixEpoch + TICK_MS * 1000n;
  ctx.db.enemyTickJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextTick),
    sessionId: arg.sessionId,
  });
});

function apply_player_damage(ctx: any, sessionId: bigint, ps: any, damage: bigint) {
  const newHp = ps.hp > damage ? ps.hp - damage : 0n;
  if (newHp <= 0n && ps.status === 'alive') {
    ctx.db.playerState.id.update({ ...ps, hp: 0n, status: 'downed' });
    // Schedule elimination after 30 seconds
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

// Integer square root (Newton's method) — needed for deterministic distance calcs
function bigintSqrt(n: bigint): bigint {
  if (n < 0n) return 0n;
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}
```

#### Enemy Spawning

```typescript
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

  // Deterministic enemy type selection using timestamp as seed
  const seed = Number(ctx.timestamp.microsSinceUnixEpoch % 100n);
  let cumWeight = 0;
  let enemyType = 'basic';
  for (const { type, weight } of ENEMY_WEIGHTS) {
    cumWeight += weight;
    if (seed < cumWeight) { enemyType = type; break; }
  }

  // Spawn behind the player cluster (simplified: spawn at fixed offset behind last player)
  const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)]
    .filter(p => p.status === 'alive');
  if (players.length === 0) return;

  // Average player position
  const avgZ = players.reduce((s, p) => s + p.posZ, 0n) / BigInt(players.length);
  const spawnX = (ctx.timestamp.microsSinceUnixEpoch % 30_000n) - 15_000n; // random X offset
  const spawnZ = avgZ + 20_000n; // 20 units behind players

  // Speed multiplier scales up with cycle number
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

  // Schedule next spawn — interval decreases with cycle number (more enemies over time)
  const baseInterval = 8_000_000n; // 8 seconds
  const minInterval = 2_000_000n;  // 2 seconds minimum
  const interval = baseInterval - session.cycleNumber * 500_000n;
  const nextSpawn = ctx.timestamp.microsSinceUnixEpoch + (interval < minInterval ? minInterval : interval);
  ctx.db.enemySpawnJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextSpawn),
    sessionId: arg.sessionId,
  });
});
```

#### Day/Night Phase Advancement

```typescript
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

  // Schedule next phase in 60 seconds
  const nextAdvance = ctx.timestamp.microsSinceUnixEpoch + 60_000_000n;
  ctx.db.dayPhaseJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextAdvance),
    sessionId: arg.sessionId,
  });
});
```

#### Elimination and End Game

```typescript
export const eliminate_downed = spacetimedb.reducer({
  arg: EliminateJob.rowType,
}, (ctx, { arg }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
    if (p.playerIdentity.isEqual(arg.targetIdentity)) { ps = p; break; }
  }
  if (!ps || ps.status !== 'downed') return; // already revived

  ctx.db.playerState.id.update({ ...ps, status: 'eliminated' });

  // Check if all players are eliminated
  const remaining = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)]
    .filter(p => p.status === 'alive' || p.status === 'downed');

  if (remaining.length === 0) {
    end_session(ctx, arg.sessionId);
  }
});

function end_session(ctx: any, sessionId: bigint) {
  const session = ctx.db.gameSession.id.find(sessionId);
  if (!session) return;

  ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });

  const lobby = ctx.db.lobby.id.find(session.lobbyId);
  if (lobby) ctx.db.lobby.id.update({ ...lobby, status: 'game_over' });
}
```

**Update `fire_start_game`** to kick off the game loop after creating player states:

```typescript
// After inserting all player_state rows, schedule the recurring jobs:

// Enemy tick starts immediately
const now = ctx.timestamp.microsSinceUnixEpoch;
ctx.db.enemyTickJob.insert({
  scheduledId: 0n,
  scheduledAt: ScheduleAt.time(now + 100_000n), // 100ms
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
```

---

## Frontend

### `src/localGameState.svelte.ts` — local player input & prediction

```typescript
// Separate from game.svelte.ts — handles frame-by-frame input
export type InputState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
};

const input = $state<InputState>({ forward: false, back: false, left: false, right: false, sprint: false });
const localPos = $state({ x: 0, y: 0, z: 0 });
const localVelocity = $state({ x: 0, z: 0 });

export { input, localPos, localVelocity };

// Class speed config
const CLASS_SPEED: Record<string, { walk: number; sprint: number }> = {
  spotter:  { walk: 5, sprint: 9 },
  gunner:   { walk: 4.5, sprint: 7.5 },
  tank:     { walk: 2.5, sprint: 3.5 },
  healer:   { walk: 5, sprint: 8.5 },
};

export function updateLocalMovement(dt: number, playerClass: string, hasStamina: boolean) {
  const speeds = CLASS_SPEED[playerClass] ?? CLASS_SPEED.gunner;
  const isSprinting = input.sprint && hasStamina;
  const speed = isSprinting ? speeds.sprint : speeds.walk;

  let vx = 0, vz = 0;
  if (input.forward) vz -= 1;
  if (input.back)    vz += 1;
  if (input.left)    vx -= 1;
  if (input.right)   vx += 1;

  const len = Math.sqrt(vx * vx + vz * vz);
  if (len > 0) { vx /= len; vz /= len; }

  localPos.x += vx * speed * dt;
  localPos.z += vz * speed * dt;
  localVelocity.x = vx * speed;
  localVelocity.z = vz * speed;
}
```

### `src/lib/InputHandler.svelte` — keyboard/gamepad input

```svelte
<script lang="ts">
  import { input } from '../localGameState.svelte.js';

  const keyMap: Record<string, keyof typeof input> = {
    'KeyW': 'forward', 'ArrowUp': 'forward',
    'KeyS': 'back',    'ArrowDown': 'back',
    'KeyA': 'left',    'ArrowLeft': 'left',
    'KeyD': 'right',   'ArrowRight': 'right',
    'ShiftLeft': 'sprint', 'ShiftRight': 'sprint',
  };

  function onKeyDown(e: KeyboardEvent) {
    const key = keyMap[e.code];
    if (key) input[key] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = keyMap[e.code];
    if (key) input[key] = false;
  }
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />
```

Mount `<InputHandler />` in `App.svelte` when `stageState.currentStage === 'game'`.

### `src/lib/GameStage.svelte` (Phase 3 implementation)

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';
  import { localPos, localVelocity, input, updateLocalMovement } from '../localGameState.svelte.js';
  import PlayerEntity from './PlayerEntity.svelte';
  import EnemyEntity from './EnemyEntity.svelte';
  import DayNightSky from './DayNightSky.svelte';

  const { connection: conn, identity } = useSpacetimeDB();
  const [players] = useTable(tables.playerState);
  const [enemies] = useTable(tables.enemy);
  const [sessions] = useTable(tables.gameSession);

  const session = $derived(sessions.find(s => s.id === gameState.currentSessionId));
  const myState = $derived(players.find(p => p.playerIdentity.toHexString() === identity?.toHexString() && p.sessionId === gameState.currentSessionId));
  const otherPlayers = $derived(players.filter(p => p.playerIdentity.toHexString() !== identity?.toHexString() && p.sessionId === gameState.currentSessionId));
  const liveEnemies = $derived(enemies.filter(e => e.sessionId === gameState.currentSessionId && e.isAlive));

  // Send position to server at 15Hz
  let sendTimer = 0;
  const SEND_INTERVAL = 1 / 15;

  useTask((dt) => {
    if (!myState || myState.status !== 'alive') return;

    // Local movement prediction
    const hasStamina = myState.stamina > 0n;
    updateLocalMovement(dt, myState.classChoice, hasStamina);

    // Send to server on interval
    sendTimer += dt;
    if (sendTimer >= SEND_INTERVAL) {
      sendTimer = 0;
      conn?.reducers.movePlayer({
        sessionId: gameState.currentSessionId!,
        posX: BigInt(Math.round(localPos.x * 1000)),
        posY: BigInt(Math.round(localPos.y * 1000)),
        posZ: BigInt(Math.round(localPos.z * 1000)),
        isSprinting: input.sprint && hasStamina,
      });
    }
  });
</script>

<DayNightSky phase={session?.dayPhase ?? 'sunset'} />

<!-- Local player (predicted position) -->
{#if myState}
  <T.Group position={[localPos.x, localPos.y, localPos.z]}>
    <!-- Placeholder mesh — replace with character model in art pass -->
    <T.Mesh>
      <T.CapsuleGeometry args={[0.4, 1.2]} />
      <T.MeshStandardMaterial color="#4a8" />
    </T.Mesh>
  </T.Group>
{/if}

<!-- Remote players (server position) -->
{#each otherPlayers as player (player.id)}
  <PlayerEntity {player} />
{/each}

<!-- Enemies (interpolated) -->
{#each liveEnemies as enemy (enemy.id)}
  <EnemyEntity {enemy} />
{/each}
```

### `src/lib/DayNightSky.svelte`

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';

  type Props = { phase: string };
  let { phase }: Props = $props();

  const PHASE_COLORS = {
    sunset:     { sky: [1.0, 0.5, 0.2] as [number,number,number], ambient: 0.8, sun: 1.2 },
    dusk:       { sky: [0.6, 0.3, 0.4] as [number,number,number], ambient: 0.5, sun: 0.6 },
    twilight:   { sky: [0.15, 0.1, 0.3] as [number,number,number], ambient: 0.25, sun: 0.2 },
    night:      { sky: [0.02, 0.02, 0.08] as [number,number,number], ambient: 0.08, sun: 0.05 },
    deep_night: { sky: [0.01, 0.01, 0.04] as [number,number,number], ambient: 0.03, sun: 0.01 },
  };

  const current = $derived(PHASE_COLORS[phase as keyof typeof PHASE_COLORS] ?? PHASE_COLORS.sunset);
</script>

<T.AmbientLight intensity={current.ambient} />
<T.DirectionalLight
  position={[50, 80, 50]}
  intensity={current.sun}
  color={`rgb(${Math.round(current.sky[0]*255)},${Math.round(current.sky[1]*255)},${Math.round(current.sky[2]*255)})`}
/>
```

### `src/lib/PlayerEntity.svelte`

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import type { PlayerState } from '../module_bindings/index.js';

  type Props = { player: PlayerState };
  let { player }: Props = $props();

  // Interpolated position
  let displayX = $state(Number(player.posX) / 1000);
  let displayY = $state(Number(player.posY) / 1000);
  let displayZ = $state(Number(player.posZ) / 1000);

  const targetX = $derived(Number(player.posX) / 1000);
  const targetY = $derived(Number(player.posY) / 1000);
  const targetZ = $derived(Number(player.posZ) / 1000);

  const CLASS_COLORS: Record<string, string> = {
    spotter: '#4af',
    gunner:  '#f84',
    tank:    '#8a4',
    healer:  '#f4a',
  };

  useTask((dt) => {
    const LERP = 1 - Math.pow(0.001, dt); // smooth follow
    displayX += (targetX - displayX) * LERP;
    displayY += (targetY - displayY) * LERP;
    displayZ += (targetZ - displayZ) * LERP;
  });
</script>

{#if player.status !== 'eliminated'}
  <T.Group position={[displayX, displayY, displayZ]}>
    <T.Mesh>
      <T.CapsuleGeometry args={[0.4, 1.2]} />
      <T.MeshStandardMaterial
        color={player.status === 'downed' ? '#555' : CLASS_COLORS[player.classChoice] ?? '#fff'}
        opacity={player.status === 'downed' ? 0.5 : 1}
        transparent={player.status === 'downed'}
      />
    </T.Mesh>
  </T.Group>
{/if}
```

### `src/lib/EnemyEntity.svelte`

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import type { Enemy } from '../module_bindings/index.js';

  type Props = { enemy: Enemy };
  let { enemy }: Props = $props();

  let displayX = $state(Number(enemy.posX) / 1000);
  let displayZ = $state(Number(enemy.posZ) / 1000);

  const targetX = $derived(Number(enemy.posX) / 1000);
  const targetZ = $derived(Number(enemy.posZ) / 1000);

  const ENEMY_COLORS: Record<string, string> = {
    basic:   '#c33',
    fast:    '#f73',
    brute:   '#833',
    spitter: '#3c3',
  };

  useTask((dt) => {
    const LERP = 1 - Math.pow(0.0001, dt);
    displayX += (targetX - displayX) * LERP;
    displayZ += (targetZ - displayZ) * LERP;
  });
</script>

<T.Group position={[displayX, 0, displayZ]}>
  <T.Mesh>
    <T.BoxGeometry args={[0.8, 1.5, 0.6]} />
    <T.MeshStandardMaterial color={ENEMY_COLORS[enemy.enemyType] ?? '#c33'} />
  </T.Mesh>
</T.Group>
```

### Camera Follow Mode (`Camera.svelte`)

Add a follow mode that activates when `stageState.currentStage === 'game'`:

```typescript
// In Camera.svelte, inside the existing useTask or a new one:
import { stageState } from '../stage.svelte.js';
import { localPos } from '../localGameState.svelte.js';

useTask(() => {
  if (!controls || stageState.currentStage !== 'game') return;
  const OFFSET = { x: 0, y: 6, z: 12 };
  controls.setTarget(localPos.x, localPos.y + 1, localPos.z, false);
  controls.setPosition(localPos.x + OFFSET.x, localPos.y + OFFSET.y, localPos.z + OFFSET.z, false);
});
```

### `src/lib/GameHud.svelte` (Phase 3 implementation)

```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';
  import { stageActions } from '../stage.svelte.js';

  const { identity } = useSpacetimeDB();
  const [players] = useTable(tables.playerState);
  const [sessions] = useTable(tables.gameSession);

  const session = $derived(sessions.find(s => s.id === gameState.currentSessionId));
  const myState = $derived(players.find(p =>
    p.playerIdentity.toHexString() === identity?.toHexString() &&
    p.sessionId === gameState.currentSessionId
  ));
  const teammates = $derived(players.filter(p =>
    p.playerIdentity.toHexString() !== identity?.toHexString() &&
    p.sessionId === gameState.currentSessionId
  ));

  const DAY_PHASE_LABELS: Record<string, string> = {
    sunset: '🌅 Sunset', dusk: '🌆 Dusk', twilight: '🌇 Twilight',
    night: '🌙 Night', deep_night: '🌑 Deep Night',
  };

  // Watch for game over
  $effect(() => {
    if (session?.status === 'finished') {
      stageActions.setStage('game_over');
    }
  });

  function hpPercent(hp: bigint, max: bigint) {
    return max > 0n ? Number(hp * 100n / max) : 0;
  }
</script>

<div transition:fly={{ x: -20, duration: 300 }}>
  <!-- Day phase indicator -->
  <div style="position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
              background: rgba(0,0,0,0.6); padding: 0.4rem 1rem; border-radius: 20px;">
    {DAY_PHASE_LABELS[session?.dayPhase ?? 'sunset'] ?? ''}
    {#if session?.cycleNumber && session.cycleNumber > 0n}
      <span style="margin-left: 0.5rem; color: #ff8;">Day {Number(session.cycleNumber) + 1}</span>
    {/if}
  </div>

  <!-- Local player HP & stamina -->
  {#if myState}
    <div style="position: absolute; bottom: 2rem; left: 2rem; width: 200px;">
      <div style="margin-bottom: 0.3rem;">
        <div style="font-size: 0.75rem; color: #aaa; margin-bottom: 2px;">HP</div>
        <div style="background: #333; border-radius: 4px; height: 12px;">
          <div style="background: #e44; border-radius: 4px; height: 100%; width: {hpPercent(myState.hp, myState.maxHp)}%;
                      transition: width 0.2s;"></div>
        </div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: #aaa; margin-bottom: 2px;">Stamina</div>
        <div style="background: #333; border-radius: 4px; height: 8px;">
          <div style="background: #4af; border-radius: 4px; height: 100%; width: {hpPercent(myState.stamina, myState.maxStamina)}%;
                      transition: width 0.1s;"></div>
        </div>
      </div>
      <div style="margin-top: 0.4rem; font-size: 0.85rem; color: #ff8;">
        Score: {Number(myState.score).toLocaleString()}
      </div>
    </div>
  {/if}

  <!-- Teammate status -->
  <div style="position: absolute; top: 1rem; right: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
    {#each teammates as p (p.id)}
      <div style="background: rgba(0,0,0,0.6); padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem;
                  color: {p.status === 'downed' ? '#f44' : p.status === 'eliminated' ? '#444' : '#ccc'};">
        <span style="text-transform: capitalize;">{p.classChoice}</span>
        {#if p.status === 'downed'}
          <span style="color: #f44; margin-left: 0.4rem;">⚠ DOWNED</span>
        {:else if p.status === 'eliminated'}
          <span style="color: #444; margin-left: 0.4rem;">✕ OUT</span>
        {:else}
          <span style="display: inline-block; width: 60px; height: 6px; background: #333; border-radius: 3px; margin-left: 0.4rem; vertical-align: middle;">
            <span style="display: block; height: 100%; background: #e44; border-radius: 3px; width: {hpPercent(p.hp, p.maxHp)}%;"></span>
          </span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Downed state overlay -->
  {#if myState?.status === 'downed'}
    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                background: rgba(0,0,0,0.5); pointer-events: none;">
      <div style="text-align: center; color: #f44;">
        <h2 style="font-size: 2rem; margin: 0;">YOU'RE DOWN</h2>
        <p>Waiting for Healer... (30s)</p>
      </div>
    </div>
  {/if}
</div>
```

---

## Done When

- [ ] Players move through the 3D space, camera follows local player
- [ ] Remote player positions update and interpolate smoothly
- [ ] Enemies spawn and visually move toward players
- [ ] Enemy melee deals damage; HP bars update in HUD
- [ ] Running out of HP triggers downed state, 30s timer starts
- [ ] All players downed → session ends, all clients see `game_over` stage
- [ ] Day/night phase advances every 60s, sky color changes
- [ ] Stamina drains on sprint, recharges on walk
