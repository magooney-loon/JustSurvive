# Phase 4 — Classes, Abilities & Items

**Goal:** Each class feels distinct. All abilities, item pickups, and the Spitter's acid pools are fully implemented. The revive system works with channel/interrupt.

---

## SpacetimeDB Backend

### New Tables (add to `schema.ts`)

```typescript
export const Mark = table({
  name: 'mark',
  public: true,
  indexes: [
    { name: 'mark_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  sourceIdentity: t.identity(),
  targetType: t.string(),       // 'enemy' | 'location'
  targetEnemyId: t.u64().optional(),
  posX: t.i64().optional(),
  posZ: t.i64().optional(),
  expiresAt: t.timestamp(),
});

export const AcidPool = table({
  name: 'acid_pool',
  public: true,
  indexes: [
    { name: 'acid_pool_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  posX: t.i64(),
  posZ: t.i64(),
  radius: t.u64(),              // fixed-point, e.g. 2000 = 2 world units
  expiresAt: t.timestamp(),
});

export const ItemSpawn = table({
  name: 'item_spawn',
  public: true,
  indexes: [
    { name: 'item_spawn_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  itemType: t.string(),         // 'energy_drink' | 'stamina_boost' | 'medkit' | 'armor_plate' | 'flare'
  posX: t.i64(),
  posZ: t.i64(),
});

export const ReviveChannel = table({
  name: 'revive_channel',
  public: true,
  indexes: [
    { name: 'revive_channel_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  healerIdentity: t.identity(),
  targetIdentity: t.identity(),
  channelStartedAt: t.timestamp(),
});

// Scheduled: complete revive after 2 seconds
export const ReviveCompleteJob = table({
  name: 'revive_complete_job',
  scheduled: () => complete_revive,
  indexes: [
    { name: 'revive_job_session', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  sessionId: t.u64(),
  healerIdentity: t.identity(),
  targetIdentity: t.identity(),
});

// Add to PlayerState: per-ability cooldowns + item effects
// Update existing player_state table to add:
//   reviveCooldownUntil: t.timestamp().optional()
//   pingCooldownUntil: t.timestamp().optional()
//   armorBonus: t.u64()  — extra HP from armor plates (max 50)
//   speedBoostUntil: t.timestamp().optional()
//   staminaBoostUntil: t.timestamp().optional()
//   staminaBoostAmount: t.u64()  — 25% of base maxStamina
```

> Note: if PlayerState table already has rows in development, clear the database and republish when adding columns.

---

### New Reducers (`index.ts`)

#### Spotter — Mark Enemy

```typescript
export const mark_enemy = spacetimedb.reducer({
  sessionId: t.u64(),
  enemyId: t.u64(),
}, (ctx, { sessionId, enemyId }) => {
  // Validate caller is Spotter and not sprinting (enforced client-side; server validates class)
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.classChoice !== 'spotter') throw new SenderError('Not a Spotter');
  if (ps.status !== 'alive') return;

  const enemy = ctx.db.enemy.id.find(enemyId);
  if (!enemy || !enemy.isAlive) return;

  // Mark the enemy (5 second TTL)
  const expiresAt = ctx.timestamp.microsSinceUnixEpoch + 5_000_000n;
  ctx.db.mark.insert({
    id: 0n,
    sessionId,
    sourceIdentity: ctx.sender,
    targetType: 'enemy',
    targetEnemyId: enemyId,
    posX: undefined,
    posZ: undefined,
    expiresAt: { microsSinceUnixEpoch: expiresAt },
  });
  ctx.db.enemy.id.update({ ...enemy, isMarked: true, markedUntil: { microsSinceUnixEpoch: expiresAt } });
});
```

> Add `isMarked: t.bool()` and `markedUntil: t.timestamp().optional()` to the Enemy table definition.

#### Spotter — Ping Location

