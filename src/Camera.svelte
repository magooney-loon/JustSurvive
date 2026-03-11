<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AudioListener } from '@threlte/extras';
	import { CameraControls, type CameraControlsRef } from '@threlte/extras';
	import { cameraActions, stageState } from './stage.svelte.js';
	import { log } from './settings.svelte.js';
	import { cameraFollow, localAim, localPos } from './localGameState.svelte.js';
	import type { PerspectiveCamera } from 'three';

	let controls = $state<CameraControlsRef>();

	const handleCameraCreate = (camera: PerspectiveCamera) => {
		camera.lookAt(0, 0, 0);
		return () => {
			log.info('Camera disposed');
		};
	};

	const handleControlsCreate = (controlsRef: CameraControlsRef) => {
		controls = controlsRef;
		cameraActions.setCameraControls(controlsRef);
		return () => {
			cameraActions.setCameraControls(undefined);
			controls = undefined;
		};
	};

	const FOLLOW_OFFSET = { x: 0, y: 6, z: 12 };
	const MOVE_THRESHOLD = 0.002; // skip update if target moved less than this

	let prevFollowX = 0, prevFollowZ = 0, prevAimX = 0, prevAimZ = 0;

	useTask(() => {
		if (!controls || stageState.currentStage !== 'game') return;
		const followX = cameraFollow.active ? cameraFollow.x : localPos.x;
		const followY = cameraFollow.active ? cameraFollow.y : localPos.y;
		const followZ = cameraFollow.active ? cameraFollow.z : localPos.z;
		const aimX = cameraFollow.active ? cameraFollow.aimX : localAim.x;
		const aimZ = cameraFollow.active ? cameraFollow.aimZ : localAim.z;

		// Skip if nothing meaningful changed
		if (
			Math.abs(followX - prevFollowX) < MOVE_THRESHOLD &&
			Math.abs(followZ - prevFollowZ) < MOVE_THRESHOLD &&
			Math.abs(aimX - prevAimX) < MOVE_THRESHOLD &&
			Math.abs(aimZ - prevAimZ) < MOVE_THRESHOLD
		) return;

		prevFollowX = followX; prevFollowZ = followZ;
		prevAimX = aimX; prevAimZ = aimZ;

		const aimAngle = Math.atan2(followX - aimX, followZ - aimZ);
		const camAngle = -aimAngle;
		const cos = Math.cos(camAngle);
		const sin = Math.sin(camAngle);
		const offsetX = FOLLOW_OFFSET.x * cos - FOLLOW_OFFSET.z * sin;
		const offsetZ = FOLLOW_OFFSET.x * sin + FOLLOW_OFFSET.z * cos;
		controls.setTarget(followX, followY + 1, followZ, false);
		controls.setPosition(followX + offsetX, followY + FOLLOW_OFFSET.y, followZ + offsetZ, false);
	});
</script>

<T.PerspectiveCamera
	position={[0, 0, 10]}
	fov={60}
	near={0.001}
	far={100}
	makeDefault
	oncreate={handleCameraCreate}
>
	<AudioListener />
	<CameraControls enabled={true} bind:ref={controls} oncreate={handleControlsCreate} />
</T.PerspectiveCamera>
