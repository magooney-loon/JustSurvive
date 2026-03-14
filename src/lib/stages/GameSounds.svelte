<script lang="ts">
	import { T } from '@threlte/core';
	import { PositionalAudio } from '@threlte/extras';
	import { PositionalAudio as ThreePosAudio } from 'three';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import { localPos } from '$lib/stores/movement.svelte.js';
	import { soundTriggers, soundActions } from '$root/Sound.svelte';
	import { settingsState } from '$root/settings.svelte.js';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [sessions] = useTable(tables.gameSession);
	const [enemies] = useTable(tables.enemy);

	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);

	const base = import.meta.env.BASE_URL;

	// ─── Positional audio refs ────────────────────────────────────────────────
	let gunnerShotAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let gunnerAdrenalineAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let healerHealAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let healerReviveAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let spotterMarkAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let spotterPingAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let tankBashAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let tankBraceAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let enemySpawnAudio = $state.raw<ThreePosAudio | undefined>(undefined);

	const playPos = (audio: ThreePosAudio | undefined) => {
		if (!audio?.buffer || !settingsState.audio.effectsEnabled) return;
		if (audio.isPlaying) audio.stop();
		audio.play();
	};

	// ─── New cycle sound ──────────────────────────────────────────────────────
	let prevCycleNumber: bigint | undefined = undefined;
	$effect(() => {
		const session = $sessions.find(
			(s) => s.id === lobbyState.currentSessionId && s.status === 'active'
		);
		if (!session) return;
		if (prevCycleNumber !== undefined && session.cycleNumber > prevCycleNumber) {
			soundActions.playNewCycle();
		}
		prevCycleNumber = session.cycleNumber;
	});

	// ─── Per-enemy-type kill spree tracking ───────────────────────────────────
	const killCounts = new Map<string, number>();
	const countedKills = new Set<bigint>();
	let prevKillSessionId: bigint | null | undefined = undefined;

	const SPREE_ACTIONS: Record<string, () => void> = {
		basic: () => soundActions.playSpreeKilling(),
		fast: () => soundActions.playSpreeeDominating(),
		brute: () => soundActions.playSpreeGodlike(),
		spitter: () => soundActions.playSpreeHumiliation()
	};

	$effect(() => {
		const sessionId = lobbyState.currentSessionId;
		if (sessionId !== prevKillSessionId) {
			killCounts.clear();
			countedKills.clear();
			prevKillSessionId = sessionId;
		}
		if (!sessionId) return;
		for (const e of $enemies) {
			if (e.sessionId !== sessionId || e.isAlive || countedKills.has(e.id)) continue;
			countedKills.add(e.id);
			const count = (killCounts.get(e.enemyType) ?? 0) + 1;
			killCounts.set(e.enemyType, count);
			if (count % 10 === 0) SPREE_ACTIONS[e.enemyType]?.();
		}
	});

	// ─── Keep volumes synced ──────────────────────────────────────────────────
	$effect(() => {
		const vol = settingsState.audio.effectsVolume;
		for (const a of [
			gunnerShotAudio,
			gunnerAdrenalineAudio,
			healerHealAudio,
			healerReviveAudio,
			spotterMarkAudio,
			spotterPingAudio,
			tankBashAudio,
			tankBraceAudio,
			enemySpawnAudio
		]) {
			if (a) a.setVolume(vol);
		}
	});

	// ─── Ability sound triggers (local player — positional) ───────────────────
	$effect(() => {
		if (soundTriggers.gunnerShot > 0) playPos(gunnerShotAudio);
	});
	$effect(() => {
		if (soundTriggers.gunnerAdrenaline > 0) playPos(gunnerAdrenalineAudio);
	});
	$effect(() => {
		if (soundTriggers.healerHeal > 0) playPos(healerHealAudio);
	});
	$effect(() => {
		if (soundTriggers.healerRevive > 0) playPos(healerReviveAudio);
	});
	$effect(() => {
		if (soundTriggers.spotterMark > 0) playPos(spotterMarkAudio);
	});
	$effect(() => {
		if (soundTriggers.spotterPing > 0) playPos(spotterPingAudio);
	});
	$effect(() => {
		if (soundTriggers.tankBash > 0) playPos(tankBashAudio);
	});
	$effect(() => {
		if (soundTriggers.tankBrace > 0) playPos(tankBraceAudio);
	});
	$effect(() => {
		if (soundTriggers.enemySpawn > 0) playPos(enemySpawnAudio);
	});

// ─── Player status → global sounds ───────────────────────────────────────
	let prevStatus = $state<string | undefined>(undefined);
	$effect(() => {
		const status = myState?.status;
		if (status !== prevStatus) {
			if (status === 'downed') soundActions.playPlayerDown();
			prevStatus = status;
		}
	});
</script>

<!-- Group tracks local player world position so PositionalAudio is spatially correct -->
<T.Group position={[localPos.x, 1.0, localPos.z]}>
	<PositionalAudio
		src={`${base}sounds/classAbility/gunner_shot.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			gunnerShotAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/gunner_adrenaline.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			gunnerAdrenalineAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/healer_heal.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			healerHealAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/healer_revive.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			healerReviveAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/spotter_steady_shot.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			spotterMarkAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/spotter_flash_stun.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			spotterPingAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/tank_axe_swing.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			tankBashAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/classAbility/tank_brace.wav`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => {
			tankBraceAudio = a;
		}}
	/>
	<PositionalAudio
		src={`${base}sounds/map/enemy_spawn.wav`}
		refDistance={3}
		maxDistance={25}
		rolloffFactor={2}
		oncreate={(a) => {
			enemySpawnAudio = a;
		}}
	/>
</T.Group>
