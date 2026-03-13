<script lang="ts">
	import { fly } from 'svelte/transition';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import type { Enemy } from '$bindings/types.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import { stageActions } from '$root/stage.svelte.js';
	import { abilityState } from '$lib/stores/abilities.svelte.js';
	import ReviveChannelHud from '$lib/character/ui/ReviveChannelHud.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [sessions] = useTable(tables.gameSession);
	const [enemies] = useTable(tables.enemy);
	const [bossTimers] = useTable(tables.bossTimer);

	const session = $derived($sessions.find((s) => s.id === lobbyState.currentSessionId));
	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
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
		$enemies.find(
			(e) => e.sessionId === lobbyState.currentSessionId && e.enemyType === 'boss' && e.isAlive
		) as Enemy | undefined
	);
	const bossTimer = $derived(
		$bossTimers.find((bt) => bt.sessionId === lobbyState.currentSessionId)
	);
	const bossSecsLeft = $derived(() => {
		if (!bossTimer) return 0;
		const spawnMs = Number(bossTimer.spawnAt.microsSinceUnixEpoch) / 1000;
		return Math.max(0, Math.ceil((spawnMs - now) / 1000));
	});

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
					cdFrac: Math.max(0, (abilityState.markCooldownUntil - now) / 5000),
					cdMs: 2000
				},
				{
					label: 'Flash',
					input: 'RMB',
					color: '#22d4ff',
					cdFrac: Math.max(0, (abilityState.pingCooldownUntil - now) / 1500),
					cdMs: 1500
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
				{
					label: 'Adrenaline',
					input: 'RMB',
					color: '#ff8822',
					cdFrac: Math.max(0, (abilityState.adrenalineCooldownUntil - now) / 5000),
					cdMs: 5000
				}
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
	<!-- Day phase indicator — top left -->
	<div
		style="
		position: absolute; top: 1.25rem; left: 1.25rem;
		background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
		padding: 0.5rem 1.1rem; border-radius: 999px; color: white;
		font-size: 1rem; font-weight: 500; white-space: nowrap;
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

	<!-- Boss — top center: countdown or HP bar -->
	{#if boss}
		<div
			style="
			position: absolute; top: 1.25rem; left: 50%; transform: translateX(-50%);
			background: rgba(20,0,10,0.85); border: 2px solid #aa1133;
			padding: 0.6rem 1.5rem; border-radius: 0.75rem; min-width: 280px;
			backdrop-filter: blur(8px); text-align: center;
			box-shadow: 0 0 24px #aa113366;
		"
		>
			<div style="font-size: 0.8rem; color: #ff4466; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 0.35rem; text-transform: uppercase;">
				BOSS
			</div>
			<div style="background: rgba(0,0,0,0.5); border-radius: 4px; height: 14px; overflow: hidden;">
				<div
					style="background: linear-gradient(90deg, #aa1133, #ff2255); border-radius: 4px; height: 100%;
					       width: {hpPercent(boss.hp, boss.maxHp)}%; transition: width 0.2s;"
				></div>
			</div>
			<div style="font-size: 0.75rem; color: rgba(255,255,255,0.55); margin-top: 0.25rem;">
				{Number(boss.hp)} / {Number(boss.maxHp)}
			</div>
		</div>
	{:else if bossTimer}
		<div
			style="
			position: absolute; top: 1.25rem; left: 50%; transform: translateX(-50%);
			background: rgba(10,0,20,0.75); border: 1.5px solid rgba(180,50,80,0.5);
			padding: 0.5rem 1.4rem; border-radius: 0.75rem;
			backdrop-filter: blur(8px); text-align: center; white-space: nowrap;
		"
		>
			<span style="font-size: 0.75rem; color: rgba(255,100,130,0.7); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">
				Boss in
			</span>
			<span style="font-size: 1.4rem; font-weight: 800; color: #ff4466; margin-left: 0.5rem; font-variant-numeric: tabular-nums;">
				{bossSecsLeft()}s
			</span>
		</div>
	{/if}

	<!-- Ability bar — bottom center -->
	{#if myState && myState.status === 'alive'}
		{@const slots = abilities()}
		<div
			style="
			position: absolute; bottom: 2.5rem; left: 50%; transform: translateX(-50%);
			display: flex; gap: 0.9rem; pointer-events: none;
		"
		>
			{#each slots as slot}
				<div
					style="
					position: relative; width: 110px; height: 110px;
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
							style="font-size: 1rem; font-weight: 600; color: {slot.cdFrac > 0
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
			position: absolute; bottom: 2.5rem; left: 2rem; width: 280px;
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
					style="background: rgba(0,0,0,0.4); border-radius: 4px; height: 12px; overflow: hidden;"
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
					style="background: rgba(0,0,0,0.4); border-radius: 4px; height: 9px; overflow: hidden;"
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
			<div style="font-size: 1.15rem; font-weight: 700; color: #ffd060;">
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
				padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 1rem;
				color: {p.status === 'downed' ? '#f66' : 'rgba(255,255,255,0.85)'};
				backdrop-filter: blur(6px); min-width: 200px;
			"
			>
				<div style="display: flex; align-items: center; gap: 0.5rem;">
					<span style="text-transform: capitalize; font-weight: 500; flex: 1;">{p.classChoice}</span
					>
					{#if p.status === 'downed'}
						<span style="color: #f66; font-size: 0.75rem; font-weight: 700;">DOWNED</span>
					{:else}
						<span style="font-size: 0.75rem; color: rgba(255,255,255,0.5); font-weight: 500;"
							>{Number(p.hp)}/{Number(p.maxHp)}</span
						>
					{/if}
				</div>
				{#if p.status !== 'downed'}
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
					Waiting for Healer...
				</p>
			</div>
		</div>
	{/if}

	<!-- Revive channel progress (healer only) -->
	<ReviveChannelHud />

</div>
