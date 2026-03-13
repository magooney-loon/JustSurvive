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
	import type { Texture } from 'three';
	import StickRig from './StickRig.svelte';

	export type PlayerRigProps = {
		classChoice: string;
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse: number;
		phase?: string;
		isBracing?: boolean;
		texture?: Texture | null;
	};

	let {
		classChoice,
		color,
		walkPhase,
		speed,
		shotPulse: _shotPulse,
		phase: _phase,
		isBracing: _isBracing,
		texture = null
	}: PlayerRigProps = $props();

	const limbR = $derived(classChoice === 'tank' ? 0.09 : classChoice === 'gunner' ? 0.075 : 0.065);

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	const sinWalk = $derived(Math.sin(walkPhase));
	const sinHalf = $derived(Math.sin(walkPhase * 0.5));
	const swing = $derived(sinWalk * 1.1 * moveIntensity);
	const bob = $derived(Math.abs(sinWalk) * 0.07 * moveIntensity);
	const sway = $derived(sinHalf * 0.18 * moveIntensity);
	const hipShift = $derived(sinWalk * 0.06 * moveIntensity);
	const torsoTwist = $derived(sinWalk * 0.18 * moveIntensity);
	const headTilt = $derived(sinHalf * 0.12 * moveIntensity);
	const footRoll = $derived(Math.cos(walkPhase) * 0.3 * moveIntensity);
	const isSprinting = $derived(speed > 6);
	const holdAim = $derived(classChoice === 'spotter' || classChoice === 'gunner');
	const armBop = $derived(isSprinting ? sinWalk * 0.2 * moveIntensity : 0);
	const armPitch = $derived(holdAim ? armBop : 0);
	const armForwardZ = $derived(holdAim ? -0.55 : -0.2);
	const leanForward = $derived((isSprinting ? 0.22 : 0.08) * moveIntensity);

	const plateTint = $derived(classChoice === 'gunner' ? '#2b2620' : '#2f271f');

	const leftArmRotX = $derived(holdAim ? armPitch : -swing * 0.8);
	const rightArmRotX = $derived(holdAim ? -armPitch : swing * 0.8);

	const kneeBendL = $derived(0.07 + Math.max(0, sinWalk) * 0.95 * moveIntensity);
	const kneeBendR = $derived(0.07 + Math.max(0, -sinWalk) * 0.95 * moveIntensity);

	const visorColor = $derived(
		classChoice === 'spotter'
			? '#22d4ff'
			: classChoice === 'gunner'
				? '#ff8822'
				: classChoice === 'tank'
					? '#66ff44'
					: '#ff88cc'
	);
	const visorGlow = $derived(0.75);
	const emblemGlow = $derived(0.55);
</script>

