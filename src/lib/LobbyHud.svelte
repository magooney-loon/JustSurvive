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
