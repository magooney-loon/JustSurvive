<script module>
	// Module-level: shared across all imports, not per-instance
	export const soundTriggers = $state({
		swoosh: 0,
		click: 0,
		currentAnimSound: '' as string,
		// Global game SFX (non-positional)
		playerDead: 0,
		playerDown: 0,
		newCycle: 0,
		spreeKilling: 0,
		spreeDominating: 0,
		spreeGodlike: 0,
		spreeHumiliation: 0,
		// Positional ability SFX — handled by GameSounds.svelte
		gunnerShot: 0,
		healerHeal: 0,
		healerRevive: 0,
		spotterMark: 0,
		spotterPing: 0,
		tankBash: 0,
		tankBrace: 0
	});

	export const soundActions = {
		playSwoosh() {
			soundTriggers.swoosh++;
		},
		playClick() {
			soundTriggers.click++;
		},
		playPlayerDead() {
			soundTriggers.playerDead++;
		},
		playPlayerDown() {
			soundTriggers.playerDown++;
		},
		playNewCycle() {
			soundTriggers.newCycle++;
		},
		playSpreeKilling() {
			soundTriggers.spreeKilling++;
		},
		playSpreeeDominating() {
			soundTriggers.spreeDominating++;
		},
		playSpreeGodlike() {
			soundTriggers.spreeGodlike++;
		},
		playSpreeHumiliation() {
			soundTriggers.spreeHumiliation++;
		},
		// Positional ability sounds
		playGunnerShot() {
			soundTriggers.gunnerShot++;
		},
		playHealerHeal() {
			soundTriggers.healerHeal++;
		},
		playHealerRevive() {
			soundTriggers.healerRevive++;
		},
		playSpotterMark() {
			soundTriggers.spotterMark++;
		},
		playSpotterPing() {
			soundTriggers.spotterPing++;
		},
		playTankBash() {
			soundTriggers.tankBash++;
		},
		playTankBrace() {
			soundTriggers.tankBrace++;
		}
	};
</script>

