<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';

	type LegsAnim = 'Idle' | 'Forward' | 'ForwardLeft' | 'ForwardRight';

	type Props = {
		speed: number;
		facing: number; // yaw in radians
		velX: number;
		velZ: number;
	};
	let { speed, facing, velX, velZ }: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<LegsAnim>();

	// Start all actions playing at weight 0, idle at 1
	$effect(() => {
		if (!$actions?.['Idle']) return;
		for (const name of ['Idle', 'Forward', 'ForwardLeft', 'ForwardRight'] as LegsAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(name === 'Idle' ? 1 : 0);
		}
	});

	useTask((dt) => {
		if (!mixer) return;

		// Facing direction vectors (game convention: facing=0 → -Z)
		const fwdX = -Math.sin(facing);
		const fwdZ = -Math.cos(facing);
		const rgtX = -Math.cos(facing);
		const rgtZ = Math.sin(facing);

		const fwdComp = velX * fwdX + velZ * fwdZ; // + = forward, - = backward
		const rgtComp = velX * rgtX + velZ * rgtZ; // + = right, - = left

		const moveIntensity = Math.min(speed / 4, 1);
		// Normalised strafe component: -1 = full left, +1 = full right
		const rgtNorm = speed > 0.1 ? rgtComp / speed : 0;

		// Animation weights — same shape for forward AND backward (timeScale drives direction)
		const wIdle = 1 - moveIntensity;
		const wFwd = (1 - Math.abs(rgtNorm)) * moveIntensity;
		const wFwdLeft = Math.max(0, -rgtNorm) * moveIntensity;
		const wFwdRight = Math.max(0, rgtNorm) * moveIntensity;

		$actions['Idle']?.setEffectiveWeight(wIdle);
		$actions['Forward']?.setEffectiveWeight(wFwd);
		$actions['ForwardLeft']?.setEffectiveWeight(wFwdLeft);
		$actions['ForwardRight']?.setEffectiveWeight(wFwdRight);

		// Negative timeScale plays animation in reverse → looks like backward movement
		const dir = fwdComp < -0.1 ? -1 : 1;
		const rate = speed > 0.5 ? Math.max(0.35, Math.min(1.4, speed / 7)) : 1;
		const timeScale = dir * rate;
		$actions['Idle']?.setEffectiveTimeScale(1);
		$actions['Forward']?.setEffectiveTimeScale(timeScale);
		$actions['ForwardLeft']?.setEffectiveTimeScale(timeScale);
		$actions['ForwardRight']?.setEffectiveTimeScale(timeScale);

		mixer.update(dt);
	});
</script>

<!-- scale=0.05: spine root sits at y≈15.2 model units → y≈0.76 game units (hip height) -->
<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/legs.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI, 0]}
	scale={0.05}
/>
