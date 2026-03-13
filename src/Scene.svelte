<script lang="ts">
	import { stageState } from '$root/stage.svelte.js';
	import MenuStage from '$lib/stages/MenuStage.svelte';
	import GameStage from '$lib/stages/GameStage.svelte';
	import GameOverStage from '$lib/stages/GameOverStage.svelte';
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
