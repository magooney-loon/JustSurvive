# Phase 1 — Foundation

**Goal:** Strip boilerplate demo content. Wire up Forest Run's stage structure with empty shells. By end of phase, all screens are navigable with placeholder content and the SpacetimeDB backend skeleton is in place.

---

## Deliverables

### 1. Remove Boilerplate Demo Content

Delete these files (boilerplate examples, not used in Forest Run):
- `src/lib/HomeStage.svelte`
- `src/lib/GalaxyStage.svelte`
- `src/lib/HomeHud.svelte`
- `src/lib/GalaxyHud.svelte`
- `src/lib/WelcomeModal.svelte`

Replace the boilerplate SpacetimeDB backend with a Forest Run skeleton:
- `backend/spacetimedb/src/schema.ts` — empty shell with correct imports, exports `spacetimedb`
- `backend/spacetimedb/src/index.ts` — `clientConnected` / `clientDisconnected` lifecycle stubs only

Update `main.ts` to use the new database name (`forest-run`).

---

### 2. Update Stage Machine

**File: `src/stage.svelte.ts`**

Update `StageType`:
```typescript
export type StageType = 'menu' | 'lobby' | 'game' | 'game_over' | 'leaderboard' | 'settings';
```

Update `STAGES` array — each entry needs `id`, `label`, `icon`, and a `camera` function. Use placeholder camera positions (proper follow-cam comes in Phase 3):

```typescript
export const STAGES: StageConfig[] = [
  {
    id: 'menu',
    label: 'Menu',
    icon: 'mdiHome',
    camera: (controls, animated) => {
      // Cinematic forest vista — adjust values in Phase 3 art pass
      controls.setTarget(0, 0, 0, animated);
      controls.setPosition(0, 8, 20, animated);
    },
  },
  {
    id: 'lobby',
    label: 'Lobby',
    icon: 'mdiAccountGroup',
    camera: (controls, animated) => {
      controls.setTarget(0, 0, 0, animated);
      controls.setPosition(0, 8, 20, animated);
    },
  },
  {
    id: 'game',
    label: 'Game',
    icon: 'mdiRun',
    camera: (controls, animated) => {
      // Placeholder — overridden by follow-cam in Phase 3
      controls.setTarget(0, 2, 0, animated);
      controls.setPosition(0, 6, 12, animated);
    },
  },
  {
    id: 'game_over',
    label: 'Game Over',
    icon: 'mdiSkull',
    camera: (controls, animated) => {
      controls.setTarget(0, 0, 0, animated);
      controls.setPosition(5, 4, 15, animated);
    },
  },
  {
    id: 'leaderboard',
    label: 'Leaderboard',
    icon: 'mdiTrophy',
    camera: (controls, animated) => {
      controls.setTarget(0, 0, 0, animated);
      controls.setPosition(0, 8, 20, animated);
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'mdiCog',
    camera: (controls, animated) => {
      controls.setTarget(0, 0, 0, animated);
      controls.setPosition(0, 8, 20, animated);
    },
  },
];
```

Add convenience actions to `stageActions`:
```typescript
goToMenu: () => stageActions.setStage('menu'),
goToLobby: () => stageActions.setStage('lobby'),
goToGame: () => stageActions.setStage('game'),
goToGameOver: () => stageActions.setStage('game_over'),
goToLeaderboard: () => stageActions.setStage('leaderboard'),
```

---

### 3. Create Stub 3D Stage Components

All inside Canvas, routed through `Scene.svelte`.

**`src/lib/MenuStage.svelte`** — shared by menu, lobby, leaderboard, settings:
```svelte
<script lang="ts">
  import { T } from '@threlte/core';
</script>

<!-- Placeholder: flat plane + ambient light. Replace with forest vista in Phase 3 art pass. -->
<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[10, 20, 10]} intensity={1} />
<T.Mesh position={[0, -0.5, 0]}>
  <T.PlaneGeometry args={[100, 100]} />
  <T.MeshStandardMaterial color="#2d4a1e" />
</T.Mesh>
```

**`src/lib/GameStage.svelte`** — full gameplay world (stub):
```svelte
<script lang="ts">
  import { T } from '@threlte/core';
</script>

<!-- Placeholder: same as MenuStage. Replaced entirely in Phase 3. -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[10, 20, 10]} intensity={0.8} />
<T.Mesh position={[0, -0.5, 0]}>
  <T.PlaneGeometry args={[200, 200]} />
  <T.MeshStandardMaterial color="#1a3a10" />
</T.Mesh>
```

**`src/lib/GameOverStage.svelte`** — deep night scene (stub):
```svelte
<script lang="ts">
  import { T } from '@threlte/core';
</script>

<T.AmbientLight intensity={0.05} color="#1a1a4a" />
<T.Mesh position={[0, -0.5, 0]}>
  <T.PlaneGeometry args={[100, 100]} />
  <T.MeshStandardMaterial color="#0a0a0a" />
</T.Mesh>
```

---

### 4. Update Scene.svelte Routing

**File: `src/Scene.svelte`**

