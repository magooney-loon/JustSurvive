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

	// ── Terrain Ring (outside arena) ─────────────────────────────────────────
	// Simple cliff-like ring that drops off from arena wall
	const TERRAIN_INNER = ARENA_RADIUS + 1;
	const TERRAIN_OUTER = ARENA_RADIUS + 25;
	const terrainGeo = new THREE.RingGeometry(TERRAIN_INNER, TERRAIN_OUTER, 32, 4);

	// Simple slope - high near arena, drops off
	const pos = terrainGeo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const dist = Math.sqrt(x * x + y * y);
		const t = (dist - TERRAIN_INNER) / (TERRAIN_OUTER - TERRAIN_INNER);
		// Linear slope from 2.5 (wall top) down to -5
		const height = 2.5 - t * 7.5;
		pos.setZ(i, height);
	}
	terrainGeo.computeVertexNormals();

	// ── Materials (solid fallback) ─────────────────────────────────────────────
	const groundMat = new THREE.MeshStandardMaterial({ color: '#2a5218', roughness: 0.95 });
	const wallMat = new THREE.MeshStandardMaterial({
		color: '#4a4035',
		side: THREE.BackSide,
		roughness: 0.95
	});
	const wallCapMat = new THREE.MeshStandardMaterial({ color: '#302a22', roughness: 0.9 });
	const terrainMat = new THREE.MeshStandardMaterial({
		color: '#1a1a10',
		roughness: 1.0,
		flatShading: true,
		side: THREE.FrontSide
	});
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
	// Post: slightly taller, thicker base — looks like an iron stake
	const torchPostGeo = new THREE.CylinderGeometry(0.035, 0.06, 2.0, 6);
	// Bowl: wider cup shape, two-part basket
	const torchBowlGeo = new THREE.CylinderGeometry(0.14, 0.07, 0.22, 7);
	const torchBowlRimGeo = new THREE.TorusGeometry(0.13, 0.025, 5, 10);
	// Flames — outer wide orange + inner narrow bright yellow
	const torchFlameGeo = new THREE.ConeGeometry(0.11, 0.38, 7);
	const torchFlameInnerGeo = new THREE.ConeGeometry(0.055, 0.28, 6);
	// Glows — tight bright core + wide faint halo
	const torchGlowGeo = new THREE.SphereGeometry(0.15, 7, 6);
	const torchHaloGeo = new THREE.SphereGeometry(0.5, 7, 6);
	// Fallback (no-texture) material for post/bowl
	const torchMat = new THREE.MeshStandardMaterial({
		color: '#2a1a0a',
		roughness: 0.85,
		metalness: 0.3
	});
	const torchFlameMat = new THREE.MeshBasicMaterial({ color: '#ff4400' });
	const torchFlameInnerMat = new THREE.MeshBasicMaterial({ color: '#ffdd44' });
	const torchGlowMat = new THREE.MeshBasicMaterial({
		color: '#ffaa44',
		transparent: true,
		opacity: 0.9,
		depthWrite: false
	});
	const torchHaloMat = new THREE.MeshBasicMaterial({
		color: '#ff6600',
		transparent: true,
		opacity: 0.02,
		depthWrite: false
	});

	// ── Portals (spawn gates on arena wall) ──────────────────────────────────
	const SPAWN_POINT_COUNT = 8;
	const PORTAL_RADIUS = ARENA_RADIUS - 1.5; // same as wall torch ring
	export const portalPositions = Array.from({ length: SPAWN_POINT_COUNT }, (_, i) => {
		// +0.5 offset so portals sit between wall torches (avoids angle overlap with 12-torch ring)
		const angle = ((i + 0.5) / SPAWN_POINT_COUNT) * Math.PI * 2;
		return {
			x: Math.cos(angle) * PORTAL_RADIUS,
			z: Math.sin(angle) * PORTAL_RADIUS,
			ry: Math.PI / 2 - angle // correct inward-facing rotation for a Y-axis rotated object
		};
	});

	// Portal geometries
	const portalRingGeo = new THREE.TorusGeometry(1.0, 0.22, 8, 22);
	const portalVoidGeo = new THREE.CircleGeometry(0.88, 18);
	const portalSwirl1Geo = new THREE.TorusGeometry(0.6, 0.055, 6, 16);
	const portalSwirl2Geo = new THREE.TorusGeometry(0.4, 0.04, 5, 12);
	const portalGlowGeo = new THREE.SphereGeometry(0.7, 8, 6);

	// Portal materials
	const portalRingMat = new THREE.MeshStandardMaterial({
		color: '#1a1020',
		roughness: 0.9,
		metalness: 0.2
	});
	const portalVoidMat = new THREE.MeshBasicMaterial({
		color: '#0a0018',
		transparent: true,
		opacity: 0.92,
		depthWrite: false
	});
	const portalSwirl1Mat = new THREE.MeshBasicMaterial({
		color: '#9922ff',
		transparent: true,
		opacity: 0.75,
		depthWrite: false
	});
	const portalSwirl2Mat = new THREE.MeshBasicMaterial({
		color: '#cc44ff',
		transparent: true,
		opacity: 0.55,
		depthWrite: false
	});
	const portalGlowMat = new THREE.MeshBasicMaterial({
		color: '#6600cc',
		transparent: true,
		opacity: 0.1,
		depthWrite: false
	});

	// Wall ring (12), mid ring (7), inner ring (4)
	export const TORCH_RINGS = [
		{ count: 12, radius: ARENA_RADIUS - 1.5 },
		{ count: 7, radius: 33 },
		{ count: 4, radius: 18 }
	] as const;

	const torchPositions = TORCH_RINGS.flatMap(({ count, radius }) =>
		Array.from({ length: count }, (_, i) => ({
			x: Math.cos((i / count) * Math.PI * 2) * radius,
			z: Math.sin((i / count) * Math.PI * 2) * radius
		}))
	);

	// Pre-create all torch groups for caching (ready before first render)
	const torchGroups: THREE.Group[] = torchPositions.map((torch) => {
		const group = new THREE.Group();
		group.position.set(torch.x, 0, torch.z);

		const post = new THREE.Mesh(torchPostGeo, torchMat);
		post.position.set(0, 0.5, 0);
		group.add(post);

		const bowl = new THREE.Mesh(torchBowlGeo, torchMat);
		bowl.position.set(0, 1.5, 0);
		group.add(bowl);

		const rim = new THREE.Mesh(torchBowlRimGeo, torchMat);
		rim.position.set(0, 1.6, 0);
		rim.rotation.set(Math.PI / 2, 0, 0);
		group.add(rim);

		const flame = new THREE.Mesh(torchFlameGeo, torchFlameMat);
		flame.position.set(0, 1.74, 0);
		flame.name = 'flame';
		group.add(flame);

		const flameInner = new THREE.Mesh(torchFlameInnerGeo, torchFlameInnerMat);
		flameInner.position.set(0, 1.76, 0);
		flameInner.name = 'flameInner';
		group.add(flameInner);

		const glow = new THREE.Mesh(torchGlowGeo, torchGlowMat);
		glow.position.set(0, 1.64, 0);
		glow.name = 'glow';
		group.add(glow);

		const halo = new THREE.Mesh(torchHaloGeo, torchHaloMat);
		halo.position.set(0, 1.7, 0);
		halo.name = 'halo';
		group.add(halo);

		const light = new THREE.PointLight('#ff7722', 18, 28, 2);
		light.position.set(0, 1.9, 0);
		light.name = 'light';
		group.add(light);

		return group;
	});

	// Pre-create all portal groups for caching
	const portalGroups: THREE.Group[] = portalPositions.map((portal) => {
		const group = new THREE.Group();
		group.position.set(portal.x, 1.2, portal.z);
		group.rotation.set(0, portal.ry, 0);

		const ring = new THREE.Mesh(portalRingGeo, portalRingMat);
		group.add(ring);

		const voidMesh = new THREE.Mesh(portalVoidGeo, portalVoidMat);
		voidMesh.position.set(0, 0, 0.01);
		group.add(voidMesh);

		const swirl1 = new THREE.Mesh(portalSwirl1Geo, portalSwirl1Mat);
		swirl1.name = 'swirl1';
		group.add(swirl1);

		const swirl2 = new THREE.Mesh(portalSwirl2Geo, portalSwirl2Mat);
		swirl2.name = 'swirl2';
		group.add(swirl2);

		const glow = new THREE.Mesh(portalGlowGeo, portalGlowMat);
		glow.name = 'glow';
		group.add(glow);

		const light = new THREE.PointLight('#8833ff', 2.5, 12, 2);
		light.position.set(0, 0, -1);
		light.name = 'light';
		group.add(light);

		return group;
	});

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
		terrainGeo,
		terrainMat,
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
		torchGroups,
		torchPostGeo,
		torchBowlGeo,
		torchBowlRimGeo,
		torchFlameGeo,
		torchFlameInnerGeo,
		torchGlowGeo,
		torchHaloGeo,
		torchMat,
		torchFlameMat,
		torchFlameInnerMat,
		torchGlowMat,
		torchHaloMat,
		portalGroups
	};
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useTexture, PositionalAudio } from '@threlte/extras';
	import { RepeatWrapping } from 'three';
	import { settingsState } from '$root/settings.svelte.js';

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

	const torchVolume = $derived(
		settingsState.audio.effectsEnabled ? settingsState.audio.effectsVolume : 0
	);
