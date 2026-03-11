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

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);"
>
	<div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2rem; min-width: 360px; color: white;">
		<h2 style="margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 700; text-align: center;">Game Over</h2>
		<p style="color: rgba(255,255,255,0.45); margin: 0 0 1.5rem; font-size: 0.875rem; text-align: center; text-transform: uppercase; letter-spacing: 0.08em;">Final Scores</p>

		<div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.75rem;">
			{#each sessionPlayers as p, i (p.id)}
				<div style="
					display: flex; align-items: center; gap: 0.75rem;
					padding: 0.65rem 0.875rem;
					background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
					border-radius: 0.5rem;
					opacity: {p.status === 'eliminated' ? 0.5 : 1};
				">
					<span style="color: #ffd060; font-weight: 700; width: 1.5rem; font-size: 0.95rem;">#{i + 1}</span>
					<span style="flex: 1; text-transform: capitalize; font-size: 0.95rem;">{p.classChoice}</span>
					<span style="font-size: 0.8rem; font-weight: 600; color: {p.status === 'eliminated' ? '#f66' : '#4f4'};">
						{p.status === 'eliminated' ? 'Eliminated' : 'Survived'}
					</span>
					<span style="color: #ffd060; font-weight: 700; font-size: 1rem;">{Number(p.score).toLocaleString()}</span>
				</div>
			{/each}
		</div>

		<button
			onclick={goToMenu}
			style="width: 100%; padding: 0.7rem; background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;"
		>
			Back to Menu
		</button>
	</div>
</div>
