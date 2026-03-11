<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
	import { gameActions, gameState } from '../game.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { soundActions } from '../Sound.svelte';

	const conn = useSpacetimeDB();
	const [lobbies] = useTable(tables.lobby);
	const [lobbyPlayers] = useTable(tables.lobbyPlayer);

	const myEntry = $derived(
		$lobbyPlayers.find((p) => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
	);
	const myLobby = $derived(myEntry ? $lobbies.find((l) => l.id === myEntry.lobbyId) : null);
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
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);"
>
	<div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2.5rem; min-width: 340px; color: white; display: flex; flex-direction: column; gap: 1rem; align-items: stretch;">
		<h1 style="margin: 0 0 0.5rem; font-size: 2.25rem; font-weight: 700; text-align: center; letter-spacing: 0.05em;">Forest Run</h1>

		{#if inActiveGame}
			<input
				type="text"
				value={myEntry?.playerName}
				disabled
				style="text-align: center; font-size: 1rem; padding: 0.5rem 1rem; border-radius: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); cursor: not-allowed;"
			/>
			<button
				onclick={() => { soundActions.playClick(); stageActions.setStage('lobby'); }}
				style="padding: 0.6rem; background: rgba(74,170,136,0.3); color: white; border: 1px solid rgba(74,170,136,0.5); border-radius: 0.5rem; cursor: pointer; font-size: 1rem;"
			>
				Reconnect to Lobby
			</button>
			<button
				onclick={() => { soundActions.playClick(); stageActions.setStage('leaderboard'); }}
				style="padding: 0.6rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
			>Leaderboard</button>
			<button
				onclick={() => { soundActions.playClick(); stageActions.setStage('settings'); }}
				style="padding: 0.6rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
			>Settings</button>
		{:else}
			<input
				type="text"
				placeholder="Your name"
				bind:value={playerName}
				maxlength={16}
				style="text-align: center; font-size: 1rem; padding: 0.5rem 1rem; border-radius: 0.5rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: white; outline: none;"
			/>

			{#if mode === 'main'}
				<button
					onclick={() => { soundActions.playClick(); quickplay(); }}
					disabled={loading}
					style="padding: 0.65rem; background: rgba(74,170,136,0.25); color: white; border: 1px solid rgba(74,170,136,0.45); border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;"
				>Quick Play</button>
				<button
					onclick={() => { soundActions.playClick(); hostPrivate(); }}
					disabled={loading}
					style="padding: 0.65rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
				>Host Private Lobby</button>
				<button
					onclick={() => { soundActions.playClick(); gameActions.clearError(); mode = 'join_code'; }}
					disabled={loading}
					style="padding: 0.65rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
				>Join by Code</button>
				<div style="display: flex; gap: 0.5rem;">
					<button
						onclick={() => { soundActions.playClick(); stageActions.setStage('leaderboard'); }}
						disabled={loading}
						style="flex: 1; padding: 0.5rem; background: rgba(255,255,255,0.07); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;"
					>Leaderboard</button>
					<button
						onclick={() => { soundActions.playClick(); stageActions.setStage('settings'); }}
						disabled={loading}
						style="flex: 1; padding: 0.5rem; background: rgba(255,255,255,0.07); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;"
					>Settings</button>
				</div>
			{:else}
				<input
					type="text"
					placeholder="Enter Code"
					bind:value={joinCode}
					maxlength={6}
					style="text-align: center; text-transform: uppercase; font-size: 1.75rem; padding: 0.5rem 1rem; letter-spacing: 0.4em; border-radius: 0.5rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); color: white; outline: none;"
				/>
				<button
					onclick={() => { soundActions.playClick(); joinByCode(); }}
					disabled={joinCode.length < 4 || loading}
					style="padding: 0.65rem; background: rgba(74,170,136,0.25); color: white; border: 1px solid rgba(74,170,136,0.45); border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;"
				>Join</button>
				<button
					onclick={() => { soundActions.playClick(); gameActions.clearError(); mode = 'main'; }}
					disabled={loading}
					style="padding: 0.5rem; background: rgba(255,255,255,0.07); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer;"
				>Back</button>
			{/if}

			{#if loading}
				<p style="text-align: center; color: rgba(255,255,255,0.5); margin: 0; font-size: 0.875rem;">Connecting...</p>
			{:else if gameState.error}
				<p style="text-align: center; color: #f66; margin: 0; font-size: 0.875rem;">{gameState.error}</p>
			{/if}
		{/if}
	</div>
</div>
