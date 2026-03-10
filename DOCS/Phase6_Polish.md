# Phase 6 — Polish, Score & Leaderboard

**Goal:** The game is shippable. Full score formula, leaderboard live, audio integrated, art pass started, and values playtested.

---

## SpacetimeDB Backend

### New Tables (add to `schema.ts`)

```typescript
export const RunScore = table({
  name: 'run_score',
  public: true,
  indexes: [
    { name: 'run_score_session_id', algorithm: 'btree', columns: ['sessionId'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  playerCount: t.u64(),
  timeSurvivedSecs: t.u64(),
  totalKills: t.u64(),
  totalDistance: t.u64(),
  daysSurvived: t.u64(),        // = cycleNumber at end
  dayMultiplierFP: t.u64(),     // fixed-point: 100 = 1.0x, 150 = 1.5x
  playerCountBonusFP: t.u64(), // fixed-point: 100 = 1.0x
  finalScore: t.u64(),
  endedAt: t.timestamp(),
});

export const LeaderboardEntry = table({
  name: 'leaderboard_entry',
  public: true,
  indexes: [
    { name: 'leaderboard_score', algorithm: 'btree', columns: ['finalScore'] },
  ],
}, {
  id: t.u64().primaryKey().autoInc(),
  sessionId: t.u64(),
  playerCount: t.u64(),
  daysSurvived: t.u64(),
  finalScore: t.u64(),
  achievedAt: t.timestamp(),
});
```

### Score Calculation (update `end_session` function in `index.ts`)

```typescript
function end_session(ctx: any, sessionId: bigint) {
  const session = ctx.db.gameSession.id.find(sessionId);
  if (!session) return;

  const players = [...ctx.db.playerState.player_state_session_id.filter(sessionId)];

  // Aggregate stats across all players
  let totalKills = 0n;
  let totalDistance = 0n;
  let playerCount = BigInt(players.length);
  for (const p of players) {
    totalKills += p.score; // score field accumulates kills in our implementation
    totalDistance += p.scoreDistance ?? 0n; // add scoreDistance field to PlayerState
  }

  // Time survived in seconds
  const timeSurvivedUs = ctx.timestamp.microsSinceUnixEpoch - session.startedAt.microsSinceUnixEpoch;
  const timeSurvivedSecs = timeSurvivedUs / 1_000_000n;

  // Day multiplier: Day 1 = 1.0x, Day 2 = 1.5x, Day 3 = 2.0x (capped at 5.0x)
  const cycleNum = session.cycleNumber; // 0-indexed (0 = first day)
  let dayMultiplierFP = 100n + cycleNum * 50n;
  if (dayMultiplierFP > 500n) dayMultiplierFP = 500n;

  // Player count bonus
  const playerCountBonusFP =
    playerCount === 2n ? 150n :
    playerCount === 3n ? 125n :
    100n; // 4 players

  // Base score = time + kills*100 + distance/10
  const baseScore = timeSurvivedSecs + totalKills * 100n + totalDistance / 10n;
  const finalScore = baseScore * dayMultiplierFP / 100n * playerCountBonusFP / 100n;

  ctx.db.runScore.insert({
    id: 0n,
    sessionId,
    playerCount,
    timeSurvivedSecs,
    totalKills,
    totalDistance,
    daysSurvived: session.cycleNumber,
    dayMultiplierFP,
    playerCountBonusFP,
    finalScore,
    endedAt: ctx.timestamp,
  });

  // Leaderboard: store if in top 100 (simplified: always insert, clients sort)
  ctx.db.leaderboardEntry.insert({
    id: 0n,
    sessionId,
    playerCount,
    daysSurvived: session.cycleNumber,
    finalScore,
    achievedAt: ctx.timestamp,
  });

  ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });
  const lobby = ctx.db.lobby.id.find(session.lobbyId);
  if (lobby) ctx.db.lobby.id.update({ ...lobby, status: 'game_over' });
}
```

### Leaderboard View (optional but recommended)

```typescript
// Top 50 entries sorted by score — anonymous view (same for all users)
spacetimedb.anonymousView(
  { name: 'top_scores', public: true },
  t.array(LeaderboardEntry.rowType),
  (ctx) => ctx.from.leaderboardEntry
    // Query builder: order by finalScore desc, limit 50
    // NOTE: check SpacetimeDB query builder docs for exact .orderBy / .limit syntax
    // Fallback: client sorts the full leaderboard_entry table
);
```

---

## Frontend

### `src/lib/GameOverHud.svelte` (full implementation)

