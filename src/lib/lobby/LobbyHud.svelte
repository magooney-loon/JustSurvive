<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { stageActions } from '../../stage.svelte.js';
	import { gameActions, gameState } from '../stores/game.svelte.js';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../../module_bindings/index.js';
	import { soundActions } from '../../Sound.svelte';

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
		if (!currentLobby && gameState.currentLobbyId === null) {
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
				gameState.currentSessionId = session.id;
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
			text: "If you go down, a teammate has 30 seconds to revive you before you're eliminated."
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
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px)"
>
	<div
		style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; padding: 2rem; min-width: 720px; color: white;"
	>
		{#if !currentLobby}
			<p style="color: rgba(255,255,255,0.6); margin: 0 0 0.5rem;">Connecting to lobby...</p>
			<p style="color: rgba(255,255,255,0.4); margin: 0 0 1rem; font-size: 0.85rem;">
				Canceling in {connectingCountdown}s...
			</p>
			<button
				onclick={() => {
					soundActions.playClick();
					gameState.currentLobbyId = null;
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
						{#if !currentLobby?.isPublic}
							{#if player.playerIdentity.toHexString() === currentLobby?.hostIdentity.toHexString()}
								<span title="Host" style="font-size: 0.85rem;">👑</span>
							{:else if isHost}
								<button
									onclick={() => {
										soundActions.playClick();
										gameActions.kickPlayer(currentLobby.id, player.playerIdentity);
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
						{@const isFull = classCounts[cls] >= 2}
						{@const isSelected = myEntry?.classChoice === cls}
						{@const classLocked = isFull || currentLobby?.status !== 'waiting' || (currentLobby?.isPublic && !!myEntry?.isReady)}
						<button
							onclick={() => {
								if (!classLocked) {
									soundActions.playClick();
									gameActions.setClass(cls, currentLobby.id);
								}
							}}
							disabled={classLocked}
							style="flex: 1; padding: 0.5rem 0.4rem; border-radius: 0.375rem; border: 1px solid rgba(255,255,255,{isSelected
								? '0.6'
								: isFull
									? '0.1'
									: '0.15'}); background: {isSelected
								? 'rgba(0,0,0,0.4)'
								: isFull
									? 'rgba(0,0,0,0.2)'
									: 'rgba(255,255,255,0.06)'}; color: {isSelected
								? CLASS_COLORS[cls]
								: isFull
									? 'rgba(255,255,255,0.3)'
									: 'white'}; cursor: {classLocked
								? 'not-allowed'
								: 'pointer'}; transition: background 0.15s, border-color 0.15s; display: flex; flex-direction: column; align-items: center; gap: 0.12rem;"
						>
							<span
								style="font-size: 0.82rem; font-weight: 700; text-transform: capitalize; line-height: 1;"
								>{cls}</span
							>
							<span style="font-size: 0.58rem; opacity: 0.5; line-height: 1;"
								>{CLASS_STATS[cls].role}</span
							>
							<span style="font-size: 0.6rem; opacity: 0.55; line-height: 1;"
								>❤ {CLASS_STATS[cls].hp} · ⚡ {CLASS_STATS[cls].stamina}</span
							>
							<span style="font-size: 0.55rem; opacity: 0.4; line-height: 1;"
								>({classCounts[cls]}/2)</span
							>
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
								<span style="opacity: 0.7;">LMB:</span> Mark enemy (2s cooldown)
							</p>
							<p style="margin: 0; font-size: 0.8rem;">
								<span style="opacity: 0.7;">RMB:</span> Flash stun (1.5s cooldown)
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

				<!-- Synergy -->
				{#if activeSynergy}
					{@const syn = activeSynergy}
					<div
						style="background: rgba(255,255,255,0.04); border: 1px solid {syn.color}44; border-radius: 0.5rem; padding: 0.6rem 0.75rem; margin-top: 0.5rem;"
					>
						<p
							style="margin: 0 0 0.2rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5;"
						>
							Squad Synergy
						</p>
						<p
							style="margin: 0 0 0.2rem; font-size: 0.85rem; font-weight: 700; color: {syn.color};"
						>
							{syn.label}
						</p>
						<p style="margin: 0; font-size: 0.75rem; opacity: 0.65;">{syn.desc}</p>
					</div>
				{/if}
			</div>

			<!-- Ready toggle -->
			{@const readyLocked = !myEntry?.classChoice || currentLobby?.status !== 'waiting' || (currentLobby?.isPublic && !!myEntry?.isReady)}
			<button
				onclick={() => {
					soundActions.playClick();
					gameActions.setReady(currentLobby.id, !myEntry?.isReady);
				}}
				disabled={readyLocked}
				style="width: 100%; padding: 0.65rem; margin-bottom: 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,{myEntry?.isReady
					? '0.45'
					: '0.2'}); background: {myEntry?.isReady
					? 'rgba(74,170,136,0.3)'
					: 'rgba(255,255,255,0.1)'}; color: white; cursor: {readyLocked
					? 'not-allowed'
					: 'pointer'}; font-weight: 600; font-size: 0.95rem; transition: background 0.15s;"
			>
				{myEntry?.isReady ? '✓ Locked In' : 'Ready Up'}
			</button>

			<!-- Start area -->
			{#if currentLobby?.isPublic}
				<p
					style="text-align: center; color: rgba(255,255,255,0.45); font-size: 0.875rem; margin: 0 0 0.5rem;"
				>
					{gameStarting ? 'Starting...' : allReady ? 'Starting soon...' : 'Game starts when 2+ players are ready'}
				</p>
			{:else if isHost}
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
				style="width: 100%; margin-top: 0.25rem; padding: 0.5rem; background: rgba(220,50,50,0.15); border: 1px solid rgba(220,50,50,0.3); border-radius: 0.5rem; color: rgba(255,120,120,0.9); cursor: {currentLobby?.status !==
				'waiting'
					? 'not-allowed'
					: 'pointer'}; font-size: 0.875rem;"
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

			<!-- Cycling tips -->
			<div
				style="margin-top: 0.6rem; padding: 0.55rem 0.75rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.5rem; min-height: 2.8rem; position: relative; overflow: hidden;"
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
						<span style="font-size: 0.73rem; color: rgba(255,255,255,0.6); line-height: 1.4;"
							>{tip.text}</span
						>
					</div>
				{/key}
			</div>

			{#if gameState.error}
				<p style="color: #f66; margin: 0.75rem 0 0; font-size: 0.875rem;">{gameState.error}</p>
			{/if}
		{/if}
	</div>
</div>
