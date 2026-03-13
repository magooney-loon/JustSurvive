<script lang="ts">
	import { fade } from 'svelte/transition';
	import { stageState } from '$root/stage.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import MenuHud from '$lib/stages/MenuHud.svelte';
	import LobbyHud from '$lib/lobby/LobbyHud.svelte';
	import GameHud from '$lib/stages/GameHud.svelte';
	import GameOverHud from '$lib/stages/GameOverHud.svelte';
	import LeaderboardHud from '$lib/stages/LeaderboardHud.svelte';
	import Settings from '$lib/stages/Settings.svelte';
</script>

<!-- HTML overlay — rendered as a sibling to <Canvas> in App.svelte -->
{#if settingsState.general.uiVisible}
	<div
		transition:fade={{ duration: 150 }}
		style="position: absolute; inset: 0; pointer-events: none;"
	>
		<div style="position: relative; width: 100%; height: 100%; pointer-events: none;">
			{#if stageState.currentStage === 'menu'}
				<div style="pointer-events: auto;"><MenuHud /></div>
			{/if}

			{#if stageState.currentStage === 'lobby'}
				<div style="pointer-events: auto;"><LobbyHud /></div>
			{/if}

			{#if stageState.currentStage === 'game'}
				<div style="pointer-events: auto;"><GameHud /></div>
			{/if}

			{#if stageState.currentStage === 'game_over'}
				<div style="pointer-events: auto;"><GameOverHud /></div>
			{/if}

			{#if stageState.currentStage === 'leaderboard'}
				<div style="pointer-events: auto;"><LeaderboardHud /></div>
			{/if}

			{#if stageState.currentStage === 'settings'}
				<div style="pointer-events: auto;"><Settings /></div>
			{/if}
		</div>
	</div>
{/if}
