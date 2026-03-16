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
	const TPS_Y = 3.5;
	const TPS_Z = 3.5;
	const TPS_PITCH = -Math.atan2(TPS_Y, TPS_Z) * 0.36; // look more towards sky
	const EYE_Y_BASE = 1.658; // spectate eye level
	const BASE_SENS = 0.002;

	// Dynamic shoulder sway based on movement
	const SWAY_AMOUNT = 0.7; // how far camera sways to shoulder when strafing
	let camSway = 0;
	let camSwayTarget = 0;
	const SWAY_LERP = 0.06;

	// Walking/running bob effect
	let bobPhase = 0;
	const BOB_SPEED_WALK = 8;
	const BOB_SPEED_RUN = 14;
	const BOB_AMOUNT = 0.12;
	const BOB_RUN_MULT = 2.2;
	let camBob = 0;

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

	useTask((dt) => {
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

			// Calculate right vector perpendicular to camera facing
			const rightX = Math.cos(camYawSmooth);
			const rightZ = -Math.sin(camYawSmooth);

			// Project velocity onto right vector to get strafe amount
			const strafeVel = localVelocity.x * rightX + localVelocity.z * rightZ;
			// Target sway: strafe left = camera sways right shoulder, strafe right = camera sways left shoulder
			camSwayTarget = -Math.max(-1, Math.min(1, strafeVel / 5)) * SWAY_AMOUNT;
			// Smooth sway transition
			camSway += (camSwayTarget - camSway) * SWAY_LERP;

			// Movement bob - subtle vertical bounce based on speed
			const speed = Math.hypot(localVelocity.x, localVelocity.z);
			const targetBobSpeed = speed > 2 ? (speed > 5 ? BOB_SPEED_RUN : BOB_SPEED_WALK) : 0;
			// Smooth transition between bob speeds
			bobPhase += dt * targetBobSpeed;
			// Lerp the bob amplitude so it fades in/out smoothly
			const targetBobAmt = BOB_AMOUNT * Math.min(1, speed / 3) * (speed > 5 ? BOB_RUN_MULT : 1);
			camBob += (targetBobAmt - camBob) * 0.1;
			camBob = Math.abs(Math.sin(bobPhase)) * camBob;

			const targetX = localPos.x + smoothBehindX + rightX * camSway + localVelocity.x * LOOK_AHEAD;
			const targetY = localPos.y + TPS_Y;
			const targetZ = localPos.z + smoothBehindZ + rightZ * camSway + localVelocity.z * LOOK_AHEAD;

			// Smooth camera position
			camTargetX += (targetX - camTargetX) * LERP_POS;
			camTargetY += (targetY - camTargetY) * LERP_POS;
			camTargetZ += (targetZ - camTargetZ) * LERP_POS;

			// Boss shake
			const shakeY = bossShake.intensity;
			const shakeX = bossShake.intensity * Math.sin(Date.now() * 0.031) * 0.4;

			camRotYaw += (tpsCamera.yaw - camRotYaw) * LERP_ROT;
			camera.position.set(camTargetX + shakeX, camTargetY + shakeY + camBob, camTargetZ);
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
