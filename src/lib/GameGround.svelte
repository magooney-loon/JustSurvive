<script module lang="ts">
	import * as THREE from 'three';
	import { ARENA_RADIUS } from './arenaConfig.js';

	// ── Geometries ───────────────────────────────────────────────────────────────
	const groundGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
	const wallGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 3.0, 64, 1, true);
	const wallCapGeo = new THREE.RingGeometry(ARENA_RADIUS - 1.2, ARENA_RADIUS + 1.5, 64);
	// 3 rings with decreasing opacity toward center — soft gradient blend
	const grimeGeoA = new THREE.RingGeometry(ARENA_RADIUS - 8, ARENA_RADIUS - 0.5, 64);
	const grimeGeoB = new THREE.RingGeometry(ARENA_RADIUS - 18, ARENA_RADIUS - 7, 64);
	const grimeGeoC = new THREE.RingGeometry(ARENA_RADIUS - 30, ARENA_RADIUS - 17, 64);

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
	const grimeMatA = new THREE.MeshBasicMaterial({
		color: '#0d0905',
		transparent: true,
		opacity: 0.54,
		depthWrite: false
	});
	const grimeMatB = new THREE.MeshBasicMaterial({
		color: '#0d0905',
		transparent: true,
		opacity: 0.28,
		depthWrite: false
	});
	const grimeMatC = new THREE.MeshBasicMaterial({
		color: '#0d0905',
		transparent: true,
		opacity: 0.1,
		depthWrite: false
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

	// ── Rubble ────────────────────────────────────────────────────────────────
	function seededRand(n: number): number {
		const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
		return x - Math.floor(x);
	}

	const rubbleMat = new THREE.MeshLambertMaterial({ color: '#352e25' });
	const rubbleBoxGeo = new THREE.BoxGeometry(1, 1, 1);
	const rubbleSphereGeo = new THREE.SphereGeometry(0.5, 5, 4);
	const BOX_COUNT = 60;
	const SPHERE_COUNT = 45;
	const rubbleBoxMesh = new THREE.InstancedMesh(rubbleBoxGeo, rubbleMat, BOX_COUNT);
	const rubbleSphereMesh = new THREE.InstancedMesh(rubbleSphereGeo, rubbleMat, SPHERE_COUNT);

	// Spread across whole arena — denser near wall, sparser toward center
	let si = 0;
	for (let i = 0; i < BOX_COUNT; i++) {
		const angle = seededRand(si++) * Math.PI * 2;
		// Bias toward outer ring: sqrt gives uniform area distribution, then skew outward
		const t = Math.pow(seededRand(si++), 0.55);
		const rad = 4 + t * (ARENA_RADIUS - 5);
		// Pieces near wall are bigger; pieces near center are smaller pebbles
		const sizeMult = 0.4 + t * 0.6;
		const sx = (0.1 + seededRand(si++) * 0.38) * sizeMult;
		const sy = (0.06 + seededRand(si++) * 0.16) * sizeMult;
		const sz = (0.1 + seededRand(si++) * 0.38) * sizeMult;
		const ry = seededRand(si++) * Math.PI * 2;
		const rx = seededRand(si++) * 0.55;
		_dummy.position.set(Math.cos(angle) * rad, -0.5 + sy / 2, Math.sin(angle) * rad);
		_dummy.rotation.set(rx, ry, 0);
		_dummy.scale.set(sx, sy, sz);
		_dummy.updateMatrix();
		rubbleBoxMesh.setMatrixAt(i, _dummy.matrix);
	}
	rubbleBoxMesh.instanceMatrix.needsUpdate = true;

	for (let i = 0; i < SPHERE_COUNT; i++) {
		const angle = seededRand(si++) * Math.PI * 2;
		const t = Math.pow(seededRand(si++), 0.55);
		const rad = 4 + t * (ARENA_RADIUS - 5);
		const sizeMult = 0.35 + t * 0.65;
		const sc = (0.08 + seededRand(si++) * 0.24) * sizeMult;
		_dummy.position.set(Math.cos(angle) * rad, -0.5 + sc * 0.35, Math.sin(angle) * rad);
		_dummy.rotation.set(0, 0, 0);
		_dummy.scale.set(sc, sc * 0.65, sc);
		_dummy.updateMatrix();
		rubbleSphereMesh.setMatrixAt(i, _dummy.matrix);
	}
	rubbleSphereMesh.instanceMatrix.needsUpdate = true;

	// ── Torches ───────────────────────────────────────────────────────────────
	const TORCH_COUNT = 6;
	const torchPostGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.8, 5);
	const torchBowlGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.2, 6);
	const torchFlameGeo = new THREE.ConeGeometry(0.09, 0.32, 6);
	const torchGlowGeo = new THREE.SphereGeometry(0.13, 6, 5);
	const torchMat = new THREE.MeshLambertMaterial({ color: '#1e1208' });
	const torchFlameMat = new THREE.MeshBasicMaterial({ color: '#ff5500' });
	const torchGlowMat = new THREE.MeshBasicMaterial({
		color: '#ffaa22',
		transparent: true,
		opacity: 0.5,
		depthWrite: false
	});
	const torchPositions = Array.from({ length: TORCH_COUNT }, (_, i) => ({
		x: Math.cos((i / TORCH_COUNT) * Math.PI * 2) * (ARENA_RADIUS - 1.5),
		z: Math.sin((i / TORCH_COUNT) * Math.PI * 2) * (ARENA_RADIUS - 1.5)
	}));

	export {
		groundGeo,
		wallGeo,
		wallCapGeo,
		grimeGeoA,
		grimeGeoB,
		grimeGeoC,
		groundMat,
		wallMat,
		wallCapMat,
		grimeMatA,
		grimeMatB,
		grimeMatC,
		spikeMesh1,
		spikeMesh2,
		spikeMesh3,
		ropeMesh1,
		ropeMesh2,
		spikeMat,
		rubbleBoxMesh,
		rubbleSphereMesh,
		torchPositions,
		torchPostGeo,
		torchBowlGeo,
		torchFlameGeo,
		torchGlowGeo,
		torchMat,
		torchFlameMat,
		torchGlowMat
	};
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useTexture } from '@threlte/extras';
	import { RepeatWrapping } from 'three';

	const base = import.meta.env.BASE_URL;

	const groundTexture = useTexture(`${base}textures/concrete_floor_damaged_01.webp`, {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.repeat.set(8, 8);
			tex.offset.set(0.5, 0.5);
			return tex;
		}
	}).catch(() => null);

	const wallTexture = useTexture(`${base}textures/stone_brick_wall_001.webp`, {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.repeat.set(16, 2);
			return tex;
		}
	}).catch(() => null);

	const spikeTexture = useTexture(`${base}textures/rusty_metal_05.webp`, {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.repeat.set(4, 1);
			return tex;
		}
	}).catch(() => null);

	let clock = $state(0);
	useTask((dt) => {
		clock += dt;
	});
