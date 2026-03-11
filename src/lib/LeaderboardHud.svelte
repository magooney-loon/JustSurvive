<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);"
>
	<div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2rem; min-width: 340px; color: white;">
		<h2 style="margin: 0 0 1.5rem; font-size: 1.5rem; font-weight: 600;">Leaderboard</h2>
		<p style="color: rgba(255,255,255,0.4); font-size: 0.875rem; text-align: center; margin: 0 0 1.5rem;">Coming in a future phase.</p>
		<button
			onclick={() => stageActions.setStage('menu')}
			style="width: 100%; padding: 0.6rem; background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 0.5rem; cursor: pointer;"
		>
			Back
		</button>
	</div>
</div>
