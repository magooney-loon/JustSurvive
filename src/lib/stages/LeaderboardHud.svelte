<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '$root/stage.svelte.js';
	import { soundActions } from '$root/Sound.svelte';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';

	const [lobbyResults] = useTable(tables.lobbyResult);
	const [resultPlayers] = useTable(tables.lobbyResultPlayer);
	const [globalStatsRows] = useTable(tables.globalStats);
	const [squadRecords] = useTable(tables.squadRecord);

	const sorted = $derived(
		[...$lobbyResults].sort((a, b) => {
			if (b.totalScore > a.totalScore) return 1;
			if (b.totalScore < a.totalScore) return -1;
			return 0;
		})
	);

	const stats = $derived($globalStatsRows[0]);

	const totalClassSlots = $derived(
		stats ? stats.classSpotter + stats.classGunner + stats.classTank + stats.classHealer : 0n
	);

	function classPct(count: bigint): number {
		if (!stats || totalClassSlots === 0n) return 0;
		return Math.round(Number((count * 100n) / totalClassSlots));
	}

	const topByPlayed = $derived(
		[...$squadRecords]
			.sort((a, b) => {
				if (b.timesPlayed > a.timesPlayed) return 1;
				if (b.timesPlayed < a.timesPlayed) return -1;
				return 0;
			})
			.slice(0, 5)
	);

	const topByScore = $derived(
		[...$squadRecords]
			.sort((a, b) => {
				if (b.bestScore > a.bestScore) return 1;
				if (b.bestScore < a.bestScore) return -1;
				return 0;
			})
			.slice(0, 5)
	);

	let tab: 'board' | 'stats' | 'squads' = $state('board');
	let squadSort: 'played' | 'score' = $state('played');

	function fmtSecs(s: bigint): string {
		const m = s / 60n;
		const sec = s % 60n;
		return `${m}m ${sec < 10n ? '0' : ''}${sec}s`;
	}

	function fmtCombo(combo: string): string {
		return combo
			.split(',')
			.map((c) => c.charAt(0).toUpperCase() + c.slice(1))
			.join(' + ');
	}

	function fmtNum(n: bigint): string {
		return Number(n).toLocaleString();
	}

	function getRowPlayers(sessionId: bigint) {
		return $resultPlayers.filter((p) => p.sessionId === sessionId);
	}

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#60a5fa',
		gunner: '#f87171',
		tank: '#4ade80',
		healer: '#facc15'
	};

	function classColor(c: string): string {
		return CLASS_COLORS[c] ?? '#fff';
	}
</script>

