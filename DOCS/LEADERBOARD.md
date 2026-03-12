# Leaderboard Design — Per-Lobby Rankings

## Goal

Rank **lobbies by squad performance** — the squad composition is what matters, not individual players.
Top 20 enforced **server-side** in the reducer. Global stats accumulate across ALL games.

---

## Tables (4 new)

### 1. `LobbyResult` — top 20 leaderboard rows

Max 20 rows at all times, managed by the reducer.

```ts
LobbyResult {
  id:           u64        primaryKey autoInc
  sessionId:    u64        -- dedup guard
  lobbyCode:    string     -- denormalized (lobby resets after session)
  combo:        string     -- sorted class string e.g. "gunner,healer,tank"
  playerCount:  u64        -- 1–4
  totalScore:   u64
  survivalSecs: u64
  cycleNumber:  u64
  createdAt:    timestamp

  indexes:
    lobby_result_score    btree ['totalScore']  -- find lowest to evict
    lobby_result_session  btree ['sessionId']   -- dedup
}
```

### 2. `LobbyResultPlayer` — name + class for top-20 display only

One row per player per top-20 session. Deleted alongside its parent when evicted.
No scoring here — purely for showing who was in that squad on the leaderboard.

```ts
LobbyResultPlayer {
  id:          u64     primaryKey autoInc
  sessionId:   u64     -- links to LobbyResult.sessionId
  playerName:  string  -- display only
  classChoice: string  -- 'spotter' | 'gunner' | 'tank' | 'healer'

  indexes:
    lobby_result_player_session  btree ['sessionId']
}
```

### 3. `GlobalStats` — single-row accumulator (id always = 1n)

Every completed session updates this, regardless of top-20 qualification.

```ts
GlobalStats {
  id:                u64   primaryKey   -- always 1n
  totalGames:        u64
  totalSurvivalSecs: u64
  bestSurvivalSecs:  u64
  -- class slot counts (how many times each class appeared across all sessions)
  classSpotter:      u64
  classGunner:       u64
  classTank:         u64
  classHealer:       u64
}
```

### 4. `SquadRecord` — one row per unique class combo

Tracks how often a squad composition has been played and its best results.
`combo` is alphabetically sorted and comma-joined: `"gunner,healer"`, `"gunner,healer,spotter,tank"`.

```ts
SquadRecord {
  id:               u64      primaryKey autoInc
  combo:            string   unique
  timesPlayed:      u64
  bestScore:        u64
  bestSurvivalSecs: u64

  indexes:
    squad_record_combo         btree unique ['combo']      -- upsert lookup
    squad_record_times_played  btree ['timesPlayed']       -- sort by popularity
    squad_record_best_score    btree ['bestScore']         -- sort by performance
}
```

---

## Backend Changes (all in `index.ts`)

### Register in `schema({})`

```ts
const spacetimedb = schema({
  ...existing...,
  lobbyResult,
  lobbyResultPlayer,
  globalStats,
  squadRecord,
});
```

### Logic injected into `end_session()`

```
1. Build combo string
   - players = [...ctx.db.playerState.player_state_session_id.filter(sessionId)]
   - classes = players.map(p => p.classChoice).filter(c => c !== '').sort()
   - combo = classes.join(',')   e.g. "gunner,healer,tank"
   - totalScore = players.reduce((acc, p) => acc + p.score, 0n)
   - survivalSecs = (endedAt - startedAt) / 1_000_000n

2. Update GlobalStats (id = 1n)
   - If exists: increment totalGames, totalSurvivalSecs, each class count, update bestSurvivalSecs
   - If not exists: insert fresh row with id: 1n

3. Upsert SquadRecord for this combo
   - Look up: [...ctx.db.squadRecord.squad_record_combo.filter(combo)][0]
   - If exists: update timesPlayed+1, bestScore if higher, bestSurvivalSecs if higher
   - If not: insert new row

4. Top-20 gate
   a. Dedup: skip if sessionId already exists in lobby_result_session index
   b. Count existing LobbyResult rows via iter()
   c. If count < 20 → insert
   d. If count == 20:
      - Find row with lowest totalScore (iter over 20 rows, find min)
      - If new totalScore > min → evict:
          * Delete all LobbyResultPlayer rows where sessionId = evicted.sessionId
          * Delete the LobbyResult row
          * Insert new ones
      - Else → skip (doesn't qualify)

5. Insert LobbyResult (if qualified)
   { id: 0n, sessionId, lobbyCode: lobby.code, combo, playerCount: BigInt(classes.length),
     totalScore, survivalSecs, cycleNumber: session.cycleNumber, createdAt: ctx.timestamp }

6. Insert LobbyResultPlayer rows (one per player, if qualified)
   - For each PlayerState row, find matching LobbyPlayer by playerIdentity to get playerName
   - Insert: { id: 0n, sessionId, playerName, classChoice: player.classChoice }
```

