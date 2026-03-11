<script module lang="ts">
	import * as THREE from 'three';
	import { ARENA_RADIUS } from './arenaConfig.js';

	// ── Ground ────────────────────────────────────────────────────────────────
	// Circular plane with a radial vertex-color gradient (bright center → dark edge)
	const groundGeo = (() => {
		const geo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
		const pos = geo.attributes.position as THREE.BufferAttribute;
		const colors = new Float32Array(pos.count * 3);
		const inner = new THREE.Color('#2a5218');
		const outer = new THREE.Color('#162c0a');
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i), y = pos.getY(i);
			const t = Math.min(1, (x * x + y * y) / (ARENA_RADIUS * ARENA_RADIUS));
			const c = inner.clone().lerp(outer, t);
			colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
		}
		geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		return geo;
	})();
	const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

	// ── Dirt ring near the treeline ───────────────────────────────────────────
	const dirtGeo = new THREE.RingGeometry(ARENA_RADIUS - 8, ARENA_RADIUS - 0.5, 64);
	const dirtMat = new THREE.MeshStandardMaterial({
		color: '#2e1a08',
		transparent: true,
		opacity: 0.55,
		roughness: 1,
		depthWrite: false
	});

	// ── Circular stone wall ───────────────────────────────────────────────────
	// Open cylinder, BackSide so the inside face is rendered for players inside
	const wallGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 3.0, 64, 1, true);
	const wallMat = new THREE.MeshStandardMaterial({
		color: '#4a4035',
		side: THREE.BackSide,
		roughness: 0.95
	});

	// Darker base band of the wall
	const wallBaseGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 0.7, 64, 1, true);
	const wallBaseMat = new THREE.MeshStandardMaterial({
		color: '#2c2420',
		side: THREE.BackSide,
		roughness: 1
	});

	// Wall top cap (ring facing down into arena)
	const wallCapGeo = new THREE.RingGeometry(ARENA_RADIUS - 1.2, ARENA_RADIUS + 1.5, 64);
	const wallCapMat = new THREE.MeshStandardMaterial({ color: '#302a22', roughness: 0.9 });

	// ── Tree palisade ─────────────────────────────────────────────────────────
	// Pre-built InstancedMesh — created once, never updated
	const TREE_COUNT = 48;
	const treeGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 6);
	const treeMat = new THREE.MeshStandardMaterial({ color: '#2c1a08', roughness: 1 });
	const treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, TREE_COUNT);

	const _dummy = new THREE.Object3D();
	for (let i = 0; i < TREE_COUNT; i++) {
		const angle = (i / TREE_COUNT) * Math.PI * 2;
		const h = 3.2 + Math.abs(Math.sin(i * 7.3)) * 2.8; // height 3.2–6.0
		const r = ARENA_RADIUS + 0.6;
		_dummy.position.set(Math.cos(angle) * r, -0.5 + h * 0.5, Math.sin(angle) * r);
		_dummy.scale.set(1, h, 1);
		_dummy.rotation.set(
			Math.sin(i * 2.31) * 0.06,   // slight forward lean
			angle + Math.sin(i * 5.7) * 0.4, // face outward + variation
			Math.sin(i * 3.71) * 0.06    // slight sideways lean
		);
		_dummy.updateMatrix();
		treeMesh.setMatrixAt(i, _dummy.matrix);
	}
	treeMesh.instanceMatrix.needsUpdate = true;
</script>

<script lang="ts">
	import { T } from '@threlte/core';
</script>

<!-- Circular ground with radial gradient -->
<T.Mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={groundGeo} material={groundMat} />

<!-- Worn dirt ring near the treeline -->
<T.Mesh position={[0, -0.49, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={dirtGeo} material={dirtMat} />

<!-- Stone wall body (ground y=-0.5 → top y=2.5, center y=1.0) -->
<T.Mesh position={[0, 1.0, 0]} geometry={wallGeo} material={wallMat} />

<!-- Darker base band (ground level) -->
<T.Mesh position={[0, -0.15, 0]} geometry={wallBaseGeo} material={wallBaseMat} />

<!-- Wall top cap -->
<T.Mesh position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={wallCapGeo} material={wallCapMat} />

<!-- Tree palisade (static instanced mesh, no per-frame cost) -->
<T is={treeMesh} />
