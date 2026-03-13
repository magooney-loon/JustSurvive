<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '$root/stage.svelte.js';
	import { lobbyActions, lobbyState } from '$lib/stores/lobby.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { soundActions } from '$root/Sound.svelte';

	const conn = useSpacetimeDB();
	const [lobbies] = useTable(tables.lobby);
	const [lobbyPlayers] = useTable(tables.lobbyPlayer);

	const myEntry = $derived(
		$lobbyPlayers.find((p) => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
	);
	const myLobby = $derived(myEntry ? $lobbies.find((l) => l.id === myEntry.lobbyId) : null);
	const inActiveGame = $derived(myLobby?.status === 'in_progress');

	const totalLobbies = $derived($lobbies.filter((l) => l.status === 'waiting').length);
	const totalPlayers = $derived(
		$lobbyPlayers.filter((lp) =>
			$lobbies.some((l) => l.id === lp.lobbyId && l.status === 'waiting')
		).length
	);

	$effect(() => {
		if (!myLobby) {
			lobbyState.leavingLobby = false;
			return;
		}
		if (myLobby.status !== 'in_progress' && !lobbyState.leavingLobby) {
			stageActions.setStage('lobby');
		}
	});

	let joinCode = $state('');
	let playerName = $state('Player');
	let mode = $state<'main' | 'join_code'>('main');
	let loading = $state(false);

	async function quickplay() {
		loading = true;
		lobbyActions.setPlayerName(playerName);
		await lobbyActions.quickplay();
		loading = false;
		if (!lobbyState.error) stageActions.setStage('lobby');
	}

	async function hostPrivate() {
		loading = true;
		lobbyActions.setPlayerName(playerName);
		await lobbyActions.hostLobby(false);
		loading = false;
		if (!lobbyState.error) stageActions.setStage('lobby');
	}

	async function joinByCode() {
		if (joinCode.length < 4) return;
		loading = true;
		lobbyActions.setPlayerName(playerName);
		await lobbyActions.joinByCode(joinCode);
		loading = false;
		if (!lobbyState.error) stageActions.setStage('lobby');
	}
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);"
>
	<div
		style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2.5rem; min-width: 340px; color: white; display: flex; flex-direction: column; gap: 1rem; align-items: stretch;"
	>
		<h1
			style="margin: 0.25rem 0 0.5rem; font-size: 2.5rem; font-weight: 900; text-align: center; letter-spacing: 0.15em; color: #fff; text-transform: uppercase; font-family: system-ui, -apple-system, sans-serif; position: relative;"
		>
			<span
				style="display: block; text-shadow: 0 1px 0 #0aa, 0 2px 0 #088, 0 3px 0 #066, 0 4px 0 #044, 0 5px 0 #022, 0 6px 1px rgba(0,0,0,0.1), 0 0 5px rgba(0,255,255,0.1), 0 1px 3px rgba(0,255,255,0.3), 0 3px 5px rgba(0,255,255,0.3), 0 5px 10px rgba(0,255,255,0.35), 0 10px 10px rgba(0,255,255,0.3), 0 20px 20px rgba(0,255,255,0.2);"
				>Just</span
			>
			<span
				style="display: block; background: linear-gradient(to bottom, #0ff 0%, #06f 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 8px rgba(0,255,255,0.6)); animation: glitch-survive 3s infinite;"
				>Survive</span
			>
		</h1>

		<!-- Decorative hazard bar -->
		<svg viewBox="0 0 200 12" style="width: 100%; height: 12px; display: block;">
			<defs>
				<pattern
					id="hazard"
					width="10"
					height="12"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(45)"
				>
					<rect width="5" height="12" fill="#0ff" />
					<rect x="5" width="5" height="12" fill="#222" />
				</pattern>
			</defs>
			<rect width="200" height="12" fill="url(#hazard)" opacity="0.8" />
		</svg>

		{#if !inActiveGame}
			<div style="display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 0.25rem;">
				<span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">
					<span style="color: #4af; font-weight: 600;">{totalLobbies}</span> lobbies
				</span>
				<span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">
					<span style="color: #8a4; font-weight: 600;">{totalPlayers}</span> players
				</span>
			</div>
		{/if}

		{#if inActiveGame}
			<label
				for="player-name"
				style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; text-align: center;"
				>Your Name</label
			>
			<input
				id="player-name"
				type="text"
				value={myEntry?.playerName}
				disabled
				class="player-name-input"
			/>
			<button
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('lobby');
				}}
				style="padding: 0.6rem; background: rgba(74,170,136,0.3); color: white; border: 1px solid rgba(74,170,136,0.5); border-radius: 0.5rem; cursor: pointer; font-size: 1rem;"
			>
				Reconnect to Lobby
			</button>
			<button
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('leaderboard');
				}}
				style="padding: 0.6rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
				>Leaderboard</button
			>
			<button
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('settings');
				}}
				style="padding: 0.6rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
				>Settings</button
			>
		{:else}
			<div style="display: flex; flex-direction: column; gap: 0.35rem;">
				<label
					for="player-name"
					style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; text-align: center;"
					>Your Name</label
				>
				<input
					id="player-name"
					type="text"
					placeholder="Enter your name"
					bind:value={playerName}
					maxlength={16}
					class="player-name-input"
				/>
			</div>

			<div style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.25rem 0;"></div>

			{#if mode === 'main'}
				<button
					onclick={() => {
						soundActions.playClick();
						quickplay();
					}}
					disabled={loading}
					style="padding: 0.65rem; background: rgba(74,170,136,0.25); color: white; border: 1px solid rgba(74,170,136,0.45); border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;"
					>Quick Play</button
				>
				<button
					onclick={() => {
						soundActions.playClick();
						hostPrivate();
					}}
					disabled={loading}
					style="padding: 0.65rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
					>Host Private Lobby</button
				>
				<button
					onclick={() => {
						soundActions.playClick();
						lobbyActions.clearError();
						mode = 'join_code';
					}}
					disabled={loading}
					style="padding: 0.65rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; cursor: pointer;"
					>Join Private Lobby</button
				>
				<div style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"></div>

				<div style="display: flex; gap: 0.5rem;">
					<button
						onclick={() => {
							soundActions.playClick();
							stageActions.setStage('leaderboard');
						}}
						disabled={loading}
						style="flex: 1; padding: 0.5rem; background: rgba(255,255,255,0.07); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;"
						>Leaderboard</button
					>
					<button
						onclick={() => {
							soundActions.playClick();
							stageActions.setStage('settings');
						}}
						disabled={loading}
						style="flex: 1; padding: 0.5rem; background: rgba(255,255,255,0.07); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;"
						>Settings</button
					>
				</div>
				<a
					href="https://github.com/magooney-loon/JustSurvive"
					target="_blank"
					rel="noopener noreferrer"
					style="padding: 0.5rem; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer; text-align: center; text-decoration: none; font-size: 0.8rem;"
					>Source Code</a
				>
			{:else}
				<input
					type="text"
					placeholder="Enter Code"
					bind:value={joinCode}
					maxlength={6}
					style="text-align: center; text-transform: uppercase; font-size: 1.75rem; padding: 0.5rem 1rem; letter-spacing: 0.4em; border-radius: 0.5rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); color: white; outline: none;"
				/>
				<button
					onclick={() => {
						soundActions.playClick();
						joinByCode();
					}}
					disabled={joinCode.length < 4 || loading}
					style="padding: 0.65rem; background: rgba(74,170,136,0.25); color: white; border: 1px solid rgba(74,170,136,0.45); border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600;"
					>Join</button
				>
				<button
					onclick={() => {
						soundActions.playClick();
						lobbyActions.clearError();
						mode = 'main';
					}}
					disabled={loading}
					style="padding: 0.5rem; background: rgba(255,255,255,0.07); color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; cursor: pointer;"
					>Back</button
				>
			{/if}

			{#if loading}
				<p
					style="text-align: center; color: rgba(255,255,255,0.5); margin: 0; font-size: 0.875rem;"
				>
					Connecting...
				</p>
			{:else if lobbyState.error}
				<p style="text-align: center; color: #f66; margin: 0; font-size: 0.875rem;">
					{lobbyState.error}
				</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	@keyframes glitch-survive {
		0%,
		90%,
		100% {
			transform: translate(0);
			filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6));
		}
		92% {
			transform: translate(-2px, 1px);
			filter: drop-shadow(0 0 15px rgba(0, 255, 255, 0.9)) hue-rotate(90deg);
		}
		94% {
			transform: translate(2px, -1px);
			filter: drop-shadow(0 0 12px rgba(0, 255, 255, 0.8)) hue-rotate(-90deg);
		}
		96% {
			transform: translate(-1px, 2px);
			filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.7));
		}
		98% {
			transform: translate(1px, -2px);
			filter: drop-shadow(0 0 14px rgba(0, 255, 255, 0.85)) hue-rotate(45deg);
		}
	}
	.player-name-input {
		text-align: center;
		font-size: 1.1rem;
		padding: 0.6rem 1rem;
		border-radius: 0.375rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #fff;
		outline: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.player-name-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}
	.player-name-input:focus {
		border-color: rgba(74, 170, 136, 0.8);
		box-shadow: 0 0 0 3px rgba(74, 170, 136, 0.25);
	}
	.player-name-input:disabled {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.5);
		cursor: not-allowed;
	}
</style>