```typescript
export const ping_location = spacetimedb.reducer({
  sessionId: t.u64(),
  posX: t.i64(),
  posZ: t.i64(),
}, (ctx, { sessionId, posX, posZ }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.classChoice !== 'spotter') throw new SenderError('Not a Spotter');
  if (ps.status !== 'alive') return;
  if (ps.pingCooldownUntil && ctx.timestamp.microsSinceUnixEpoch < ps.pingCooldownUntil.microsSinceUnixEpoch) {
    throw new SenderError('Ping on cooldown');
  }

  const expiresAt = ctx.timestamp.microsSinceUnixEpoch + 10_000_000n; // 10s
  ctx.db.mark.insert({
    id: 0n,
    sessionId,
    sourceIdentity: ctx.sender,
    targetType: 'location',
    targetEnemyId: undefined,
    posX,
    posZ,
    expiresAt: { microsSinceUnixEpoch: expiresAt },
  });

  // Set 10s cooldown
  const cooldownUntil = { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + 10_000_000n };
  ctx.db.playerState.id.update({ ...ps, pingCooldownUntil: cooldownUntil });
});
```

#### Gunner — Attack Enemy (with suppression)

```typescript
const WEAPON_DAMAGE: Record<string, bigint> = {
  gunner: 15n,  // per shot
  healer: 35n,  // shotgun, close-range burst
};

// Track sustained fire for suppression (simple: if same enemy hit 3+ times → suppress)
// Stored client-side; server just applies slow on the reducer call with suppress flag

export const attack_enemy = spacetimedb.reducer({
  sessionId: t.u64(),
  enemyId: t.u64(),
  suppress: t.bool(),
}, (ctx, { sessionId, enemyId, suppress }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || (ps.classChoice !== 'gunner' && ps.classChoice !== 'healer')) {
    throw new SenderError('Class cannot attack');
  }
  if (ps.status !== 'alive') return;

  const enemy = ctx.db.enemy.id.find(enemyId);
  if (!enemy || !enemy.isAlive) return;

  const dmg = WEAPON_DAMAGE[ps.classChoice] ?? 15n;
  const newHp = enemy.hp > dmg ? enemy.hp - dmg : 0n;

  if (newHp <= 0n) {
    // Enemy killed — increment unkilled enemy speed stacks for remaining enemies
    ctx.db.enemy.id.update({ ...enemy, hp: 0n, isAlive: false });
    ctx.db.playerState.id.update({ ...ps, score: ps.score + 10n }); // +10 score per kill

    // Remove enemy's mark rows
    for (const m of ctx.db.mark.mark_session_id.filter(sessionId)) {
      if (m.targetEnemyId === enemyId) ctx.db.mark.id.delete(m.id);
    }
  } else {
    // Apply suppression (Gunner only): set speed to 60% for 1 second
    let updatedEnemy = { ...enemy, hp: newHp };
    if (suppress && ps.classChoice === 'gunner') {
      // Suppression: override speedMultiplier temporarily — stored as isDazed with short daze
      const suppressUntil = { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + 1_000_000n };
      updatedEnemy = { ...updatedEnemy, isDazed: true, dazedUntil: suppressUntil };
    }
    ctx.db.enemy.id.update(updatedEnemy);
  }
});
```

#### Tank — Shield Bash

```typescript
export const shield_bash = spacetimedb.reducer({
  sessionId: t.u64(),
  enemyId: t.u64().optional(),
}, (ctx, { sessionId, enemyId }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.classChoice !== 'tank') throw new SenderError('Not a Tank');
  if (ps.status !== 'alive') return;

  if (enemyId !== undefined) {
    const enemy = ctx.db.enemy.id.find(enemyId);
    if (!enemy || !enemy.isAlive) return;

    // Daze for 1.5 seconds + knockback (push enemy 4 units away from tank)
    const dx = enemy.posX - ps.posX;
    const dz = enemy.posZ - ps.posZ;
    const mag = bigintSqrt(dx * dx + dz * dz);
    const knockback = 4000n; // 4 world units in fixed-point
    const newX = mag > 0n ? enemy.posX + dx * knockback / mag : enemy.posX + knockback;
    const newZ = mag > 0n ? enemy.posZ + dz * knockback / mag : enemy.posZ + knockback;

    const dazedUntil = { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + 1_500_000n };
    ctx.db.enemy.id.update({ ...enemy, posX: newX, posZ: newZ, isDazed: true, dazedUntil });
  }
  // Debris clearing: handled client-side by detecting debris in range and calling clear_debris
});

export const clear_debris = spacetimedb.reducer({
  sessionId: t.u64(),
  debrisId: t.u64(),
}, (ctx, { sessionId, debrisId }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  // Both Tank (bash) and Gunner/Healer (shoot) can clear debris
  if (!ps || ps.status !== 'alive') return;
  // Debris table added in Phase 5 — placeholder for now
});
```

