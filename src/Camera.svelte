<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AudioListener } from '@threlte/extras';
	import { CameraControls, type CameraControlsRef } from '@threlte/extras';
	import { cameraActions, stageState } from './stage.svelte.js';
	import { log } from './settings.svelte.js';
	import { localPos } from './localGameState.svelte.js';
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
		controls.setTarget(localPos.x, localPos.y + 1, localPos.z, false);
		controls.setPosition(
			localPos.x + FOLLOW_OFFSET.x,
			localPos.y + FOLLOW_OFFSET.y,
			localPos.z + FOLLOW_OFFSET.z,
			false
		);
	});
</script>

<T.PerspectiveCamera
	position={[0, 0, 10]}
	fov={60}
	near={0.001}
	far={144}
	makeDefault
	oncreate={handleCameraCreate}
>
	<AudioListener />
	<CameraControls enabled={true} bind:ref={controls} oncreate={handleControlsCreate} />
</T.PerspectiveCamera>
