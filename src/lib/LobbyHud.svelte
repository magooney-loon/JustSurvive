<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '../stage.svelte.js';
	import { gameActions, gameState } from '../game.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';

	const conn = useSpacetimeDB();
	const [lobbies] = useTable(tables.lobby);
	const [lobbyPlayers] = useTable(tables.lobbyPlayer);
	const [sessions] = useTable(tables.gameSession);

	// Find our lobby by our identity in lobbyPlayer
	const myEntry = $derived($lobbyPlayers.find(p => p.playerIdentity.toHexString() === $conn.identity?.toHexString()));
	const currentLobby = $derived(myEntry ? $lobbies.find(l => l.id === myEntry.lobbyId) : null);
	const players = $derived(currentLobby ? $lobbyPlayers.filter(p => p.lobbyId === currentLobby.id) : []);
	const isHost = $derived(currentLobby?.hostIdentity.toHexString() === $conn.identity?.toHexString());
	const allReady = $derived(players.length >= 2 && players.every(p => p.isReady && p.classChoice));

	const CLASSES = ['spotter', 'gunner', 'tank', 'healer'] as const;

	let countdownValue = $state(3);
	$effect(() => {
		if (currentLobby?.status === 'countdown') {
			countdownValue = 3;
			const interval = setInterval(() => {
				countdownValue = Math.max(0, countdownValue - 1);
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	// Watch for session starting → transition to game (only pick the active session)
	$effect(() => {
		if (currentLobby?.status === 'in_progress') {
			const session = $sessions.find(s => s.lobbyId === currentLobby.id && s.status === 'active');
			if (session) {
				gameState.currentSessionId = session.id;
				stageActions.setStage('game');
			}
		}
	});

	function copyCode() {
		if (currentLobby) navigator.clipboard.writeText(currentLobby.code);
	}
</script>

<div transition:fly={{ y: 20, duration: 300 }}
     style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
	<div style="background: rgba(0,0,0,0.7); padding: 2rem; border-radius: 12px; min-width: 400px;">

		{#if !currentLobby}
			<p>Connecting to lobby...</p>
			<button onclick={() => stageActions.setStage('menu')}>Back</button>

		{:else}
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
				<h2 style="margin: 0;">Lobby</h2>
				{#if currentLobby?.isPublic}
					<span style="background: #2a5; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">PUBLIC</span>
				{:else}
					<button onclick={copyCode}>Code: {currentLobby?.code} 📋</button>
				{/if}
			</div>

			<!-- Player list -->
			<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
				{#each players as player (player.id)}
					<div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
						<span style="flex: 1;">{player.playerName}</span>
						<span style="color: #aaa; font-size: 0.85rem;">{player.classChoice || '—'}</span>
						<span style="color: {player.isReady ? '#4f4' : '#f44'};">{player.isReady ? '✓ Ready' : 'Not Ready'}</span>
						{#if player.playerIdentity.toHexString() === currentLobby?.hostIdentity.toHexString()}
							<span title="Host">👑</span>
						{/if}
					</div>
				{/each}
				{#if players.length < 4}
					{#each { length: 4 - players.length } as _}
						<div style="padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 8px; color: #555;">
							Waiting for player...
						</div>
					{/each}
				{/if}
			</div>

			<!-- Class selector -->
			<div style="margin-bottom: 1rem;">
				<p style="margin: 0 0 0.5rem; font-size: 0.85rem; color: #aaa;">Select class:</p>
				<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
					{#each CLASSES as cls}
						<button
							onclick={() => gameActions.setClass(cls, currentLobby.id)}
							style="background: {myEntry?.classChoice === cls ? '#4a8' : 'rgba(255,255,255,0.1)'}; padding: 0.4rem 0.8rem; border-radius: 6px; text-transform: capitalize;"
						>
							{cls}
						</button>
					{/each}
				</div>
			</div>

			<!-- Ready toggle -->
			<div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
				<button
					onclick={() => gameActions.setReady(currentLobby.id, !myEntry?.isReady)}
					disabled={!myEntry?.classChoice || currentLobby?.status !== 'waiting'}
					style="flex: 1; background: {myEntry?.isReady ? '#4a8' : '#555'}; padding: 0.6rem; border-radius: 8px;"
				>
					{myEntry?.isReady ? '✓ Ready' : 'Ready Up'}
				</button>
			</div>

			<!-- Host start button -->
			{#if isHost}
				<button
					onclick={() => gameActions.startCountdown(currentLobby.id)}
					disabled={!allReady}
					style="width: 100%; padding: 0.8rem; font-size: 1.1rem; background: {allReady ? '#4a8' : '#333'}; border-radius: 8px; margin-bottom: 0.5rem;"
				>
					{players.length < 2 ? 'Need 2+ players' : !allReady ? 'Waiting for all players' : 'Start Game'}
				</button>
			{:else}
				<p style="text-align: center; color: #aaa; font-size: 0.9rem;">Waiting for host to start...</p>
			{/if}

			{#if currentLobby?.status === 'countdown'}
				<p style="text-align: center; font-size: 2rem; color: #ff8;">Starting in {countdownValue}...</p>
			{/if}

			<button onclick={() => { gameActions.leaveLobby(currentLobby.id); stageActions.setStage('menu'); }}
			        disabled={currentLobby?.status !== 'waiting'}
			        style="width: 100%; margin-top: 0.5rem; padding: 0.4rem; background: rgba(255,50,50,0.3); border-radius: 8px;">
				Leave Lobby
			</button>

			{#if gameState.error}
				<p style="color: red; margin-top: 0.5rem;">{gameState.error}</p>
			{/if}
		{/if}
	</div>
</div>