#### Tank — Brace (2s mandatory hold, 5s cooldown)

```typescript
// Stored client-side timing. Server records brace start/end.
// Bracing flag checked in enemy_tick — enemies that hit a bracing tank bounce.

export const brace_start = spacetimedb.reducer({
  sessionId: t.u64(),
}, (ctx, { sessionId }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.classChoice !== 'tank') return;
  ctx.db.playerState.id.update({ ...ps, isBracing: true });
  // isBracing: t.bool() — add to PlayerState table
});

export const brace_end = spacetimedb.reducer({
  sessionId: t.u64(),
}, (ctx, { sessionId }) => {
  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps) return;
  ctx.db.playerState.id.update({ ...ps, isBracing: false });
});
```

Add `isBracing: t.bool()` to the PlayerState table definition (default `false`).

In `enemy_tick`, add brace collision check: if enemy is within melee range of a bracing tank, apply knockback + daze to enemy instead of dealing damage to tank.

#### Healer — Revive Channel

```typescript
const REVIVE_COOLDOWN_US = 15_000_000n; // 15 seconds in microseconds
const REVIVE_CHANNEL_US = 2_000_000n;   // 2 second channel

export const revive_start = spacetimedb.reducer({
  sessionId: t.u64(),
  targetIdentity: t.identity(),
}, (ctx, { sessionId, targetIdentity }) => {
  let healer: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { healer = p; break; }
  }
  if (!healer || healer.classChoice !== 'healer') throw new SenderError('Not a Healer');
  if (healer.status !== 'alive') return;

  // Check cooldown
  if (healer.reviveCooldownUntil && ctx.timestamp.microsSinceUnixEpoch < healer.reviveCooldownUntil.microsSinceUnixEpoch) {
    throw new SenderError('Revive on cooldown');
  }

  // Find target (must be downed)
  let target: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(targetIdentity)) { target = p; break; }
  }
  if (!target || target.status !== 'downed') throw new SenderError('Target is not downed');

  // Check proximity (within 3 units)
  const dx = healer.posX - target.posX;
  const dz = healer.posZ - target.posZ;
  const dist2 = dx * dx + dz * dz;
  if (dist2 > 9_000_000n) throw new SenderError('Too far from downed player'); // 3 units squared

  // Create revive channel
  ctx.db.reviveChannel.insert({
    id: 0n,
    sessionId,
    healerIdentity: ctx.sender,
    targetIdentity,
    channelStartedAt: ctx.timestamp,
  });

  // Schedule completion in 2 seconds
  const completeAt = ctx.timestamp.microsSinceUnixEpoch + REVIVE_CHANNEL_US;
  ctx.db.reviveCompleteJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(completeAt),
    sessionId,
    healerIdentity: ctx.sender,
    targetIdentity,
  });
});

export const complete_revive = spacetimedb.reducer({
  arg: ReviveCompleteJob.rowType,
}, (ctx, { arg }) => {
  // Check revive channel still exists (not interrupted)
  let channel: any;
  for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(arg.sessionId)) {
    if (c.healerIdentity.isEqual(arg.healerIdentity) && c.targetIdentity.isEqual(arg.targetIdentity)) {
      channel = c; break;
    }
  }
  if (!channel) return; // interrupted

  // Find healer and target
  let healer: any, target: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
    if (p.playerIdentity.isEqual(arg.healerIdentity)) healer = p;
    if (p.playerIdentity.isEqual(arg.targetIdentity)) target = p;
  }

  if (!healer || !target || target.status !== 'downed') {
    ctx.db.reviveChannel.id.delete(channel.id);
    return;
  }

  // Revive: restore 50 HP, set alive, give 5s speed burst (Adrenaline Shot)
  const speedBoostUntil = { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + 5_000_000n };
  ctx.db.playerState.id.update({ ...target, hp: 50n, status: 'alive', speedBoostUntil });

  // Set healer cooldown
  const cooldownUntil = { microsSinceUnixEpoch: ctx.timestamp.microsSinceUnixEpoch + REVIVE_COOLDOWN_US };
  ctx.db.playerState.id.update({ ...healer, reviveCooldownUntil: cooldownUntil });

  ctx.db.reviveChannel.id.delete(channel.id);
});
```

