<script lang="ts">
	import { onMount } from 'svelte';
	import { useTask } from '@threlte/core';
	import { T } from '@threlte/core';
	import * as THREE from 'three';
	import { loadEnemyModel, createEnemyMesh, findAnimation, type LoadedMD2 } from './md2Cache.js';

	export type MD2EnemyCharacterProps = {
		enemyType: 'basic' | 'fast' | 'brute' | 'spitter' | 'caster';
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { enemyType, speed, attackPhase = 0, isDead = false }: MD2EnemyCharacterProps = $props();

	let loaded = $state(false);
	let loadedData = $state<LoadedMD2 | null>(null);
	let bodyMesh = $state<THREE.Mesh | null>(null);
	let weaponMesh = $state<THREE.Mesh | null>(null);
	let mixer = $state<THREE.AnimationMixer | null>(null);
	let currentAction = $state<THREE.AnimationAction | null>(null);

	function getAnimationFromState(s: number, atk: number, dead: boolean): string {
		if (dead) return 'death';
		if (s < 0.1) return 'idle';
		if (atk > 0.3) return 'attack';
		return 'run';
	}

	function setAnimation(name: string) {
		if (!loadedData || !bodyMesh || !mixer) return;

		const clip = findAnimation(loadedData.animations, name);
		if (!clip) {
			console.log(`[MD2] Animation not found: ${name}`);
			return;
		}

		if (currentAction && currentAction.getClip().name === clip.name) return;

		const newAction = mixer.clipAction(clip);
		newAction.reset();
		newAction.setLoop(THREE.LoopRepeat as any, Infinity);
		newAction.play();

		if (currentAction) {
			currentAction.fadeOut(0.2);
			newAction.reset().fadeIn(0.2).play();
		}
		currentAction = newAction;
		console.log(`[MD2] Playing animation: ${clip.name}`);
	}

	$effect(() => {
		if (loaded && loadedData) {
			const anim = getAnimationFromState(speed, attackPhase, isDead);
			setAnimation(anim);
		}
	});

	useTask((delta) => {
		if (mixer) {
			mixer.update(delta);
		}
	});

	onMount(async () => {
		console.log(`[MD2] Mounting enemy: ${enemyType}`);

		try {
			const data = await loadEnemyModel(enemyType);
			loadedData = data;

			const { body, weapon } = createEnemyMesh(data, enemyType);
			bodyMesh = body;
			weaponMesh = weapon || null;

			mixer = new THREE.AnimationMixer(body);

			const firstAnim = getAnimationFromState(speed, attackPhase, isDead);
			setAnimation(firstAnim);

			loaded = true;
			console.log(`[MD2] Ready: ${enemyType}`);
		} catch (e) {
			console.error(`[MD2] Failed to load ${enemyType}:`, e);
		}
	});
</script>

{#if loaded && bodyMesh}
	<T.Group position={[0, 0.1, 0]}>
		<T is={bodyMesh} />
		{#if weaponMesh}
			<T is={weaponMesh} />
		{/if}
	</T.Group>
{/if}
