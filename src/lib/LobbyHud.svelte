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
	const [sessions] = useTable(tables.gameSession);

	const myEntry = $derived(
		$lobbyPlayers.find((p) => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
	);
	const currentLobby = $derived(myEntry ? $lobbies.find((l) => l.id === myEntry.lobbyId) : null);
	const players = $derived(
		currentLobby ? $lobbyPlayers.filter((p) => p.lobbyId === currentLobby.id) : []
	);
	const isHost = $derived(
		currentLobby?.hostIdentity.toHexString() === $conn.identity?.toHexString()
	);
	const allReady = $derived(
		players.length >= 1 && players.every((p) => p.isReady && p.classChoice)
	);
	const gameStarting = $derived(
		currentLobby?.status === 'countdown' || currentLobby?.status === 'in_progress'
	);
	const canStart = $derived(allReady && !gameStarting);

	const CLASSES = ['spotter', 'gunner', 'tank', 'healer'] as const;

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner: '#f84',
		tank: '#8a4',
		healer: '#f4a'
	};

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
			const session = $sessions.find((s) => s.lobbyId === currentLobby.id && s.status === 'active');
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
	<div
		style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2rem; min-width: 420px; color: white;"
	>
		{#if !currentLobby}
			<p style="color: rgba(255,255,255,0.6); margin: 0 0 1rem;">Connecting to lobby...</p>
			<button
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('menu');
				}}
				style="padding: 0.5rem 1.5rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
				>Back</button
			>
		{:else}
			<!-- Header -->
			<div
				style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;"
			>
				<h2 style="margin: 0; font-size: 1.5rem; font-weight: 600;">Lobby</h2>
				{#if currentLobby?.isPublic}
					<span
						style="background: rgba(42,170,85,0.25); border: 1px solid rgba(42,170,85,0.4); padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.75rem; color: #4f4; font-weight: 600; letter-spacing: 0.05em;"
						>PUBLIC</span
					>
				{:else}
					<button
						onclick={() => {
							soundActions.playClick();
							copyCode();
						}}
						style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); padding: 0.3rem 0.8rem; border-radius: 0.375rem; cursor: pointer; font-family: monospace; letter-spacing: 0.15em; font-size: 0.9rem;"
					>
						{currentLobby?.code} 📋
					</button>
				{/if}
			</div>

			<!-- Player list -->
			<div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem;">
				{#each players as player (player.id)}
					<div
						style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem;"
					>
						<span style="flex: 1; font-size: 0.95rem;">{player.playerName}</span>
						<span
							style="font-size: 0.8rem; font-weight: 600; text-transform: capitalize; color: {player.classChoice
								? CLASS_COLORS[player.classChoice]
								: 'rgba(255,255,255,0.45)'};">{player.classChoice || '—'}</span
						>
						<span
							style="font-size: 0.8rem; font-weight: 600; color: {player.isReady
								? '#4f4'
								: '#f66'};"
						>
							{player.isReady ? '✓ Ready' : 'Not Ready'}
						</span>
						{#if player.playerIdentity.toHexString() === currentLobby?.hostIdentity.toHexString()}
							<span title="Host" style="font-size: 0.85rem;">👑</span>
						{/if}
					</div>
				{/each}
				{#each { length: Math.max(0, 4 - players.length) } as _}
					<div
						style="padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 0.5rem; color: rgba(255,255,255,0.25); font-size: 0.875rem;"
					>
						Waiting for player...
					</div>
				{/each}
			</div>

			<!-- Class selector -->
			<div style="margin-bottom: 1.25rem;">
				<p
					style="margin: 0 0 0.5rem; font-size: 0.8rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.08em;"
				>
					Select class
				</p>
				<div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
					{#each CLASSES as cls}
						<button
							onclick={() => {
								soundActions.playClick();
								gameActions.setClass(cls, currentLobby.id);
							}}
							style="flex: 1; padding: 0.45rem 0.6rem; border-radius: 0.375rem; border: 1px solid rgba(255,255,255,{myEntry?.classChoice ===
							cls
								? '0.6'
								: '0.15'}); background: {myEntry?.classChoice === cls
								? 'rgba(0,0,0,0.4)'
								: 'rgba(255,255,255,0.06)'}; color: {myEntry?.classChoice === cls
								? CLASS_COLORS[cls]
								: 'white'}; cursor: pointer; text-transform: capitalize; font-size: 0.875rem; font-weight: {myEntry?.classChoice ===
							cls
								? '600'
								: '400'}; transition: background 0.15s, border-color 0.15s;"
						>
							{cls}
						</button>
					{/each}
				</div>

				{#if myEntry?.classChoice}
					<div
						style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 1rem;"
					>
						<p
							style="margin: 0 0 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: {CLASS_COLORS[
								myEntry.classChoice
							]};"
						>
							{myEntry.classChoice} Abilities
						</p>
						{#if myEntry.classChoice === 'spotter'}
							<p style="margin: 0 0 0.25rem; font-size: 0.8rem;">
								<span style="opacity: 0.7;">LMB:</span> Mark enemy (5s cooldown)
							</p>
							<p style="margin: 0; font-size: 0.8rem;">
								<span style="opacity: 0.7;">RMB:</span> Ping location
							</p>
						{:else if myEntry.classChoice === 'gunner'}
							<p style="margin: 0 0 0.25rem; font-size: 0.8rem;">
								<span style="opacity: 0.7;">LMB:</span> Shoot enemy
							</p>
							<p style="margin: 0; font-size: 0.8rem;">
								<span style="opacity: 0.7;">Every 3rd shot:</span> Suppresses enemy
							</p>
						{:else if myEntry.classChoice === 'tank'}
							<p style="margin: 0 0 0.25rem; font-size: 0.8rem;">
								<span style="opacity: 0.7;">LMB:</span> Shield bash (1.5s cooldown)
							</p>
							<p style="margin: 0; font-size: 0.8rem;">
								<span style="opacity: 0.7;">RMB hold:</span> Brace (5s, reduces damage)
							</p>
						{:else if myEntry.classChoice === 'healer'}
							<p style="margin: 0 0 0.25rem; font-size: 0.8rem;">
								<span style="opacity: 0.7;">LMB:</span> Heal teammate (2s cooldown)
							</p>
							<p style="margin: 0; font-size: 0.8rem;">
								<span style="opacity: 0.7;">RMB:</span> Revive downed teammate
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Ready toggle -->
			<button
				onclick={() => {
					soundActions.playClick();
					gameActions.setReady(currentLobby.id, !myEntry?.isReady);
				}}
				disabled={!myEntry?.classChoice || currentLobby?.status !== 'waiting'}
				style="width: 100%; padding: 0.65rem; margin-bottom: 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,{myEntry?.isReady
					? '0.45'
					: '0.2'}); background: {myEntry?.isReady
					? 'rgba(74,170,136,0.3)'
					: 'rgba(255,255,255,0.1)'}; color: white; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: background 0.15s;"
			>
				{myEntry?.isReady ? '✓ Ready' : 'Ready Up'}
			</button>

			<!-- Host start button -->
			{#if isHost}
				<button
					onclick={() => {
						soundActions.playClick();
						gameActions.startCountdown(currentLobby.id);
					}}
					disabled={!canStart}
					style="width: 100%; padding: 0.75rem; font-size: 1rem; font-weight: 600; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,{canStart
						? '0.5'
						: '0.12'}); background: {canStart
						? 'rgba(74,170,136,0.35)'
						: 'rgba(255,255,255,0.05)'}; color: {canStart
						? 'white'
						: 'rgba(255,255,255,0.3)'}; cursor: {canStart
						? 'pointer'
						: 'not-allowed'}; margin-bottom: 0.5rem; transition: background 0.15s;"
				>
					{!allReady ? 'Waiting for all players' : gameStarting ? 'Starting...' : 'Start Game'}
				</button>
			{:else}
				<p
					style="text-align: center; color: rgba(255,255,255,0.45); font-size: 0.875rem; margin: 0 0 0.5rem;"
				>
					Waiting for host to start...
				</p>
			{/if}

			{#if currentLobby?.status === 'countdown'}
				<p
					style="text-align: center; font-size: 2rem; color: #ff8; margin: 0.5rem 0; font-weight: 700;"
				>
					Starting in {countdownValue}...
				</p>
			{/if}

			<button
				onclick={() => {
					soundActions.playClick();
					gameActions.leaveLobby(currentLobby.id);
					stageActions.setStage('menu');
				}}
				disabled={currentLobby?.status !== 'waiting'}
				style="width: 100%; margin-top: 0.25rem; padding: 0.5rem; background: rgba(220,50,50,0.15); border: 1px solid rgba(220,50,50,0.3); border-radius: 0.5rem; color: rgba(255,120,120,0.9); cursor: pointer; font-size: 0.875rem;"
			>
				Leave Lobby
			</button>

			<div
				style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);"
			>
				<p
					style="margin: 0 0 0.35rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; text-align: center;"
				>
					Controls
				</p>
				<div style="display: flex; flex-wrap: wrap; gap: 0.35rem; justify-content: center;">
					<span
						style="font-size: 0.65rem; padding: 0.2rem 0.4rem; background: rgba(255,255,255,0.1); border-radius: 0.25rem;"
						>WASD - Move</span
					>
					<span
						style="font-size: 0.65rem; padding: 0.2rem 0.4rem; background: rgba(255,255,255,0.1); border-radius: 0.25rem;"
						>Shift - Sprint</span
					>
					<span
						style="font-size: 0.65rem; padding: 0.2rem 0.4rem; background: rgba(255,255,255,0.1); border-radius: 0.25rem;"
						>Mouse - Aim</span
					>
				</div>
			</div>

			{#if gameState.error}
				<p style="color: #f66; margin: 0.75rem 0 0; font-size: 0.875rem;">{gameState.error}</p>
			{/if}
		{/if}
	</div>
</div>
