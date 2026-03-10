<script lang="ts">
	import { stageState } from './stage.svelte.js';
	import MenuStage from '$lib/MenuStage.svelte';
	import GameStage from '$lib/GameStage.svelte';
	import GameOverStage from '$lib/GameOverStage.svelte';
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
