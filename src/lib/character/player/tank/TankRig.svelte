<script module lang="ts">
	import { MeshLambertMaterial } from 'three';
	const _lc = new Map<string, MeshLambertMaterial>();
	export function eL(hex: string): MeshLambertMaterial {
		let m = _lc.get(hex);
		if (!m) _lc.set(hex, (m = new MeshLambertMaterial({ color: hex })));
		return m;
	}
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending, type Texture } from 'three';
	import PlayerRig from '$lib/character/PlayerRig.svelte';

	export type TankRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse?: number;
		phase?: string;
		isCharging?: boolean;
		texture?: Texture | null;
	};

	let {
		color,
		walkPhase,
		speed,
		shotPulse = 0,
		phase = 'sunset',
		isCharging = false,
		texture = null
	}: TankRigProps = $props();

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	const sinWalk = $derived(Math.sin(walkPhase));
	const sinHalf = $derived(Math.sin(walkPhase * 0.5));
	const swing = $derived(sinWalk * 1.1 * moveIntensity);
	const bob = $derived(Math.abs(sinWalk) * 0.07 * moveIntensity);
	const sway = $derived(sinHalf * 0.18 * moveIntensity);
	const hipShift = $derived(sinWalk * 0.06 * moveIntensity);
	const torsoTwist = $derived(sinWalk * 0.18 * moveIntensity);
	const isSprinting = $derived(speed > 6);
	const leanForward = $derived((isSprinting ? 0.22 : 0.08) * moveIntensity);

	let chargeT = $state(0);
	useTask((dt) => {
		const target = isCharging ? 1 : 0;
		chargeT += (target - chargeT) * (1 - Math.pow(0.004, dt));
	});
	const shieldGlow = $derived(chargeT * 0.85);
	const shieldArmZ = $derived(-0.55 - 0.08 * chargeT);
	const shieldS = $derived(0.58 + 0.42 * chargeT);

	const armForwardZ = -0.2;
	const leftArmRotX = $derived(-swing * 0.8);
	const rightArmRotX = $derived(swing * 0.8);
</script>

<PlayerRig
	classChoice="tank"
	{color}
	{walkPhase}
	{speed}
	{shotPulse}
	{phase}
	isBracing={false}
	{texture}
/>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Group position={[-0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[leftArmRotX, 0, 0]}>
		<T.Group
			position={[0, 0, shieldArmZ]}
			rotation={[-Math.PI / 2, 0, 0]}
			scale={[shieldS, shieldS, shieldS]}
		>
			<T.Mesh>
				<T.CylinderGeometry args={[0.44, 0.44, 0.065, 6]} />
				<T.MeshStandardMaterial color="#162416" roughness={0.28} metalness={0.6} />
			</T.Mesh>
			<T.Mesh>
				<T.CylinderGeometry args={[0.47, 0.44, 0.02, 6]} />
				<T.MeshStandardMaterial
					color="#2a6e2a"
					emissive="#44ff44"
					emissiveIntensity={0.12 + shieldGlow * 2.2}
					roughness={0.28}
					metalness={0.7}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.BoxGeometry args={[0.07, 0.01, 0.38]} />
				<T.MeshBasicMaterial color="#55ee55" transparent opacity={0.2 + shieldGlow * 0.5} />
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.BoxGeometry args={[0.38, 0.01, 0.07]} />
				<T.MeshBasicMaterial color="#55ee55" transparent opacity={0.2 + shieldGlow * 0.5} />
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.CylinderGeometry args={[0.06, 0.06, 0.012, 6]} />
				<T.MeshStandardMaterial
					color="#55ee55"
					emissive="#44ff44"
					emissiveIntensity={0.2 + shieldGlow * 1.8}
					roughness={0.3}
					metalness={0.6}
				/>
			</T.Mesh>
			{#if chargeT > 0.05}
				<T.Mesh position={[0, 0.038, 0]}>
					<T.CylinderGeometry args={[0.43, 0.43, 0.001, 16]} />
					<T.MeshBasicMaterial
						color="#44ff44"
						transparent
						opacity={shieldGlow * 0.15}
						blending={AdditiveBlending}
						depthWrite={false}
					/>
				</T.Mesh>
				<T.Mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<T.RingGeometry args={[0.44, 0.62, 14]} />
					<T.MeshBasicMaterial
						color="#88ff88"
						transparent
						opacity={shieldGlow * 0.65}
						blending={AdditiveBlending}
						depthWrite={false}
					/>
				</T.Mesh>
			{/if}
		</T.Group>
	</T.Group>

	<!-- Right arm — axe -->
	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		<!-- Handle -->
		<T.Mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.022, 0.018, 0.44, 7]} />
			<T.MeshStandardMaterial color="#3b2007" roughness={0.75} metalness={0.05} />
		</T.Mesh>
		<!-- Axe head -->
		<T.Mesh position={[-0.04, 0, -0.52]}>
			<T.BoxGeometry args={[0.14, 0.18, 0.055]} />
			<T.MeshStandardMaterial color="#5a5a5a" roughness={0.22} metalness={0.8} />
		</T.Mesh>
		<!-- Blade edge (slightly offset, lighter) -->
		<T.Mesh position={[-0.105, 0, -0.52]}>
			<T.BoxGeometry args={[0.02, 0.16, 0.045]} />
			<T.MeshStandardMaterial color="#c8c8c8" roughness={0.08} metalness={0.95} />
		</T.Mesh>
	</T.Group>
</T.Group>
