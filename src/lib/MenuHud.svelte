<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
	import { gameActions, gameState } from '../game.svelte.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';

	const [lobbies] = useTable(tables.lobby);

	let joinCode = $state('');
	let playerName = $state('Player');
	let mode = $state<'main' | 'join_code'>('main');

	function quickplay() {
		gameActions.setPlayerName(playerName);
		gameActions.quickplay($lobbies);
		stageActions.setStage('lobby');
	}

	function hostPrivate() {
		gameActions.setPlayerName(playerName);
		gameActions.hostLobby(false);
		stageActions.setStage('lobby');
	}

	function joinByCode() {
		if (joinCode.length < 4) return;
		gameActions.setPlayerName(playerName);
		gameActions.joinByCode(joinCode);
		stageActions.setStage('lobby');
	}
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem;"
>
	<h1 style="font-size: 3rem; margin: 0;">Forest Run</h1>

	<input
		type="text"
		placeholder="Your name"
		bind:value={playerName}
		maxlength={16}
		style="text-align: center; font-size: 1.2rem; padding: 0.4rem 1rem; border-radius: 8px;"
	/>

	{#if mode === 'main'}
		<button onclick={quickplay}>Quick Play</button>
		<button onclick={hostPrivate}>Host Private Lobby</button>
		<button onclick={() => (mode = 'join_code')}>Join by Code</button>
		<button onclick={() => stageActions.setStage('leaderboard')}>Leaderboard</button>
		<button onclick={() => stageActions.setStage('settings')}>Settings</button>
	{:else}
		<input
			type="text"
			placeholder="Enter Code"
			bind:value={joinCode}
			maxlength={6}
			style="text-align: center; text-transform: uppercase; font-size: 1.5rem; padding: 0.4rem 1rem; letter-spacing: 0.3rem; border-radius: 8px;"
		/>
		<button onclick={joinByCode} disabled={joinCode.length < 4}>Join</button>
		<button onclick={() => (mode = 'main')}>Back</button>
	{/if}

	{#if gameState.error}
		<p style="color: red;">{gameState.error}</p>
	{/if}
</div>
