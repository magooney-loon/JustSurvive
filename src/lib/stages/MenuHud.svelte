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
	class="rpgui-content"
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
>
	<div
		class="rpgui-container framed-golden"
		style="padding: 2rem; min-width: 360px; display: flex; flex-direction: column; gap: 1rem; align-items: stretch;"
	>
		<h1
			style="margin: 0.25rem 0 0.5rem; font-size: 2.5rem; font-weight: 900; text-align: center; letter-spacing: 0.15em; color: #fff; text-transform: uppercase; font-family: system-ui, -apple-system, sans-serif; position: relative;"
		>
			<span
				style="display: block; text-shadow: 0 1px 0 #a60, 0 2px 0 #840, 0 3px 0 #620, 0 4px 0 #410, 0 5px 0 #200, 0 6px 1px rgba(0,0,0,0.1), 0 0 5px rgba(255,165,0,0.1), 0 1px 3px rgba(255,165,0,0.3), 0 3px 5px rgba(255,165,0,0.3), 0 5px 10px rgba(255,165,0,0.35), 0 10px 10px rgba(255,165,0,0.3), 0 20px 20px rgba(255,165,0,0.2);"
				>Just</span
			>
			<span
				style="display: block; background: linear-gradient(to bottom, #ffb300 0%, #e05000 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 8px rgba(255,165,0,0.6)); animation: glitch-survive 3s infinite;"
				>Survive</span
			>
		</h1>

		<!-- Decorative hazard bar -->
		<hr class="golden" />

		{#if !inActiveGame}
			<p class="rpgui-center">
				<span style="color: #4af; font-weight: 600;">{totalLobbies}</span> lobbies ·
				<span style="color: #8a4; font-weight: 600;">{totalPlayers}</span> players
			</p>
		{/if}

		{#if inActiveGame}
			<label for="player-name">Your Name</label>
			<input
				id="player-name"
				type="text"
				value={myEntry?.playerName}
				disabled
				class="player-name-input"
			/>
			<button
				class="rpgui-button"
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('lobby');
				}}
			>
				<p>Reconnect to Lobby</p>
			</button>
			<button
				class="rpgui-button"
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('leaderboard');
				}}
			>
				<p>Leaderboard</p>
			</button>
			<button
				class="rpgui-button"
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('settings');
				}}
			>
				<p>Settings</p>
			</button>
		{:else}
			<div style="display: flex; flex-direction: column; gap: 0.35rem;">
				<label for="player-name" style="text-align: center;">Your Name</label>
				<input
					id="player-name"
					type="text"
					placeholder="Enter your name"
					bind:value={playerName}
					maxlength={16}
					class="player-name-input"
				/>
			</div>

			<hr class="golden" />

			{#if mode === 'main'}
				<button
					class="rpgui-button golden"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						quickplay();
					}}
					disabled={loading}
				>
					<p>Quick Play</p>
				</button>
				<button
					class="rpgui-button"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						hostPrivate();
					}}
					disabled={loading}
				>
					<p>Host Private Lobby</p>
				</button>
				<button
					class="rpgui-button"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						lobbyActions.clearError();
						mode = 'join_code';
					}}
					disabled={loading}
				>
					<p>Join Private Lobby</p>
				</button>
				<hr class="golden" />

				<div style="display: flex; gap: 0.5rem;">
					<button
						class="rpgui-button"
						style="width: 100%;"
						onclick={() => {
							soundActions.playClick();
							stageActions.setStage('leaderboard');
						}}
						disabled={loading}
					>
						<p>Leaderboard</p>
					</button>
					<button
						class="rpgui-button"
						style="width: 100%;"
						onclick={() => {
							soundActions.playClick();
							stageActions.setStage('settings');
						}}
						disabled={loading}
					>
						<p>Settings</p>
					</button>
				</div>
				<p class="rpgui-center">
					<a
						href="https://github.com/magooney-loon/JustSurvive"
						target="_blank"
						rel="noopener noreferrer">Source Code</a
					>
				</p>
			{:else}
				<input
					type="text"
					placeholder="Enter Code"
					bind:value={joinCode}
					maxlength={6}
					style="text-align: center; text-transform: uppercase; font-size: 1.75rem; padding: 0.5rem 1rem; letter-spacing: 0.4em; border-radius: 0.5rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); color: white; outline: none;"
				/>
				<button
					class="rpgui-button golden"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						joinByCode();
					}}
					disabled={joinCode.length < 4 || loading}
				>
					<p>Join</p>
				</button>
				<button
					class="rpgui-button"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						lobbyActions.clearError();
						mode = 'main';
					}}
					disabled={loading}
				>
					<p>Back</p>
				</button>
			{/if}

			{#if loading}
				<p class="rpgui-center" style="color: rgba(255,255,255,0.5);">Connecting...</p>
			{:else if lobbyState.error}
				<p class="rpgui-center" style="color: #f66;">
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
			filter: drop-shadow(0 0 8px rgba(255, 165, 0, 0.6));
		}
		92% {
			transform: translate(-2px, 1px);
			filter: drop-shadow(0 0 15px rgba(255, 165, 0, 0.9)) hue-rotate(30deg);
		}
		94% {
			transform: translate(2px, -1px);
			filter: drop-shadow(0 0 12px rgba(255, 165, 0, 0.8)) hue-rotate(-30deg);
		}
		96% {
			transform: translate(-1px, 2px);
			filter: drop-shadow(0 0 10px rgba(255, 165, 0, 0.7));
		}
		98% {
			transform: translate(1px, -2px);
			filter: drop-shadow(0 0 14px rgba(255, 165, 0, 0.85)) hue-rotate(15deg);
		}
	}
	/* Only apply block display to non-golden buttons — golden button p is inline-block by design */
	.rpgui-button:not(.golden) p {
		display: block;
		text-align: center;
		margin: 0;
		line-height: 1.2;
	}
	.rpgui-button.golden {
		min-width: 180px;
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
