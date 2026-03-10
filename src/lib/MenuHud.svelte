<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
</script>

<div transition:fly={{ y: 20 }} style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
	<h1>Forest Run</h1>
	<button onclick={() => stageActions.setStage('lobby')}>Play</button>
	<button onclick={() => stageActions.setStage('settings')}>Settings</button>
</div>
