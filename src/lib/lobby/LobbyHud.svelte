<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { untrack } from 'svelte';
	import { stageActions } from '$root/stage.svelte.js';
	import { lobbyActions, lobbyState } from '$lib/stores/lobby.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { soundActions } from '$root/Sound.svelte';
	import { CLASSES, getActiveSynergy, TIPS, BOSSES, BOSS_LIST } from './classData.js';

	const base = import.meta.env.BASE_URL;

	const conn = useSpacetimeDB();
	const [lobbies] = useTable(tables.lobby);
	const [lobbyPlayers] = useTable(tables.lobbyPlayer);
	const [sessions] = useTable(tables.gameSession);
	const [lobbyMessages] = useTable(tables.lobbyMessage);

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
		currentLobby?.isPublic
			? players.length >= 2 && players.every((p) => p.isReady && p.classChoice)
			: players.length >= 1 && players.every((p) => p.isReady && p.classChoice)
	);
	const gameStarting = $derived(
		currentLobby?.status === 'countdown' || currentLobby?.status === 'in_progress'
	);
	const canStart = $derived(allReady && !gameStarting);

	const classCounts = $derived({
		spotter: players.filter((p) => p.classChoice === 'spotter').length,
		gunner: players.filter((p) => p.classChoice === 'gunner').length,
		tank: players.filter((p) => p.classChoice === 'tank').length,
		healer: players.filter((p) => p.classChoice === 'healer').length
	});

	const activeSynergy = $derived(getActiveSynergy(classCounts));

	const CLASS_COLORS: Record<string, string> = {
		spotter: CLASSES.spotter.stats.color,
		gunner: CLASSES.gunner.stats.color,
		tank: CLASSES.tank.stats.color,
		healer: CLASSES.healer.stats.color
	};

	const CLASS_STATS: Record<string, { hp: number; stamina: number; role: string }> = {
		spotter: {
			hp: CLASSES.spotter.stats.hp,
			stamina: CLASSES.spotter.stats.stamina,
			role: CLASSES.spotter.stats.role
		},
		gunner: {
			hp: CLASSES.gunner.stats.hp,
			stamina: CLASSES.gunner.stats.stamina,
			role: CLASSES.gunner.stats.role
		},
		tank: {
			hp: CLASSES.tank.stats.hp,
			stamina: CLASSES.tank.stats.stamina,
			role: CLASSES.tank.stats.role
		},
		healer: {
			hp: CLASSES.healer.stats.hp,
			stamina: CLASSES.healer.stats.stamina,
			role: CLASSES.healer.stats.role
		}
	};

	let countdownValue = $state(3);

	// Track whether we've ever seen our lobby entry (prevents false redirect on initial load)
	let hasHadEntry = $state(false);
	$effect(() => {
		if (myEntry) hasHadEntry = true;
	});

	// If our lobbyPlayer row disappears after we had one (kicked / lobby deleted),
	// clean up and go back to menu immediately.
	$effect(() => {
		if (hasHadEntry && !myEntry && !leaving) {
			lobbyState.currentLobbyId = null;
			lobbyState.currentSessionId = null;
			stageActions.setStage('menu');
		}
	});

	$effect(() => {
		if (currentLobby?.status === 'countdown') {
			countdownValue = 3;
			untrack(() => soundActions.playCountdown());
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
				lobbyState.currentSessionId = session.id;
				stageActions.setStage('game');
			}
		}
	});

	function copyCode() {
		if (currentLobby) navigator.clipboard.writeText(currentLobby.code);
	}

	let tipIndex = $state(0);
	$effect(() => {
		const id = setInterval(() => {
			tipIndex = (tipIndex + 1) % TIPS.length;
		}, 5000);
		return () => clearInterval(id);
	});

	let bossIndex = $state(0);
	$effect(() => {
		const id = setInterval(() => {
			bossIndex = (bossIndex + 1) % BOSS_LIST.length;
		}, 6000);
		return () => clearInterval(id);
	});

	const chatMessages = $derived(
		currentLobby
			? [...$lobbyMessages]
					.filter((m) => m.lobbyId === currentLobby.id)
					.sort((a, b) => Number(a.id - b.id))
			: []
	);

	function rpguiProgress(node: HTMLElement) {
		const rpgui = (window as any).RPGUI;
		if (rpgui && !node.getAttribute('data-rpgui-type')) {
			rpgui.create(node, 'progress');
		}
	}

	let leaving = $state(false);
	let chatInput = $state('');
	let chatEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		chatMessages;
		if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
	});

	function sendChat() {
		const msg = chatInput.trim();
		if (!msg || !currentLobby) return;
		lobbyActions.sendMessage(currentLobby.id, msg);
		chatInput = '';
	}

	const READY_DEADLINE_SECONDS = 120;
	let readySecondsLeft = $state(0);
	let playerEnteredAt = $state<number | null>(null);

	$effect(() => {
		if (currentLobby && currentLobby.isPublic && !myEntry?.isReady) {
			if (!playerEnteredAt) playerEnteredAt = Date.now();
		} else {
			playerEnteredAt = null;
			readySecondsLeft = 0;
		}
	});

	$effect(() => {
		if (!currentLobby?.isPublic || myEntry?.isReady || !playerEnteredAt) return;
		const enteredAt = playerEnteredAt;
		function update() {
			readySecondsLeft = Math.max(
				0,
				Math.ceil(READY_DEADLINE_SECONDS - (Date.now() - enteredAt) / 1000)
			);
		}
		update();
		const id = setInterval(update, 500);
		return () => clearInterval(id);
	});
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	class="rpgui-content"
	style="
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 8%;
		perspective: 1800px;
		overflow: hidden;
	"
