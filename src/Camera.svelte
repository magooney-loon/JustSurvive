<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AudioListener } from '@threlte/extras';
	import { CameraControls, type CameraControlsRef } from '@threlte/extras';
	import { cameraActions, stageState } from './stage.svelte.js';
	import { log } from './settings.svelte.js';
	import { localAim, localPos } from './localGameState.svelte.js';
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

	useTask(() => {
		if (!controls || stageState.currentStage !== 'game') return;
		const aimAngle = Math.atan2(localPos.x - localAim.x, localPos.z - localAim.z);
		const camAngle = -aimAngle;
		const cos = Math.cos(camAngle);
		const sin = Math.sin(camAngle);
		const offsetX = FOLLOW_OFFSET.x * cos - FOLLOW_OFFSET.z * sin;
		const offsetZ = FOLLOW_OFFSET.x * sin + FOLLOW_OFFSET.z * cos;
		controls.setTarget(localPos.x, localPos.y + 1, localPos.z, false);
		controls.setPosition(
			localPos.x + offsetX,
			localPos.y + FOLLOW_OFFSET.y,
			localPos.z + offsetZ,
			false
		);
	});
</script>

<T.PerspectiveCamera
	position={[0, 0, 10]}
	fov={60}
	near={0.001}
	far={1200}
	makeDefault
	oncreate={handleCameraCreate}
>
	<AudioListener />
	<CameraControls enabled={true} bind:ref={controls} oncreate={handleControlsCreate} />
</T.PerspectiveCamera>
