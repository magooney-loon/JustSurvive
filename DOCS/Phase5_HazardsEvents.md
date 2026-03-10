# Phase 5 — Hazards, World Events & Procedural Depth

**Goal:** The forest feels dangerous and alive. Map hazards block and slow players. Branching paths with dead end risk. Fog rolls in unpredictably. Difficulty scales with survival time.

---

## SpacetimeDB Backend

### New Tables (add to `schema.ts`)

```typescript
export const Debris = table({
  name: 'debris',
  public: true,
  indexes: [
    { name: 'debris_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  posX: t.i64(),
  posZ: t.i64(),
  isCleared: t.bool(),
  clearedAt: t.timestamp().optional(),
});

// Fog event scheduling
export const FogStartJob = table({
  name: 'fog_start_job',
  scheduled: () => start_fog,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

export const FogEndJob = table({
  name: 'fog_end_job',
  scheduled: () => end_fog,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
});

// Acid pool cleanup job
export const AcidExpireJob = table({
  name: 'acid_expire_job',
  scheduled: () => cleanup_acid,
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
  poolId: t.u64(),
});
```

Also add to `GameSession` table:
```typescript
fogStartedAt: t.timestamp().optional(),
fogDurationSecs: t.u64().optional(),
```

### New Reducers (`index.ts`)

#### Fog Events

```typescript
export const start_fog = spacetimedb.reducer({
  arg: FogStartJob.rowType,
}, (ctx, { arg }) => {
  const session = ctx.db.gameSession.id.find(arg.sessionId);
  if (!session || session.status !== 'active') return;

  // Randomize fog duration 30-60 seconds (deterministic from timestamp)
  const durationSeed = ctx.timestamp.microsSinceUnixEpoch % 30_000_000n;
  const duration = 30_000_000n + durationSeed; // 30-60 seconds in microseconds

  ctx.db.gameSession.id.update({
    ...session,
    fogActive: true,
    fogStartedAt: ctx.timestamp,
    fogDurationSecs: duration / 1_000_000n,
  });

  // Schedule fog end
  const endAt = ctx.timestamp.microsSinceUnixEpoch + duration;
  ctx.db.fogEndJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(endAt),
    sessionId: arg.sessionId,
  });

  // Schedule next fog start: 90-180 seconds after this one ends
  const nextFogDelay = 90_000_000n + (ctx.timestamp.microsSinceUnixEpoch % 90_000_000n);
  const nextFogAt = endAt + nextFogDelay;
  ctx.db.fogStartJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextFogAt),
    sessionId: arg.sessionId,
  });
});

export const end_fog = spacetimedb.reducer({
  arg: FogEndJob.rowType,
}, (ctx, { arg }) => {
  const session = ctx.db.gameSession.id.find(arg.sessionId);
  if (!session) return;
  ctx.db.gameSession.id.update({
    ...session,
    fogActive: false,
    fogStartedAt: undefined,
    fogDurationSecs: undefined,
  });
});
```

Schedule first fog in `fire_start_game`, after the session is created:
```typescript
// First fog at 90-120 seconds into the game (randomized)
const firstFogDelay = 90_000_000n + (session.mapSeed % 30_000_000n);
ctx.db.fogStartJob.insert({
  scheduledId: 0n,
  scheduledAt: ScheduleAt.time(now + firstFogDelay),
  sessionId: session.id,
});
```

#### Debris Spawn (called by world generation events)

Debris is pre-placed at map generation based on `mapSeed` (client-side). The server stores which debris has been cleared so all clients agree:

```typescript
export const report_debris = spacetimedb.reducer({
  sessionId: t.u64(),
  posX: t.i64(),
  posZ: t.i64(),
  debrisId: t.u64(),  // client-computed deterministic ID from mapSeed + position
}, (ctx, { sessionId, posX, posZ, debrisId }) => {
  // First player to encounter debris reports it to server — idempotent insert
  if (ctx.db.debris.id.find(debrisId)) return; // already reported
  ctx.db.debris.insert({
    id: debrisId,
    sessionId,
    posX,
    posZ,
    isCleared: false,
    clearedAt: undefined,
  });
});

export const clear_debris = spacetimedb.reducer({
  sessionId: t.u64(),
  debrisId: t.u64(),
}, (ctx, { sessionId, debrisId }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.status !== 'alive') return;

  // Any combat class can clear (Gunner/Healer shoot it, Tank bashes it)
  const validClasses = ['gunner', 'healer', 'tank'];
  if (!validClasses.includes(ps.classChoice)) return;

  const debris = ctx.db.debris.id.find(debrisId);
  if (!debris || debris.isCleared) return;

  // Proximity check: 4 units
  const dx = ps.posX - debris.posX;
  const dz = ps.posZ - debris.posZ;
  if (dx * dx + dz * dz > 16_000_000n) throw new SenderError('Too far from debris');

  ctx.db.debris.id.update({ ...debris, isCleared: true, clearedAt: ctx.timestamp });
});
```

