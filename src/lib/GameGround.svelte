<script module lang="ts">
	import * as THREE from 'three';
	import { ARENA_RADIUS } from './arenaConfig.js';

	// ── Geometries ───────────────────────────────────────────────────────────────
	const groundGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
	const wallGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 3.0, 64, 1, true);
	const wallCapGeo = new THREE.RingGeometry(ARENA_RADIUS - 1.2, ARENA_RADIUS + 1.5, 64);

	// ── Materials (solid fallback) ─────────────────────────────────────────────
	const groundMat = new THREE.MeshStandardMaterial({ color: '#2a5218', roughness: 0.95 });
	const wallMat = new THREE.MeshStandardMaterial({
		color: '#4a4035',
		side: THREE.BackSide,
		roughness: 0.95
	});
	const wallCapMat = new THREE.MeshStandardMaterial({ color: '#302a22', roughness: 0.9 });
	const spikeMat = new THREE.MeshStandardMaterial({
		color: '#1a1a1a',
		roughness: 0.5,
		metalness: 0.5
	});

	// ── Spikes on wall cap ─────────────────────────────────────────────────────
	const SPIKE_COUNT = 64;

	// 3 spike types with different heights
	const spikeGeo1 = new THREE.ConeGeometry(0.25, 1.8, 6);
	const spikeGeo2 = new THREE.ConeGeometry(0.3, 2.2, 6);
	const spikeGeo3 = new THREE.ConeGeometry(0.2, 2.5, 6);

	const spikeMesh1 = new THREE.InstancedMesh(spikeGeo1, spikeMat, 22);
	const spikeMesh2 = new THREE.InstancedMesh(spikeGeo2, spikeMat, 22);
	const spikeMesh3 = new THREE.InstancedMesh(spikeGeo3, spikeMat, 20);

	const _dummy = new THREE.Object3D();
	const WALL_TOP = 2.5;
	const r = ARENA_RADIUS - 0.8;

	// ── Ropes connecting spikes ──────────────────────────────────────────────────
	const ropeGeo = new THREE.TorusGeometry(r, 0.08, 6, 64);
	const ropeMesh1 = new THREE.Mesh(ropeGeo, spikeMat);
	const ropeMesh2 = new THREE.Mesh(ropeGeo, spikeMat);

	// Distribute spikes - all pointing straight up, no rotation
	let idx = 0;
	const types = [
		{ mesh: spikeMesh1, count: 22, height: 1.8 },
		{ mesh: spikeMesh2, count: 22, height: 2.2 },
		{ mesh: spikeMesh3, count: 20, height: 2.5 }
	];

	for (const type of types) {
		for (let i = 0; i < type.count; i++) {
			const angle = (idx / SPIKE_COUNT) * Math.PI * 2;
			_dummy.position.set(Math.cos(angle) * r, WALL_TOP + type.height / 2, Math.sin(angle) * r);
			_dummy.rotation.set(0, 0, 0);
			_dummy.scale.set(1, 1, 1);
			_dummy.updateMatrix();
			type.mesh.setMatrixAt(i, _dummy.matrix);
			idx++;
		}
		type.mesh.instanceMatrix.needsUpdate = true;
	}

	export {
		groundGeo,
		wallGeo,
		wallCapGeo,
		groundMat,
		wallMat,
		wallCapMat,
		spikeMesh1,
		spikeMesh2,
		spikeMesh3,
		ropeMesh1,
		ropeMesh2,
		spikeMat
	};
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import { useTexture } from '@threlte/extras';
	import { RepeatWrapping } from 'three';

	const groundTexture = useTexture('/textures/concrete_floor_damaged_01.webp', {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.repeat.set(8, 8);
			tex.offset.set(0.5, 0.5);
			return tex;
		}
	}).catch(() => null);

	const wallTexture = useTexture('/textures/stone_brick_wall_001.webp', {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.repeat.set(16, 2);
			return tex;
		}
	}).catch(() => null);

	const spikeTexture = useTexture('/textures/rusty_metal_05.webp', {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.repeat.set(4, 1);
			return tex;
		}
	}).catch(() => null);
</script>

{#await groundTexture then tex}
	<T.Mesh
		position={[0, -0.5, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		geometry={groundGeo}
		material={tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }) : groundMat}
	/>
{/await}

{#await wallTexture then tex}
	<T.Mesh
		position={[0, 1.0, 0]}
		geometry={wallGeo}
		material={tex
			? new THREE.MeshStandardMaterial({ map: tex, side: THREE.BackSide, roughness: 0.95 })
			: wallMat}
	/>
{/await}

<T.Mesh
	position={[0, 2.5, 0]}
	rotation={[-Math.PI / 2, 0, 0]}
	geometry={wallCapGeo}
	material={wallCapMat}
/>

{#await spikeTexture then tex}
	{@const mat = tex
		? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.4 })
		: spikeMat}
	<T is={spikeMesh1} material={mat} />
	<T is={spikeMesh2} material={mat} />
	<T is={spikeMesh3} material={mat} />
	<T is={ropeMesh1} material={mat} position={[0, 2.9, 0]} rotation={[Math.PI / 2, 0, 0]} />
	<T is={ropeMesh2} material={mat} position={[0, 3.6, 0]} rotation={[Math.PI / 2, 0, 0]} />
{/await}