**In `apply_player_damage` (Phase 3 helper):** add revive interrupt check:

```typescript
// After dealing damage, check if healer was channeling a revive
for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
  if (c.healerIdentity.isEqual(ps.playerIdentity)) {
    ctx.db.reviveChannel.id.delete(c.id);
    // The scheduled ReviveCompleteJob will fire but find no channel — it will no-op
    break;
  }
}
```

#### Spitter — Spit Acid (called inside `enemy_tick`)

Inside `enemy_tick`, for Spitter enemies: instead of melee, spit acid at player position.

```typescript
// In enemy_tick, Spitter ranged attack logic:
if (enemy.enemyType === 'spitter' && dist <= 8_000_000n) { // 8 world units range
  // Spit at player position — create acid pool
  const poolExpiry = ctx.timestamp.microsSinceUnixEpoch + 8_000_000n; // 8 seconds
  ctx.db.acidPool.insert({
    id: 0n,
    sessionId: arg.sessionId,
    posX: nearest.posX + (dx / 2n), // land halfway toward player
    posZ: nearest.posZ + (dz / 2n),
    radius: 2000n, // 2 world units
    expiresAt: { microsSinceUnixEpoch: poolExpiry },
  });
  // Spitter doesn't melee — skip normal damage path
  continue;
}
```

**In `move_player`:** check acid pool overlap:

```typescript
// After updating position, check acid pool damage:
const now = ctx.timestamp.microsSinceUnixEpoch;
for (const pool of ctx.db.acidPool.acid_pool_session_id.filter(sessionId)) {
  if (pool.expiresAt.microsSinceUnixEpoch < now) continue; // expired (cleanup done in Phase 5)
  const dx = posX - pool.posX;
  const dz = posZ - pool.posZ;
  const dist2 = dx * dx + dz * dz;
  if (dist2 < pool.radius * pool.radius) {
    // Player in acid: -5 HP per second = -0.5 per 100ms tick approximation per move call
    // At 15Hz, each call ~= 67ms, so apply fractional: 5 HP/sec / 15 = ~0.33 HP per call
    // Use integer: deal 1 HP every 3 calls — simplify to 1 HP per call at 15Hz (5x scale)
    apply_player_damage(ctx, sessionId, ps, 1n);
    break;
  }
}
```

#### Item Spawning (called inside `spawn_enemy` or on its own scheduled job)

