<script lang="ts">
	import { fly } from 'svelte/transition';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState } from '../game.svelte.js';
	import { stageActions } from '../stage.svelte.js';
	import { soundActions } from '../Sound.svelte';
	import { abilityState } from '../localGameState.svelte.js';
	import { settingsState } from '../settings.svelte.js';
	import ReviveChannelHud from './ReviveChannelHud.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [sessions] = useTable(tables.gameSession);

	const session = $derived($sessions.find((s) => s.id === gameState.currentSessionId));
	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === gameState.currentSessionId
		)
	);
	const teammates = $derived(
		$players.filter(
			(p) =>
				p.playerIdentity.toHexString() !== $conn.identity?.toHexString() &&
				p.sessionId === gameState.currentSessionId
		)
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
		if (session?.status === 'active') sessionWasActive = true;
		if (session?.status === 'finished' && sessionWasActive) {
			stageActions.setStage('game_over');
		}
	});

	let downedSecondsLeft = $state(30);
	$effect(() => {
		if (myState?.status !== 'downed') return;
		downedSecondsLeft = 30;
		const interval = setInterval(() => {
			downedSecondsLeft = Math.max(0, downedSecondsLeft - 1);
		}, 1000);
		return () => clearInterval(interval);
	});

	let now = $state(Date.now());
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

	const abilities = $derived((): [AbilitySlot, AbilitySlot] => {
		const cls = myState?.classChoice ?? '';
		if (cls === 'spotter')
			return [
				{
					label: 'Mark',
					input: 'LMB',
					color: '#22d4ff',
					cdFrac: Math.max(0, (abilityState.markCooldownUntil - now) / 2000),
					cdMs: 2000
				},
				{
					label: 'Ping',
					input: 'RMB',
					color: '#22d4ff',
					cdFrac: cdFrac(myState?.pingCooldownUntil?.microsSinceUnixEpoch, 10000),
					cdMs: 10000
				}
			];
		if (cls === 'gunner')
			return [
				{
					label: `Fire${abilityState.suppressHits % 3 > 0 ? ` ${abilityState.suppressHits % 3}/3` : ' ★'}`,
					input: 'LMB',
					color: '#ff8822',
					cdFrac: 0
				},
				{ label: '—', input: '', color: '#555', cdFrac: 0 }
			];
		if (cls === 'tank')
			return [
				{
					label: 'Bash',
					input: 'LMB',
					color: '#66ff44',
					cdFrac: Math.max(0, (abilityState.bashCooldownUntil - now) / 1500),
					cdMs: 1500
				},
				{
					label: 'Brace',
					input: 'RMB',
					color: '#66ff44',
					cdFrac: Math.max(0, (abilityState.braceCooldownUntil - now) / 1000),
					cdMs: 1000,
					active: myState?.isBracing
				}
			];
		if (cls === 'healer')
			return [
				{
					label: 'Heal',
					input: 'LMB',
					color: '#ff88cc',
					cdFrac: Math.max(0, (abilityState.healCooldownUntil - now) / 2000),
					cdMs: 2000
				},
				{
					label: 'Revive',
					input: 'RMB',
					color: '#ff88cc',
					cdFrac: cdFrac(myState?.reviveCooldownUntil?.microsSinceUnixEpoch, 15000),
					cdMs: 15000
				}
			];
		return [
			{ label: '—', input: '', color: '#555', cdFrac: 0 },
			{ label: '—', input: '', color: '#555', cdFrac: 0 }
		];
	});
</script>

