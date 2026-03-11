<script lang="ts">
	import { T } from '@threlte/core';
	import { PositionalAudio } from '@threlte/extras';
	import { PositionalAudio as ThreePosAudio } from 'three';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState } from '../game.svelte.js';
	import { localPos } from '../localGameState.svelte.js';
	import { soundTriggers, soundActions } from '../Sound.svelte';
	import { settingsState } from '../settings.svelte.js';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);

	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === gameState.currentSessionId
		)
	);

	const base = import.meta.env.BASE_URL;

	// ─── Positional audio refs ────────────────────────────────────────────────
	let gunnerShotAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let healerHealAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let healerReviveAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let spotterMarkAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let spotterPingAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let tankBashAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let tankBraceAudio = $state.raw<ThreePosAudio | undefined>(undefined);

	const playPos = (audio: ThreePosAudio | undefined) => {
		if (!audio?.buffer || !settingsState.audio.effectsEnabled) return;
		if (audio.isPlaying) audio.stop();
		audio.play();
	};

	// ─── Keep volumes synced ──────────────────────────────────────────────────
	$effect(() => {
		const vol = settingsState.audio.effectsVolume;
		for (const a of [gunnerShotAudio, healerHealAudio, healerReviveAudio, spotterMarkAudio, spotterPingAudio, tankBashAudio, tankBraceAudio]) {
			if (a) a.setVolume(vol);
		}
	});

	// ─── Ability sound triggers ───────────────────────────────────────────────
	$effect(() => { if (soundTriggers.gunnerShot > 0) playPos(gunnerShotAudio); });
	$effect(() => { if (soundTriggers.healerHeal > 0) playPos(healerHealAudio); });
	$effect(() => { if (soundTriggers.healerRevive > 0) playPos(healerReviveAudio); });
	$effect(() => { if (soundTriggers.spotterMark > 0) playPos(spotterMarkAudio); });
	$effect(() => { if (soundTriggers.spotterPing > 0) playPos(spotterPingAudio); });
	$effect(() => { if (soundTriggers.tankBash > 0) playPos(tankBashAudio); });
	$effect(() => { if (soundTriggers.tankBrace > 0) playPos(tankBraceAudio); });

	// ─── Player status → global sounds ───────────────────────────────────────
	let prevStatus = $state<string | undefined>(undefined);
	$effect(() => {
		const status = myState?.status;
		if (status !== prevStatus) {
			if (status === 'downed') soundActions.playPlayerDown();
			else if (status === 'eliminated') soundActions.playPlayerDead();
			prevStatus = status;
		}
	});
</script>

<!-- Group tracks local player world position so PositionalAudio is spatially correct -->
<T.Group position={[localPos.x, 1.0, localPos.z]}>
	<PositionalAudio
		src={`${base}sounds/gunner_shot.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { gunnerShotAudio = a; }}
	/>
	<PositionalAudio
		src={`${base}sounds/healer_heal.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { healerHealAudio = a; }}
	/>
	<PositionalAudio
		src={`${base}sounds/healer_revive.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { healerReviveAudio = a; }}
	/>
	<PositionalAudio
		src={`${base}sounds/spotter_location.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { spotterMarkAudio = a; }}
	/>
	<PositionalAudio
		src={`${base}sounds/spotter_ping.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { spotterPingAudio = a; }}
	/>
	<PositionalAudio
		src={`${base}sounds/tank_bash.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { tankBashAudio = a; }}
	/>
	<PositionalAudio
		src={`${base}sounds/tank_brace.mp3`}
		refDistance={4}
		maxDistance={20}
		rolloffFactor={1.5}
		oncreate={(a) => { tankBraceAudio = a; }}
	/>
</T.Group>
