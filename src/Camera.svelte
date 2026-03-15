<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AudioListener } from '@threlte/extras';
	import { stageState } from '$root/stage.svelte.js';
	import { log, settingsState } from '$root/settings.svelte.js';
	import { localPos, tpsCamera, cameraFollow, bossShake } from '$lib/stores/movement.svelte.js';
	import type { PerspectiveCamera } from 'three';

	const { renderer } = useThrelte();
	let camera = $state.raw<PerspectiveCamera>();

	// TPS: camera offset above and behind the player
	const TPS_Y = 8;
	const TPS_Z = 10;
	const TPS_PITCH = -Math.atan2(TPS_Y, TPS_Z);
	const EYE_Y_BASE = 1.658; // spectate eye level
	const BASE_SENS = 0.002;

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

	// Release pointer lock whenever we leave the game stage
	$effect(() => {
		if (stageState.currentStage !== 'game') {
			document.exitPointerLock();
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
			const behindX = Math.sin(tpsCamera.yaw) * TPS_Z;
			const behindZ = Math.cos(tpsCamera.yaw) * TPS_Z;
			const shakeY = bossShake.intensity;
			const shakeX = bossShake.intensity * Math.sin(Date.now() * 0.031) * 0.4;
			camera.position.set(
				localPos.x + behindX + shakeX,
				localPos.y + TPS_Y + shakeY,
				localPos.z + behindZ
			);
			camera.rotation.y = tpsCamera.yaw;
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