<div transition:fly={{ x: -20, duration: 300 }}>
	<!-- Settings button — top left -->
	<button
		onclick={() => {
			soundActions.playClick();
			stageActions.setStage('settings');
		}}
		style="position: absolute; top: 1.25rem; left: 1.25rem; padding: 0.35rem 0.75rem;
		       background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
		       border-radius: 0.5rem; color: rgba(255,255,255,0.6); font-size: 0.8rem;
		       cursor: pointer; backdrop-filter: blur(6px); transition: background 0.15s;"
		onmouseenter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
		onmouseleave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
	>
		Settings
	</button>

	<!-- Day phase indicator — top center -->
	<div
		style="
		position: absolute; top: 1.25rem; left: 50%; transform: translateX(-50%);
		background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
		padding: 0.4rem 1.25rem; border-radius: 999px; color: white;
		font-size: 0.9rem; font-weight: 500; white-space: nowrap;
		backdrop-filter: blur(6px);
	"
	>
		{DAY_PHASE_LABELS[session?.dayPhase ?? 'sunset'] ?? ''}
		{#if session?.cycleNumber && session.cycleNumber > 0n}
			<span style="margin-left: 0.6rem; color: #ffd060; font-weight: 600;"
				>Day {Number(session.cycleNumber) + 1}</span
			>
		{/if}
	</div>

	<!-- Ability bar — bottom center -->
	{#if myState && myState.status === 'alive'}
		{@const slots = abilities()}
		<div
			style="
			position: absolute; bottom: 2.5rem; left: 50%; transform: translateX(-50%);
			display: flex; gap: 0.75rem; pointer-events: none;
		"
		>
			{#each slots as slot}
				<div
					style="
					position: relative; width: 90px; height: 90px;
					background: rgba(255,255,255,0.07);
					border: 1.5px solid {slot.active ? slot.color : 'rgba(255,255,255,0.18)'};
					border-radius: 0.625rem; overflow: hidden;
					box-shadow: {slot.active ? `0 0 14px ${slot.color}55` : 'none'};
					transition: border-color 0.15s, box-shadow 0.15s;
					backdrop-filter: blur(6px);
				"
				>
					<!-- Cooldown overlay (fills from bottom) -->
					{#if slot.cdFrac > 0}
						<div
							style="
							position: absolute; bottom: 0; left: 0; right: 0;
							height: {slot.cdFrac * 100}%;
							background: rgba(0,0,0,0.6);
							transition: height 0.08s linear;
						"
						></div>
					{/if}
					<!-- Active pulse overlay -->
					{#if slot.active}
						<div
							style="
							position: absolute; inset: 0;
							background: {slot.color}18;
							animation: abilityPulse 0.9s ease-in-out infinite alternate;
						"
						></div>
					{/if}
					<!-- Content -->
					<div
						style="
						position: relative; height: 100%;
						display: flex; flex-direction: column;
						align-items: center; justify-content: center; gap: 3px;
					"
					>
						<span
							style="font-size: 0.875rem; font-weight: 600; color: {slot.cdFrac > 0
								? '#888'
								: slot.color}; text-align: center; line-height: 1.1;"
						>
							{slot.label}
						</span>
						{#if slot.input}
							<span
								style="font-size: 0.7rem; color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px;"
							>
								{slot.input}
							</span>
						{/if}
						{#if slot.cdFrac > 0}
							<span style="font-size: 0.75rem; color: #aaa; font-weight: 500;">
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
			style="
			position: absolute; bottom: 2.5rem; left: 2rem; width: 240px;
			background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
			border-radius: 0.75rem; padding: 0.875rem 1rem;
			backdrop-filter: blur(6px);
		"
		>
			<!-- HP bar -->
			<div style="margin-bottom: 0.6rem;">
				<div
					style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;"
				>
					<span
						style="font-size: 0.8rem; color: rgba(255,255,255,0.55); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em;"
						>HP</span
					>
					<span style="font-size: 0.8rem; color: rgba(255,255,255,0.7); font-weight: 600;"
						>{Number(myState.hp)} / {Number(myState.maxHp)}</span
					>
				</div>
				<div
					style="background: rgba(0,0,0,0.4); border-radius: 4px; height: 10px; overflow: hidden;"
				>
					<div
						style="background: #e44; border-radius: 4px; height: 100%; width: {hpPercent(
							myState.hp,
							myState.maxHp
						)}%; transition: width 0.2s;"
					></div>
				</div>
			</div>
			<!-- Stamina bar -->
			<div style="margin-bottom: 0.6rem;">
				<div
					style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;"
				>
					<span
						style="font-size: 0.8rem; color: rgba(255,255,255,0.55); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em;"
						>Stamina</span
					>
				</div>
				<div
					style="background: rgba(0,0,0,0.4); border-radius: 4px; height: 7px; overflow: hidden;"
				>
					<div
						style="background: #4af; border-radius: 4px; height: 100%; width: {hpPercent(
							myState.stamina,
							myState.maxStamina
						)}%; transition: width 0.1s;"
					></div>
				</div>
			</div>
			<!-- Score -->
			<div style="font-size: 1rem; font-weight: 700; color: #ffd060;">
				{Number(myState.score).toLocaleString()} pts
			</div>
		</div>
	{/if}

	<!-- Teammate status — top right -->
	<div
		style="position: absolute; top: 1.25rem; right: 1.25rem; display: flex; flex-direction: column; gap: 0.4rem;"
	>
		{#each teammates as p (p.id)}
			<div
				style="
				background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
				padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem;
				color: {p.status === 'downed'
					? '#f66'
					: p.status === 'eliminated'
						? 'rgba(255,255,255,0.25)'
						: 'rgba(255,255,255,0.85)'};
				backdrop-filter: blur(6px); min-width: 160px;
			"
			>
				<div style="display: flex; align-items: center; gap: 0.5rem;">
					<span style="text-transform: capitalize; font-weight: 500; flex: 1;">{p.classChoice}</span
					>
					{#if p.status === 'downed'}
						<span style="color: #f66; font-size: 0.75rem; font-weight: 700;">DOWNED</span>
					{:else if p.status === 'eliminated'}
						<span style="color: rgba(255,255,255,0.25); font-size: 0.75rem;">OUT</span>
					{:else}
						<span style="font-size: 0.75rem; color: rgba(255,255,255,0.5); font-weight: 500;"
							>{Number(p.hp)}/{Number(p.maxHp)}</span
						>
					{/if}
				</div>
				{#if p.status !== 'downed' && p.status !== 'eliminated'}
					<div
						style="background: rgba(0,0,0,0.35); border-radius: 3px; height: 5px; margin-top: 0.35rem; overflow: hidden;"
					>
						<div
							style="height: 100%; background: #e44; border-radius: 3px; width: {hpPercent(
								p.hp,
								p.maxHp
							)}%; transition: width 0.2s;"
						></div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Downed state overlay -->
	{#if myState?.status === 'downed'}
		<div
			style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
		            background: rgba(0,0,0,0.55); pointer-events: none; backdrop-filter: blur(3px);"
		>
			<div style="text-align: center; color: white;">
				<h2
					style="font-size: 2.5rem; margin: 0 0 0.5rem; color: #f66; font-weight: 800; letter-spacing: 0.05em;"
				>
					YOU'RE DOWN
				</h2>
				<p style="font-size: 1.1rem; color: rgba(255,255,255,0.6); margin: 0;">
					Waiting for Healer... {downedSecondsLeft}s
				</p>
			</div>
		</div>
	{/if}

	<!-- Revive channel progress (healer only) -->
	<ReviveChannelHud />

	<!-- FPS crosshair — center of screen, only in FPS mode when alive -->
	{#if myState?.status === 'alive' && settingsState.controls.cameraMode === 'fps'}
		<div
			style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;"
		>
			<div style="position: relative; width: 20px; height: 20px;">
				<!-- Horizontal bar -->
				<div style="position: absolute; top: 50%; left: 0; width: 100%; height: 2px; background: rgba(255,255,255,0.85); transform: translateY(-50%);"></div>
				<!-- Vertical bar -->
				<div style="position: absolute; left: 50%; top: 0; width: 2px; height: 100%; background: rgba(255,255,255,0.85); transform: translateX(-50%);"></div>
				<!-- Center dot -->
				<div style="position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; background: white; border-radius: 50%; transform: translate(-50%,-50%);"></div>
			</div>
		</div>
	{/if}
</div>