#### Acid Pool Cleanup

```typescript
export const cleanup_acid = spacetimedb.reducer({
  arg: AcidExpireJob.rowType,
}, (ctx, { arg }) => {
  const pool = ctx.db.acidPool.id.find(arg.poolId);
  if (!pool) return;
  if (ctx.timestamp.microsSinceUnixEpoch >= pool.expiresAt.microsSinceUnixEpoch) {
    ctx.db.acidPool.id.delete(arg.poolId);
  }
});
```

Schedule `cleanup_acid` immediately after inserting each acid pool in the Spitter spit logic (Phase 4):
```typescript
ctx.db.acidExpireJob.insert({
  scheduledId: 0n,
  scheduledAt: ScheduleAt.time(poolExpiry + 1_000_000n), // 1s after expiry to be safe
  sessionId: arg.sessionId,
  poolId: newPool.id,
});
```

#### Throw Flare

```typescript
export const throw_flare = spacetimedb.reducer({
  sessionId: t.u64(),
  targetX: t.i64(),
  targetZ: t.i64(),
}, (ctx, { sessionId, targetX, targetZ }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || !ps.hasFlare || ps.status !== 'alive') return;

  const FLARE_RADIUS = 8000n; // 8 units

  // Mark all enemies within radius
  const expiresAt = { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + 8_000_000n };
  for (const enemy of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
    if (!enemy.isAlive) continue;
    const dx = enemy.posX - targetX;
    const dz = enemy.posZ - targetZ;
    if (dx * dx + dz * dz <= FLARE_RADIUS * FLARE_RADIUS) {
      ctx.db.enemy.id.update({ ...enemy, isMarked: true, markedUntil: expiresAt });
      ctx.db.mark.insert({
        id: 0n,
        sessionId,
        sourceIdentity: ctx.sender,
        targetType: 'enemy',
        targetEnemyId: enemy.id,
        posX: undefined,
        posZ: undefined,
        expiresAt,
      });
    }
  }

  // Remove flare from inventory
  ctx.db.playerState.id.update({ ...ps, hasFlare: false });
});
```

#### Enemy Speed Bonus on Kill (update `attack_enemy` from Phase 4)

When an enemy is killed, increase `speedMultiplier` of all remaining live enemies by 10%:

```typescript
// In attack_enemy, after confirming kill:
if (newHp <= 0n) {
  ctx.db.enemy.id.update({ ...enemy, hp: 0n, isAlive: false });

  // +10% speed to all remaining live enemies
  for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
    if (e.isAlive && e.id !== enemyId) {
      ctx.db.enemy.id.update({ ...e, speedMultiplier: e.speedMultiplier + 10n });
    }
  }
  // ...
}
```

---

## Frontend — Procedural World

### Deterministic PRNG (`src/lib/prng.ts`)

```typescript
// Mulberry32 — fast, deterministic, good distribution
export function createRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(seed: bigint) {
  return createRng(Number(seed & 0xFFFFFFFFn));
}
```