---

## Frontend: `LeaderboardHud.svelte`

### Data sources

```ts
const [results, _]        = useTable(tables.LobbyResult);        // top 20
const [resultPlayers, _]  = useTable(tables.LobbyResultPlayer);  // name+class per session
const [globalStats, _]    = useTable(tables.GlobalStats);         // single row
const [squadRecords, _]   = useTable(tables.SquadRecord);         // all combos
```

### Leaderboard table (sort by totalScore DESC client-side, already ≤20 rows)

Each row expands to show the squad roster (name + class icon), no identity-based highlighting.

| Rank | Code | Score | Survived | Cycles |
|------|------|-------|----------|--------|
| 1 | AB12CD | 3,530 | 8m 32s | 3 |
|   | ↳ Alice · Gunner · Bob · Healer · Carol · Spotter · Dan · Tank | | | |
| 2 | XY99ZZ | 1,900 | 5m 10s | 2 |
|   | ↳ Eve · Gunner · Frank · Tank | | | |

```ts
// Get players for a row
const rowPlayers = $resultPlayers.filter(p => p.sessionId === row.sessionId);
// Display: "Name (Class)" per player, joined by " · "
```

### Global stats panel (from `GlobalStats[0]`)

```
Total Games Played:  142
Best Survival:       12m 44s
Avg Survival:        totalSurvivalSecs / totalGames

Class Distribution (% of total slots played):
  Spotter  ██████░░░░  22%
  Gunner   █████████░  31%
  Tank     █████░░░░░  18%
  Healer   ████████░░  29%
```

`classSpotter / (classSpotter + classGunner + classTank + classHealer)`

### Top squad combos (two views, toggle)

**Most Played** — sort `squadRecords` by `timesPlayed DESC`, top 5:
```
  Gunner + Healer + Spotter + Tank  ×38  Best 4,210  Longest 11m 20s
  Gunner + Tank                     ×21  Best 2,800  Longest  7m 05s
  Gunner + Healer                   ×14  Best 2,100  Longest  6m 30s
```

**Best Score** — sort by `bestScore DESC`, top 5:
```
  Gunner + Healer + Spotter + Tank  Best 4,210  ×38 games
  Spotter + Tank                    Best 3,100  ×5 games
```

---

## Implementation Order

1. **Backend** — add 4 tables to `index.ts` (after `ReviveCompleteJob`, before `schema({})`)
2. **Backend** — register in `schema({})`
3. **Backend** — inject logic into `end_session()` helper
4. **Publish fresh** — `npm run spacetime:publish:local:fresh`
5. **Generate** — `npm run spacetime:generate`
6. **Frontend** — implement `LeaderboardHud.svelte`

---

## Edge Cases

| Case | Handling |
|------|---------|
| All players left before session ends | `classes` array empty → `combo = "none"` |
| Unselected class (`''`) | Filtered out before building combo |
| Tie on totalScore during eviction | Keep older entry (don't evict on equal) |
| Reducer called twice | Dedup via `lobby_result_session` index |
| Solo player | `combo = "gunner"` (single class) — valid SquadRecord entry |
