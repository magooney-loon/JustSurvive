<script lang="ts">
	import { fly } from 'svelte/transition';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState, lobbyActions } from '$lib/stores/lobby.svelte.js';
	import { stageActions } from '$root/stage.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

	const [players] = useTable(tables.playerState);

	const sessionPlayers = $derived(
		$players
			.filter((p) => p.sessionId === lobbyState.currentSessionId)
			.sort((a, b) => Number(b.score - a.score))
	);

	function goToMenu() {
		if (lobbyState.currentLobbyId) lobbyActions.leaveLobby(lobbyState.currentLobbyId);
		stageActions.setStage('menu');
	}
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	class="rpgui-content"
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);"
>
	<div class="rpgui-container framed" style="padding: 2rem; min-width: 360px;">
		<h2>Game Over</h2>
		<p class="rpgui-center">Final Scores</p>

		<div
			class="rpgui-list-imp"
			style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.75rem; max-height: 300px; overflow-y: auto;"
		>
			{#each sessionPlayers as p, i (p.id)}
				<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.875rem;">
					<span style="color: #ffd060; font-weight: 700; width: 1.5rem;">#{i + 1}</span>
					<span style="flex: 1; text-transform: capitalize;">{p.classChoice}</span>
					<span
						style="font-size: 0.8rem; font-weight: 600; color: {p.status === 'downed'
							? '#f66'
							: '#4f4'};"
					>
						{p.status === 'downed' ? 'Downed' : 'Survived'}
					</span>
					<span style="color: #ffd060; font-weight: 700;"> {Number(p.score).toLocaleString()}</span>
				</div>
			{/each}
		</div>

		<div style="display: flex; justify-content: center;">
			<button
				class="rpgui-button"
				onclick={() => {
					soundActions.playClick();
					goToMenu();
				}}
			>
				<p>Back to Menu</p>
			</button>
		</div>
	</div>
</div>
