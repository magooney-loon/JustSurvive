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
	import { T } from '@threlte/core';
	import { AdditiveBlending, DoubleSide, type Texture } from 'three';
	import PlayerRig from '$lib/character/PlayerRig.svelte';

	export type GunnerRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		facing: number;
		velX: number;
		velZ: number;
		shotPulse: number;
		phase?: string;
		isBracing?: boolean;
		texture?: Texture | null;
	};

	let {
		color,
		walkPhase,
		speed,
		facing,
		velX,
		velZ,
		shotPulse,
		phase = 'sunset',
		isBracing = false,
		texture = null
	}: GunnerRigProps = $props();

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

	const armForwardZ = -0.2;
	const leftArmRotX = $derived(-swing * 0.8);
	const rightArmRotX = $derived(swing * 0.8);
</script>

<PlayerRig
	classChoice="gunner"
	{color}
	{walkPhase}
	{speed}
	{facing}
	{velX}
	{velZ}
	{shotPulse}
	{phase}
	{isBracing}
	{texture}
/>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Group position={[-0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[leftArmRotX, 0, 0]}>
		{@const recoil = shotPulse * 0.18}
		<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
			<T.MeshStandardMaterial color="#2b2b2b" roughness={0.38} metalness={0.42} />
		</T.Mesh>
		{#if shotPulse > 0}
			{@const f = shotPulse}
			{@const mz = -0.85 - recoil}
			<!-- Perpendicular disc: the bright circular bloom at the muzzle face -->
			<T.Mesh position={[0, 0, mz]} scale={f * 0.2}>
				<T.CircleGeometry args={[1, 10]} />
				<T.MeshBasicMaterial color="#ffffff" transparent opacity={f * 0.95} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, 0, mz]} scale={f * 0.38}>
				<T.CircleGeometry args={[1, 10]} />
				<T.MeshBasicMaterial color="#ff8800" transparent opacity={f * 0.4} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
			</T.Mesh>
			<!-- Forward gas blast: elongated narrow cone -->
			<T.Mesh position={[0, 0, mz - f * 0.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[f * 0.08, f * 0.5, f * 0.08]}>
				<T.ConeGeometry args={[1, 1, 7]} />
				<T.MeshBasicMaterial color="#fff4cc" transparent opacity={f * 0.95} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<!-- Wider hot base -->
			<T.Mesh position={[0, 0, mz - f * 0.06]} rotation={[-Math.PI / 2, 0, 0]} scale={[f * 0.18, f * 0.18, f * 0.18]}>
				<T.ConeGeometry args={[1, 1, 7]} />
				<T.MeshBasicMaterial color="#ffcc44" transparent opacity={f * 0.7} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<!-- Hot white core sphere -->
			<T.Mesh position={[0, 0, mz]} scale={f * 0.09}>
				<T.SphereGeometry args={[1, 6, 5]} />
				<T.MeshBasicMaterial color="#ffffff" transparent opacity={f} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<!-- Star petals: 4 radial jets around barrel axis -->
			<T.Mesh position={[0, f * 0.07, mz]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, -f * 0.07, mz]} rotation={[Math.PI, 0, 0]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[f * 0.07, 0, mz]} rotation={[0, 0, -Math.PI / 2]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[-f * 0.07, 0, mz]} rotation={[0, 0, Math.PI / 2]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
		{/if}
	</T.Group>

	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		{@const recoil = shotPulse * 0.18}
		<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
			<T.MeshStandardMaterial color="#2b2b2b" roughness={0.38} metalness={0.42} />
		</T.Mesh>
		{#if shotPulse > 0}
			{@const f = shotPulse}
			{@const mz = -0.85 - recoil}
			<T.Mesh position={[0, 0, mz]} scale={f * 0.2}>
				<T.CircleGeometry args={[1, 10]} />
				<T.MeshBasicMaterial color="#ffffff" transparent opacity={f * 0.95} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, 0, mz]} scale={f * 0.38}>
				<T.CircleGeometry args={[1, 10]} />
				<T.MeshBasicMaterial color="#ff8800" transparent opacity={f * 0.4} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, 0, mz - f * 0.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[f * 0.08, f * 0.5, f * 0.08]}>
				<T.ConeGeometry args={[1, 1, 7]} />
				<T.MeshBasicMaterial color="#fff4cc" transparent opacity={f * 0.95} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, 0, mz - f * 0.06]} rotation={[-Math.PI / 2, 0, 0]} scale={[f * 0.18, f * 0.18, f * 0.18]}>
				<T.ConeGeometry args={[1, 1, 7]} />
				<T.MeshBasicMaterial color="#ffcc44" transparent opacity={f * 0.7} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, 0, mz]} scale={f * 0.09}>
				<T.SphereGeometry args={[1, 6, 5]} />
				<T.MeshBasicMaterial color="#ffffff" transparent opacity={f} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, f * 0.07, mz]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[0, -f * 0.07, mz]} rotation={[Math.PI, 0, 0]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[f * 0.07, 0, mz]} rotation={[0, 0, -Math.PI / 2]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
			<T.Mesh position={[-f * 0.07, 0, mz]} rotation={[0, 0, Math.PI / 2]} scale={[f * 0.055, f * 0.18, f * 0.055]}>
				<T.ConeGeometry args={[1, 1, 5]} />
				<T.MeshBasicMaterial color="#ffaa33" transparent opacity={f * 0.8} blending={AdditiveBlending} depthWrite={false} />
			</T.Mesh>
		{/if}
	</T.Group>
</T.Group>
