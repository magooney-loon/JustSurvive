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
	let group = $state<THREE.Group | null>(null);
	let bodyMesh = $state<THREE.Mesh | null>(null);
	let mixer = $state<THREE.AnimationMixer | null>(null);
	let currentAction = $state<THREE.AnimationAction | null>(null);

	const ENEMY_ANIMS = {
		basic: {
			idle: ['crstand'],
			move: ['crwalk'],
			attack: ['crattack'],
			death: ['crdeath']
		},
		brute: {
			idle: ['crstand'],
			move: ['crwalk'],
			attack: ['crattack'],
			death: ['crdeath']
		},
		fast: {
			idle: ['stand'],
			move: ['run'],
			attack: ['jump'],
			death: ['crdeath']
		},
		spitter: {
			idle: ['stand'],
			move: ['run'],
			attack: ['point'],
			death: ['crdeath']
		},
		caster: {
			idle: ['stand'],
			move: ['run'],
			attack: ['taunt'],
			death: ['crdeath']
		}
	};

	function getAnim(type: typeof enemyType, category: 'idle' | 'move' | 'attack' | 'death'): string {
		const enemyAnims = ENEMY_ANIMS[type];
		const anims = enemyAnims?.[category] || ['stand'];
		return anims[Math.floor(Math.random() * anims.length)];
	}

	let cycleTimer = $state(0);
	let currentCategory = $state('idle');
	let hasCycledOnce = $state(false);

	function getAnimationFromState(s: number, atk: number, dead: boolean): string {
		if (dead) return getAnim(enemyType, 'death');
		if (atk > 0.3) return getAnim(enemyType, 'attack');
		if (s < 0.1) return getAnim(enemyType, 'idle');
		return getAnim(enemyType, 'move');
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

		if (ENEMY_ANIMS[enemyType]?.death.includes(name)) {
			newAction.setLoop(THREE.LoopOnce as any, 1);
			newAction.clampWhenFinished = true;
		} else {
			newAction.setLoop(THREE.LoopRepeat as any, Infinity);
		}
		newAction.play();

		if (currentAction) {
			currentAction.fadeOut(0.15);
			newAction.reset().fadeIn(0.15).play();
		}
		currentAction = newAction;
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

			cycleTimer += delta;
			const newCategory = isDead
				? 'death'
				: attackPhase > 0.3
					? 'attack'
					: speed < 0.1
						? 'idle'
						: 'move';

			if (newCategory !== currentCategory) {
				currentCategory = newCategory;
				cycleTimer = 0;
				hasCycledOnce = false;
			}

			if (newCategory === 'idle' && !hasCycledOnce && cycleTimer > 3) {
				hasCycledOnce = true;
				const anim = getAnimationFromState(speed, attackPhase, isDead);
				setAnimation(anim);
			}
		}
	});

	onMount(async () => {
		console.log(`[MD2] Mounting enemy: ${enemyType}`);

		try {
			const data = await loadEnemyModel(enemyType);
			loadedData = data;

			const result = createEnemyMesh(data, enemyType);
			group = result.group;
			bodyMesh = result.body;

			mixer = new THREE.AnimationMixer(bodyMesh);

			const firstAnim = getAnimationFromState(speed, attackPhase, isDead);
			setAnimation(firstAnim);

			loaded = true;
			console.log(`[MD2] Ready: ${enemyType}`);
		} catch (e) {
			console.error(`[MD2] Failed to load ${enemyType}:`, e);
		}
	});
</script>

{#if loaded && group}
	<T is={group} position={[0, isDead ? 0.4 : 1.0, 0]} />
{/if}
