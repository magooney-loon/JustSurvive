<script lang="ts">
	import { fly } from 'svelte/transition';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState } from '../game.svelte.js';
	import { stageActions } from '../stage.svelte.js';
	import { abilityState } from '../localGameState.svelte.js';
	import ReviveChannelHud from './ReviveChannelHud.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [sessions] = useTable(tables.gameSession);

	const session = $derived($sessions.find(s => s.id === gameState.currentSessionId));
	const myState = $derived($players.find(
		p => p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
		     p.sessionId === gameState.currentSessionId
	));
	const teammates = $derived($players.filter(
		p => p.playerIdentity.toHexString() !== $conn.identity?.toHexString() &&
		     p.sessionId === gameState.currentSessionId
	));

	const DAY_PHASE_LABELS: Record<string, string> = {
		sunset: 'Sunset', dusk: 'Dusk', twilight: 'Twilight',
		night: 'Night', deep_night: 'Deep Night',
	};

	let sessionWasActive = $state(false);
	$effect(() => {
		if (session?.status === 'active') sessionWasActive = true;
		if (session?.status === 'finished' && sessionWasActive) {
			stageActions.setStage('game_over');
		}
	});

	// Countdown timer for downed state
	let downedSecondsLeft = $state(30);
	$effect(() => {
		if (myState?.status !== 'downed') return;
		downedSecondsLeft = 30;
		const interval = setInterval(() => {
			downedSecondsLeft = Math.max(0, downedSecondsLeft - 1);
		}, 1000);
		return () => clearInterval(interval);
	});

	// Tick for cooldown display
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 80);
		return () => clearInterval(id);
	});

	function hpPercent(hp: bigint, max: bigint) {
		return max > 0n ? Number(hp * 100n / max) : 0;
	}

	function cdFrac(untilMicros: bigint | undefined | null, totalMs: number): number {
		if (!untilMicros) return 0;
		const remaining = Number(untilMicros / 1000n) - now;
		return remaining > 0 ? Math.min(1, remaining / totalMs) : 0;
	}

	// Per-class ability slot definitions
	type AbilitySlot = {
		label: string;
		input: string;
		color: string;
		// 0=ready, >0=fraction of CD remaining
		cdFrac: number;
		cdMs?: number; // total cooldown duration in ms (for seconds display)
		active?: boolean;
	};

	const abilities = $derived((): [AbilitySlot, AbilitySlot] => {
		const cls = myState?.classChoice ?? '';
		if (cls === 'spotter') return [
			{ label: 'Mark', input: 'LMB', color: '#22d4ff',
			  cdFrac: Math.max(0, (abilityState.markCooldownUntil - now) / 5000), cdMs: 5000 },
			{ label: 'Ping', input: 'RMB', color: '#22d4ff',
			  cdFrac: cdFrac(myState?.pingCooldownUntil?.microsSinceUnixEpoch, 10000), cdMs: 10000 },
		];
		if (cls === 'gunner') return [
			{ label: `Fire${abilityState.suppressHits % 3 > 0 ? ` ${abilityState.suppressHits % 3}/3` : ' ★'}`, input: 'LMB', color: '#ff8822', cdFrac: 0 },
			{ label: '—', input: '', color: '#555', cdFrac: 0 },
		];
		if (cls === 'tank') return [
			{ label: 'Bash', input: 'LMB', color: '#66ff44',
			  cdFrac: Math.max(0, (abilityState.bashCooldownUntil - now) / 1500), cdMs: 1500 },
			{ label: 'Brace', input: 'RMB', color: '#66ff44', cdFrac: 0, active: myState?.isBracing },
		];
		if (cls === 'healer') return [
			{ label: 'Heal', input: 'LMB', color: '#ff88cc',
			  cdFrac: Math.max(0, (abilityState.healCooldownUntil - now) / 2000), cdMs: 2000 },
			{ label: 'Revive', input: 'RMB', color: '#ff88cc',
			  cdFrac: cdFrac(myState?.reviveCooldownUntil?.microsSinceUnixEpoch, 15000), cdMs: 15000 },
		];
		return [
			{ label: '—', input: '', color: '#555', cdFrac: 0 },
			{ label: '—', input: '', color: '#555', cdFrac: 0 },
		];
	});
</script>