<script lang="ts">
	import { Audio } from '@threlte/extras';
	import { Audio as ThreeAudio } from 'three';
	import { settingsState, log } from './settings.svelte.js';
	import { skyState } from './localGameState.svelte.js';

	// Place your audio files in /public/sounds/
	const base = import.meta.env.BASE_URL;
	const OST_URL = `${base}sounds/ost.ogg`;
	const OST1_URL = `${base}sounds/ost1.ogg`;
	const OST2_URL = `${base}sounds/ost2.ogg`;
	const AMBIENCE_URL = `${base}sounds/ambience.ogg`;
	const CLICK_URL = `${base}sounds/click.mp3`;
	const SWOOSH_URL = `${base}sounds/swoosh.mp3`;
	const PLAYER_DEAD_URL = `${base}sounds/player_dead.mp3`;
	const PLAYER_DOWN_URL = `${base}sounds/player_down.mp3`;
	const NEW_CYCLE_URL = `${base}sounds/new_cycle.mp3`;
	const SPREE_KILLING_URL = `${base}sounds/spree_killing.mp3`;
	const SPREE_DOMINATING_URL = `${base}sounds/spree_dominating.mp3`;
	const SPREE_GODLIKE_URL = `${base}sounds/spree_godlike.mp3`;
	const SPREE_HUMILIATION_URL = `${base}sounds/spree_humiliation.mp3`;
	const RAINSTORM_URL = `${base}sounds/rainstorm.mp3`;

	// $state.raw — prevents Svelte 5 from wrapping class instances in a Proxy
	let ostAudio = $state.raw<ThreeAudio>();
	let ost1Audio = $state.raw<ThreeAudio>();
	let ost2Audio = $state.raw<ThreeAudio>();
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
	let newCycleAudio = $state.raw<ThreeAudio>();
	let spreeKillingAudio = $state.raw<ThreeAudio>();
	let spreeDominatingAudio = $state.raw<ThreeAudio>();
	let spreeGodlikeAudio = $state.raw<ThreeAudio>();
	let spreeHumiliationAudio = $state.raw<ThreeAudio>();
	let rainstormAudio = $state.raw<ThreeAudio>();

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

	// ─── Music playlist (ost.ogg → ost1.ogg → ost.ogg → …) ──────────────────

	// Plain vars — not reactive state, managed imperatively
	let ostCurrentIdx = 0; // 0 = ost.ogg, 1 = ost1.ogg, 2 = ost2.ogg
	let ostStoppedByUser = false;
	let ostFadeTimer: ReturnType<typeof setInterval> | null = null;

	const MUSIC_FADE_STEPS = 25;
	const MUSIC_FADE_MS = 1500;

	function getOstTrack(idx: number): ThreeAudio | undefined {
		return idx === 0 ? ostAudio : idx === 1 ? ost1Audio : ost2Audio;
	}

	function clearMusicFade() {
		if (ostFadeTimer) {
			clearInterval(ostFadeTimer);
			ostFadeTimer = null;
		}
	}

	function playOstWithFade(audio: ThreeAudio, targetVol: number) {
		clearMusicFade();
		// Must set onEnded BEFORE play() — Three.js binds it inside play()
		audio.onEnded = function (this: ThreeAudio) {
			(this as any).isPlaying = false; // mirror Three.js internal (readonly in types)
			if (ostStoppedByUser) {
				ostStoppedByUser = false;
				return; // user paused intentionally — don't switch tracks
			}
			if (!settingsState.audio.musicEnabled) return;
			// Natural end — switch to next track
			const nextIdx = (ostCurrentIdx + 1) % 3;
			const next = getOstTrack(nextIdx);
			if (!next) return;
			ostCurrentIdx = nextIdx;
			playOstWithFade(next, settingsState.audio.musicVolume);
		};
		audio.setVolume(0);
		audio.play();
		// Fade in
		let step = 0;
		ostFadeTimer = setInterval(() => {
			step++;
			audio.setVolume(Math.min(targetVol, targetVol * (step / MUSIC_FADE_STEPS)));
			if (step >= MUSIC_FADE_STEPS) clearMusicFade();
		}, MUSIC_FADE_MS / MUSIC_FADE_STEPS);
	}

	function stopCurrentOst() {
		clearMusicFade();
		const current = getOstTrack(ostCurrentIdx);
		if (current?.isPlaying) {
			ostStoppedByUser = true;
			current.stop();
		}
	}

	// Start/stop based on music toggle — waits for both tracks to be loaded
	$effect(() => {
		if (!ostAudio || !ost1Audio) return;
		if (settingsState.audio.musicEnabled) {
			const current = getOstTrack(ostCurrentIdx);
			if (current && !current.isPlaying) {
				playOstWithFade(current, settingsState.audio.musicVolume);
			}
		} else {
			stopCurrentOst();
		}
	});

	// Sync volume to currently playing track (skips during active fade)
	$effect(() => {
		const vol = settingsState.audio.musicVolume;
		if (!ostFadeTimer) {
			getOstTrack(ostCurrentIdx)?.setVolume(vol);
		}
	});

	// ─── Looping tracks ───────────────────────────────────────────────────────

	$effect(() => {
		if (!ambienceAudio) return;
		if (settingsState.audio.ambienceEnabled) ambienceAudio.play();
		else ambienceAudio.pause();
	});

	$effect(() => {
		if (!ambienceAudio) return;
		ambienceAudio.setVolume(settingsState.audio.ambienceVolume);
	});

	// ─── Rain — loops during night phases, volume scales with storm intensity ─
	$effect(() => {
		if (!rainstormAudio) return;
		const vol = skyState.stormIntensity * settingsState.audio.ambienceVolume;
		rainstormAudio.setVolume(vol);
		if (skyState.stormIntensity > 0.05 && settingsState.audio.ambienceEnabled) {
			if (!rainstormAudio.isPlaying) rainstormAudio.play();
		} else {
			if (rainstormAudio.isPlaying) rainstormAudio.pause();
		}
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

	$effect(() => {
		const vol = settingsState.audio.effectsVolume;
		for (const a of [
			newCycleAudio,
			spreeKillingAudio,
			spreeDominatingAudio,
			spreeGodlikeAudio,
			spreeHumiliationAudio
		]) {
			if (a) a.setVolume(vol);
		}
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

	$effect(() => {
		if (soundTriggers.newCycle > 0 && settingsState.audio.effectsEnabled)
			playOneShot(newCycleAudio);
	});
	$effect(() => {
		if (soundTriggers.spreeKilling > 0 && settingsState.audio.effectsEnabled)
			playOneShot(spreeKillingAudio);
	});
	$effect(() => {
		if (soundTriggers.spreeDominating > 0 && settingsState.audio.effectsEnabled)
			playOneShot(spreeDominatingAudio);
	});
	$effect(() => {
		if (soundTriggers.spreeGodlike > 0 && settingsState.audio.effectsEnabled)
			playOneShot(spreeGodlikeAudio);
	});
	$effect(() => {
		if (soundTriggers.spreeHumiliation > 0 && settingsState.audio.effectsEnabled)
			playOneShot(spreeHumiliationAudio);
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

<!-- Audio track 1: OST / background music (no loop — playlist switches tracks) -->
<Audio
	src={OST_URL}
	oncreate={(a) => {
		ostAudio = a;
		log.info('Audio loaded: OST');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Audio track 2: OST alternate -->
<Audio
	src={OST1_URL}
	oncreate={(a) => {
		ost1Audio = a;
		log.info('Audio loaded: OST1');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Audio track 3: OST alternate 2 -->
<Audio
	src={OST2_URL}
	oncreate={(a) => {
		ost2Audio = a;
		log.info('Audio loaded: OST2');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Audio track 4: Ambience -->
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

<!-- Global SFX: New Cycle -->
<Audio
	src={NEW_CYCLE_URL}
	oncreate={(a) => {
		newCycleAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Global SFX: Spree sounds -->
<Audio
	src={SPREE_KILLING_URL}
	oncreate={(a) => {
		spreeKillingAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={SPREE_DOMINATING_URL}
	oncreate={(a) => {
		spreeDominatingAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={SPREE_GODLIKE_URL}
	oncreate={(a) => {
		spreeGodlikeAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={SPREE_HUMILIATION_URL}
	oncreate={(a) => {
		spreeHumiliationAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Rainstorm — loops during night/storm phases, volume driven by skyState.stormIntensity -->
<Audio
	src={RAINSTORM_URL}
	loop
	oncreate={(a) => {
		rainstormAudio = a;
		log.info('Audio loaded: Rainstorm');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
