<script module>
	// Module-level: shared across all imports, not per-instance
	export const soundTriggers = $state({
		swoosh: 0,
		click: 0,
		currentAnimSound: '' as string,
		// Global game SFX (non-positional)
		playerDead: 0,
		playerDown: 0,
		// Positional ability SFX — handled by GameSounds.svelte
		gunnerShot: 0,
		healerHeal: 0,
		healerRevive: 0,
		spotterMark: 0,
		spotterPing: 0,
		tankBash: 0,
		tankBrace: 0,
	});

	export const soundActions = {
		playSwoosh() { soundTriggers.swoosh++; },
		playClick() { soundTriggers.click++; },
		playAnimSound(action: string) { soundTriggers.currentAnimSound = action; },
		stopAnimSounds() { soundTriggers.currentAnimSound = ''; },
		playPlayerDead() { soundTriggers.playerDead++; },
		playPlayerDown() { soundTriggers.playerDown++; },
		// Positional ability sounds
		playGunnerShot() { soundTriggers.gunnerShot++; },
		playHealerHeal() { soundTriggers.healerHeal++; },
		playHealerRevive() { soundTriggers.healerRevive++; },
		playSpotterMark() { soundTriggers.spotterMark++; },
		playSpotterPing() { soundTriggers.spotterPing++; },
		playTankBash() { soundTriggers.tankBash++; },
		playTankBrace() { soundTriggers.tankBrace++; },
	};
</script>

<script lang="ts">
	import { Audio } from '@threlte/extras';
	import { Audio as ThreeAudio } from 'three';
	import { settingsState, log } from './settings.svelte.js';

	// Place your audio files in /public/sounds/
	const base = import.meta.env.BASE_URL;
	const OST_URL = `${base}sounds/ost.ogg`;
	const AMBIENCE_URL = `${base}sounds/ambience.ogg`;
	const CLICK_URL = `${base}sounds/click.mp3`;
	const SWOOSH_URL = `${base}sounds/swoosh.mp3`;
	const PLAYER_DEAD_URL = `${base}sounds/player_dead.mp3`;
	const PLAYER_DOWN_URL = `${base}sounds/player_down.mp3`;

	// $state.raw — prevents Svelte 5 from wrapping class instances in a Proxy
	let ostAudio = $state.raw<ThreeAudio>();
	let ambienceAudio = $state.raw<ThreeAudio>();
	let clickAudio = $state.raw<ThreeAudio>();
	let swooshAudio = $state.raw<ThreeAudio>();
	let animIdleAudio = $state.raw<ThreeAudio>();
	let animWalkAudio = $state.raw<ThreeAudio>();
	let animRunAudio = $state.raw<ThreeAudio>();
	let animAgreeAudio = $state.raw<ThreeAudio>();
	let animHeadShakeAudio = $state.raw<ThreeAudio>();
	let playerDeadAudio = $state.raw<ThreeAudio>();
	let playerDownAudio = $state.raw<ThreeAudio>();

	// ─── Playback helpers ─────────────────────────────────────────────────────

	// Stop + replay — restarts the sound each call (good for clicks)
	const playOneShot = (audio: ThreeAudio | undefined) => {
		if (!audio) return;
		if (audio.isPlaying) audio.stop();
		audio.play();
	};

	// Clone + play — allows multiple overlapping instances (good for swoosh)
	const playPolyphonic = (audio: ThreeAudio | undefined) => {
		if (!audio?.buffer) return;
		const clone = audio.clone() as ThreeAudio;
		clone.setVolume(audio.getVolume());
		clone.play();
	};

	// ─── Looping tracks ───────────────────────────────────────────────────────

	$effect(() => {
		if (!ostAudio) return;
		if (settingsState.audio.musicEnabled) ostAudio.play();
		else ostAudio.pause();
	});

	$effect(() => {
		if (!ostAudio) return;
		ostAudio.setVolume(settingsState.audio.musicVolume);
	});

	$effect(() => {
		if (!ambienceAudio) return;
		if (settingsState.audio.ambienceEnabled) ambienceAudio.play();
		else ambienceAudio.pause();
	});

	$effect(() => {
		if (!ambienceAudio) return;
		ambienceAudio.setVolume(settingsState.audio.ambienceVolume);
	});

	$effect(() => {
		if (!clickAudio) return;
		clickAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!swooshAudio) return;
		swooshAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!playerDeadAudio) return;
		playerDeadAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!playerDownAudio) return;
		playerDownAudio.setVolume(settingsState.audio.effectsVolume);
	});

	// ─── One-shot SFX ────────────────────────────────────────────────────────

	$effect(() => {
		if (soundTriggers.click > 0 && settingsState.audio.effectsEnabled) playOneShot(clickAudio);
	});

	$effect(() => {
		if (soundTriggers.swoosh > 0 && settingsState.audio.effectsEnabled) playPolyphonic(swooshAudio);
	});

	$effect(() => {
		if (soundTriggers.playerDead > 0 && settingsState.audio.effectsEnabled)
			playOneShot(playerDeadAudio);
	});

	$effect(() => {
		if (soundTriggers.playerDown > 0 && settingsState.audio.effectsEnabled)
			playOneShot(playerDownAudio);
	});

	// ─── Animation sounds — single effect handles stop-then-play atomically ──

	$effect(() => {
		const animAudios = [
			animIdleAudio,
			animWalkAudio,
			animRunAudio,
			animAgreeAudio,
			animHeadShakeAudio
		];
		const vol = settingsState.audio.effectsVolume;

		// Keep volumes in sync
		for (const audio of animAudios) {
			if (audio) audio.setVolume(vol);
		}

		// Stop all, then play the active one
		for (const audio of animAudios) {
			if (audio?.isPlaying) audio.stop();
		}

		if (!soundTriggers.currentAnimSound || !settingsState.audio.effectsEnabled) return;

		const animAudioMap: Record<string, ThreeAudio | undefined> = {
			idle: animIdleAudio,
			walk: animWalkAudio,
			run: animRunAudio,
			agree: animAgreeAudio,
			headShake: animHeadShakeAudio
		};
		const target = animAudioMap[soundTriggers.currentAnimSound];
		if (target) playOneShot(target);
	});
</script>

<!-- Audio track 1: OST / background music -->
<Audio
	src={OST_URL}
	loop
	oncreate={(a) => {
		ostAudio = a;
		log.info('Audio loaded: OST');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Audio track 2: Ambience -->
<Audio
	src={AMBIENCE_URL}
	loop
	oncreate={(a) => {
		ambienceAudio = a;
		log.info('Audio loaded: Ambience');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- SFX 1: Click -->
<Audio
	src={CLICK_URL}
	oncreate={(a) => {
		clickAudio = a;
		log.info('Audio loaded: Click SFX');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- SFX 2: Swoosh (stage transitions) -->
<Audio
	src={SWOOSH_URL}
	oncreate={(a) => {
		swooshAudio = a;
		log.info('Audio loaded: Swoosh SFX');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Global SFX: Player Dead -->
<Audio
	src={PLAYER_DEAD_URL}
	oncreate={(a) => {
		playerDeadAudio = a;
		log.info('Audio loaded: Player Dead SFX');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Global SFX: Player Down -->
<Audio
	src={PLAYER_DOWN_URL}
	oncreate={(a) => {
		playerDownAudio = a;
		log.info('Audio loaded: Player Down SFX');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