<div transition:fly={{ x: -20, duration: 300 }}>
	<!-- Day phase indicator -->
	<div style="position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
	            background: rgba(0,0,0,0.6); padding: 0.4rem 1rem; border-radius: 20px; color: #fff;">
		{DAY_PHASE_LABELS[session?.dayPhase ?? 'sunset'] ?? ''}
		{#if session?.cycleNumber && session.cycleNumber > 0n}
			<span style="margin-left: 0.5rem; color: #ff8;">Day {Number(session.cycleNumber) + 1}</span>
		{/if}
	</div>

	<!-- Ability bar — bottom center -->
	{#if myState && myState.status === 'alive'}
		{@const slots = abilities()}
		<div style="
			position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
			display: flex; gap: 0.5rem; pointer-events: none;
		">
			{#each slots as slot}
				<div style="
					position: relative; width: 68px; height: 68px;
					background: rgba(0,0,0,0.75);
					border: 1.5px solid {slot.active ? slot.color : 'rgba(255,255,255,0.15)'};
					border-radius: 8px; overflow: hidden;
					box-shadow: {slot.active ? `0 0 10px ${slot.color}66` : 'none'};
					transition: border-color 0.15s, box-shadow 0.15s;
				">
					<!-- Cooldown overlay (fills from bottom) -->
					{#if slot.cdFrac > 0}
						<div style="
							position: absolute; bottom: 0; left: 0; right: 0;
							height: {slot.cdFrac * 100}%;
							background: rgba(0,0,0,0.65);
							transition: height 0.08s linear;
						"></div>
					{/if}
					<!-- Active pulse overlay -->
					{#if slot.active}
						<div style="
							position: absolute; inset: 0;
							background: {slot.color}18;
							animation: abilityPulse 0.9s ease-in-out infinite alternate;
						"></div>
					{/if}
					<!-- Content -->
					<div style="
						position: relative; height: 100%;
						display: flex; flex-direction: column;
						align-items: center; justify-content: center; gap: 2px;
					">
						<span style="font-size: 0.75rem; font-weight: 600; color: {slot.cdFrac > 0 ? '#888' : slot.color}; text-align: center; line-height: 1.1;">
							{slot.label}
						</span>
						{#if slot.input}
							<span style="font-size: 0.6rem; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px;">
								{slot.input}
							</span>
						{/if}
						{#if slot.cdFrac > 0}
							<span style="font-size: 0.65rem; color: #aaa;">
								{(slot.cdFrac * (slot.cdMs ?? 5000) / 1000).toFixed(1)}s
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Local player HP & stamina -->
	{#if myState}
		<div style="position: absolute; bottom: 2rem; left: 2rem; width: 200px;">
			<div style="margin-bottom: 0.3rem;">
				<div style="font-size: 0.75rem; color: #aaa; margin-bottom: 2px;">HP</div>
				<div style="background: #333; border-radius: 4px; height: 12px;">
					<div style="background: #e44; border-radius: 4px; height: 100%; width: {hpPercent(myState.hp, myState.maxHp)}%;
					            transition: width 0.2s;"></div>
				</div>
			</div>
			<div>
				<div style="font-size: 0.75rem; color: #aaa; margin-bottom: 2px;">Stamina</div>
				<div style="background: #333; border-radius: 4px; height: 8px;">
					<div style="background: #4af; border-radius: 4px; height: 100%; width: {hpPercent(myState.stamina, myState.maxStamina)}%;
					            transition: width 0.1s;"></div>
				</div>
			</div>
			<div style="margin-top: 0.4rem; font-size: 0.85rem; color: #ff8;">
				Score: {Number(myState.score).toLocaleString()}
			</div>
		</div>
	{/if}

	<!-- Teammate status -->
	<div style="position: absolute; top: 1rem; right: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
		{#each teammates as p (p.id)}
			<div style="background: rgba(0,0,0,0.6); padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem;
			            color: {p.status === 'downed' ? '#f44' : p.status === 'eliminated' ? '#444' : '#ccc'};">
				<span style="text-transform: capitalize;">{p.classChoice}</span>
				{#if p.status === 'downed'}
					<span style="color: #f44; margin-left: 0.4rem;">DOWNED</span>
				{:else if p.status === 'eliminated'}
					<span style="color: #444; margin-left: 0.4rem;">OUT</span>
				{:else}
					<span style="display: inline-block; width: 60px; height: 6px; background: #333; border-radius: 3px; margin-left: 0.4rem; vertical-align: middle;">
						<span style="display: block; height: 100%; background: #e44; border-radius: 3px; width: {hpPercent(p.hp, p.maxHp)}%;"></span>
					</span>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Downed state overlay -->
	{#if myState?.status === 'downed'}
		<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
		            background: rgba(0,0,0,0.5); pointer-events: none;">
			<div style="text-align: center; color: #f44;">
				<h2 style="font-size: 2rem; margin: 0;">YOU'RE DOWN</h2>
				<p>Waiting for Healer... {downedSecondsLeft}s</p>
			</div>
		</div>
	{/if}

	<!-- Revive channel progress (healer only) -->
	<ReviveChannelHud />
</div>