>
	<!-- Squad Synergy — absolutely positioned at the bottom center -->
	{#if activeSynergy && currentLobby}
		{@const syn = activeSynergy}
		<div
			class="rpgui-container framed-golden"
			style="position: absolute; bottom: 0.75rem; left: 50%; transform: translateX(-50%); z-index: 10; padding: 0.4rem 1.25rem; display: flex; align-items: center; gap: 1.25rem; white-space: nowrap;"
		>
			<p
				style="margin: 0; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5;"
			>
				Squad Synergy
			</p>
			<p style="margin: 0; font-size: 0.8rem; font-weight: 700; color: {syn.color};">
				{syn.label}
			</p>
			<p
				style="margin: 0; font-size: 0.68rem; opacity: 0.65; max-width: 400px; white-space: normal; line-height: 1.3;"
			>
				{syn.desc}
			</p>
		</div>
	{/if}

	<div
		class="rpgui-container framed"
		style="
			padding: 1.5rem;
			color: white;
			display: flex;
			gap: 1.5rem;
			height: 1250px;
			align-items: flex-start;
			transform: rotateY(-18deg);

			box-shadow:
				0 0 60px rgba(0,0,0,0.6),
				-20px 0 40px rgba(0,0,0,0.4),
				inset 0 0 30px rgba(100,150,255,0.03);
			border: 1px solid rgba(100,150,255,0.15);
		"
	>
		<!-- Left: Lobby panel -->
		<div style="width: 630px; flex-shrink: 0;">
			{#if !currentLobby && !leaving}
				<p>Connecting...</p>
			{:else}
				<!-- Header -->
				<div
					style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;"
				>
					<h2>Lobby</h2>
					{#if currentLobby?.isPublic}
						<span
							style="background: rgba(42,170,85,0.25); border: 1px solid rgba(42,170,85,0.4); padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.75rem; color: #4f4; font-weight: 600; letter-spacing: 0.05em;"
							>PUBLIC</span
						>
					{:else}
						<div style="display: flex; align-items: center; gap: 0.5rem;">
							<span style="font-size: 0.75rem; opacity: 0.6;">Copy:</span>
							<button
								class="rpgui-button"
								onclick={() => {
									soundActions.playClick();
									copyCode();
								}}
							>
								<p>{currentLobby?.code}</p>
							</button>
						</div>
					{/if}
				</div>

				<!-- Player list -->
				<div
					class="rpgui-list-imp"
					style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem; max-height: 200px; overflow-y: auto;"
				>
					{#each players as player (player.id)}
						<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem;">
							<span style="flex: 1;">{player.playerName}</span>
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
							{#if !currentLobby?.isPublic}
								{#if player.playerIdentity.toHexString() === currentLobby?.hostIdentity.toHexString()}
									<span title="Host" style="font-size: 0.85rem;">👑</span>
								{:else if isHost}
									<button
										onclick={() => {
											soundActions.playClick();
											lobbyActions.kickPlayer(currentLobby!.id, player.playerIdentity);
										}}
										disabled={gameStarting}
										title="Kick player"
										style="padding: 0.15rem 0.4rem; font-size: 0.7rem; background: rgba(220,50,50,0.2); border: 1px solid rgba(220,50,50,0.4); border-radius: 0.25rem; color: #f88; cursor: {gameStarting
											? 'not-allowed'
											: 'pointer'}; opacity: {gameStarting ? '0.4' : '1'};">Kick</button
									>
								{/if}
							{/if}
						</div>
					{/each}
					{#each { length: Math.max(0, 4 - players.length) } as _}
						<div
							style="padding: 0.6rem 0.75rem; color: rgba(255,255,255,0.25); font-size: 0.875rem;"
						>
							Waiting for player...
						</div>
					{/each}
				</div>

				<!-- Class selector -->
				<div style="margin-bottom: 1.25rem;">
					<h4>Select class</h4>
					<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
						{#each Object.values(CLASSES) as cls}
							{@const clsId = cls.stats.id}
							{@const isLockedClass = clsId === 'tank' || clsId === 'healer'}
							{@const isTaken = !isLockedClass && classCounts[clsId] >= 1}
							{@const isSelected = myEntry?.classChoice === clsId}
							{@const classLocked =
								isLockedClass ||
								(isTaken && !isSelected) ||
								currentLobby?.status !== 'waiting' ||
								(currentLobby?.isPublic && !!myEntry?.isReady)}
							<button
								onclick={() => {
									if (!classLocked) {
										soundActions.playClick();
										if (isSelected) {
											// Deselect current class
											lobbyActions.setClass('', currentLobby.id);
										} else {
											// Select new class
											lobbyActions.setClass(clsId, currentLobby.id);
										}
									}
								}}
								disabled={classLocked}
								class="rpgui-button"
								style="width: 100%; min-width: auto; height: auto; padding: 0.6rem 0.25rem; {isSelected
									? 'background-image: url(' +
										base +
										'css/img/button-down.png); outline: 2px solid ' +
										CLASS_COLORS[clsId] +
										'; outline-offset: -2px;'
									: ''}; {isLockedClass ? 'opacity: 0.4; filter: grayscale(1);' : ''}"
							>
								<div
									style="display: flex; flex-direction: column; align-items: center; gap: 0.15rem;"
								>
									{#if clsId === 'spotter'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url({base}css/img/icons/sword.png);"
										></div>
									{:else if clsId === 'gunner'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url({base}css/img/icons/weapon-slot.png);"
										></div>
									{:else if clsId === 'tank'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url({base}css/img/icons/shield.png);"
										></div>
									{:else if clsId === 'healer'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url({base}css/img/icons/potion-red.png);"
										></div>
									{/if}
									<span
										style="font-size: 0.7rem; font-weight: 700; text-transform: capitalize; color: {isSelected
											? CLASS_COLORS[clsId]
											: isTaken
												? 'rgba(255,255,255,0.3)'
												: isLockedClass
													? 'rgba(255,255,255,0.4)'
													: 'white'};">{clsId}</span
									>
									{#if isLockedClass}
										<span style="font-size: 0.5rem; color: #888; font-weight: 700;">LOCKED</span>
									{:else if isSelected}
										<span style="font-size: 0.5rem; color: #ff0; font-weight: 700;">SELECTED</span>
									{:else if isTaken}
										<span style="font-size: 0.5rem; color: #f66; font-weight: 700;">TAKEN</span>
									{:else}
										<span style="font-size: 0.5rem; color: #4f4; font-weight: 700;">AVAILABLE</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>

					<!-- Class stats bars -->
					<div
						style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem;"
					>
						{#each Object.values(CLASSES) as cls}
							{@const clsId = cls.stats.id}
							{@const isSelected = myEntry?.classChoice === clsId}
							<div
								class="rpgui-container framed-grey"
								style="padding: 0.4rem; {isSelected
									? 'border-color: ' + CLASS_COLORS[clsId] + ';'
									: ''}"
							>
								<div
									style="font-size: 0.6rem; text-transform: capitalize; text-align: center; color: {CLASS_COLORS[
										clsId
									]}; margin-bottom: 0.25rem;"
								>
									{clsId}
								</div>
								<span style="font-size: 0.5rem;">HP</span>
								<div
									class="rpgui-progress red progress-sm"
									data-value={CLASS_STATS[clsId].hp / 200}
									use:rpguiProgress
								></div>
								<span style="font-size: 0.5rem;">STM</span>
								<div
									class="rpgui-progress green progress-sm"
									data-value={CLASS_STATS[clsId].stamina / 600}
									use:rpguiProgress
								></div>
							</div>
						{/each}
					</div>

					{#if myEntry?.classChoice && CLASSES[myEntry.classChoice as keyof typeof CLASSES]}
						{@const clsData = CLASSES[myEntry.classChoice as keyof typeof CLASSES]}
						<div
							class="rpgui-container framed-grey"
							style="margin-top: 0.75rem; padding: 0.6rem; background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%);"
						>
							<p
								style="margin: 0 0 0.6rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: {clsData
									.stats
									.color}; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem;"
							>
								⚡ {clsData.stats.name} Abilities
							</p>
							{#each clsData.abilities as ability}
								<div
									style="margin-bottom: 0.6rem; padding: 0.5rem; background: rgba(0,0,0,0.25); border-radius: 0.3rem; border-left: 3px solid {clsData
										.stats.color};"
								>
									<div
										style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;"
									>
										<span style="font-size: 0.8rem; font-weight: 700; color: {clsData.stats.color};"
											>{ability.name}</span
										>
										<span
											style="font-size: 0.6rem; padding: 0.15rem 0.4rem; background: rgba(255,255,255,0.1); border-radius: 0.2rem; color: rgba(255,255,255,0.7); font-weight: 600;"
										>
											{ability.input}
										</span>
									</div>
									<p
										style="margin: 0; font-size: 0.65rem; color: rgba(255,255,255,0.6); line-height: 1.35;"
									>
										{ability.desc}
									</p>
									{#if ability.cooldown !== 'None'}
										<div
											style="margin-top: 0.3rem; display: flex; align-items: center; gap: 0.3rem;"
										>
											<span style="font-size: 0.55rem; color: rgba(255,255,255,0.35);">⏱</span>
											<span style="font-size: 0.6rem; color: #fa8; font-weight: 600;"
												>CD: {ability.cooldown}</span
											>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Ready toggle -->
				{@const readyLocked =
					!myEntry?.classChoice ||
					currentLobby?.status !== 'waiting' ||
					(currentLobby?.isPublic && !!myEntry?.isReady)}
				<button
					class="rpgui-button golden"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						lobbyActions.setReady(currentLobby!.id, !myEntry?.isReady);
					}}
					disabled={readyLocked}
				>
					<p>{myEntry?.isReady ? '✓ Locked In' : 'Ready Up'}</p>
				</button>

				<!-- Start area -->
				{#if currentLobby?.isPublic}
					<p class="rpgui-center">
						{gameStarting
							? 'Starting...'
							: allReady
								? 'Starting soon...'
								: 'Game starts when 2+ players are ready'}
					</p>
				{:else if isHost}
					<button
						class="rpgui-button golden"
						style="width: 100%;"
						onclick={() => {
							soundActions.playClick();
							lobbyActions.startCountdown(currentLobby!.id);
						}}
						disabled={!canStart}
					>
						<p>
							{!allReady ? 'Waiting for all players' : gameStarting ? 'Starting...' : 'Start Game'}
						</p>
					</button>
				{:else}
					<p class="rpgui-center">Waiting for host to start...</p>
				{/if}

				{#if lobbyState.error}
					<p style="color: #f66;">{lobbyState.error}</p>
				{/if}
			{/if}
		</div>

		<!-- Right: Chat panel -->
		{#if currentLobby}
			<div
				class="rpgui-container framed-grey"
				style="width: 340px; height: 1200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem;"
			>
				<h4>Lobby Chat</h4>

				<!-- Messages -->
				<div
					bind:this={chatEl}
					class="rpgui-list-imp"
					style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem;"
				>
					{#if chatMessages.length === 0}
						<p class="rpgui-center" style="color: rgba(255,255,255,0.25);">No messages yet</p>
					{:else}
						{#each chatMessages as msg (msg.id)}
							<div style="display: flex; flex-direction: column; gap: 0.1rem;">
								<span
									style="font-size: 0.65rem; font-weight: 700; color: {CLASS_COLORS[
										players.find(
											(p) => p.playerIdentity.toHexString() === msg.playerIdentity.toHexString()
										)?.classChoice ?? ''
									] ?? 'rgba(255,255,255,0.55)'};"
								>
									{msg.playerName}
								</span>
								<span
									style="font-size: 0.78rem; color: rgba(255,255,255,0.8); word-break: break-word; line-height: 1.35;"
								>
									{msg.message}
								</span>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Input -->
				<div style="display: flex; gap: 0.4rem;">
					<input
						type="text"
						maxlength="200"
						placeholder="Type..."
						bind:value={chatInput}
						onkeydown={(e) => {
							if (e.key === 'Enter') sendChat();
						}}
					/>
					<button class="rpgui-button" onclick={sendChat} disabled={!chatInput.trim()}>
						<p>Send</p>
					</button>
				</div>

				<!-- Controls -->
				<div style="padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.08);">
					<p class="rpgui-center">Controls</p>
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

				<!-- Boss info carousel -->
				<div
					style="padding-top: 0.5rem; height:450px; border-top: 1px solid rgba(255,255,255,0.08);"
				>
					<p
						class="rpgui-center"
						style="margin-bottom: 0.4rem; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5;"
					>
						Boss Field Guide
					</p>
					<!-- dot indicators -->
					<div style="display: flex; justify-content: center; gap: 0.3rem; margin-bottom: 0.5rem;">
						{#each BOSS_LIST as _, i}
							<span
								style="width: 6px; height: 6px; border-radius: 50%; display: inline-block; background: {i ===
								bossIndex
									? BOSSES[BOSS_LIST[i]].color
									: 'rgba(255,255,255,0.2)'}; transition: background 0.3s;"
							></span>
						{/each}
					</div>
					{#key bossIndex}
						{@const boss = BOSSES[BOSS_LIST[bossIndex]]}
						{@const threatColor =
							boss.threat === 'extreme'
								? '#f44'
								: boss.threat === 'high'
									? '#f84'
									: boss.threat === 'medium'
										? '#fa4'
										: '#4f8'}
						<div
							in:fade={{ duration: 300 }}
							style="display: flex; flex-direction: column; gap: 0.4rem;"
						>
							<!-- Name + threat -->
							<div style="display: flex; align-items: center; justify-content: space-between;">
								<span style="font-size: 0.9rem; font-weight: 700; color: {boss.color};"
									>{boss.name}</span
								>
								<span
									style="font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 0.25rem; background: {threatColor}22; border: 1px solid {threatColor}55; color: {threatColor};"
									>{boss.threat}</span
								>
							</div>
							<!-- Stats grid -->
							<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem;">
								{#each [['HP', String(boss.hp), '#f66'], ['Speed', boss.speed + ' u/s', '#4af'], ['Dmg', boss.meleeDamage + '/hit', '#fa4'], ['Enrage', '≤' + boss.enrageHp + ' HP', '#f84']] as [label, value, col]}
									<div
										style="background: rgba(0,0,0,0.3); border-radius: 0.25rem; padding: 0.3rem 0.2rem; text-align: center; border-top: 2px solid {col}44;"
									>
										<div
											style="font-size: 0.7rem; font-weight: 700; color: {col}; line-height: 1.1;"
										>
											{value}
										</div>
										<div
											style="font-size: 0.5rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.15rem;"
										>
											{label}
										</div>
									</div>
								{/each}
							</div>
							<!-- Abilities -->
							{#each boss.abilities as ab}
								<div
									style="padding: 0.3rem 0.5rem; background: rgba(0,0,0,0.25); border-radius: 0.25rem; border-left: 2px solid {boss.color}60;"
								>
									<div
										style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem;"
									>
										<span style="font-size: 0.68rem; font-weight: 700; color: {boss.color};"
											>{ab.name}</span
										>
										<span
											style="font-size: 0.55rem; background: rgba(255,255,255,0.07); padding: 0.1rem 0.3rem; border-radius: 0.2rem; color: rgba(255,255,255,0.4);"
											>CD {ab.cooldown}</span
										>
									</div>
									<span style="font-size: 0.6rem; color: rgba(255,255,255,0.5); line-height: 1.35;"
										>{ab.desc}</span
									>
								</div>
							{/each}
							<!-- Tactical tip -->
							<div
								style="padding: 0.3rem 0.5rem; background: rgba(255,200,80,0.06); border-radius: 0.25rem; border-left: 2px solid rgba(255,200,80,0.4);"
							>
								<span
									style="font-size: 0.6rem; color: rgba(255,200,100,0.7); line-height: 1.35; font-style: italic;"
									>💡 {boss.tips[0]}</span
								>
							</div>
						</div>
					{/key}
				</div>

				<!-- Cycling tips -->
				<div style="padding: 0.55rem 0.6rem; height: 7rem; position: relative; overflow: hidden;">
					{#key tipIndex}
						{@const tip = TIPS[tipIndex]}
						<div
							in:fade={{ duration: 350 }}
							style="display: flex; flex-direction: column; gap: 0.15rem;"
						>
							<span
								style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: {tip.color}; opacity: 0.9;"
								>{tip.tag}</span
							>
							<span style="font-size: 0.72rem; color: rgba(255,255,255,0.6); line-height: 1.4;"
								>{tip.text}</span
							>
						</div>
					{/key}
				</div>
				{#if currentLobby?.isPublic && myEntry && !myEntry.isReady && readySecondsLeft > 0}
					{@const urgent = readySecondsLeft <= 30}
					<div
						style="padding: 0.65rem 0.75rem; border-radius: 0.5rem; border: 1px solid {urgent
							? 'rgba(255,80,80,0.5)'
							: 'rgba(255,180,50,0.35)'}; background: {urgent
							? 'rgba(255,50,50,0.12)'
							: 'rgba(255,160,30,0.08)'}; display: flex; flex-direction: column; gap: 0.2rem;"
					>
						<p
							style="margin: 0; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: {urgent
								? '#f66'
								: '#ffa530'};"
						>
							{urgent ? '⚠ Ready up now!' : '⏱ Ready up deadline'}
						</p>
						<p
							style="margin: 0; font-size: 1.5rem; font-weight: 800; color: {urgent
								? '#f55'
								: '#ffb84d'}; line-height: 1;"
						>
							{Math.floor(readySecondsLeft / 60)}:{String(readySecondsLeft % 60).padStart(2, '0')}
						</p>
						<p
							style="margin: 0; font-size: 0.68rem; color: rgba(255,255,255,0.45); line-height: 1.3;"
						>
							You'll be removed if you don't ready up in time.
						</p>
					</div>
				{/if}
				<button
					class="rpgui-button"
					style="width: 100%; margin-top: 0.25rem;"
					onclick={() => {
						soundActions.playClick();
						leaving = true;
						lobbyActions.leaveLobby(currentLobby!.id);
						stageActions.setStage('menu');
					}}
					disabled={currentLobby?.status !== 'waiting'}
				>
					<p>Leave Lobby</p>
				</button>
			</div>
		{/if}
	</div>

	<!-- Countdown overlay — centered above everything -->
	{#if currentLobby?.status === 'countdown'}
		<div
			transition:fade={{ duration: 250 }}
			style="position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
			       background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);"
		>
			<div class="rpgui-container framed-golden" style="padding: 2rem 3.5rem; text-align: center;">
				<p
					style="margin: 0 0 0.5rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.6); font-weight: 600;"
				>
					Game Starting
				</p>
				{#key countdownValue}
					<p
						in:fly={{ y: -20, duration: 220 }}
						style="margin: 0; font-size: 5rem; font-weight: 900; color: #ff8; line-height: 1; font-variant-numeric: tabular-nums;"
					>
						{countdownValue}
					</p>
				{/key}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Scale RPGUI progress bars down for compact stat cards */
	:global(.progress-sm.rpgui-progress) {
		height: 18px;
		margin-top: 2px;
		margin-bottom: 2px;
	}
	:global(.progress-sm .rpgui-progress-left-edge),
	:global(.progress-sm .rpgui-progress-right-edge) {
		height: 18px;
		width: 18px;
	}
	:global(.progress-sm .rpgui-progress-track) {
		height: 18px;
		left: 18px;
		right: 18px;
	}
	:global(.progress-sm .rpgui-progress-fill) {
		top: 4px;
		bottom: 3px;
	}
</style>
