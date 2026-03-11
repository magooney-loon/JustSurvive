<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
	import { gameActions, gameState } from '../game.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';

	const conn = useSpacetimeDB();
	const [lobbies] = useTable(tables.lobby);
	const [lobbyPlayers] = useTable(tables.lobbyPlayer);

	const myEntry = $derived(
		$lobbyPlayers.find((p) => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
	);
	const myLobby = $derived(myEntry ? $lobbies.find((l) => l.id === myEntry.lobbyId) : null);
	// Only show reconnect for active games; redirect to lobby for waiting/countdown
	const inActiveGame = $derived(myLobby?.status === 'in_progress');

	$effect(() => {
		if (!myLobby) {
			gameState.leavingLobby = false;
			return;
		}
		if (myLobby.status !== 'in_progress' && !gameState.leavingLobby) {
			stageActions.setStage('lobby');
		}
	});

	let joinCode = $state('');
	let playerName = $state('Player');
	let mode = $state<'main' | 'join_code'>('main');
	let loading = $state(false);

	async function quickplay() {
		loading = true;
		gameActions.setPlayerName(playerName);
		await gameActions.quickplay($lobbies);
		loading = false;
		if (!gameState.error) stageActions.setStage('lobby');
	}

	async function hostPrivate() {
		loading = true;
		gameActions.setPlayerName(playerName);
		await gameActions.hostLobby(false);
		loading = false;
		if (!gameState.error) stageActions.setStage('lobby');
	}

	async function joinByCode() {
		if (joinCode.length < 4) return;
		loading = true;
		gameActions.setPlayerName(playerName);
		await gameActions.joinByCode(joinCode);
		loading = false;
		if (!gameState.error) stageActions.setStage('lobby');
	}
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem;"
>
	<h1 style="font-size: 3rem; margin: 0;">Forest Run</h1>

	{#if inActiveGame}
		<input
			type="text"
			value={myEntry?.playerName}
			disabled
			style="text-align: center; font-size: 1.2rem; padding: 0.4rem 1rem; border-radius: 8px; opacity: 0.6; cursor: not-allowed;"
		/>
		<button
			onclick={() => stageActions.setStage('lobby')}
			style="background: #4a8; padding: 0.6rem 2rem; border-radius: 8px; font-size: 1.1rem;"
		>
			Reconnect to Lobby
		</button>
		<button onclick={() => stageActions.setStage('leaderboard')}>Leaderboard</button>
		<button onclick={() => stageActions.setStage('settings')}>Settings</button>
	{:else}
		<input
			type="text"
			placeholder="Your name"
			bind:value={playerName}
			maxlength={16}
			style="text-align: center; font-size: 1.2rem; padding: 0.4rem 1rem; border-radius: 8px;"
		/>

		{#if mode === 'main'}
			<button onclick={quickplay} disabled={loading}>Quick Play</button>
			<button onclick={hostPrivate} disabled={loading}>Host Private Lobby</button>
			<button
				onclick={() => {
					gameActions.clearError();
					mode = 'join_code';
				}}
				disabled={loading}>Join by Code</button
			>
			<button onclick={() => stageActions.setStage('leaderboard')} disabled={loading}
				>Leaderboard</button
			>
			<button onclick={() => stageActions.setStage('settings')} disabled={loading}>Settings</button>
		{:else}
			<input
				type="text"
				placeholder="Enter Code"
				bind:value={joinCode}
				maxlength={6}
				style="text-align: center; text-transform: uppercase; font-size: 1.5rem; padding: 0.4rem 1rem; letter-spacing: 0.3rem; border-radius: 8px;"
			/>
			<button onclick={joinByCode} disabled={joinCode.length < 4 || loading}>Join</button>
			<button
				onclick={() => {
					gameActions.clearError();
					mode = 'main';
				}}
				disabled={loading}>Back</button
			>
		{/if}

		{#if loading}
			<p style="color: #aaa;">Connecting...</p>
		{:else if gameState.error}
			<p style="color: #f66;">{gameState.error}</p>
		{/if}
	{/if}
</div>
