<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AudioListener } from '@threlte/extras';
	import { stageState } from '$root/stage.svelte.js';
	import { log, settingsState } from '$root/settings.svelte.js';
	import {
		localPos,
		localVelocity,
		tpsCamera,
		cameraFollow,
		bossShake
	} from '$lib/stores/movement.svelte.js';
	import type { PerspectiveCamera } from 'three';

	const { renderer } = useThrelte();
	let camera = $state.raw<PerspectiveCamera>();

	// TPS: camera offset above and behind the player
	const TPS_Y = 8;
	const TPS_Z = 10;
	const TPS_PITCH = -Math.atan2(TPS_Y, TPS_Z);
	const EYE_Y_BASE = 1.658; // spectate eye level
	const BASE_SENS = 0.002;

	// Camera smoothing
	let camTargetX = 0;
	let camTargetY = 0;
	let camTargetZ = 0;
	let camYawSmooth = 0;
	let camRotYaw = 0;
	const LERP_POS = 0.12;
	const LERP_YAW = 0.18;
	const LERP_ROT = 0.14;
	const LOOK_AHEAD = 0.03;

	$effect(() => {
		const canvas = renderer.domElement;

		function onClick() {
			if (stageState.currentStage === 'game') canvas.requestPointerLock();
		}

		function onMouseMove(e: MouseEvent) {
			if (document.pointerLockElement !== canvas) return;
			if (stageState.currentStage !== 'game') return;
			const sens = BASE_SENS * settingsState.controls.mouseSensitivity;
			tpsCamera.yaw -= e.movementX * sens;
		}

		canvas.addEventListener('click', onClick);
		document.addEventListener('mousemove', onMouseMove);
		return () => {
			canvas.removeEventListener('click', onClick);
			document.removeEventListener('mousemove', onMouseMove);
			document.exitPointerLock();
		};
	});

	// Release pointer lock and reset camera whenever we leave the game stage
	$effect(() => {
		if (stageState.currentStage !== 'game') {
			document.exitPointerLock();

			// Reset camera smoothing variables so next game starts fresh
			camTargetX = 0;
			camTargetY = 0;
			camTargetZ = 0;
			camYawSmooth = 0;
			camRotYaw = 0;

			// Reset camera to default menu position when not in game
			if (camera) {
				camera.position.set(0, 0, 0);
				camera.rotation.set(0, 0, 0);
				camera.lookAt(0, 0, 0);
			}
		}
	});

	useTask(() => {
		if (!camera || stageState.currentStage !== 'game') return;
		camera.rotation.order = 'YXZ';
		if (cameraFollow.active) {
			// Spectate: look from eliminated target's eye level facing their direction
			const spectateYaw = Math.atan2(
				cameraFollow.x - cameraFollow.aimX,
				cameraFollow.z - cameraFollow.aimZ
			);
			camera.position.set(cameraFollow.x, cameraFollow.y + EYE_Y_BASE, cameraFollow.z);
			camera.rotation.y = spectateYaw;
			camera.rotation.x = 0;
		} else {
			// TPS: hover above and behind the player, orbiting via yaw

			// Smooth yaw follow
			camYawSmooth += (tpsCamera.yaw - camYawSmooth) * LERP_YAW;
			const smoothBehindX = Math.sin(camYawSmooth) * TPS_Z;
			const smoothBehindZ = Math.cos(camYawSmooth) * TPS_Z;

			const targetX = localPos.x + smoothBehindX + localVelocity.x * LOOK_AHEAD;
			const targetY = localPos.y + TPS_Y;
			const targetZ = localPos.z + smoothBehindZ + localVelocity.z * LOOK_AHEAD;

			// Smooth camera position
			camTargetX += (targetX - camTargetX) * LERP_POS;
			camTargetY += (targetY - camTargetY) * LERP_POS;
			camTargetZ += (targetZ - camTargetZ) * LERP_POS;

			// Boss shake
			const shakeY = bossShake.intensity;
			const shakeX = bossShake.intensity * Math.sin(Date.now() * 0.031) * 0.4;

			camRotYaw += (tpsCamera.yaw - camRotYaw) * LERP_ROT;
			camera.position.set(camTargetX + shakeX, camTargetY + shakeY, camTargetZ);
			camera.rotation.y = camRotYaw;
			camera.rotation.x = TPS_PITCH;
		}
	});
</script>

<T.PerspectiveCamera
	fov={75}
	near={0.05}
	far={1000}
	makeDefault
	oncreate={(cam) => {
		camera = cam;
		return () => log.info('Camera disposed');
	}}
>
	<AudioListener />
</T.PerspectiveCamera>