### `src/lib/ForestWorld.svelte` — Procedural terrain

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';
  import { localPos } from '../localGameState.svelte.js';
  import { createSeededRng } from './prng.js';
  import HazardLayer from './HazardLayer.svelte';

  const [sessions] = useTable(tables.gameSession);
  const session = $derived(sessions.find(s => s.id === gameState.currentSessionId));
  const rng = $derived(session ? createSeededRng(session.mapSeed) : null);

  // Generate tree positions ahead of player (streaming chunks)
  const CHUNK_SIZE = 40;
  const VISIBLE_CHUNKS = 3;

  type TreeInstance = { x: number; z: number; scale: number; rot: number };

  function generateChunk(chunkZ: number, seed: bigint): TreeInstance[] {
    const chunkRng = createSeededRng(seed + BigInt(chunkZ * 1000));
    const trees: TreeInstance[] = [];
    const count = 30 + Math.floor(chunkRng() * 20);
    for (let i = 0; i < count; i++) {
      const x = (chunkRng() - 0.5) * 30; // spread on X
      const z = chunkRng() * CHUNK_SIZE + chunkZ * CHUNK_SIZE;
      // Keep path clear: skip trees within 4 units of X=0
      if (Math.abs(x) < 4) continue;
      trees.push({ x, z, scale: 0.8 + chunkRng() * 0.6, rot: chunkRng() * Math.PI * 2 });
    }
    return trees;
  }

  let currentChunkZ = $state(0);
  let chunks = $state<TreeInstance[][]>([]);

  $effect(() => {
    if (!session) return;
    // Initialize first chunks
    for (let i = 0; i < VISIBLE_CHUNKS; i++) {
      chunks[i] = generateChunk(i, session.mapSeed);
    }
  });

  useTask(() => {
    const playerChunk = Math.floor(localPos.z / -CHUNK_SIZE);
    if (playerChunk > currentChunkZ) {
      currentChunkZ = playerChunk;
      // Remove old chunk, add new one ahead
      chunks.shift();
      chunks.push(generateChunk(currentChunkZ + VISIBLE_CHUNKS, session?.mapSeed ?? 0n));
    }
  });
</script>

