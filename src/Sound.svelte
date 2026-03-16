<script module>
	// Module-level: shared across all imports, not per-instance
	export const soundTriggers = $state({
		swoosh: 0,
		click: 0,
		hitmarker: 0,
		// Global game SFX (non-positional)
		playerDown: 0,
		playerDamage: 0,
		newCycle: 0,
		spreeKilling: 0,
		spreeDominating: 0,
		spreeGodlike: 0,
		spreeHumiliation: 0,
		// Positional ability SFX — handled by GameSounds.svelte
		gunnerShot: 0,
		gunnerAdrenaline: 0,
		healerHeal: 0,
		healerRevive: 0,
		spotterMark: 0,
		spotterPing: 0,
		tankBash: 0,
		tankBrace: 0,
		// Boss SFX — handled by BossRig.svelte
		bossFootstep: 0,
		bossAttack: 0,
		bossDead: 0,
		bossDaze: 0,
		// Boss spawn — global sound
		bossIntro: 0,
		// Weather
		thunder: 0,
		// Game flow
		gameStart: 0,
		gameEnd: 0,
		countdown: 0,
		// Enemy spawn
		enemySpawn: 0,
		// Ultimate ability
		ultimate: 0,
		// Item pickups
		healthPickup: 0,
		staminaPickup: 0,
		doubleDamagePickup: 0,
		doubleSpeedPickup: 0
	});

	export const soundActions = {
		playSwoosh() {
			soundTriggers.swoosh++;
		},
		playClick() {
			soundTriggers.click++;
		},
		playHitmarker() {
			soundTriggers.hitmarker++;
		},
		playPlayerDown() {
			soundTriggers.playerDown++;
		},
		playPlayerDamage() {
			soundTriggers.playerDamage++;
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
		playGunnerAdrenaline() {
			soundTriggers.gunnerAdrenaline++;
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
		},
		playBossFootstep() {
			soundTriggers.bossFootstep++;
		},
		playBossAttack() {
			soundTriggers.bossAttack++;
		},
		playBossDead() {
			soundTriggers.bossDead++;
		},
		playBossDaze() {
			soundTriggers.bossDaze++;
		},
		playBossIntro() {
			soundTriggers.bossIntro++;
		},
		playThunder() {
			soundTriggers.thunder++;
		},
		playGameStart() {
			soundTriggers.gameStart++;
		},
		playCountdown() {
			soundTriggers.countdown++;
		},
		playGameEnd() {
			soundTriggers.gameEnd++;
		},
		playEnemySpawn() {
			soundTriggers.enemySpawn++;
		},
		playUltimate() {
			soundTriggers.ultimate++;
		},
		playHealthPickup() {
			soundTriggers.healthPickup++;
		},
		playStaminaPickup() {
			soundTriggers.staminaPickup++;
		},
		playDoubleDamagePickup() {
			soundTriggers.doubleDamagePickup++;
		},
		playDoubleSpeedPickup() {
			soundTriggers.doubleSpeedPickup++;
		}
	};
</script>

<script lang="ts">
	import { Audio } from '@threlte/extras';
	import { Audio as ThreeAudio } from 'three';
	import { settingsState, log } from '$root/settings.svelte.js';
	import { skyState } from '$lib/stores/sky.svelte.js';

	// Place your audio files in /public/sounds/
	const base = import.meta.env.BASE_URL;
	const OST_URL = `${base}sounds/ost/ost.ogg`;
	const OST1_URL = `${base}sounds/ost/ost1.ogg`;
	const OST2_URL = `${base}sounds/ost/ost2.ogg`;
	const AMBIENCE_URL = `${base}sounds/ambience/ambience.ogg`;
	const CLICK_URL = `${base}sounds/click.mp3`;
	const SWOOSH_URL = `${base}sounds/swoosh.mp3`;
	const PLAYER_DOWN_URL = `${base}sounds/player/player_down.wav`;
	const PLAYER_DAMAGE_URL = `${base}sounds/player/damage_impact.wav`;
	const NEW_CYCLE_URL = `${base}sounds/map/new_cycle.mp3`;
	const SPREE_KILLING_URL = `${base}sounds/map/spree_killing.mp3`;
	const SPREE_DOMINATING_URL = `${base}sounds/map/spree_dominating.mp3`;
	const SPREE_GODLIKE_URL = `${base}sounds/map/spree_godlike.mp3`;
	const SPREE_HUMILIATION_URL = `${base}sounds/map/spree_humiliation.mp3`;
	const RAINSTORM_URL = `${base}sounds/ambience/sound_rain.wav`;
	const THUNDER_URL = `${base}sounds/ambience/sound_thunder.wav`;
	const BOSS_INTRO_URL = `${base}sounds/enemies/boss_intro.mp3`;
	const HITMARKER_URL = `${base}sounds/map/hitmarker.ogg`;
	const GAME_START_URL = `${base}sounds/map/game_start.wav`;
	const GAME_END_URL = `${base}sounds/map/game_end.wav`;
	const GUNNER_ADRENALINE_URL = `${base}sounds/classAbility/gunner_adrenaline.wav`;
	const COUNTDOWN_URL = `${base}sounds/map/countdown.mp3`;
	const ULTIMATE_URL = `${base}sounds/classAbility/ultimate.mp3`;
	const HEALTH_PICKUP_URL = `${base}sounds/player/health_refill.mp3`;
	const STAMINA_PICKUP_URL = `${base}sounds/player/stamina_refill.mp3`;
	const DOUBLE_DAMAGE_URL = `${base}sounds/player/double_damage.mp3`;
	const DOUBLE_SPEED_URL = `${base}sounds/player/double_speed.mp3`;

	// $state.raw — prevents Svelte 5 from wrapping class instances in a Proxy
	let ostAudio = $state.raw<ThreeAudio>();
	let ost1Audio = $state.raw<ThreeAudio>();
	let ost2Audio = $state.raw<ThreeAudio>();
	let ambienceAudio = $state.raw<ThreeAudio>();
	let clickAudio = $state.raw<ThreeAudio>();
	let swooshAudio = $state.raw<ThreeAudio>();
	let playerDownAudio = $state.raw<ThreeAudio>();
	let playerDamageAudio = $state.raw<ThreeAudio>();
	let newCycleAudio = $state.raw<ThreeAudio>();
	let spreeKillingAudio = $state.raw<ThreeAudio>();
	let spreeDominatingAudio = $state.raw<ThreeAudio>();
	let spreeGodlikeAudio = $state.raw<ThreeAudio>();
	let spreeHumiliationAudio = $state.raw<ThreeAudio>();
	let rainstormAudio = $state.raw<ThreeAudio>();
	let thunderAudio = $state.raw<ThreeAudio>();
	let bossIntroAudio = $state.raw<ThreeAudio>();
	let hitmarkerAudio = $state.raw<ThreeAudio>();
	let gameStartAudio = $state.raw<ThreeAudio>();
	let gameEndAudio = $state.raw<ThreeAudio>();
	let gunnerAdrenalineAudio = $state.raw<ThreeAudio>();
	let countdownAudio = $state.raw<ThreeAudio>();
	let ultimateAudio = $state.raw<ThreeAudio>();
	let healthPickupAudio = $state.raw<ThreeAudio>();
	let staminaPickupAudio = $state.raw<ThreeAudio>();
	let doubleDamageAudio = $state.raw<ThreeAudio>();
	let doubleSpeedAudio = $state.raw<ThreeAudio>();

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

	// ─── Thunder — volume synced to ambience ──────────────────────────────────
	$effect(() => {
		if (!thunderAudio) return;
		thunderAudio.setVolume(settingsState.audio.ambienceVolume);
	});

	$effect(() => {
		if (soundTriggers.thunder > 0 && settingsState.audio.ambienceEnabled) playOneShot(thunderAudio);
	});

	$effect(() => {
		if (!clickAudio) return;
		clickAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!hitmarkerAudio) return;
		hitmarkerAudio.setVolume(settingsState.audio.effectsVolume * 0.6);
	});

	$effect(() => {
		if (!swooshAudio) return;
		swooshAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!playerDownAudio) return;
		playerDownAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!playerDamageAudio) return;
		playerDamageAudio.setVolume(settingsState.audio.effectsVolume);
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

	$effect(() => {
		if (!gameStartAudio) return;
		gameStartAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!gameEndAudio) return;
		gameEndAudio.setVolume(settingsState.audio.effectsVolume);
	});

	$effect(() => {
		if (!gunnerAdrenalineAudio) return;
		gunnerAdrenalineAudio.setVolume(settingsState.audio.effectsVolume);
	});

	// ─── One-shot SFX ────────────────────────────────────────────────────────

	$effect(() => {
		if (soundTriggers.click > 0 && settingsState.audio.effectsEnabled) playOneShot(clickAudio);
	});

	$effect(() => {
		if (soundTriggers.hitmarker > 0 && settingsState.audio.effectsEnabled)
			playPolyphonic(hitmarkerAudio);
	});

	$effect(() => {
		if (soundTriggers.swoosh > 0 && settingsState.audio.effectsEnabled) playPolyphonic(swooshAudio);
	});

	$effect(() => {
		if (soundTriggers.playerDown > 0 && settingsState.audio.effectsEnabled)
			playOneShot(playerDownAudio);
	});

	$effect(() => {
		if (soundTriggers.playerDamage > 0 && settingsState.audio.effectsEnabled)
			playOneShot(playerDamageAudio);
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
	$effect(() => {
		if (soundTriggers.bossIntro > 0 && settingsState.audio.effectsEnabled)
			playOneShot(bossIntroAudio);
	});
	$effect(() => {
		if (soundTriggers.gameStart > 0 && settingsState.audio.effectsEnabled)
			playOneShot(gameStartAudio);
	});
	$effect(() => {
		if (soundTriggers.countdown > 0 && settingsState.audio.effectsEnabled)
			playOneShot(countdownAudio);
	});
	$effect(() => {
		if (soundTriggers.gameEnd > 0 && settingsState.audio.effectsEnabled) playOneShot(gameEndAudio);
	});
	$effect(() => {
		if (soundTriggers.gunnerAdrenaline > 0 && settingsState.audio.effectsEnabled)
			playOneShot(gunnerAdrenalineAudio);
	});
	$effect(() => {
		if (soundTriggers.ultimate > 0 && settingsState.audio.effectsEnabled)
			playOneShot(ultimateAudio);
	});
	$effect(() => {
		if (soundTriggers.healthPickup > 0 && settingsState.audio.effectsEnabled)
			playOneShot(healthPickupAudio);
	});
	$effect(() => {
		if (soundTriggers.staminaPickup > 0 && settingsState.audio.effectsEnabled)
			playOneShot(staminaPickupAudio);
	});
	$effect(() => {
		if (soundTriggers.doubleDamagePickup > 0 && settingsState.audio.effectsEnabled)
			playOneShot(doubleDamageAudio);
	});
	$effect(() => {
		if (soundTriggers.doubleSpeedPickup > 0 && settingsState.audio.effectsEnabled)
			playOneShot(doubleSpeedAudio);
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

<!-- Global SFX: Player Down -->
<Audio
	src={PLAYER_DOWN_URL}
	oncreate={(a) => {
		playerDownAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Global SFX: Player Damage -->
<Audio
	src={PLAYER_DAMAGE_URL}
	oncreate={(a) => {
		playerDamageAudio = a;
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
<Audio
	src={BOSS_INTRO_URL}
	oncreate={(a) => {
		bossIntroAudio = a;
		log.info('Audio loaded: Boss Intro');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- SFX: Hitmarker -->
<Audio
	src={HITMARKER_URL}
	oncreate={(a) => {
		hitmarkerAudio = a;
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

<!-- Thunder — one-shot, triggered by lightning flash in Skybox.svelte -->
<Audio
	src={THUNDER_URL}
	oncreate={(a) => {
		thunderAudio = a;
		log.info('Audio loaded: Thunder');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Game Start / End stings -->
<Audio
	src={GAME_START_URL}
	oncreate={(a) => {
		gameStartAudio = a;
		log.info('Audio loaded: Game Start');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={GAME_END_URL}
	oncreate={(a) => {
		gameEndAudio = a;
		log.info('Audio loaded: Game End');
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Countdown — plays on game start -->
<Audio
	src={COUNTDOWN_URL}
	oncreate={(a) => {
		countdownAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Gunner Adrenaline — global non-positional fallback -->
<Audio
	src={GUNNER_ADRENALINE_URL}
	oncreate={(a) => {
		gunnerAdrenalineAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Ultimate ability activation -->
<Audio
	src={ULTIMATE_URL}
	oncreate={(a) => {
		ultimateAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>

<!-- Item pickup sounds -->
<Audio
	src={HEALTH_PICKUP_URL}
	oncreate={(a) => {
		healthPickupAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={STAMINA_PICKUP_URL}
	oncreate={(a) => {
		staminaPickupAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={DOUBLE_DAMAGE_URL}
	oncreate={(a) => {
		doubleDamageAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
<Audio
	src={DOUBLE_SPEED_URL}
	oncreate={(a) => {
		doubleSpeedAudio = a;
	}}
	userData={{ hideInTree: true, selectable: false }}
/>
