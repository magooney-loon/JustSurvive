<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ x: -20 }} style="position: absolute; top: 1rem; left: 1rem;">
	<p>Game HUD (Phase 3)</p>
	<button onclick={() => stageActions.setStage('game_over')}>End Game (dev)</button>
</div>