<!-- Ground plane -->
<T.Mesh position={[0, -0.5, localPos.z - 100]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
  <T.PlaneGeometry args={[40, 400]} />
  <T.MeshStandardMaterial color="#1a3a10" roughness={0.9} />
</T.Mesh>

<!-- Trees (instanced ideally, placeholder individual meshes) -->
{#each chunks.flat() as tree, i (i)}
  <T.Group position={[tree.x, 0, tree.z]} rotation={[0, tree.rot, 0]}>
    <!-- Trunk -->
    <T.Mesh position={[0, 2, 0]}>
      <T.CylinderGeometry args={[0.15, 0.25, 4, 6]} />
      <T.MeshStandardMaterial color="#5a3a1a" />
    </T.Mesh>
    <!-- Canopy -->
    <T.Mesh position={[0, 5, 0]} scale={tree.scale}>
      <T.ConeGeometry args={[1.5, 4, 7]} />
      <T.MeshStandardMaterial color="#1a5a1a" />
    </T.Mesh>
  </T.Group>
{/each}

<!-- Hazards (from same seed) -->
{#if session}
  <HazardLayer sessionId={session.id} mapSeed={session.mapSeed} playerZ={localPos.z} />
{/if}
```

### `src/lib/HazardLayer.svelte`

Generates and renders map hazards using the same deterministic seed:

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { createSeededRng } from './prng.js';
  import { input } from '../localGameState.svelte.js';

  type Props = { sessionId: bigint; mapSeed: bigint; playerZ: number };
  let { sessionId, mapSeed, playerZ }: Props = $props();

  const [debrisList] = useTable(tables.debris);
  const { connection: conn } = useSpacetimeDB();

  type Hazard = { type: 'bush' | 'stump' | 'pit' | 'debris'; x: number; z: number; id?: bigint };

  const HAZARD_CHUNK_SIZE = 40;
  const LOOK_AHEAD = 120; // units ahead of player

  // Generate hazards for visible range
  const hazards = $derived.by(() => {
    const result: Hazard[] = [];
    const startZ = Math.floor((playerZ - 20) / HAZARD_CHUNK_SIZE) * HAZARD_CHUNK_SIZE;
    const rng = createSeededRng(mapSeed + 99999n);

    for (let z = startZ; z > playerZ - LOOK_AHEAD; z -= HAZARD_CHUNK_SIZE) {
      const chunkRng = createSeededRng(mapSeed + BigInt(Math.abs(z / HAZARD_CHUNK_SIZE) * 7919));
      const count = 2 + Math.floor(chunkRng() * 4);
      for (let i = 0; i < count; i++) {
        const x = (chunkRng() - 0.5) * 14;
        const hz = z - chunkRng() * HAZARD_CHUNK_SIZE;
        const r = chunkRng();
        let type: Hazard['type'];
        if (r < 0.4) type = 'bush';
        else if (r < 0.6) type = 'stump';
        else if (r < 0.75) type = 'pit';
        else type = 'debris';

        const id = BigInt(Math.round(Math.abs(x * 100) + Math.abs(hz * 100))); // deterministic ID
        result.push({ type, x, z: hz, id });
      }
    }
    return result;
  });

  // Active (uncleared) debris
  const clearedDebrisIds = $derived(new Set(
    debrisList.filter(d => d.sessionId === sessionId && d.isCleared).map(d => d.id)
  ));

  const visibleHazards = $derived(hazards.filter(h => {
    if (h.type === 'debris' && h.id !== undefined && clearedDebrisIds.has(h.id)) return false;
    return true;
  }));
</script>

{#each visibleHazards as hazard (`${hazard.type}_${hazard.x}_${hazard.z}`)}
  {#if hazard.type === 'bush'}
    <!-- Dense bush: semi-transparent, slows players (slow enforced in move_player server-side) -->
    <T.Mesh position={[hazard.x, 0.6, hazard.z]}>
      <T.SphereGeometry args={[1.2, 6, 4]} />
      <T.MeshStandardMaterial color="#2d6a20" opacity={0.85} transparent />
    </T.Mesh>

  {:else if hazard.type === 'stump'}
    <T.Mesh position={[hazard.x, 0.2, hazard.z]}>
      <T.CylinderGeometry args={[0.4, 0.5, 0.4, 7]} />
      <T.MeshStandardMaterial color="#6a3a1a" />
    </T.Mesh>

  {:else if hazard.type === 'pit'}
    <T.Mesh position={[hazard.x, -0.8, hazard.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.CircleGeometry args={[1.5, 8]} />
      <T.MeshStandardMaterial color="#0a0a08" />
    </T.Mesh>

  {:else if hazard.type === 'debris' && hazard.id !== undefined}
    <!-- Debris blockage — solid, blocks path -->
    <T.Mesh position={[hazard.x, 0.6, hazard.z]}>
      <T.BoxGeometry args={[6, 1.2, 1]} />
      <T.MeshStandardMaterial color="#6a5a2a" />
    </T.Mesh>
  {/if}
{/each}
```

**Hazard collision** (for bush slow and pit damage) is enforced server-side in `move_player`. The server also receives the deterministic hazard positions from the same seed, so it can check proximity to hazards without storing every hazard in a table.

Add to `move_player` reducer:
```typescript
// Check bush: slow sprint (if in bush zone, treat isSprinting as false for stamina drain)
// Check pit: if player Y drops (client detects fall and sends posY change) → apply_player_damage

// Bush positions can be checked server-side using the same seeded generator:
// import { createSeededRng } from './utils.js' (add to backend)
// This keeps hazard state server-authoritative without storing all hazard rows
```

### `src/lib/FogLayer.svelte`

```svelte
<script lang="ts">
  import { T, useThrelte } from '@threlte/core';
  import { useTask } from '@threlte/core';
  import { useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';

  const { scene, renderer } = useThrelte();
  const [sessions] = useTable(tables.gameSession);

  const session = $derived(sessions.find(s => s.id === gameState.currentSessionId));
  const fogActive = $derived(session?.fogActive ?? false);

  let currentDensity = $state(0);
  const TARGET_DENSITY = 0.08; // when fog is active
  const CLEAR_DENSITY = 0.003;  // ambient atmospheric haze always present

  useTask((dt) => {
    const target = fogActive ? TARGET_DENSITY : CLEAR_DENSITY;
    currentDensity += (target - currentDensity) * Math.min(dt * 0.5, 1);
    if (scene.fog) {
      (scene.fog as any).density = currentDensity;
    }
  });
</script>

<!-- Three.js exponential fog applied to the scene -->
<T.FogExp2 attach="fog" color="#c8d8c8" density={currentDensity} />
```

Mount `<FogLayer />` inside `GameStage.svelte`.

### `src/lib/BranchingPath.svelte`

Generates path forks at intervals determined by mapSeed. Dead ends are also seeded:

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import { createSeededRng } from './prng.js';
  import { gameState } from '../game.svelte.js';
  import { useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';

  type Props = { mapSeed: bigint; playerZ: number };
  let { mapSeed, playerZ }: Props = $props();

  type Fork = {
    z: number;          // world Z where fork starts
    mergeZ: number;     // where paths merge back
    leftIsDeadEnd: boolean;
    rightIsDeadEnd: boolean;
  };

  // Generate fork points: every 120-180 units, seeded
  const forks = $derived.by(() => {
    const result: Fork[] = [];
    const rng = createSeededRng(mapSeed + 12345n);
    let z = -60; // first fork 60 units in
    while (z > playerZ - 300) {
      const forkLength = 60 + rng() * 60;
      const hasDeadEnd = rng() < 0.35; // 35% chance of a dead end on one branch
      const deadEndSide = rng() < 0.5 ? 'left' : 'right';
      result.push({
        z,
        mergeZ: z - forkLength,
        leftIsDeadEnd: hasDeadEnd && deadEndSide === 'left',
        rightIsDeadEnd: hasDeadEnd && deadEndSide === 'right',
      });
      z -= forkLength + 80 + rng() * 60; // gap between forks
    }
    return result;
  });

  // Only show forks near the player
  const visibleForks = $derived(forks.filter(f => f.z > playerZ - 200 && f.z < playerZ + 50));
</script>

{#each visibleForks as fork (`fork_${fork.z}`)}
  <!-- Fork indicator sign at split point -->
  <T.Group position={[0, 2, fork.z]}>
    <HTML center>
      <div style="background: rgba(0,0,0,0.7); padding: 0.3rem 0.6rem; border-radius: 6px;
                  color: #ff8; font-size: 0.9rem; white-space: nowrap;">
        ← Path forks →
      </div>
    </HTML>
  </T.Group>

  <!-- Dead end wall -->
  {#if fork.leftIsDeadEnd}
    <T.Mesh position={[-8, 1.5, fork.mergeZ - 5]}>
      <T.BoxGeometry args={[8, 3, 2]} />
      <T.MeshStandardMaterial color="#5a4a2a" />
    </T.Mesh>
    <T.Group position={[-8, 3.5, fork.mergeZ - 4]}>
      <HTML center>
        <div style="color: #f44; font-weight: bold; font-size: 1rem;">✕ DEAD END</div>
      </HTML>
    </T.Group>
  {/if}

  {#if fork.rightIsDeadEnd}
    <T.Mesh position={[8, 1.5, fork.mergeZ - 5]}>
      <T.BoxGeometry args={[8, 3, 2]} />
      <T.MeshStandardMaterial color="#5a4a2a" />
    </T.Mesh>
    <T.Group position={[8, 3.5, fork.mergeZ - 4]}>
      <HTML center>
        <div style="color: #f44; font-weight: bold; font-size: 1rem;">✕ DEAD END</div>
      </HTML>
    </T.Group>
  {/if}
{/each}
```

Mount `<BranchingPath mapSeed={session.mapSeed} playerZ={localPos.z} />` inside `GameStage.svelte`.

### Fog HUD notification (add to `GameHud.svelte`)

```svelte
{#if session?.fogActive}
  <div style="position: absolute; top: 4rem; left: 50%; transform: translateX(-50%);
              background: rgba(50,70,50,0.8); padding: 0.4rem 1rem; border-radius: 20px;
              color: #bdc; font-size: 0.85rem; animation: pulse 2s infinite;">
    ⛅ FOG ROLLING IN
  </div>
{/if}

<style>
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
</style>
```

### `src/lib/FlareEntity.svelte`

Dynamic light + visual for thrown flare:

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';

  type Props = { x: number; z: number; expiresAt: number };
  let { x, z, expiresAt }: Props = $props();

  let intensity = $state(3);
  useTask(() => {
    const remaining = (expiresAt - Date.now()) / 8000;
    intensity = Math.max(0, remaining * 3); // fade out
  });
</script>

<T.Group position={[x, 0.5, z]}>
  <T.PointLight color="#ff8844" {intensity} distance={20} decay={2} />
  <T.Mesh>
    <T.SphereGeometry args={[0.1, 8, 8]} />
    <T.MeshStandardMaterial color="#ff4" emissive="#ff8" emissiveIntensity={2} />
  </T.Mesh>
</T.Group>
```

---

## Done When

- [ ] Fog activates and deactivates; density lerps smoothly (no snap)
- [ ] Fog notification appears in HUD when fog starts
- [ ] Dense bushes visually present; passing through them slows the player
- [ ] Stumps visible in path
- [ ] Pits show as dark circles; falling in applies damage and stun
- [ ] Debris blockages span the path; cleared by shooting or Tank bash
- [ ] Branching paths fork and merge; dead end walls visible with "DEAD END" indicator
- [ ] Fog + night together produces near-blackout (visually dramatic)
- [ ] Enemy speed multiplier increases as enemies are killed (surviving enemies get faster)
- [ ] Flare throw marks all enemies in radius, creates dynamic light for 8 seconds
- [ ] Acid pools expire and are cleaned up from the database
- [ ] Enemy and item spawn rates escalate with cycle number
