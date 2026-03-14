<script lang="ts">
	import { T } from '@threlte/core';
	import type { Texture } from 'three';

	export type StickRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		texture?: Texture | null;
		limbRadius?: number;
	};

	let { color, walkPhase, speed, texture = null, limbRadius = 0.065 }: StickRigProps = $props();

	const bodyMat = $derived(
		texture ? { map: texture, color, roughness: 0.85 } : { color, roughness: 0.88 }
	);

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

	const leanForward = $derived((isSprinting ? 0.22 : 0.08) * moveIntensity);

	const limbR = $derived(limbRadius);

	const kneeBendL = $derived(0.07 + Math.max(0, sinWalk) * 0.95 * moveIntensity);
	const kneeBendR = $derived(0.07 + Math.max(0, -sinWalk) * 0.95 * moveIntensity);
</script>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Mesh position={[0, 0.93, -leanForward * 0.45]} rotation={[leanForward, 0, 0]}>
		<T.CylinderGeometry args={[0.14, 0.18, 0.65, 6]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>
	<T.Mesh position={[0, 1.18, -leanForward * 0.55]} rotation={[leanForward * 0.9, 0, 0]}>
		<T.CylinderGeometry args={[0.1, 0.15, 0.55, 6]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>
	<T.Mesh position={[0, 1.32, -leanForward * 0.6]} rotation={[leanForward * 0.9, 0, 0]}>
		<T.CylinderGeometry args={[0.08, 0.12, 0.4, 6]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>
	<T.Mesh position={[0, 1.44, -leanForward * 0.65]} rotation={[leanForward * 0.8, 0, 0]}>
		<T.CylinderGeometry args={[0.075, 0.11, 0.2, 8]} />
		<T.MeshStandardMaterial color="#d0bb9a" roughness={0.85} />
	</T.Mesh>

	<T.Mesh position={[0, 0.75, 0]}>
		<T.SphereGeometry args={[0.12, 8, 6]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>
	<T.Mesh position={[0, 0.78, 0]}>
		<T.CapsuleGeometry args={[0.16, 0.22, 6, 10]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>

	<T.Mesh position={[0, 1.35, 0]}>
		<T.SphereGeometry args={[0.1, 8, 6]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>
	<T.Mesh position={[-0.28, 1.34, -0.02]}>
		<T.CapsuleGeometry args={[0.068, 0.22, 4, 8]} />
		<T.MeshStandardMaterial color="#2f271f" roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0.28, 1.34, -0.02]}>
		<T.CapsuleGeometry args={[0.068, 0.22, 4, 8]} />
		<T.MeshStandardMaterial color="#2f271f" roughness={0.35} metalness={0.35} />
	</T.Mesh>

	<T.Mesh position={[0, 1.25, -leanForward * 0.4]}>
		<T.CapsuleGeometry args={[0.18, 0.3, 6, 10]} />
		<T.MeshStandardMaterial {...bodyMat} />
	</T.Mesh>

	<T.Group
		position={[0, 1.63, -leanForward * 0.75]}
		rotation={[headTilt + leanForward * 0.4, 0, 0]}
	>
		<T.Mesh position={[0, 0.02, 0]}>
			<T.SphereGeometry args={[0.185, 10, 7]} />
			<T.MeshStandardMaterial color="#d9c5a7" roughness={0.85} />
		</T.Mesh>
		<T.Mesh>
			<T.BoxGeometry args={[0.32, 0.26, 0.24]} />
			<T.MeshStandardMaterial color="#cdbb9c" roughness={0.85} />
		</T.Mesh>
		<T.Mesh position={[0, -0.01, 0]}>
			<T.CylinderGeometry args={[0.205, 0.248, 0.13, 8]} />
			<T.MeshStandardMaterial color="#d2c3a5" roughness={0.5} metalness={0.18} />
		</T.Mesh>
		<T.Mesh position={[0, 0.075, -0.17]}>
			<T.BoxGeometry args={[0.28, 0.055, 0.065]} />
			<T.MeshStandardMaterial color="#bfa98c" roughness={0.75} />
		</T.Mesh>
		<T.Mesh position={[0, 0.028, -0.163]}>
			<T.BoxGeometry args={[0.305, 0.092, 0.052]} />
			<T.MeshStandardMaterial color="#0d0d0d" roughness={0.22} metalness={0.55} />
		</T.Mesh>
		<T.Mesh position={[0, -0.09, -0.17]}>
			<T.CapsuleGeometry args={[0.036, 0.1, 4, 8]} />
			<T.MeshStandardMaterial color="#bfa98c" roughness={0.8} />
		</T.Mesh>
		<T.Mesh position={[0, 0.17, -0.06]}>
			<T.BoxGeometry args={[0.18, 0.065, 0.1]} />
			<T.MeshStandardMaterial color="#bfa98c" roughness={0.65} />
		</T.Mesh>
	</T.Group>

	<T.Group position={[-0.14, 0.75, 0]} rotation={[swing, 0, 0]}>
		<T.Mesh position={[0, -0.21, 0]}>
			<T.CylinderGeometry args={[limbR * 1.1, limbR * 0.9, 0.42, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
		</T.Mesh>
		<T.Mesh position={[0, -0.42, 0]}>
			<T.SphereGeometry args={[limbR * 1.05, 7, 5]} />
			<T.MeshStandardMaterial color="#2a1d12" roughness={0.65} metalness={0.12} />
		</T.Mesh>
		<T.Group position={[0, -0.42, 0]} rotation={[-kneeBendL, 0, 0]}>
			<T.Mesh position={[0, -0.26, 0]}>
				<T.CylinderGeometry args={[limbR * 0.88, limbR * 0.72, 0.52, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
			</T.Mesh>
			<T.Mesh position={[0, -0.54, 0]}>
				<T.SphereGeometry args={[limbR * 0.78, 6, 4]} />
				<T.MeshStandardMaterial color="#221710" roughness={0.75} />
			</T.Mesh>
			<T.Group position={[0, -0.54, 0]} rotation={[footRoll, 0, 0]}>
				<T.Mesh position={[0, -0.065, -0.03]}>
					<T.BoxGeometry args={[limbR * 2.25, limbR * 1.05, limbR * 3.5]} />
					<T.MeshStandardMaterial color="#141414" roughness={0.82} />
				</T.Mesh>
			</T.Group>
		</T.Group>
	</T.Group>

	<T.Group position={[0.14, 0.75, 0]} rotation={[-swing, 0, 0]}>
		<T.Mesh position={[0, -0.21, 0]}>
			<T.CylinderGeometry args={[limbR * 1.1, limbR * 0.9, 0.42, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
		</T.Mesh>
		<T.Mesh position={[0, -0.42, 0]}>
			<T.SphereGeometry args={[limbR * 1.05, 7, 5]} />
			<T.MeshStandardMaterial color="#2a1d12" roughness={0.65} metalness={0.12} />
		</T.Mesh>
		<T.Group position={[0, -0.42, 0]} rotation={[-kneeBendR, 0, 0]}>
			<T.Mesh position={[0, -0.26, 0]}>
				<T.CylinderGeometry args={[limbR * 0.88, limbR * 0.72, 0.52, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
			</T.Mesh>
			<T.Mesh position={[0, -0.54, 0]}>
				<T.SphereGeometry args={[limbR * 0.78, 6, 4]} />
				<T.MeshStandardMaterial color="#221710" roughness={0.75} />
			</T.Mesh>
			<T.Group position={[0, -0.54, 0]} rotation={[-footRoll, 0, 0]}>
				<T.Mesh position={[0, -0.065, -0.03]}>
					<T.BoxGeometry args={[limbR * 2.25, limbR * 1.05, limbR * 3.5]} />
					<T.MeshStandardMaterial color="#141414" roughness={0.82} />
				</T.Mesh>
			</T.Group>
		</T.Group>
	</T.Group>
</T.Group>