```typescript
// Add ItemSpawnJob table and spawn_item reducer (similar pattern to enemy spawning)
export const spawn_item = spacetimedb.reducer({
  arg: ItemSpawnJob.rowType,
}, (ctx, { arg }) => {
  const session = ctx.db.gameSession.id.find(arg.sessionId);
  if (!session || session.status !== 'active') return;

  const ITEMS = ['energy_drink', 'stamina_boost', 'medkit', 'armor_plate', 'flare'];
  const seed = Number(ctx.timestamp.microsSinceUnixEpoch % BigInt(ITEMS.length));
  const itemType = ITEMS[seed];

  // Spawn ahead of players
  const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)]
    .filter(p => p.status === 'alive');
  if (players.length === 0) return;

  const avgZ = players.reduce((s, p) => s + p.posZ, 0n) / BigInt(players.length);
  const spawnX = (ctx.timestamp.microsSinceUnixEpoch % 20_000n) - 10_000n;
  const spawnZ = avgZ - 15_000n; // 15 units ahead

  ctx.db.itemSpawn.insert({ id: 0n, sessionId: arg.sessionId, itemType, posX: spawnX, posZ: spawnZ });

  // Reschedule next item spawn: every 12 seconds
  const nextSpawn = ctx.timestamp.microsSinceUnixEpoch + 12_000_000n;
  ctx.db.itemSpawnJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(nextSpawn),
    sessionId: arg.sessionId,
  });
});

export const pickup_item = spacetimedb.reducer({
  sessionId: t.u64(),
  itemId: t.u64(),
}, (ctx, { sessionId, itemId }) => {
  const item = ctx.db.itemSpawn.id.find(itemId);
  if (!item || item.sessionId !== sessionId) return;

  let ps: any;
  for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
    if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
  }
  if (!ps || ps.status !== 'alive') return;

  // Proximity check (1.5 units)
  const dx = ps.posX - item.posX;
  const dz = ps.posZ - item.posZ;
  if (dx * dx + dz * dz > 2_250_000n) return; // 1.5^2 * 1000^2

  // Apply item effect
  let updatedPs = { ...ps };
  const now = ctx.timestamp.microsSinceUnixEpoch;

  switch (item.itemType) {
    case 'energy_drink':
      updatedPs.speedBoostUntil = { microsSinceUnixEpoch: now + 10_000_000n };
      break;
    case 'stamina_boost':
      updatedPs.stamina = ps.maxStamina + ps.maxStamina / 4n; // instant refill + 25% bonus
      updatedPs.staminaBoostUntil = { microsSinceUnixEpoch: now + 30_000_000n };
      break;
    case 'medkit':
      updatedPs.hp = ps.hp + 50n > ps.maxHp + ps.armorBonus ? ps.maxHp + ps.armorBonus : ps.hp + 50n;
      break;
    case 'armor_plate':
      const newArmor = ps.armorBonus + 25n > 50n ? 50n : ps.armorBonus + 25n;
      updatedPs.armorBonus = newArmor;
      updatedPs.maxHp = ps.maxHp - ps.armorBonus + newArmor; // update effective max HP
      break;
    case 'flare':
      // Flare is a throwable — stored as a boolean/count on player state
      // Mark enemies in radius when thrown via throw_flare reducer (Phase 5)
      updatedPs.hasFlare = true; // add hasFlare: t.bool() to PlayerState
      break;
  }

  ctx.db.playerState.id.update(updatedPs);
  ctx.db.itemSpawn.id.delete(itemId); // remove from world
});
```

---

## Frontend

### `src/lib/AcidPoolEntity.svelte`

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import type { AcidPool } from '../module_bindings/index.js';

  type Props = { pool: AcidPool };
  let { pool }: Props = $props();

  const x = $derived(Number(pool.posX) / 1000);
  const z = $derived(Number(pool.posZ) / 1000);
  const r = $derived(Number(pool.radius) / 1000);
</script>

<T.Group position={[x, 0.01, z]}>
  <T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
    <T.CircleGeometry args={[r, 16]} />
    <T.MeshStandardMaterial color="#3f3" emissive="#1a1" opacity={0.6} transparent />
  </T.Mesh>
</T.Group>
```

### `src/lib/ItemPickupEntity.svelte`

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useSpacetimeDB } from 'spacetimedb/svelte';
  import { gameState } from '../game.svelte.js';
  import type { ItemSpawn } from '../module_bindings/index.js';

  type Props = { item: ItemSpawn };
  let { item }: Props = $props();

  const { connection: conn } = useSpacetimeDB();

  const x = $derived(Number(item.posX) / 1000);
  const z = $derived(Number(item.posZ) / 1000);

  const ITEM_COLORS: Record<string, string> = {
    energy_drink: '#ff4', stamina_boost: '#4af', medkit: '#f44',
    armor_plate: '#88f', flare: '#fa4',
  };

  let bobY = $state(0);
  let t = 0;
  useTask((dt) => { t += dt; bobY = Math.sin(t * 2) * 0.15; });
</script>

<T.Group position={[x, 0.5 + bobY, z]}>
  <T.Mesh>
    <T.BoxGeometry args={[0.4, 0.4, 0.4]} />
    <T.MeshStandardMaterial
      color={ITEM_COLORS[item.itemType] ?? '#fff'}
      emissive={ITEM_COLORS[item.itemType] ?? '#fff'}
      emissiveIntensity={0.3}
    />
  </T.Mesh>
</T.Group>
```

Pickup is triggered automatically in `move_player` reducer when proximity check passes. Client can also send `pickup_item` explicitly when near an item (belt-and-suspenders approach).

### `src/lib/MarkOverlay.svelte`

