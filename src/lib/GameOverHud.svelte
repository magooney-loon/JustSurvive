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