<div
	transition:fly={{ y: 20, duration: 300 }}
	class="rpgui-content"
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1rem;"
>
	<div
		class="rpgui-container framed"
		style="padding: 1.75rem; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; gap: 1rem;"
	>
		<!-- Header -->
		<div style="display: flex; align-items: center; justify-content: space-between;">
			<h2>Leaderboard</h2>
			<button
				class="rpgui-button"
				onclick={() => {
					soundActions.playClick();
					stageActions.setStage('menu');
				}}
			>
				<p>Back</p>
			</button>
		</div>

		<!-- Tabs -->
		<div style="display: flex; gap: 0.5rem;">
			{#each [['board', 'Top 20'], ['stats', 'Global Stats'], ['squads', 'Squad Records']] as [id, label]}
				<button
					onclick={() => {
						soundActions.playClick();
						tab = id as typeof tab;
					}}
					style="flex: 1; padding: 0.45rem; border-radius: 0.5rem; cursor: pointer; transition: background 0.15s;
						background: {tab === id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'};
						border: 1px solid {tab === id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'};
						color: {tab === id ? 'white' : 'rgba(255,255,255,0.5)'};"
				>
					{label}
				</button>
			{/each}
		</div>

		<!-- Content -->
		<div
			class="rpgui-list-imp"
			style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; border: none; padding: 0;"
		>
			<!-- ── TOP 20 ── -->
			{#if tab === 'board'}
				{#if sorted.length === 0}
					<p class="rpgui-center" style="color: rgba(255,255,255,0.35); margin: 2rem 0;">
						No games recorded yet.
					</p>
				{:else}
					{#each sorted as row, i}
						{@const players = getRowPlayers(row.sessionId)}
						<div
							style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 0.75rem; padding: 0.75rem 1rem;"
						>
							<!-- Row header -->
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<span
									style="font-size: 0.8rem; font-weight: 700; color: {i === 0
										? '#fbbf24'
										: i === 1
											? '#94a3b8'
											: i === 2
												? '#b45309'
												: 'rgba(255,255,255,0.3)'}; min-width: 1.5rem; text-align: center;"
								>
									#{i + 1}
								</span>
								<span
									style="font-size: 0.75rem; font-family: monospace; color: rgba(255,255,255,0.45); letter-spacing: 0.1em;"
								>
									{row.lobbyCode}
								</span>
								<span style="flex: 1; font-size: 0.8rem; color: rgba(255,255,255,0.5);">
									{fmtCombo(row.combo)}
								</span>
								<span style="font-size: 1rem; font-weight: 700; color: #fbbf24;">
									{fmtNum(row.totalScore)}
								</span>
								<span style="font-size: 0.75rem; color: rgba(255,255,255,0.4);">
									{fmtSecs(row.survivalSecs)}
								</span>
								<span style="font-size: 0.75rem; color: rgba(255,255,255,0.35);">
									C{row.cycleNumber}
								</span>
							</div>
							<!-- Player roster -->
							{#if players.length > 0}
								<div
									style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.07);"
								>
									{#each players as p}
										<span
											style="font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 9999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
										>
											<span style="color: {classColor(p.classChoice)}; font-weight: 600;"
												>{p.classChoice.charAt(0).toUpperCase() + p.classChoice.slice(1)}</span
											>
											<span style="color: rgba(255,255,255,0.55);"> · {p.playerName}</span>
										</span>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/if}

				<!-- ── GLOBAL STATS ── -->
			{:else if tab === 'stats'}
				{#if !stats}
					<p class="rpgui-center" style="color: rgba(255,255,255,0.35); margin: 2rem 0;">
						No games played yet.
					</p>
				{:else}
					<!-- Summary numbers -->
					<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
						{#each [['Total Games', fmtNum(stats.totalGames)], ['Best Survival', fmtSecs(stats.bestSurvivalSecs)], ['Avg Survival', stats.totalGames > 0n ? fmtSecs(stats.totalSurvivalSecs / stats.totalGames) : '—']] as [label, value]}
							<div
								style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 0.75rem; padding: 0.85rem; text-align: center;"
							>
								<div style="font-size: 1.2rem; font-weight: 700; color: #fbbf24;">{value}</div>
								<div style="font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-top: 0.25rem;">
									{label}
								</div>
							</div>
						{/each}
					</div>

					<!-- Class distribution -->
					<div
						style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 0.75rem; padding: 1rem;"
					>
						<div
							style="font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 0.75rem;"
						>
							Class Distribution
						</div>
						{#each [['spotter', stats.classSpotter], ['gunner', stats.classGunner], ['tank', stats.classTank], ['healer', stats.classHealer]] as [cls, count]}
							{@const pct = classPct(count as bigint)}
							<div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
								<span
									style="font-size: 0.78rem; color: {classColor(
										cls as string
									)}; width: 4.5rem; text-align: right; font-weight: 600;"
								>
									{(cls as string).charAt(0).toUpperCase() + (cls as string).slice(1)}
								</span>
								<div
									style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 9999px; overflow: hidden;"
								>
									<div
										style="height: 100%; width: {pct}%; background: {classColor(
											cls as string
										)}; border-radius: 9999px; transition: width 0.4s;"
									></div>
								</div>
								<span style="font-size: 0.75rem; color: rgba(255,255,255,0.45); width: 2.5rem;"
									>{pct}%</span
								>
								<span
									style="font-size: 0.72rem; color: rgba(255,255,255,0.3); width: 2rem; text-align: right;"
									>×{fmtNum(count as bigint)}</span
								>
							</div>
						{/each}
					</div>
				{/if}

				<!-- ── SQUAD RECORDS ── -->
			{:else if tab === 'squads'}
				<!-- Sort toggle -->
				<div style="display: flex; gap: 0.4rem;">
					{#each [['played', 'Most Played'], ['score', 'Best Score']] as [id, label]}
						<button
							onclick={() => {
								soundActions.playClick();
								squadSort = id as typeof squadSort;
							}}
							style="flex: 1; padding: 0.35rem; border-radius: 0.5rem; cursor: pointer;
							background: {squadSort === id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'};
							border: 1px solid {squadSort === id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'};
							color: {squadSort === id ? 'white' : 'rgba(255,255,255,0.45)'};"
						>
							{label}
						</button>
					{/each}
				</div>

				{#if $squadRecords.length === 0}
					<p class="rpgui-center" style="color: rgba(255,255,255,0.35); margin: 2rem 0;">
						No squad data yet.
					</p>
				{:else}
					{#each squadSort === 'played' ? topByPlayed : topByScore as sq, i}
						<div
							style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 0.75rem; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem;"
						>
							<span
								style="font-size: 0.8rem; font-weight: 700; color: {i === 0
									? '#fbbf24'
									: i === 1
										? '#94a3b8'
										: i === 2
											? '#b45309'
											: 'rgba(255,255,255,0.3)'}; min-width: 1.5rem; text-align: center;"
							>
								#{i + 1}
							</span>
							<div style="flex: 1;">
								<div
									style="font-size: 0.85rem; font-weight: 600; color: white; margin-bottom: 0.2rem;"
								>
									{fmtCombo(sq.combo)}
								</div>
								<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
									{#each sq.combo.split(',') as cls}
										<span style="font-size: 0.7rem; color: {classColor(cls)}; font-weight: 600;">
											{cls.charAt(0).toUpperCase() + cls.slice(1)}
										</span>
									{/each}
								</div>
							</div>
							<div
								style="text-align: right; font-size: 0.75rem; color: rgba(255,255,255,0.4); display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-end;"
							>
								<span>×{fmtNum(sq.timesPlayed)} games</span>
								<span style="color: #fbbf24;">Best {fmtNum(sq.bestScore)}</span>
								<span>Longest {fmtSecs(sq.bestSurvivalSecs)}</span>
							</div>
						</div>
					{/each}
				{/if}
			{/if}
		</div>
	</div>
</div>
