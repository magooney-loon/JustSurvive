<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AudioListener } from '@threlte/extras';
	import { stageState } from './stage.svelte.js';
	import { log, settingsState } from './settings.svelte.js';
	import { localPos, localVelocity, fpsCamera, cameraFollow } from './localGameState.svelte.js';
	import type { PerspectiveCamera } from 'three';

	const { renderer } = useThrelte();
	let camera = $state.raw<PerspectiveCamera>();

	// FPS: eye level from head group y=1.63, visor local y=+0.028
	const EYE_Y_BASE = 1.658;
	// Visor front face local z ≈ -0.192; add 0.06 safety to stay outside near clip plane
	const VISOR_Z = 0.192 + 0.06;
	// TPS: camera offset above and behind the player
	const TPS_Y = 8;
	const TPS_Z = 10;
	const TPS_PITCH = -Math.atan2(TPS_Y, TPS_Z); // fixed downward angle looking at player
	const PITCH_MIN = -Math.PI / 2 + 0.05;
	const PITCH_MAX = Math.PI / 2 - 0.05;
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
			fpsCamera.yaw -= e.movementX * sens;
			// In TPS the pitch is fixed — only update pitch in FPS mode
			if (settingsState.controls.cameraMode === 'fps') {
				fpsCamera.pitch -= e.movementY * sens;
				fpsCamera.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, fpsCamera.pitch));
			}
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
		} else if (settingsState.controls.cameraMode === 'tps') {
			// TPS: hover above and behind the player, orbiting via yaw
			// "Behind" = opposite of look direction = +sin/+cos when yaw=0
			const behindX = Math.sin(fpsCamera.yaw) * TPS_Z;
			const behindZ = Math.cos(fpsCamera.yaw) * TPS_Z;
			camera.position.set(
				localPos.x + behindX,
				localPos.y + TPS_Y,
				localPos.z + behindZ
			);
			camera.rotation.y = fpsCamera.yaw;
			camera.rotation.x = TPS_PITCH;
		} else {
			// FPS: mirror StickRig's leanForward so camera tracks the visor during sprint
			// StickRig: leanForward = (isSprinting ? 0.22 : 0.08) * moveIntensity
			const spd = Math.hypot(localVelocity.x, localVelocity.z);
			const moveIntensity = Math.min(1, spd / 5);
			const leanFwd = (spd > 6 ? 0.22 : 0.08) * moveIntensity;
			// Head group z shifts by -leanFwd*0.75, so camera must move with it
			const camFwd = VISOR_Z + leanFwd * 0.75;
			const fwdX = -Math.sin(fpsCamera.yaw) * camFwd;
			const fwdZ = -Math.cos(fpsCamera.yaw) * camFwd;
			camera.position.set(localPos.x + fwdX, localPos.y + EYE_Y_BASE, localPos.z + fwdZ);
			camera.rotation.y = fpsCamera.yaw;
			camera.rotation.x = fpsCamera.pitch;
		}
	});
</script>

<!--
  OLD_CAMERA: Third-person orbit follow camera (CameraControls)
  Followed localPos with FOLLOW_OFFSET {x:0, y:6, z:12} rotated by aim angle —
  camera always sat behind the player relative to their aim direction.
  Used CameraControls from @threlte/extras; controls.setTarget / controls.setPosition each frame.
  Spectate mode also used CameraControls positioned behind the spectated player.
  Imports needed: CameraControls, type CameraControlsRef from '@threlte/extras';
                  cameraActions from './stage.svelte.js'
  See git history for the full implementation.
-->

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