Replace existing stage routing with:
```svelte
<script lang="ts">
  import { stageState } from '../stage.svelte.js';
  import MenuStage from '../lib/MenuStage.svelte';
  import GameStage from '../lib/GameStage.svelte';
  import GameOverStage from '../lib/GameOverStage.svelte';
</script>

{#if stageState.currentStage === 'menu' || stageState.currentStage === 'lobby' || stageState.currentStage === 'leaderboard' || stageState.currentStage === 'settings'}
  <MenuStage />
{/if}

{#if stageState.currentStage === 'game'}
  <GameStage />
{/if}

{#if stageState.currentStage === 'game_over'}
  <GameOverStage />
{/if}
```

---

### 5. Create Stub HUD Components

Each has a `transition:fly` on its root element (existing boilerplate pattern).

**`src/lib/MenuHud.svelte`** — actual implementation in Phase 2:
```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ y: 20 }} style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
  <h1>Forest Run</h1>
  <button onclick={() => stageActions.setStage('lobby')}>Play</button>
  <button onclick={() => stageActions.setStage('settings')}>Settings</button>
</div>
```

**`src/lib/LobbyHud.svelte`** — stub:
```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ y: 20 }} style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
  <div>
    <h2>Lobby (Phase 2)</h2>
    <button onclick={() => stageActions.setStage('game')}>Start (dev)</button>
    <button onclick={() => stageActions.setStage('menu')}>Back</button>
  </div>
</div>
```

**`src/lib/GameHud.svelte`** — stub (Phase 3+):
```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ x: -20 }} style="position: absolute; top: 1rem; left: 1rem;">
  <p>Game HUD (Phase 3)</p>
  <button onclick={() => stageActions.setStage('game_over')}>End Game (dev)</button>
</div>
```

**`src/lib/GameOverHud.svelte`** — stub:
```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ y: 20 }} style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
  <div>
    <h2>Game Over</h2>
    <button onclick={() => stageActions.setStage('menu')}>Main Menu</button>
    <button onclick={() => stageActions.setStage('leaderboard')}>Leaderboard</button>
  </div>
</div>
```

**`src/lib/LeaderboardHud.svelte`** — stub:
```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ y: 20 }} style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
  <div>
    <h2>Leaderboard (Phase 6)</h2>
    <button onclick={() => stageActions.setStage('menu')}>Back</button>
  </div>
</div>
```

---

### 6. Update SceneHud.svelte Routing

**File: `src/SceneHud.svelte`**

Replace existing HUD routing with separate `{#if}` blocks (never `{:else if}`):
```svelte
<script lang="ts">
  import { stageState } from '../stage.svelte.js';
  import MenuHud from '../lib/MenuHud.svelte';
  import LobbyHud from '../lib/LobbyHud.svelte';
  import GameHud from '../lib/GameHud.svelte';
  import GameOverHud from '../lib/GameOverHud.svelte';
  import LeaderboardHud from '../lib/LeaderboardHud.svelte';
  import Settings from '../lib/Settings.svelte';
</script>

{#if stageState.currentStage === 'menu'}
  <MenuHud />
{/if}

{#if stageState.currentStage === 'lobby'}
  <LobbyHud />
{/if}

{#if stageState.currentStage === 'game'}
  <GameHud />
{/if}

{#if stageState.currentStage === 'game_over'}
  <GameOverHud />
{/if}

{#if stageState.currentStage === 'leaderboard'}
  <LeaderboardHud />
{/if}

{#if stageState.currentStage === 'settings'}
  <Settings />
{/if}
```

---

### 7. SpacetimeDB Backend Skeleton

**`backend/spacetimedb/src/schema.ts`:**
```typescript
import { schema } from 'spacetimedb/server';

// Tables added in Phase 2+
const spacetimedb = schema({});
export default spacetimedb;
```

**`backend/spacetimedb/src/index.ts`:**
```typescript
import spacetimedb from './schema.js';
import { log } from '../../src/settings.svelte.js'; // logging pattern

spacetimedb.clientConnected((ctx) => {
  // Phase 2: create/update player presence
});

spacetimedb.clientDisconnected((ctx) => {
  // Phase 2: clean up lobby membership
});
```

---

### 8. Create `src/game.svelte.ts`

Reactive singleton for client-side game state. Starts minimal, grows each phase:

```typescript
// src/game.svelte.ts

export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const gameState = $state({
  currentLobbyId: null as bigint | null,
  currentSessionId: null as bigint | null,
  localPlayerClass: null as PlayerClass | null,
});

export { gameState };

export const gameActions = {
  setClass(cls: PlayerClass) {
    gameState.localPlayerClass = cls;
  },
  setLobby(id: bigint) {
    gameState.currentLobbyId = id;
  },
  setSession(id: bigint) {
    gameState.currentSessionId = id;
  },
  clearGame() {
    gameState.currentLobbyId = null;
    gameState.currentSessionId = null;
    gameState.localPlayerClass = null;
  },
};
```

---

## Done When

- [ ] All example stage/HUD files deleted
- [ ] Navigating menu → lobby → game → game_over → leaderboard works with transitions
- [ ] Settings still works (existing component unchanged)
- [ ] Backend skeleton publishes without error: `spacetime publish forest-run --module-path backend/spacetimedb`
- [ ] No TypeScript errors (`pnpm check`)
- [ ] `stage.svelte.ts` has all 6 stages with camera configs
