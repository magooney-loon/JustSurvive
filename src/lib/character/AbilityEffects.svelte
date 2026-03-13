<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import {
		healBeam,
		HEAL_BEAM_MS,
		spotterFlash,
		SPOTTER_FLASH_MS
	} from '$lib/stores/abilities.svelte.js';
	import { localPos } from '$lib/stores/movement.svelte.js';

	const [players] = useTable(tables.playerState);

	const _yAxis = new THREE.Vector3(0, 1, 0);
	const BEAM_Y = 1.1;

	let healBeams = $state<
		{ fromX: number; fromZ: number; toX: number; toZ: number; until: number }[]
	>([]);
	let flashEffects = $state<{ x: number; z: number; yaw: number; until: number }[]>([]);

	const healBeamVert = `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`;
	const healBeamFrag = `
		uniform float uOpacity;
		uniform float uTime;
		varying vec2 vUv;
		void main() {
			float beam = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
			float edge = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
			float pulse = 0.85 + 0.15 * sin(uTime * 12.0);
			gl_FragColor = vec4(1.0, 0.53, 0.8, uOpacity * beam * edge * pulse);
		}
	`;
	const healMat = new THREE.ShaderMaterial({
		vertexShader: healBeamVert,
		fragmentShader: healBeamFrag,
		uniforms: { uOpacity: { value: 0.7 }, uTime: { value: 0 } },
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});

	const flashVert = `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`;
	const flashFrag = `
		uniform float uOpacity;
		uniform float uTime;
		varying vec2 vUv;
		void main() {
			float d = length(vUv - 0.5) * 2.0;
			float fade = pow(1.0 - d, 3.0);
			float pulse = 0.9 + 0.1 * sin(uTime * 20.0);
			gl_FragColor = vec4(0.13, 0.87, 1.0, uOpacity * fade * pulse);
		}
	`;
	const flashMat = new THREE.ShaderMaterial({
		vertexShader: flashVert,
		fragmentShader: flashFrag,
		uniforms: { uOpacity: { value: 0.8 }, uTime: { value: 0 } },
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});

	let time = 0;
	useTask((dt) => {
		time += dt;
		healMat.uniforms.uTime.value = time;
		flashMat.uniforms.uTime.value = time;

		const now = Date.now();
		const sessId = lobbyState.currentSessionId;
		if (!sessId) return;

		const allPlayers = $players ?? [];
		const beams: typeof healBeams = [];
		const flashes: typeof flashEffects = [];

		for (const p of allPlayers) {
			if (p.sessionId !== sessId) continue;

			// Heal beam
			if (p.classChoice === 'healer' && (p as any).lastHealAt && (p as any).healTargetIdentity) {
				const lastHeal = (p as any).lastHealAt;
				const healUntil = Number(lastHeal?.microsSinceUnixEpoch ?? 0) / 1000 + HEAL_BEAM_MS;
				if (now < healUntil) {
					const target = allPlayers.find(
						(tp) =>
							tp.sessionId === sessId && tp.playerIdentity.isEqual((p as any).healTargetIdentity)
					);
					if (target) {
						beams.push({
							fromX: Number(p.posX) / 1000,
							fromZ: Number(p.posZ) / 1000,
							toX: Number(target.posX) / 1000,
							toZ: Number(target.posZ) / 1000,
							until: healUntil
						});
					}
				}
			}

			// Spotter flash
			if (p.classChoice === 'spotter' && (p as any).lastFlashAt) {
				const lastFlash = (p as any).lastFlashAt;
				const flashUntil = Number(lastFlash?.microsSinceUnixEpoch ?? 0) / 1000 + SPOTTER_FLASH_MS;
				if (now < flashUntil) {
					flashes.push({
						x: Number(p.posX) / 1000,
						z: Number(p.posZ) / 1000,
						yaw: Number(p.facingAngle) / 1000,
						until: flashUntil
					});
				}
			}
		}

		// Local optimistic effects
		if (healBeam.active && healBeam.until > now) {
			beams.push({
				fromX: localPos.x,
				fromZ: localPos.z,
				toX: healBeam.toX,
				toZ: healBeam.toZ,
				until: healBeam.until
			});
		}
		if (spotterFlash.active && spotterFlash.until > now) {
			flashes.push({
				x: localPos.x,
				z: localPos.z,
				yaw: spotterFlash.yaw,
				until: spotterFlash.until
			});
		}

		healBeams = beams;
		flashEffects = flashes;
	});
</script>

<!-- Heal Beams -->
{#each healBeams as beam}
	{@const t = Math.max(0, (beam.until - Date.now()) / HEAL_BEAM_MS)}
	{#if t > 0}
		{@const dx = beam.toX - beam.fromX}
		{@const dz = beam.toZ - beam.fromZ}
		{@const len = Math.sqrt(dx * dx + dz * dz)}
		{#if len > 0.1}
			{@const nx = dx / len}
			{@const nz = dz / len}
			{@const mx = (beam.fromX + beam.toX) / 2}
			{@const mz = (beam.fromZ + beam.toZ) / 2}
			{@const q = new THREE.Quaternion().setFromUnitVectors(_yAxis, new THREE.Vector3(nx, 0, nz))}
			<T.Mesh
				position={[mx, BEAM_Y, mz]}
				quaternion={[q.x, q.y, q.z, q.w]}
				scale={[0.06, len, 0.06]}
			>
				<T.CylinderGeometry args={[1, 1, 1, 8]} />
				<T.MeshBasicMaterial
					color="#ffffff"
					transparent
					opacity={t * 0.85}
					blending={THREE.AdditiveBlending}
				/>
			</T.Mesh>
			<T.Mesh
				position={[mx, BEAM_Y, mz]}
				quaternion={[q.x, q.y, q.z, q.w]}
				scale={[0.18, len, 0.18]}
			>
				<T.CylinderGeometry args={[1, 1, 1, 8]} />
				<T.MeshBasicMaterial
					color="#ff88cc"
					transparent
					opacity={t * 0.4}
					blending={THREE.AdditiveBlending}
					side={THREE.BackSide}
				/>
			</T.Mesh>
			<T.Mesh position={[beam.toX, BEAM_Y, beam.toZ]} scale={0.25 + (1 - t) * 0.35}>
				<T.SphereGeometry args={[1, 10, 8]} />
				<T.MeshBasicMaterial
					color="#ff88cc"
					transparent
					opacity={t * 0.9}
					blending={THREE.AdditiveBlending}
				/>
			</T.Mesh>
		{/if}
	{/if}
{/each}

<!-- Spotter Flash Cone -->
{#each flashEffects as flash}
	{@const t = Math.max(0, (flash.until - Date.now()) / SPOTTER_FLASH_MS)}
	{#if t > 0}
		{@const coneOffset = 2.5}
		{@const cx = flash.x - Math.sin(flash.yaw) * coneOffset}
		{@const cz = flash.z - Math.cos(flash.yaw) * coneOffset}
		{@const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, -flash.yaw, 0))}
		<T.Mesh position={[cx, 0.8, cz]} quaternion={[q.x, q.y, q.z, q.w]} scale={0.5 + t * 0.15}>
			<T.ConeGeometry args={[2, 4, 12, 1, true]} />
			<T.MeshBasicMaterial
				color="#22ddff"
				transparent
				opacity={t * 0.5}
				blending={THREE.AdditiveBlending}
				side={THREE.DoubleSide}
				depthWrite={false}
			/>
		</T.Mesh>
	{/if}
{/each}