<StickRig {color} {walkPhase} {speed} {texture} limbRadius={limbR} />

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Mesh position={[-0.2, 0.78, 0.04]} rotation={[0, 0, Math.PI / 2]}>
		<T.CapsuleGeometry args={[0.065, 0.19, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.3} />
	</T.Mesh>
	<T.Mesh position={[0.2, 0.78, 0.04]} rotation={[0, 0, Math.PI / 2]}>
		<T.CapsuleGeometry args={[0.065, 0.19, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.3} />
	</T.Mesh>
	<T.Mesh position={[0, 0.68, 0.08]}>
		<T.CylinderGeometry args={[0.08, 0.12, 0.12, 6]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.3} />
	</T.Mesh>

	<T.Mesh position={[-0.36, 1.32, 0.02]} rotation={[0, 0, 0.3]}>
		<T.BoxGeometry args={[0.15, 0.09, 0.17]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0.36, 1.32, 0.02]} rotation={[0, 0, -0.3]}>
		<T.BoxGeometry args={[0.15, 0.09, 0.17]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>

	<T.Mesh position={[-0.27, 1.25, -leanForward * 0.35]}>
		<T.CapsuleGeometry args={[0.062, 0.25, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0.27, 1.25, -leanForward * 0.35]}>
		<T.CapsuleGeometry args={[0.062, 0.25, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0, 1.16, -leanForward * 0.3]}>
		<T.CylinderGeometry args={[0.2, 0.22, 0.15, 6]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0, 1.27, -leanForward * 0.38 - 0.17]} rotation={[0, Math.PI, 0]}>
		<T.CircleGeometry args={[0.052, 8]} />
		<T.MeshBasicMaterial color={visorColor} transparent opacity={emblemGlow} />
	</T.Mesh>

	<T.Group
		position={[0, 1.63, -leanForward * 0.75]}
		rotation={[headTilt + leanForward * 0.4, 0, 0]}
	>
		<T.Mesh position={[-0.072, 0.028, -0.192]} rotation={[0, Math.PI, 0]}>
			<T.CircleGeometry args={[0.033, 8]} />
			<T.MeshBasicMaterial color={visorColor} transparent opacity={visorGlow} />
		</T.Mesh>
		<T.Mesh position={[0.072, 0.028, -0.192]} rotation={[0, Math.PI, 0]}>
			<T.CircleGeometry args={[0.033, 8]} />
			<T.MeshBasicMaterial color={visorColor} transparent opacity={visorGlow} />
		</T.Mesh>
	</T.Group>

	<T.Group position={[-0.14, 0.75, 0]} rotation={[swing, 0, 0]}>
		<T.Mesh position={[0, -0.17, 0.075]}>
			<T.BoxGeometry args={[limbR * 2.1, limbR * 2.5, limbR * 1.15]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
		</T.Mesh>
		<T.Mesh position={[0, -0.42, 0.09]}>
			<T.BoxGeometry args={[limbR * 1.9, limbR * 1.1, limbR * 0.9]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
		</T.Mesh>
		<T.Group position={[0, -0.42, 0]} rotation={[-kneeBendL, 0, 0]}>
			<T.Mesh position={[0, -0.24, 0.075]}>
				<T.CapsuleGeometry args={[limbR * 0.42, limbR * 2.1, 4, 8]} />
				<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
			</T.Mesh>
			<T.Group position={[0, -0.54, 0]} rotation={[footRoll, 0, 0]}>
				<T.Mesh position={[0, -0.1, 0.09]}>
					<T.CapsuleGeometry args={[limbR * 0.52, limbR * 1.9, 4, 8]} />
					<T.MeshStandardMaterial color="#1c1c1c" roughness={0.82} />
				</T.Mesh>
				<T.Mesh position={[0, -0.122, -0.025]}>
					<T.BoxGeometry args={[limbR * 2.15, limbR * 0.32, limbR * 3.1]} />
					<T.MeshStandardMaterial color="#090909" roughness={0.95} />
				</T.Mesh>
			</T.Group>
		</T.Group>
	</T.Group>

	<T.Group position={[0.14, 0.75, 0]} rotation={[-swing, 0, 0]}>
		<T.Mesh position={[0, -0.17, 0.075]}>
			<T.BoxGeometry args={[limbR * 2.1, limbR * 2.5, limbR * 1.15]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
		</T.Mesh>
		<T.Mesh position={[0, -0.42, 0.09]}>
			<T.BoxGeometry args={[limbR * 1.9, limbR * 1.1, limbR * 0.9]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
		</T.Mesh>
		<T.Group position={[0, -0.42, 0]} rotation={[-kneeBendR, 0, 0]}>
			<T.Mesh position={[0, -0.24, 0.075]}>
				<T.CapsuleGeometry args={[limbR * 0.42, limbR * 2.1, 4, 8]} />
				<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
			</T.Mesh>
			<T.Group position={[0, -0.54, 0]} rotation={[-footRoll, 0, 0]}>
				<T.Mesh position={[0, -0.1, 0.09]}>
					<T.CapsuleGeometry args={[limbR * 0.52, limbR * 1.9, 4, 8]} />
					<T.MeshStandardMaterial color="#1c1c1c" roughness={0.82} />
				</T.Mesh>
				<T.Mesh position={[0, -0.122, -0.025]}>
					<T.BoxGeometry args={[limbR * 2.15, limbR * 0.32, limbR * 3.1]} />
					<T.MeshStandardMaterial color="#090909" roughness={0.95} />
				</T.Mesh>
			</T.Group>
		</T.Group>
	</T.Group>

	<T.Group position={[-0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[leftArmRotX, 0, 0]}>
		<T.Mesh position={[0, -0.04, -0.22]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.5, limbR * 1.2]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.28} />
		</T.Mesh>
	</T.Group>

	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		<T.Mesh position={[0, -0.04, -0.22]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.5, limbR * 1.2]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.28} />
		</T.Mesh>
	</T.Group>
</T.Group>
