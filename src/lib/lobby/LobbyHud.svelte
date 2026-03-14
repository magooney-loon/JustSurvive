<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { stageActions } from '$root/stage.svelte.js';
	import { lobbyActions, lobbyState } from '$lib/stores/lobby.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { soundActions } from '$root/Sound.svelte';

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

	const CLASSES = ['spotter', 'gunner', 'tank', 'healer'] as const;

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner: '#f84',
		tank: '#8a4',
		healer: '#f4a'
	};

	const CLASS_STATS: Record<string, { hp: number; stamina: number; role: string }> = {
		spotter: { hp: 100, stamina: 450, role: 'Scout' },
		gunner: { hp: 100, stamina: 80, role: 'DPS' },
		tank: { hp: 150, stamina: 200, role: 'Frontline' },
		healer: { hp: 100, stamina: 80, role: 'Support' }
	};

	type SynergyEntry = { label: string; desc: string; color: string };
	const SYNERGIES: Record<string, SynergyEntry> = {
		// ── Solo ──────────────────────────────────────────────────────────────
		spotter: {
			label: 'Lone Scout',
			desc: 'Mark targets and flash stun threats solo. Fast, fragile, flying blind on support.',
			color: '#4af'
		},
		gunner: {
			label: 'One-Man Army',
			desc: 'Pure DPS with nobody watching your back. Suppression or die.',
			color: '#f84'
		},
		tank: {
			label: 'One-Man Wall',
			desc: 'Incredible durability, zero intel. Brace and hope for the best.',
			color: '#8a4'
		},
		healer: {
			label: 'Field Medic Alone',
			desc: 'No frontline to heal. Survive on skill alone.',
			color: '#f4a'
		},
		// ── Double same class ─────────────────────────────────────────────────
		spotterx2: {
			label: 'Twin Eyes',
			desc: 'Double marks, double flash stuns — crowd control everywhere. Zero sustain though.',
			color: '#4af'
		},
		gunnerx2: {
			label: 'Twin Barrels',
			desc: 'Maximum suppression. Enemies barely move. Pray nothing reaches you.',
			color: '#f84'
		},
		tankx2: {
			label: 'Iron Wall',
			desc: 'Nothing gets through. Bash and brace forever — but who marks the kills?',
			color: '#8a4'
		},
		healerx2: {
			label: 'Eternal Life',
			desc: 'You will never die. You will also never do meaningful damage.',
			color: '#f4a'
		},
		// ── 2-class duos ──────────────────────────────────────────────────────
		'gunner+spotter': {
			label: 'Marked for Death',
			desc: 'Spotter reveals, gunner suppresses. Enemies are tagged before they know you exist.',
			color: '#fa6'
		},
		'spotter+tank': {
			label: 'Scout & Shield',
			desc: 'Intel meets armor. Spotter calls threats, tank absorbs them.',
			color: '#6cf'
		},
		'healer+spotter': {
			label: 'Ghost Protocol',
			desc: 'Eyes and sustain. Spotter scouts ahead, healer keeps the squad breathing.',
			color: '#adf'
		},
		'gunner+tank': {
			label: 'Shock & Awe',
			desc: 'Tank bashes to stagger, gunner unloads. Brutal CC chain.',
			color: '#fa4'
		},
		'gunner+healer': {
			label: 'Fire & Life',
			desc: 'Healer keeps the gunner fed. Constant suppression with a safety net.',
			color: '#faf'
		},
		'healer+tank': {
			label: 'Ironclad',
			desc: 'Tank braces, healer patches. Nearly unkillable duo — just missing a trigger finger.',
			color: '#8f8'
		},
		// ── 3-player with a doubled class ─────────────────────────────────────
		'gunner+spotterx2': {
			label: 'Eagle Eye Overwatch',
			desc: 'Two spotters feed marks to one gunner. Every enemy is a highlighted target.',
			color: '#6df'
		},
		'spotterx2+tank': {
			label: 'Recon Fortress',
			desc: 'Double intel feeding a tanky frontline. Nothing surprises this squad.',
			color: '#6af'
		},
		'gunnerx2+spotter': {
			label: 'Twin Guns, One Eye',
			desc: 'One spotter directs two shooters. Coordinated suppression at range.',
			color: '#fb8'
		},
		'gunnerx2+tank': {
			label: 'Breach & Clear',
			desc: 'Tank smashes in, two gunners finish the job. Aggressive and effective.',
			color: '#fc6'
		},
		'gunnerx2+healer': {
			label: 'Glass with Backbone',
			desc: 'Double DPS sustained by a healer. Explode damage, never stop shooting.',
			color: '#fca'
		},
		'spotter+tankx2': {
			label: 'Armored Recon',
			desc: 'Two tanks with scout support. Spotter marks; tanks absorb everything.',
			color: '#9d6'
		},
		'gunner+tankx2': {
			label: 'Battering Ram',
			desc: 'Two tanks distract and bash, gunner farms suppressed kills.',
			color: '#bd6'
		},
		'healer+tankx2': {
			label: 'Immortal Frontline',
			desc: 'Two tanks and a healer. Nothing dies — including you.',
			color: '#8fc'
		},
		'healerx2+spotter': {
			label: 'Eyes of God',
			desc: 'Double sustain and full map awareness. Survive forever, see everything.',
			color: '#cff'
		},
		'gunner+healerx2': {
			label: 'Pampered DPS',
			desc: 'One gunner with two dedicated healers. Absolute overkill on sustain.',
			color: '#faf'
		},
		// ── 3-class trios ─────────────────────────────────────────────────────
		'gunner+spotter+tank': {
			label: 'Warband',
			desc: 'Mark, bash, suppress. Three damage vectors with zero safety net.',
			color: '#fa8'
		},
		'gunner+healer+spotter': {
			label: 'Glass Cannon Squad',
			desc: 'Full intel and firepower with a medic. Win fast or die smart.',
			color: '#f86'
		},
		'healer+spotter+tank': {
			label: 'The Phalanx',
			desc: 'Marked threats, tanky frontline, endless heals. Fortress squad.',
			color: '#8fa'
		},
		'gunner+healer+tank': {
			label: 'The Backbone',
			desc: 'Core combat trio. DPS, armor, sustain — the classic survival loadout.',
			color: '#af8'
		},
		// ── 4-player with two doubled classes ─────────────────────────────────
		'gunnerx2+spotterx2': {
			label: 'Eyes & Firepower',
			desc: 'Maximum recon and DPS. No defense, but enemies are dead before they arrive.',
			color: '#fd8'
		},
		'spotterx2+tankx2': {
			label: 'Armored Overwatch',
			desc: 'Double eyes, double armor. Impenetrable and always aware.',
			color: '#7cf'
		},
		'healerx2+spotterx2': {
			label: 'Support Fortress',
			desc: 'Double intel and infinite sustain. You will outlast everything.',
			color: '#bff'
		},
		'gunnerx2+tankx2': {
			label: 'Steamroller',
			desc: 'Total offense and defense. Bash, suppress, repeat. Nothing survives.',
			color: '#fd6'
		},
		'gunnerx2+healerx2': {
			label: 'Sustained Fire',
			desc: 'Double DPS never stops — two healers make sure of it.',
			color: '#fcf'
		},
		'healerx2+tankx2': {
			label: 'The Bunker',
			desc: 'Survive forever, damage nothing. Best defensive quad possible.',
			color: '#9fc'
		},
		// ── 4-player with one doubled class ───────────────────────────────────
		'gunner+spotterx2+tank': {
			label: 'Overwatch Formation',
			desc: 'Two spotters direct tank and gunner. Every move is calculated.',
			color: '#7df'
		},
		'gunner+healer+spotterx2': {
			label: 'Precision Squad',
			desc: 'Intel-heavy strike team. Two eyes guide gun and medic.',
			color: '#aef'
		},
		'healer+spotterx2+tank': {
			label: 'Turtle Watch',
			desc: 'Observe and survive. Double intel with tank+healer anchor.',
			color: '#8df'
		},
		'gunnerx2+spotter+tank': {
			label: 'Suppression Front',
			desc: 'Tank holds the line, two gunners suppress everything behind it.',
			color: '#fc8'
		},
		'gunnerx2+healer+spotter': {
			label: 'Fire Team Alpha',
			desc: 'Spotter + double DPS + medic. Aggressive intel-driven strike force.',
			color: '#fb6'
		},
		'gunnerx2+healer+tank': {
			label: 'Assault Squad',
			desc: 'Heavy DPS with armor and sustain. Balanced but offense-leaning.',
			color: '#fba'
		},
		'gunner+spotter+tankx2': {
			label: 'Shield Wall',
			desc: 'Double tanks absorb chaos while spotter and gunner farm kills behind them.',
			color: '#ad8'
		},
		'healer+spotter+tankx2': {
			label: 'Fortified Recon',
			desc: 'Safe scouting from behind double armor with a healer backup.',
			color: '#9e8'
		},
		'gunner+healer+tankx2': {
			label: 'Siege Mode',
			desc: 'Slow and unstoppable. Two tanks advance, gunner suppresses, healer sustains.',
			color: '#be8'
		},
		'gunner+healerx2+spotter': {
			label: 'Pampered Strike',
			desc: 'One gunner with double heals and full intel. Basically unkillable DPS.',
			color: '#fce'
		},
		'healerx2+spotter+tank': {
			label: 'Immortal Phalanx',
			desc: 'Sustained recon frontline. Tank never dies, spotter never misses.',
			color: '#afa'
		},
		'gunner+healerx2+tank': {
			label: 'Full Combat Support',
			desc: 'Balanced with maximum sustain. Classic roles, double the healing.',
			color: '#bfa'
		},
		// ── Full squad ────────────────────────────────────────────────────────
		'gunner+healer+spotter+tank': {
			label: 'Full Squad',
			desc: 'Perfect synergy. Every role covered — textbook survival.',
			color: '#ff8'
		}
	};

	const activeSynergy = $derived(
		SYNERGIES[
			Object.entries(classCounts)
				.filter(([, n]) => n > 0)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([cls, n]) => (n >= 2 ? `${cls}x2` : cls))
				.join('+')
		] ?? null
	);

	let countdownValue = $state(3);
	let connectingCountdown = $state(10);

	$effect(() => {
		if (!currentLobby && lobbyState.currentLobbyId === null) {
			connectingCountdown = 10;
			const interval = setInterval(() => {
				connectingCountdown--;
				if (connectingCountdown <= 0) {
					clearInterval(interval);
					stageActions.setStage('menu');
				}
			}, 1000);
			return () => clearInterval(interval);
		}
	});

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
				lobbyState.currentSessionId = session.id;
				stageActions.setStage('game');
			}
		}
	});

	function copyCode() {
		if (currentLobby) navigator.clipboard.writeText(currentLobby.code);
	}

	const TIPS = [
		// Game mechanics
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Stamina regenerates faster after standing still briefly. Walking is always free.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Enemies spawn 35 units around a random alive player — you always have a moment to react.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Each day cycle is 5 minutes (5 phases × 1 minute each). Survive full cycles to score big.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Spawn rate accelerates every cycle — starts at one enemy every 6s, floors at 1.5s.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Enemies get +5 HP per cycle completed, capped at 3× their base health.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Every enemy gets faster the longer it stays alive — up to +50% speed over time. Kill fast.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Up to 26 enemies can be alive at once. Clearing the field briefly reduces spawn pressure.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'If you go down, wait for a teammate to revive you. If all players are downed at once, the game ends.'
		},
		{
			tag: 'Tip',
			color: '#adf',
			text: 'Enemies loosely spread targets — each player gets at most 3 enemies fixated on them.'
		},
		// Day cycle
		{
			tag: 'Day Cycle',
			color: '#fa8',
			text: 'Sunset → Dusk → Twilight → Night → Deep Night, then loops. Each phase is 60 seconds.'
		},
		{
			tag: 'Day Cycle',
			color: '#fa8',
			text: 'Night and Deep Night bring storms, lightning, and faster, harder enemies. Brace up.'
		},
		{
			tag: 'Day Cycle',
			color: '#fa8',
			text: "Surviving to the next Sunset completes a cycle and increases your squad's score multiplier."
		},
		// Enemy types
		{
			tag: 'Enemy: Basic',
			color: '#f88',
			text: '57% of spawns. Slow and direct. Easy to kite but threatening in large packs.'
		},
		{
			tag: 'Enemy: Fast',
			color: '#f88',
			text: '24% of spawns. Low HP (50) but closes gaps instantly at 5.2 units/s. Shoot on sight.'
		},
		{
			tag: 'Enemy: Brute',
			color: '#f88',
			text: '10% of spawns. 250 HP base — the tankiest enemy. Bash it, slow it, then pile on.'
		},
		{
			tag: 'Enemy: Spitter',
			color: '#f88',
			text: '5% of spawns. Hangs back at 12-unit range and lobs acid pools. Move out of the green.'
		},
		{
			tag: 'Enemy: Caster',
			color: '#f88',
			text: '4% of spawns. Fires a beam from 8 units and strafes unpredictably. Suppress it first.'
		},
		// Class tips
		{
			tag: 'Spotter',
			color: '#4af',
			text: 'Marked enemies take bonus damage from all sources — always mark before the gunner shoots.'
		},
		{
			tag: 'Spotter',
			color: '#4af',
			text: 'Flash stun stuns enemies in a 90° cone — use it to buy time for teammates when overwhelmed.'
		},
		{
			tag: 'Gunner',
			color: '#f84',
			text: 'Every 3rd shot suppresses (dazes) the target. Chain bursts to keep Brutes permanently staggered.'
		},
		{
			tag: 'Tank',
			color: '#8a4',
			text: 'Shield Bash has a 1.5s cooldown. Use it to knock enemies off downed teammates.'
		},
		{
			tag: 'Tank',
			color: '#8a4',
			text: 'Bracing significantly reduces incoming damage. Hold RMB when a Brute or beam is incoming.'
		},
		{
			tag: 'Healer',
			color: '#f4a',
			text: 'Reviving a downed ally gives them a speed boost — use it to pull them out of a pile.'
		},
		{
			tag: 'Healer',
			color: '#f4a',
			text: 'Taking damage while channeling a revive interrupts it. Tank should cover the heal.'
		}
	];

	let tipIndex = $state(0);
	$effect(() => {
		const id = setInterval(() => {
			tipIndex = (tipIndex + 1) % TIPS.length;
		}, 5000);
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
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
>
	<!-- Squad Synergy — absolutely positioned at the top center, above everything -->
	{#if activeSynergy && currentLobby}
		{@const syn = activeSynergy}
		<div
			class="rpgui-container framed-golden"
			style="position: absolute; top: 0.75rem; left: 50%; transform: translateX(-50%); z-index: 10; padding: 0.4rem 1.25rem; display: flex; align-items: center; gap: 1.25rem; white-space: nowrap;"
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
		style="padding: 1.5rem; color: white; display: flex; gap: 1.5rem; align-items: flex-start;"
	>
		<!-- Left: Lobby panel -->
		<div style="width: 560px; flex-shrink: 0;">
			{#if !currentLobby}
				<p>Connecting to lobby... or kicked...</p>
				<p>
					Canceling in {connectingCountdown}s...
				</p>
				<button
					class="rpgui-button"
					onclick={() => {
						soundActions.playClick();
						lobbyState.currentLobbyId = null;
						stageActions.setStage('menu');
					}}
				>
					<p>Back</p>
				</button>
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
											lobbyActions.kickPlayer(currentLobby.id, player.playerIdentity);
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
						{#each CLASSES as cls}
							{@const isFull = classCounts[cls] >= 2}
							{@const isSelected = myEntry?.classChoice === cls}
							{@const classLocked =
								isFull ||
								currentLobby?.status !== 'waiting' ||
								(currentLobby?.isPublic && !!myEntry?.isReady)}
							<button
								onclick={() => {
									if (!classLocked) {
										soundActions.playClick();
										lobbyActions.setClass(cls, currentLobby.id);
									}
								}}
								disabled={classLocked}
								class="rpgui-button"
								style="width: 100%; min-width: auto; height: auto; padding: 0.6rem 0.25rem; {isSelected &&
								!isFull
									? 'background-image: url(/css/img/button-down.png); outline: 2px solid ' +
										CLASS_COLORS[cls] +
										'; outline-offset: -2px;'
									: ''}"
							>
								<div
									style="display: flex; flex-direction: column; align-items: center; gap: 0.15rem;"
								>
									{#if cls === 'spotter'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url(/css/img/icons/sword.png);"
										></div>
									{:else if cls === 'gunner'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url(/css/img/icons/weapon-slot.png);"
										></div>
									{:else if cls === 'tank'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url(/css/img/icons/shield.png);"
										></div>
									{:else if cls === 'healer'}
										<div
											class="rpgui-icon"
											style="width: 32px; height: 32px; background-image: url(/css/img/icons/potion-red.png);"
										></div>
									{/if}
									<span
										style="font-size: 0.7rem; font-weight: 700; text-transform: capitalize; color: {isSelected
											? isFull
												? 'rgba(255,255,255,0.3)'
												: CLASS_COLORS[cls]
											: isFull
												? 'rgba(255,255,255,0.3)'
												: 'white'};">{cls}</span
									>
									<span style="font-size: 0.5rem; opacity: 0.5;">({classCounts[cls]}/2)</span>
								</div>
							</button>
						{/each}
					</div>

					<!-- Class stats bars -->
					<div
						style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem;"
					>
						{#each CLASSES as cls}
							{@const isSelected = myEntry?.classChoice === cls}
							<div
								class="rpgui-container framed-grey"
								style="padding: 0.4rem; {isSelected
									? 'border-color: ' + CLASS_COLORS[cls] + ';'
									: ''}"
							>
								<div
									style="font-size: 0.6rem; text-transform: capitalize; text-align: center; color: {CLASS_COLORS[
										cls
									]}; margin-bottom: 0.25rem;"
								>
									{cls}
								</div>
								<span style="font-size: 0.5rem;">HP</span>
								<div
									class="rpgui-progress red progress-sm"
									data-value={CLASS_STATS[cls].hp / 150}
									use:rpguiProgress
								></div>
								<span style="font-size: 0.5rem;">STM</span>
								<div
									class="rpgui-progress green progress-sm"
									data-value={CLASS_STATS[cls].stamina / 450}
									use:rpguiProgress
								></div>
							</div>
						{/each}
					</div>

					{#if myEntry?.classChoice}
						<div class="rpgui-container framed-grey" style="margin-top: 0.75rem; padding: 0.75rem;">
							<p
								style="margin: 0 0 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: {CLASS_COLORS[
									myEntry.classChoice
								]};"
							>
								{myEntry.classChoice} Abilities
							</p>
							{#if myEntry.classChoice === 'spotter'}
								<p style="margin: 0 0 0.25rem; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 LMB:</span> Mark enemy
								</p>
								<p style="margin: 0; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 RMB:</span> Flash stun
								</p>
							{:else if myEntry.classChoice === 'gunner'}
								<p style="margin: 0 0 0.25rem; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 LMB:</span> Shoot enemy
								</p>
								<p style="margin: 0; font-size: 0.75rem;">
									<span style="opacity: 0.7;">⚡ Every 3rd:</span> Suppress
								</p>
							{:else if myEntry.classChoice === 'tank'}
								<p style="margin: 0 0 0.25rem; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 LMB:</span> Shield bash
								</p>
								<p style="margin: 0; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 RMB hold:</span> Brace
								</p>
							{:else if myEntry.classChoice === 'healer'}
								<p style="margin: 0 0 0.25rem; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 LMB:</span> Heal teammate
								</p>
								<p style="margin: 0; font-size: 0.75rem;">
									<span style="opacity: 0.7;">🖱 RMB:</span> Revive
								</p>
							{/if}
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
						lobbyActions.setReady(currentLobby.id, !myEntry?.isReady);
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
							lobbyActions.startCountdown(currentLobby.id);
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

				{#if currentLobby?.status === 'countdown'}
					<p class="rpgui-center" style="font-size: 2rem; color: #ff8;">
						Starting in {countdownValue}...
					</p>
				{/if}

				<button
					class="rpgui-button"
					style="width: 100%;"
					onclick={() => {
						soundActions.playClick();
						lobbyActions.leaveLobby(currentLobby.id);
						stageActions.setStage('menu');
					}}
					disabled={currentLobby?.status !== 'waiting'}
				>
					<p>Leave Lobby</p>
				</button>

				{#if lobbyState.error}
					<p style="color: #f66;">{lobbyState.error}</p>
				{/if}
			{/if}
		</div>

		<!-- Right: Chat panel -->
		{#if currentLobby}
			<div
				class="rpgui-container framed-grey"
				style="width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem;"
			>
				<h4>Lobby Chat</h4>

				<!-- Messages -->
				<div
					bind:this={chatEl}
					class="rpgui-list-imp"
					style="flex: 1; min-height: 200px; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem;"
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

				<!-- Cycling tips -->
				<div
					style="padding: 0.55rem 0.6rem; min-height: 3.2rem; position: relative; overflow: hidden;"
				>
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
			</div>
		{/if}
	</div>
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
