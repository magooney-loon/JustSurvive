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

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);"
>
	<div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2rem; min-width: 420px; color: white;">

		{#if !currentLobby}
			<p style="color: rgba(255,255,255,0.6); margin: 0 0 1rem;">Connecting to lobby...</p>
			<button
				onclick={() => stageActions.setStage('menu')}
				style="padding: 0.5rem 1.5rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
			>Back</button>

		{:else}
			<!-- Header -->
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
				<h2 style="margin: 0; font-size: 1.5rem; font-weight: 600;">Lobby</h2>
				{#if currentLobby?.isPublic}
					<span style="background: rgba(42,170,85,0.25); border: 1px solid rgba(42,170,85,0.4); padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.75rem; color: #4f4; font-weight: 600; letter-spacing: 0.05em;">PUBLIC</span>
				{:else}
					<button
						onclick={copyCode}
						style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); padding: 0.3rem 0.8rem; border-radius: 0.375rem; cursor: pointer; font-family: monospace; letter-spacing: 0.15em; font-size: 0.9rem;"
					>
						{currentLobby?.code} 📋
					</button>
				{/if}
			</div>

			<!-- Player list -->
			<div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem;">
				{#each players as player (player.id)}
					<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem;">
						<span style="flex: 1; font-size: 0.95rem;">{player.playerName}</span>
						<span style="color: rgba(255,255,255,0.45); font-size: 0.8rem; text-transform: capitalize;">{player.classChoice || '—'}</span>
						<span style="font-size: 0.8rem; font-weight: 600; color: {player.isReady ? '#4f4' : '#f66'};">
							{player.isReady ? '✓ Ready' : 'Not Ready'}
						</span>
						{#if player.playerIdentity.toHexString() === currentLobby?.hostIdentity.toHexString()}
							<span title="Host" style="font-size: 0.85rem;">👑</span>
						{/if}
					</div>
				{/each}
				{#each { length: Math.max(0, 4 - players.length) } as _}
					<div style="padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 0.5rem; color: rgba(255,255,255,0.25); font-size: 0.875rem;">
						Waiting for player...
					</div>
				{/each}
			</div>

			<!-- Class selector -->
			<div style="margin-bottom: 1.25rem;">
				<p style="margin: 0 0 0.5rem; font-size: 0.8rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.08em;">Select class</p>
				<div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
					{#each CLASSES as cls}
						<button
							onclick={() => gameActions.setClass(cls, currentLobby.id)}
							style="flex: 1; padding: 0.45rem 0.6rem; border-radius: 0.375rem; border: 1px solid rgba(255,255,255,{myEntry?.classChoice === cls ? '0.5' : '0.15'}); background: {myEntry?.classChoice === cls ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}; color: white; cursor: pointer; text-transform: capitalize; font-size: 0.875rem; transition: background 0.15s, border-color 0.15s;"
						>
							{cls}
						</button>
					{/each}
				</div>
			</div>

			<!-- Ready toggle -->
			<button
				onclick={() => gameActions.setReady(currentLobby.id, !myEntry?.isReady)}
				disabled={!myEntry?.classChoice || currentLobby?.status !== 'waiting'}
				style="width: 100%; padding: 0.65rem; margin-bottom: 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,{myEntry?.isReady ? '0.45' : '0.2'}); background: {myEntry?.isReady ? 'rgba(74,170,136,0.3)' : 'rgba(255,255,255,0.1)'}; color: white; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: background 0.15s;"
			>
				{myEntry?.isReady ? '✓ Ready' : 'Ready Up'}
			</button>

			<!-- Host start button -->
			{#if isHost}
				<button
					onclick={() => gameActions.startCountdown(currentLobby.id)}
					disabled={!allReady}
					style="width: 100%; padding: 0.75rem; font-size: 1rem; font-weight: 600; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,{allReady ? '0.5' : '0.12'}); background: {allReady ? 'rgba(74,170,136,0.35)' : 'rgba(255,255,255,0.05)'}; color: {allReady ? 'white' : 'rgba(255,255,255,0.3)'}; cursor: {allReady ? 'pointer' : 'not-allowed'}; margin-bottom: 0.5rem; transition: background 0.15s;"
				>
					{players.length < 2 ? 'Need 2+ players' : !allReady ? 'Waiting for all players' : 'Start Game'}
				</button>
			{:else}
				<p style="text-align: center; color: rgba(255,255,255,0.45); font-size: 0.875rem; margin: 0 0 0.5rem;">Waiting for host to start...</p>
			{/if}

			{#if currentLobby?.status === 'countdown'}
				<p style="text-align: center; font-size: 2rem; color: #ff8; margin: 0.5rem 0; font-weight: 700;">Starting in {countdownValue}...</p>
			{/if}

			<button
				onclick={() => { gameActions.leaveLobby(currentLobby.id); stageActions.setStage('menu'); }}
				disabled={currentLobby?.status !== 'waiting'}
				style="width: 100%; margin-top: 0.25rem; padding: 0.5rem; background: rgba(220,50,50,0.15); border: 1px solid rgba(220,50,50,0.3); border-radius: 0.5rem; color: rgba(255,120,120,0.9); cursor: pointer; font-size: 0.875rem;"
			>
				Leave Lobby
			</button>

			{#if gameState.error}
				<p style="color: #f66; margin: 0.75rem 0 0; font-size: 0.875rem;">{gameState.error}</p>
			{/if}
		{/if}
	</div>
</div>
