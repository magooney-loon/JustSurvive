<script lang="ts">
	import { fly } from 'svelte/transition';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import { abilityState } from '$lib/stores/abilities.svelte.js';
	import { CLASSES, type ClassId } from '$lib/lobby/classData.js';
	import { bossShake, spectateState } from '$lib/stores/movement.svelte.js';
	import ReviveChannelHud from '$lib/character/ui/ReviveChannelHud.svelte';
	import { stageActions } from '$root/stage.svelte.js';
	import { soundActions } from '$root/Sound.svelte';
	import { untrack } from 'svelte';

	let now = $state(Date.now());

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [sessions] = useTable(tables.gameSession);
	const [bosses] = useTable(tables.boss);
	const [tankStates] = useTable(tables.tankState);
	const [healerStates] = useTable(tables.healerState);

	const session = $derived($sessions.find((s) => s.id === lobbyState.currentSessionId));
	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);
	const myTankState = $derived(
		$tankStates.find(
			(t) =>
				t.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				t.sessionId === lobbyState.currentSessionId
		)
	);
	const myHealerState = $derived(
		$healerStates.find(
			(h) =>
				h.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				h.sessionId === lobbyState.currentSessionId
		)
	);
	const teammates = $derived(
		$players.filter(
			(p) =>
				p.playerIdentity.toHexString() !== $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);
	const boss = $derived(
		$bosses.find((b) => b.sessionId === lobbyState.currentSessionId && b.isAlive)
	);
	const alivePeers = $derived(teammates.filter((p) => p.status === 'alive'));
	const spectateTarget = $derived(
		alivePeers.length > 0 ? alivePeers[spectateState.index % alivePeers.length] : null
	);
	const BOSS_SPAWN_INTERVAL_MS = 90_000;
	let bossTimerStartMs = $state<number | null>(null);
	let hadBoss = $state(false);

	// Track boss death → restart countdown
	$effect(() => {
		if (boss) {
			hadBoss = true;
		} else if (hadBoss) {
			hadBoss = false;
			bossTimerStartMs = Date.now();
		}
	});

	// Initialize countdown at game start (before first boss)
	$effect(() => {
		if (session?.status === 'active' && !boss && bossTimerStartMs === null) {
			bossTimerStartMs = lobbyState.gameStartedAt ?? Date.now();
		}
		if (session?.status !== 'active') {
			bossTimerStartMs = null;
			hadBoss = false;
		}
	});

	const bossSecsLeft = $derived(
		!boss && bossTimerStartMs !== null
			? Math.max(0, Math.ceil((BOSS_SPAWN_INTERVAL_MS - (now - bossTimerStartMs)) / 1000))
			: 0
	);

	const DAY_PHASE_LABELS: Record<string, string> = {
		sunset: 'Sunset',
		dusk: 'Dusk',
		twilight: 'Twilight',
		night: 'Night',
		deep_night: 'Deep Night'
	};

	let sessionWasActive = $state(false);
	$effect(() => {
		if (session?.status === 'active' && !sessionWasActive) {
			sessionWasActive = true;
			lobbyState.gameStartedAt = Date.now();
			untrack(() => soundActions.playGameStart());
			document.documentElement.requestFullscreen?.().catch(() => {});
		}
		if (session?.status === 'finished' && sessionWasActive) {
			sessionWasActive = false;
			lobbyState.gameStartedAt = null;
			bossShake.intensity = 0;
			untrack(() => soundActions.playGameEnd());
			if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
			stageActions.setStage('game_over');
		}
	});

	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
		}, 80);
		return () => clearInterval(id);
	});

	function hpPercent(hp: bigint, max: bigint) {
		return max > 0n ? Number((hp * 100n) / max) : 0;
	}

	function cdFrac(untilMicros: bigint | undefined | null, totalMs: number): number {
		if (!untilMicros) return 0;
		const remaining = Number(untilMicros / 1000n) - now;
		return remaining > 0 ? Math.min(1, remaining / totalMs) : 0;
	}

	type AbilitySlot = {
		label: string;
		input: string;
		color: string;
		cdFrac: number;
		cdMs?: number;
		active?: boolean;
	};

	const abilities = $derived((): [AbilitySlot, AbilitySlot, AbilitySlot] => {
		const cls = myState?.classChoice as ClassId | undefined;
		const none: [AbilitySlot, AbilitySlot, AbilitySlot] = [
			{ label: '—', input: '', color: '#555', cdFrac: 0 },
			{ label: '—', input: '', color: '#555', cdFrac: 0 },
			{ label: '—', input: '', color: '#555', cdFrac: 0 }
		];
		if (!cls || !CLASSES[cls]) return none;

		const { stats, abilities: ab } = CLASSES[cls];
		const color = stats.color;
		const [a0, a1, a2] = ab;

		// Map each class ability to its abilityState cooldown key
		const cd0: Record<ClassId, number> = {
			spotter: Math.max(0, (abilityState.markCooldownUntil - now) / a0.cooldownMs),
			gunner: 0,
			tank: Math.max(0, (abilityState.bashCooldownUntil - now) / a0.cooldownMs),
			healer: Math.max(0, (abilityState.healCooldownUntil - now) / a0.cooldownMs)
		};
		const cd1: Record<ClassId, number> = {
			spotter: Math.max(0, (abilityState.pingCooldownUntil - now) / a1.cooldownMs),
			gunner: Math.max(0, (abilityState.adrenalineCooldownUntil - now) / a1.cooldownMs),
			tank: Math.max(0, (abilityState.chargeCooldownUntil - now) / a1.cooldownMs),
			healer: cdFrac(myHealerState?.reviveCooldownUntil?.microsSinceUnixEpoch, a1.cooldownMs)
		};
		const ultCdFrac = a2
			? Math.max(0, (abilityState.ultimateCooldownUntil - now) / a2.cooldownMs)
			: 0;

		// Dynamic label overrides
		const label0 =
			cls === 'gunner'
				? `Fire${abilityState.suppressHits % 3 > 0 ? ` ${abilityState.suppressHits % 3}/3` : ' ★'}`
				: a0.hudLabel;

		return [
			{ label: label0, input: a0.input, color, cdFrac: cd0[cls], cdMs: a0.cooldownMs || undefined },
			{
				label: a1.hudLabel,
				input: a1.input,
				color,
				cdFrac: cd1[cls],
				cdMs: a1.cooldownMs || undefined,
				active: cls === 'tank' ? (myTankState?.isCharging ?? false) : undefined
			},
			a2
				? {
						label: a2.hudLabel,
						input: a2.input,
						color: '#ffcc44',
						cdFrac: ultCdFrac,
						cdMs: a2.cooldownMs
					}
				: { label: '—', input: '', color: '#555', cdFrac: 0 }
		];
	});