Renders mark indicators above marked enemies (and location pings):

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import { useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';

  const [marks] = useTable(tables.mark);
  const [enemies] = useTable(tables.enemy);

  const now = $derived(Date.now() * 1000); // microseconds

  const activeMarks = $derived(
    marks.filter(m =>
      m.sessionId === gameState.currentSessionId &&
      Number(m.expiresAt.microsSinceUnixEpoch) > Date.now() * 1000
    )
  );

  function getEnemyPos(enemyId: bigint) {
    const e = enemies.find(e => e.id === enemyId);
    return e ? { x: Number(e.posX) / 1000, z: Number(e.posZ) / 1000 } : null;
  }
</script>

{#each activeMarks as mark (mark.id)}
  {#if mark.targetType === 'enemy' && mark.targetEnemyId !== undefined}
    {@const pos = getEnemyPos(mark.targetEnemyId)}
    {#if pos}
      <T.Group position={[pos.x, 3, pos.z]}>
        <HTML center>
          <div style="color: #f84; font-size: 1.2rem; font-weight: bold; text-shadow: 0 0 4px #000;">⚠</div>
        </HTML>
      </T.Group>
    {/if}
  {:else if mark.targetType === 'location' && mark.posX !== undefined}
    <T.Group position={[Number(mark.posX) / 1000, 2, Number(mark.posZ) / 1000]}>
      <HTML center>
        <div style="color: #4af; font-size: 1rem; text-shadow: 0 0 4px #000;">📍</div>
      </HTML>
    </T.Group>
  {/if}
{/each}
```

### `src/lib/ReviveChannel.svelte` (HUD element inside GameHud)

Shows revive progress bar when Healer is channeling:

```svelte
<script lang="ts">
  import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';

  const { identity } = useSpacetimeDB();
  const [channels] = useTable(tables.reviveChannel);

  const myChannel = $derived(channels.find(c =>
    c.sessionId === gameState.currentSessionId &&
    c.healerIdentity.toHexString() === identity?.toHexString()
  ));

  let elapsed = $state(0);
  let startedAt = $state(0n);

  $effect(() => {
    if (myChannel) {
      startedAt = myChannel.channelStartedAt.microsSinceUnixEpoch;
      const interval = setInterval(() => {
        elapsed = (Date.now() * 1000 - Number(startedAt)) / 2_000_000; // 0 to 1 over 2s
        if (elapsed >= 1) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  });
</script>

{#if myChannel}
  <div style="position: absolute; bottom: 6rem; left: 50%; transform: translateX(-50%);
              background: rgba(0,0,0,0.7); padding: 0.5rem 1.5rem; border-radius: 8px; text-align: center;">
    <div style="font-size: 0.85rem; color: #f4a; margin-bottom: 0.3rem;">REVIVING...</div>
    <div style="background: #333; border-radius: 4px; height: 8px; width: 160px;">
      <div style="background: #f4a; border-radius: 4px; height: 100%; width: {Math.min(elapsed * 100, 100)}%;
                  transition: width 0.05s;"></div>
    </div>
  </div>
{/if}
```

### Class Ability Input (in `GameHud.svelte` or a dedicated `AbilityInput.svelte`)

Wire keyboard shortcuts for abilities:
- `F` — Spotter mark (ray from camera hits nearest enemy, calls `mark_enemy`)
- `G` — Spotter ping (pings camera target world position)
- `LMB` — Gunner / Healer shoot (calls `attack_enemy`)
- `E` — Tank shield bash (calls `shield_bash` on nearest enemy in range)
- `Space` — Tank brace start; release = brace end
- `R` — Healer revive (calls `revive_start` on nearest downed player)

---

## Done When

- [ ] Spotter flashlight marks enemies for 5s (visual mark overlays visible to all)
- [ ] Spotter ping creates location mark (10s cooldown)
- [ ] Gunner shoots and kills enemies; sustained fire triggers suppression slow
- [ ] Tank shield bash dazes and knocks back enemy
- [ ] Tank brace: 2s mandatory hold, blocks enemies, 5s cooldown
- [ ] Healer revive: 2s channel shown with progress bar; cancels on damage
- [ ] Revived player returns at 50 HP with 5s speed boost
- [ ] Items spawn ahead of players and are collected by running over
- [ ] Spitter creates acid pools that deal damage to players standing in them
- [ ] Marks visible to all players (enemy marks, location pings)
