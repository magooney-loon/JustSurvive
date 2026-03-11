<script lang="ts">
	import { fly } from 'svelte/transition';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState, gameActions } from '../game.svelte.js';
	import { stageActions } from '../stage.svelte.js';

	const [players] = useTable(tables.playerState);

	const sessionPlayers = $derived(
		$players
			.filter(p => p.sessionId === gameState.currentSessionId)
			.sort((a, b) => Number(b.score - a.score))
	);

	function goToMenu() {
		if (gameState.currentLobbyId) gameActions.leaveLobby(gameState.currentLobbyId);
		stageActions.setStage('menu');
	}
</script>

<div transition:fly={{ y: 20, duration: 300 }}
     style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
	<div style="background: rgba(0,0,0,0.8); padding: 2rem; border-radius: 12px; min-width: 340px; text-align: center;">
		<h2 style="margin: 0 0 0.25rem;">Game Over</h2>
		<p style="color: #aaa; margin: 0 0 1.5rem; font-size: 0.9rem;">Final Scores</p>

		<div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem;">
			{#each sessionPlayers as p, i (p.id)}
				<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem;
				            background: rgba(255,255,255,0.07); border-radius: 8px;
				            opacity: {p.status === 'eliminated' ? 0.5 : 1};">
					<span style="color: #ff8; font-weight: bold; width: 1.2rem;">#{i + 1}</span>
					<span style="flex: 1; text-align: left; text-transform: capitalize;">{p.classChoice}</span>
					<span style="color: {p.status === 'eliminated' ? '#f44' : '#4f4'}; font-size: 0.8rem;">
						{p.status === 'eliminated' ? 'Eliminated' : 'Survived'}
					</span>
					<span style="color: #ff8; font-weight: bold;">{Number(p.score).toLocaleString()}</span>
				</div>
			{/each}
		</div>

		<button onclick={goToMenu}
		        style="padding: 0.6rem 2rem; background: #2a5; border: none; border-radius: 8px;
		               color: #fff; font-size: 1rem; cursor: pointer;">
			Back to Menu
		</button>
	</div>
</div>