</script>

<!-- Terrain Ring (outside arena) - cliff dropping off from wall -->
<T.Mesh
	geometry={terrainGeo}
	material={terrainMat}
	position={[0, 0, 0]}
	rotation={[-Math.PI / 2, 0, 0]}
/>

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

<!-- Torches: 3 rings (12 wall / 7 mid / 4 inner) — use cached groups -->
{#await spikeTexture then tex}
	{@const metalMat = tex
		? new THREE.MeshStandardMaterial({
				map: tex,
				roughness: 0.82,
				metalness: 0.45,
				color: '#3a2510'
			})
		: torchMat}
	{#each torchGroups as group, i}
		{@const fs =
			0.88 + Math.sin(clock * 6.8 + i * 1.4) * 0.1 + Math.sin(clock * 14.2 + i * 0.9) * 0.04}
		{@const fi =
			0.82 + Math.sin(clock * 11.1 + i * 2.3) * 0.14 + Math.sin(clock * 19.7 + i * 1.1) * 0.06}
		{@const li =
			1.2 + Math.sin(clock * 5.1 + i * 1.2) * 0.45 + Math.sin(clock * 10.7 + i * 2.1) * 0.18}
		{@const sx = Math.sin(clock * 3.7 + i * 2.1) * 0.03}
		{@const sz = Math.cos(clock * 4.3 + i * 1.7) * 0.03}
		{@const post = group.children[0]}
		{@const bowl = group.children[1]}
		{@const rim = group.children[2]}
		{@const flame = group.children[3]}
		{@const flameInner = group.children[4]}
		{@const glow = group.children[5]}
		{@const halo = group.children[6]}
		{@const light = group.children[7]}
		{#if post instanceof THREE.Mesh}{(post.material = metalMat)}{/if}
		{#if bowl instanceof THREE.Mesh}{(bowl.material = metalMat)}{/if}
		{#if rim instanceof THREE.Mesh}{(rim.material = metalMat)}{/if}
		{#if flame}
			{@const m = flame}
			{m.position.set(sx, 1.74, sz)}
			{m.scale.set(fs * 1.05, fs, fs * 1.05)}
		{/if}
		{#if flameInner}
			{@const m = flameInner}
			{m.position.set(sx * 0.5, 1.76, sz * 0.5)}
			{m.scale.set(fi * 0.5, fi * 1.15, fi * 0.5)}
		{/if}
		{#if glow}
			{@const m = glow}
			{m.scale.set(fs * 1.6, fs * 0.9, fs * 1.6)}
		{/if}
		{#if halo}
			{@const m = halo}
			{m.scale.set(fs * 0.8, fs * 0.5, fs * 0.8)}
		{/if}
		{#if light}
			{@const l = light as THREE.PointLight}
			{(l.intensity = li * 5)}
		{/if}
		<T is={group} />
	{/each}
{/await}

<!-- Torch audio: looping positional fire sound at each torch position -->
{#each torchPositions as torch}
	<T.Group position={[torch.x, 1.8, torch.z]}>
		<PositionalAudio
			src="{base}sounds/map/torch.mp3"
			loop
			autoplay
			volume={torchVolume}
			refDistance={4}
			rolloffFactor={2}
			maxDistance={22}
		/>
	</T.Group>
{/each}

<!-- Spawn portals: 8 gates evenly on the arena wall, facing inward -->
{#each portalGroups as group, i}
	{@const swirl1 = clock * 1.1 + i * 0.9}
	{@const swirl2 = -(clock * 0.75 + i * 1.3)}
	{@const pulse = 0.9 + Math.sin(clock * 1.8 + i * 2.1) * 0.1}
	{@const flicker = 0.85 + Math.sin(clock * 3.2 + i * 1.7) * 0.12}
	{@const swirl1Mesh = group.children[2]}
	{@const swirl2Mesh = group.children[3]}
	{@const glowMesh = group.children[4]}
	{@const light = group.children[5] as THREE.PointLight}
	{#if swirl1Mesh instanceof THREE.Mesh}
		{swirl1Mesh.rotation.set(swirl1, 0, swirl1 * 0.4)}
		{swirl1Mesh.scale.set(pulse, pulse, 1)}
	{/if}
	{#if swirl2Mesh instanceof THREE.Mesh}
		{swirl2Mesh.rotation.set(swirl2 * 0.6, swirl2, 0)}
		{swirl2Mesh.scale.set(flicker, flicker, 1)}
	{/if}
	{#if glowMesh instanceof THREE.Mesh}
		{glowMesh.scale.set(pulse * 1.3, pulse * 1.3, pulse * 0.5)}
	{/if}
	{#if light instanceof THREE.PointLight}
		{(light.intensity = flicker * 2.5)}
	{/if}
	<T is={group} />
{/each}
