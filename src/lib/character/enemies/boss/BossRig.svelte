<script lang="ts">
	import { onMount } from 'svelte';
	import { useTask } from '@threlte/core';
	import { T } from '@threlte/core';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		bossX?: number;
		bossZ?: number;
	};

	let { speed, attackPhase = 0, isDead = false, bossX = 0, bossZ = 0 }: Props = $props();

	const ANIM_WALK = 'zbs_walk';
	const ANIM_ATTACK = 'zbs_attack_justiceSwing';
	const ANIM_DEATH = 'gutshot';
	const SHAKE_MAX_DIST = 28;
	const SHAKE_FREQ = Math.PI * 1.4; // ~0.7 Hz footstep cycle
	const SHAKE_AMPLITUDE = 0.14;

	let scene = $state.raw<THREE.Group | null>(null);
	let mixer = $state.raw<THREE.AnimationMixer | null>(null);
	let currentAction: THREE.AnimationAction | null = null;
	let loaded = $state(false);
	let animations = new Map<string, THREE.AnimationClip>();
	let shakeTimer = 0;

	function targetAnim(): string {
		if (isDead) return ANIM_DEATH;
		if (attackPhase > 0.3) return ANIM_ATTACK;
		return ANIM_WALK;
	}

	function setAnimation(name: string) {
		if (!mixer || !animations.size) return;
		const clip = animations.get(name);
		if (!clip) return;
		if (currentAction?.getClip().name === clip.name) return;

		const newAction = mixer.clipAction(clip);
		newAction.reset();
		if (name === ANIM_DEATH) {
			newAction.setLoop(THREE.LoopOnce as any, 1);
			newAction.clampWhenFinished = true;
		} else {
			newAction.setLoop(THREE.LoopRepeat as any, Infinity);
		}
		if (currentAction) {
			currentAction.fadeOut(0.25);
			newAction.fadeIn(0.25);
		}
		newAction.play();
		currentAction = newAction;
	}

	$effect(() => {
		if (loaded) setAnimation(targetAnim());
	});

	useTask((dt) => {
		if (mixer) mixer.update(dt);

		// Camera shake — boss footsteps felt through the ground
		const isWalking = !isDead && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			const dx = bossX - localPos.x;
			const dz = bossZ - localPos.z;
			const dist = Math.sqrt(dx * dx + dz * dz);
			const proximity = Math.max(0, 1 - dist / SHAKE_MAX_DIST);
			// Pulse on footstep beat — absolute sine gives two peaks per cycle (left/right foot)
			bossShake.intensity =
				Math.abs(Math.sin(shakeTimer * SHAKE_FREQ)) * proximity * SHAKE_AMPLITUDE;
		} else {
			// Fade out when idle/dead
			bossShake.intensity = Math.max(0, bossShake.intensity - dt * 3);
		}
	});

	onMount(async () => {
		const loader = new GLTFLoader();
		const gltf = await new Promise<any>((resolve, reject) => {
			loader.load(
				`${import.meta.env.BASE_URL}models/enemies/boss/scene.gltf`,
				resolve,
				undefined,
				reject
			);
		});

		const root = gltf.scene as THREE.Group;
		// Scale: model exported in cm-scale from Sketchfab — tune if needed
		root.scale.setScalar(4.5);
		root.traverse((obj) => {
			if (obj instanceof THREE.Mesh) {
				obj.castShadow = true;
			}
		});

		for (const clip of gltf.animations as THREE.AnimationClip[]) {
			animations.set(clip.name, clip);
		}

		mixer = new THREE.AnimationMixer(root);
		scene = root;
		loaded = true;
		setAnimation(targetAnim());
	});
</script>

{#if loaded && scene}
	<T is={scene} />
{/if}