</script>

<div
	transition:fly={{ x: -20, duration: 300 }}
	class="rpgui-content"
	style="
		position: absolute;
		inset: 0;
		pointer-events: none;
		perspective: 1200px;
		transform-style: preserve-3d;
	"
>
	<!-- Day phase indicator — top left -->
	<div
		class="rpgui-container framed"
		style="
			position: absolute;
			top: 1rem;
			left: 1rem;
			padding: 0.35rem 1rem;
			display: inline-flex;
			align-items: center;
			gap: 0.6rem;
			white-space: nowrap;
			transform: rotateY(8deg) skewY(-1deg);
			transform-origin: left center;
		"
	>
		<span style="font-size: 0.9rem; font-weight: 500;"
			>{DAY_PHASE_LABELS[session?.dayPhase ?? 'sunset'] ?? ''}</span
		>
		{#if session?.cycleNumber && session.cycleNumber > 0n}
			<span style="color: #ffd060; font-weight: 700; font-size: 0.9rem;"
				>Day {Number(session.cycleNumber) + 1}</span
			>
		{/if}
	</div>

	<!-- Boss — top right: countdown or HP bar -->
	{#if boss}
		<div
			class="rpgui-container framed"
			style="
				position: absolute;
				top: 1rem;
				right: 1rem;
				min-width: 260px;
				padding: 0.5rem 1.25rem;
				text-align: center;
				transform: rotateY(-8deg) skewY(1deg);
				transform-origin: right center;
			"
		>
			<p
				style="margin: 0 0 0.4rem; font-size: 0.75rem; color: #ff4466; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;"
			>
				⚠ {boss.bossType.replace(/_/g, ' ').toUpperCase()}
			</p>
			<div class="boss-bar-track">
				<div class="boss-bar-fill" style="width: {hpPercent(boss.hp, boss.maxHp)}%;"></div>
			</div>
			<p style="margin: 0.3rem 0 0; font-size: 0.7rem; color: rgba(255,255,255,0.5);">
				{Number(boss.hp)} / {Number(boss.maxHp)}
			</p>
		</div>
	{:else}
		<div
			class="rpgui-container framed"
			style="
				position: absolute;
				top: 1rem;
				right: 1rem;
				padding: 0.4rem 1.25rem;
				white-space: nowrap;
				text-align: center;
				transform: rotateY(-8deg) skewY(1deg);
				transform-origin: right center;
			"
		>
			<span
				style="font-size: 0.75rem; color: rgba(255,100,130,0.8); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;"
			>
				<span
					style="font-size: 0.75rem; color: rgba(255,100,130,0.8); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;"
					>Boss in</span
				>
				<span
					style="font-size: 1.5rem; font-weight: 800; color: #ff4466; margin-left: 0.5rem; font-variant-numeric: tabular-nums;"
					>{bossSecsLeft}s</span
				>
			</span>
		</div>
	{/if}

	<!-- Ability bar — bottom right -->
	{#if myState && myState.status === 'alive'}
		{@const slots = abilities()}
		<div
			style="
				position: absolute;
				bottom: 2rem;
				right: 1.25rem;
				display: flex;
				gap: 0.75rem;
				pointer-events: none;
				transform: rotateY(-8deg) skewY(1deg);
				transform-origin: right bottom;
			"
		>
			{#each slots as slot}
				<div
					class="rpgui-container framed ability-slot"
					style="
						position: relative; min-width: 210px; width: 210px; height: 115px; overflow: hidden;
						outline: {slot.active ? `2px solid ${slot.color}` : 'none'};
						outline-offset: -2px;
						box-shadow: {slot.active ? `0 0 16px ${slot.color}66` : 'none'};
						transition: box-shadow 0.15s;
					"
				>
					<!-- Cooldown fill (bottom-up) -->
					{#if slot.cdFrac > 0}
						<div class="cd-overlay" style="height: {slot.cdFrac * 100}%;"></div>
					{/if}
					<!-- Active pulse -->
					{#if slot.active}
						<div class="active-overlay" style="background: {slot.color}1a;"></div>
					{/if}
					<!-- Content -->
					<div class="ability-content">
						<span class="ability-label" style="color: {slot.cdFrac > 0 ? '#777' : slot.color};">
							{slot.label}
						</span>
						{#if slot.input}
							<span class="ability-input">{slot.input}</span>
						{/if}
						{#if slot.cdFrac > 0}
							<span class="ability-cd">
								{((slot.cdFrac * (slot.cdMs ?? 5000)) / 1000).toFixed(1)}s
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Local player HP & stamina — bottom left -->
	{#if myState}
		<div
			class="rpgui-container framed"
			style="
				position: absolute;
				bottom: 2rem;
				left: 1.25rem;
				width: 270px;
				padding: 0.75rem 1rem;
				transform: rotateY(8deg) skewY(-1deg);
				transform-origin: left bottom;
			"
		>
			<!-- HP bar -->
			<div style="margin-bottom: 0.55rem;">
				<div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
					<span class="stat-label">HP</span>
					<span class="stat-value">{Number(myState.hp)} / {Number(myState.maxHp)}</span>
				</div>
				<div class="bar-track">
					<div
						class="bar-fill hp-fill"
						style="width: {hpPercent(myState.hp, myState.maxHp)}%;"
					></div>
				</div>
			</div>
			<!-- Stamina bar -->
			<div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
					<span class="stat-label">Stamina</span>
				</div>
				<div class="bar-track" style="height: 9px;">
					<div
						class="bar-fill stm-fill"
						style="width: {hpPercent(myState.stamina, myState.maxStamina)}%;"
					></div>
				</div>
			</div>
		</div>
		<!-- Score — bottom center (hidden when downed, replaced by downed banner) -->
		{#if myState.status === 'alive'}
			<div
				class="rpgui-container framed"
				style="
					position: absolute;
					bottom: 2rem;
					left: 50%;
			transform: translateX(-50%) skewY(-0.3deg);
					padding: 0.35rem 1.5rem;
					white-space: nowrap;
					text-align: center;
				"
			>
				<span style="font-size: 1.2rem; font-weight: 700; color: #ffd060;"
					>{Number(myState.score).toLocaleString()} pts</span
				>
			</div>
		{/if}
	{/if}

	<!-- Teammate status — top center -->
	<div
		style="
			position: absolute;
			top: 1rem;
			left: 50%;
			transform: translateX(-50%) skewY(0.3deg);
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
			align-items: center;
		"
	>
		{#each teammates as p (p.id)}
			<div class="teammate-card" style="color: {p.status === 'downed' ? '#f66' : 'inherit'};">
				<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem;">
					<span style="text-transform: capitalize; font-weight: 600; flex: 1; font-size: 0.8rem;"
						>{p.classChoice}</span
					>
					{#if p.status === 'downed'}
						<span style="color: #f66; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.04em;"
							>DOWN</span
						>
					{:else}
						<span style="font-size: 0.65rem; color: rgba(255,255,255,0.5);"
							>{Number(p.hp)}/{Number(p.maxHp)}</span
						>
					{/if}
				</div>
				{#if p.status !== 'downed'}
					<div class="bar-track" style="height: 5px;">
						<div class="bar-fill hp-fill" style="width: {hpPercent(p.hp, p.maxHp)}%;"></div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Downed state — lower-center -->
	{#if myState?.status === 'downed'}
		<button
			type="button"
			disabled={alivePeers.length === 0}
			style="position: absolute; bottom: 7rem; left: 50%; transform: translateX(-50%);
			       background: none; border: none; padding: 0; cursor: {alivePeers.length > 0
				? 'pointer'
				: 'default'};"
			onclick={() => spectateState.index++}
		>
			<div
				class="rpgui-container framed"
				style="text-align: center; padding: 1.25rem 3rem; min-width: 340px;"
			>
				<div
					style="font-size: 2rem; color: #f44; font-weight: 900; letter-spacing: 0.1em; text-shadow: 0 0 18px #f004; margin-bottom: 0.5rem;"
				>
					YOU'RE DOWN
				</div>
				{#if spectateTarget}
					<div
						style="font-size: 1rem; color: rgba(255,255,255,0.85); text-transform: capitalize; font-weight: 600; margin-bottom: 0.25rem;"
					>
						Spectating: {spectateTarget.classChoice}
					</div>
					<div style="font-size: 0.8rem; color: rgba(255,255,255,0.4);">Click to switch player</div>
				{:else}
					<div style="font-size: 0.95rem; color: rgba(255,255,255,0.55);">
						Waiting for Healer or next cycle...
					</div>
				{/if}
			</div>
		</button>
	{/if}

	<!-- Revive channel progress (healer only) -->
	<ReviveChannelHud />
</div>

<style>
	/* Boss HP bar */
	.boss-bar-track {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		height: 14px;
		overflow: hidden;
	}
	.boss-bar-fill {
		background: linear-gradient(90deg, #aa1133, #ff2255);
		height: 100%;
		transition: width 0.2s;
		border-radius: 3px;
	}

	/* Teammate card */
	.teammate-card {
		width: 200px;
		background: rgba(0, 0, 0, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 4px;
		padding: 0.35rem 0.6rem;
	}

	/* Generic stat bar */
	.bar-track {
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		height: 12px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.15s;
	}
	.hp-fill {
		background: #e44;
	}
	.stm-fill {
		background: #4af;
	}

	/* Stat labels */
	.stat-label {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.stat-value {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.7);
		font-weight: 600;
	}

	/* Ability slot */
	.ability-slot {
		padding: 0 !important;
	}
	.cd-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.62);
		transition: height 0.08s linear;
		pointer-events: none;
	}
	.active-overlay {
		position: absolute;
		inset: 0;
		animation: abilityPulse 0.9s ease-in-out infinite alternate;
		pointer-events: none;
	}
	.ability-content {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 0.5rem;
	}
	.ability-label {
		font-size: 1.05rem;
		font-weight: 700;
		text-align: center;
		line-height: 1.1;
		white-space: nowrap;
	}
	.ability-input {
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.45);
		background: rgba(255, 255, 255, 0.1);
		padding: 1px 6px;
		border-radius: 3px;
	}
	.ability-cd {
		font-size: 0.8rem;
		color: #aaa;
		font-weight: 600;
	}

	@keyframes abilityPulse {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 1;
		}
	}
</style>
