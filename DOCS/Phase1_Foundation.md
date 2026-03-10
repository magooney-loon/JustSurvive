# Phase 1 — Foundation

**Goal:** Strip boilerplate demo content. Wire up Forest Run's stage structure with empty shells. By end of phase, all screens are navigable with placeholder content and the SpacetimeDB backend skeleton is in place.

**Status: COMPLETE**

---

## Deliverables

### 1. Remove Boilerplate Demo Content

Delete these files (boilerplate examples, not used in Forest Run):
- [x] `src/lib/HomeStage.svelte`
- [x] `src/lib/GalaxyStage.svelte`
- [x] `src/lib/HomeHud.svelte`
- [x] `src/lib/GalaxyHud.svelte`
- [x] `src/lib/WelcomeModal.svelte`

Replace the boilerplate SpacetimeDB backend with a Forest Run skeleton:
- [x] Backend lives at `spacetimedb/src/index.ts` (single-file, no separate schema.ts — tables and reducers are co-located)
- [x] `clientConnected` / `clientDisconnected` lifecycle hooks implemented

Update `Root.svelte` to use the new database name:
- [x] DB name is `justsurvive-6769` (configured via `VITE_SPACETIMEDB_DB_NAME` env var, default `justsurvive-6769`)

---

### 2. Update Stage Machine

**File: `src/stage.svelte.ts`**

- [x] `StageType` updated:
  ```typescript
  export type StageType = 'menu' | 'lobby' | 'game' | 'game_over' | 'leaderboard' | 'settings';
  ```

- [x] `STAGES` array has all 6 entries with `id`, `label`, `icon`, and `camera` function:

  | Stage | Label | Icon | Camera position |
  |-------|-------|------|-----------------|
  | `menu` | Menu | `mdiHome` | target `(0,0,0)`, position `(0,8,20)` |
  | `lobby` | Lobby | `mdiAccountGroup` | target `(0,0,0)`, position `(0,8,20)` |
  | `game` | Game | `mdiRun` | target `(0,2,0)`, position `(0,6,12)` (Phase 3 follow-cam placeholder) |
  | `game_over` | Game Over | `mdiSkull` | target `(0,0,0)`, position `(5,4,15)` |
  | `leaderboard` | Leaderboard | `mdiTrophy` | target `(0,0,0)`, position `(0,8,20)` |
  | `settings` | Settings | `mdiCog` | target `(0,0,0)`, position `(0,8,20)` |

- [x] Convenience actions on `stageActions`:
  - `goToMenu()`, `goToLobby()`, `goToGame()`, `goToGameOver()`, `goToLeaderboard()`, `goToSettings()`, `goBack()`
  - `transitionTo(stage, duration?)` — animated with `isTransitioning` flag

---

### 3. Create Stub 3D Stage Components

All inside Canvas, routed through `Scene.svelte`.

- [x] `src/lib/MenuStage.svelte` — flat green plane + ambient + directional light (shared by menu, lobby, leaderboard, settings)
- [x] `src/lib/GameStage.svelte` — slightly darker green plane + lights (placeholder, replaced Phase 3)
- [x] `src/lib/GameOverStage.svelte` — dark plane with low-intensity blue-tinted ambient light

---

### 4. Update Scene.svelte Routing

**File: `src/Scene.svelte`**

- [x] Routes `menu | lobby | leaderboard | settings` → `<MenuStage />`
- [x] Routes `game` → `<GameStage />`
- [x] Routes `game_over` → `<GameOverStage />`
- [x] Uses separate `{#if}` blocks (not `{:else if}`) so transitions fire correctly on switch

---

### 5. Create Stub HUD Components

Each has a `transition:fly` on its root element.

- [x] `src/lib/MenuHud.svelte` — full implementation completed in Phase 2
- [x] `src/lib/LobbyHud.svelte` — full implementation completed in Phase 2
- [x] `src/lib/GameHud.svelte` — stub (Phase 3+)
- [x] `src/lib/GameOverHud.svelte` — stub
- [x] `src/lib/LeaderboardHud.svelte` — stub

---

### 6. Update SceneHud.svelte Routing

**File: `src/SceneHud.svelte`**

- [x] Separate `{#if}` blocks for each stage (never `{:else if}`)
- [x] Routes: `menu` → `MenuHud`, `lobby` → `LobbyHud`, `game` → `GameHud`, `game_over` → `GameOverHud`, `leaderboard` → `LeaderboardHud`, `settings` → `Settings`

---

### 7. SpacetimeDB Backend Skeleton

- [x] Single file: `spacetimedb/src/index.ts` (tables, schema, reducers, lifecycle all in one file)
- [x] `spacetimedb/package.json` and `spacetimedb/tsconfig.json` present
- [x] Module publishes to `justsurvive-6769`

**Scripts in root `package.json`:**

```json
"spacetime:generate": "spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb",
"spacetime:publish:local": "spacetime publish justsurvive-6769 --module-path spacetimedb --server local",
"spacetime:publish:local:fresh": "spacetime publish justsurvive-6769 --module-path spacetimedb --server local --delete-data --yes",
"spacetime:publish": "spacetime publish justsurvive-6769 --module-path spacetimedb --server maincloud"
```

---

### 8. Create `src/game.svelte.ts`

- [x] Reactive `$state` singleton: `currentLobbyId`, `currentSessionId`, `localPlayerClass`, `localPlayerName`, `error`
- [x] `gameActions.init(conn)` — stores `DbConnection` reference, called from `Root.svelte` `onConnect`
- [x] Full lobby actions implemented in Phase 2 (host, join, quickplay, setClass, setReady, startCountdown, leaveLobby)
- [x] `setError(e)` helper strips the `SenderError:` prefix from server error messages before displaying

---

## Done When

- [x] All example stage/HUD files deleted
- [x] Navigating menu → lobby → game → game_over → leaderboard works with transitions
- [x] Settings still works (existing component unchanged)
- [x] Backend skeleton publishes without error: `pnpm spacetime:publish` (DB: `justsurvive-6769`)
- [x] No TypeScript errors (`pnpm check`)
- [x] `stage.svelte.ts` has all 6 stages with camera configs