```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
  import { gameState, gameActions } from '../game.svelte.js';
  import { useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';

  const [scores] = useTable(tables.runScore);

  const latestScore = $derived(
    scores
      .filter(s => s.sessionId === gameState.currentSessionId)
      .sort((a, b) => Number(b.endedAt.microsSinceUnixEpoch - a.endedAt.microsSinceUnixEpoch))[0]
  );

  function formatTime(secs: bigint): string {
    const m = Number(secs / 60n);
    const s = Number(secs % 60n);
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  function formatMultiplier(fp: bigint): string {
    return `${Number(fp) / 100}x`;
  }

  function playAgain() {
    gameActions.clearGame();
    stageActions.setStage('lobby');
  }
</script>

<div transition:fly={{ y: 30, duration: 400 }}
     style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.75);">
  <div style="background: rgba(0,0,0,0.85); padding: 2.5rem; border-radius: 16px; min-width: 420px; text-align: center;">
    <h2 style="font-size: 2rem; margin: 0 0 0.5rem; color: #f44;">GAME OVER</h2>

    {#if latestScore}
      <div style="font-size: 3rem; font-weight: bold; color: #ff8; margin: 1rem 0;">
        {Number(latestScore.finalScore).toLocaleString()}
      </div>
      <p style="color: #aaa; margin: 0 0 1.5rem;">Final Score</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem;">
        <tbody>
          <tr>
            <td style="text-align: left; padding: 0.3rem 0; color: #aaa;">Time Survived</td>
            <td style="text-align: right; color: #fff;">{formatTime(latestScore.timeSurvivedSecs)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding: 0.3rem 0; color: #aaa;">Enemies Killed</td>
            <td style="text-align: right; color: #fff;">{Number(latestScore.totalKills)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding: 0.3rem 0; color: #aaa;">Distance</td>
            <td style="text-align: right; color: #fff;">{Number(latestScore.totalDistance).toLocaleString()}m</td>
          </tr>
          <tr>
            <td style="text-align: left; padding: 0.3rem 0; color: #aaa;">Days Survived</td>
            <td style="text-align: right; color: #fff;">{Number(latestScore.daysSurvived)}</td>
          </tr>
          <tr style="border-top: 1px solid #333; margin-top: 0.5rem;">
            <td style="text-align: left; padding: 0.5rem 0; color: #ff8;">Day Multiplier</td>
            <td style="text-align: right; color: #ff8;">{formatMultiplier(latestScore.dayMultiplierFP)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding: 0.3rem 0; color: #4af;">
              {Number(latestScore.playerCount)}P Bonus
            </td>
            <td style="text-align: right; color: #4af;">{formatMultiplier(latestScore.playerCountBonusFP)}</td>
          </tr>
        </tbody>
      </table>
    {:else}
      <p style="color: #666;">Loading score...</p>
    {/if}

    <div style="display: flex; gap: 1rem;">
      <button onclick={playAgain}
              style="flex: 1; padding: 0.8rem; background: #4a8; border-radius: 8px; font-size: 1rem;">
        Play Again
      </button>
      <button onclick={() => stageActions.setStage('leaderboard')}
              style="flex: 1; padding: 0.8rem; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 1rem;">
        Leaderboard
      </button>
      <button onclick={() => { gameActions.clearGame(); stageActions.setStage('menu'); }}
              style="padding: 0.8rem; background: rgba(255,50,50,0.2); border-radius: 8px;">
        Menu
      </button>
    </div>
  </div>
</div>
```

### `src/lib/LeaderboardHud.svelte` (full implementation)

```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
  import { useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';

  const [entries] = useTable(tables.leaderboardEntry);

  const sorted = $derived(
    [...entries].sort((a, b) => Number(b.finalScore - a.finalScore)).slice(0, 50)
  );

  function formatDate(ts: { microsSinceUnixEpoch: bigint }): string {
    return new Date(Number(ts.microsSinceUnixEpoch / 1000n)).toLocaleDateString();
  }
</script>

<div transition:fly={{ y: 20, duration: 300 }}
     style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 2rem;">
  <div style="background: rgba(0,0,0,0.8); padding: 2rem; border-radius: 16px; width: 100%; max-width: 600px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h2 style="margin: 0;">🏆 Leaderboard</h2>
      <button onclick={() => stageActions.setStage('menu')}>Back</button>
    </div>

    <div style="overflow-y: auto; max-height: 60vh;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="color: #aaa; border-bottom: 1px solid #333;">
            <th style="text-align: left; padding: 0.4rem;">#</th>
            <th style="text-align: right; padding: 0.4rem;">Score</th>
            <th style="text-align: center; padding: 0.4rem;">Players</th>
            <th style="text-align: center; padding: 0.4rem;">Days</th>
            <th style="text-align: right; padding: 0.4rem;">Date</th>
          </tr>
        </thead>
        <tbody>
          {#each sorted as entry, i (entry.id)}
            <tr style="border-bottom: 1px solid #1a1a1a;
                       color: {i === 0 ? '#ff8' : i < 3 ? '#aaa' : '#666'};">
              <td style="padding: 0.4rem;">{i + 1}</td>
              <td style="text-align: right; font-weight: bold;">
                {Number(entry.finalScore).toLocaleString()}
              </td>
              <td style="text-align: center;">{Number(entry.playerCount)}P</td>
              <td style="text-align: center;">{Number(entry.daysSurvived)}</td>
              <td style="text-align: right;">{formatDate(entry.achievedAt)}</td>
            </tr>
          {/each}
          {#if sorted.length === 0}
            <tr><td colspan={5} style="text-align: center; color: #444; padding: 2rem;">No runs yet</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
```