</script>

{#await groundTexture then tex}
	<T.Mesh
		position={[0, -0.5, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		geometry={groundGeo}
		material={tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }) : groundMat}
	/>
{/await}

<!-- Dirt / grime — 3 concentric rings fading inward for soft gradient -->
<T.Mesh
	position={[0, -0.3, 0]}
	rotation={[-Math.PI / 2, 0, 0]}
	geometry={grimeGeoA}
	material={grimeMatA}
/>
<T.Mesh
	position={[0, -0.3, 0]}
	rotation={[-Math.PI / 2, 0, 0]}
	geometry={grimeGeoB}
	material={grimeMatB}
/>
<T.Mesh
	position={[0, -0.3, 0]}
	rotation={[-Math.PI / 2, 0, 0]}
	geometry={grimeGeoC}
	material={grimeMatC}
/>

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

<!-- Rubble scattered near walls (2 draw calls total) -->
<T is={rubbleBoxMesh} />
<T is={rubbleSphereMesh} />

<!-- Torches: 6 evenly spaced on inner wall face with flickering flame + point light -->
{#each torchPositions as torch, i}
	{@const fs =
		0.86 + Math.sin(clock * 7.3 + i * 1.4) * 0.12 + Math.sin(clock * 13.7 + i * 0.8) * 0.05}
	{@const li =
		1.3 + Math.sin(clock * 5.1 + i * 1.2) * 0.4 + Math.sin(clock * 11.3 + i * 2.1) * 0.15}
	<T.Group position={[torch.x, 0, torch.z]}>
		<T.Mesh position={[0, 0.4, 0]} geometry={torchPostGeo} material={torchMat} />
		<T.Mesh position={[0, 1.4, 0]} geometry={torchBowlGeo} material={torchMat} />
		<T.Mesh
			position={[0, 1.66, 0]}
			scale={[fs, fs, fs]}
			geometry={torchFlameGeo}
			material={torchFlameMat}
		/>
		<T.Mesh
			position={[0, 1.6, 0]}
			scale={[fs * 1.5, fs, fs * 1.5]}
			geometry={torchGlowGeo}
			material={torchGlowMat}
		/>
		<T.PointLight
			color="#ff8833"
			intensity={li * 2.5}
			distance={15}
			decay={2}
			position={[0, 1.8, 0]}
		/>
	</T.Group>
{/each}