---

## Audio Integration

Using the existing `Sound.svelte` pattern: create `src/lib/GameSound.svelte` as a sibling to `Sound.svelte` inside `Canvas` (never unmounts):

```svelte
<!-- src/lib/GameSound.svelte -->
<script module lang="ts">
  import type { Audio as ThreeAudio } from 'three';
  import { soundActions } from '../Sound.svelte'; // reuse listener from existing Sound.svelte

  // Game-specific sound actions exported as module-level singleton
  export const gameSoundActions = {
    playGunshot() { /* ... */ },
    playShieldBash() { /* ... */ },
    playReviveHum() { /* ... */ },
    playAcidSizzle() { /* ... */ },
    playEnemyDeath(type: string) { /* ... */ },
    playDayPhaseTransition() { /* ... */ },
    playFogRollIn() { /* ... */ },
    playItemPickup() { /* ... */ },
  };
</script>

<script lang="ts">
  import { AudioLoader } from '@threlte/core';
  import { Audio, AudioListener } from '@threlte/extras';
  import { stageState } from '../stage.svelte.js';
  import { useTable } from 'spacetimedb/svelte';
  import { tables } from '../module_bindings/index.js';
  import { gameState } from '../game.svelte.js';

  // Watch session state for sound triggers
  const [sessions] = useTable(tables.gameSession);
  const session = $derived(sessions.find(s => s.id === gameState.currentSessionId));

  let prevPhase = $state('');
  $effect(() => {
    if (session?.dayPhase && session.dayPhase !== prevPhase) {
      prevPhase = session.dayPhase;
      gameSoundActions.playDayPhaseTransition();
    }
  });

  let prevFog = $state(false);
  $effect(() => {
    if (session?.fogActive && !prevFog) {
      gameSoundActions.playFogRollIn();
    }
    prevFog = session?.fogActive ?? false;
  });
</script>

<!-- Audio components here -->
```

Mount inside `App.svelte` alongside `Sound.svelte`, always mounted (not gated by stage).

---

## Balancing Checklist

These values were set based on design intent. Adjust after playtesting:

| Parameter | Current Value | Notes |
|-----------|--------------|-------|
| Sprint stamina drain | 3/tick at 15Hz | ~2.25s to empty for Healer (80 stamina) |
| Walk stamina regen | 2/tick at 15Hz | ~2.7s to fully regen from empty for Healer |
| Enemy spawn base interval | 8 seconds | Reduce to 5s by cycle 3 |
| Enemy tick rate | 100ms | Increase to 80ms in late cycles if perf allows |
| Spitter acid pool duration | 8 seconds | Shorten to 6s if too punishing |
| Brace cooldown | 5 seconds | Lengthen if Tank is too strong defensively |
| Revive channel duration | 2 seconds | Increase to 2.5s if Healer too easy to revive |
| Flare mark duration | 8 seconds | Matches acid pool duration |
| Dead end chance | 35% | Reduce to 25% if backtracking feels too punishing |
| Fog frequency | 90-180s between events | Increase minimum gap if fog too dominant |
| Day phase length | 60 seconds | Shorten to 45s in later cycles? |
| Player count bonus 2P | 1.5x | Increase to 1.75x if 2P feels too hard |

---

## Art Pass (Minimum Viable)

The game ships with placeholder meshes from Phase 3. For a demo/beta art pass, prioritize:

1. **Character silhouettes** — each class needs a distinct readable shape at 10+ units distance
   - Spotter: slim, flashlight prop visible
   - Gunner: dual pistol hands visible
   - Tank: wide, shield held out front
   - Healer: medical cross decal, headlamp visible

2. **Enemy silhouettes**
   - Basic: humanoid
   - Fast: lean, hunched
   - Brute: hulking, twice player size
   - Spitter: crouched, head tilted to spit

3. **Forest trees** — replace cone geometry with low-poly conifer GLB (load via `@threlte/extras` `useGltf`)

4. **Lighting pass** — directional light angles and colors tuned per day phase

5. **Post-processing** — Bloom on flashlight, laser sight, flare. Existing `Renderer.svelte` already has Bloom; tune intensity params by phase.

---

## Done When

- [ ] Score formula calculates correctly: time + kills + distance, with day and player count multipliers
- [ ] Score breakdown shown in `GameOverHud` with each component visible
- [ ] Leaderboard shows top 50 runs sorted by score
- [ ] 2-player run scores 1.5x vs 4-player equivalent run
- [ ] Day cycle multiplier increases: Day 1 = 1.0x, Day 2 = 1.5x, Day 3 = 2.0x
- [ ] Audio triggers fire for gunshots, revive, shield bash, day phase transitions, fog
- [ ] Play Again from GameOverHud returns to Lobby stage (not Menu)
- [ ] No TypeScript errors, no console errors during normal gameplay
- [ ] Runs publish cleanly to SpacetimeDB maincloud: `spacetime publish forest-run --module-path backend/spacetimedb`
- [ ] At least one full 4-player run survives into Night phase without desync or crash
