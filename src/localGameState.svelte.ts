import { ARENA_PLAY_RADIUS } from './lib/arenaConfig.js';

export type InputState = {
	forward: boolean;
	back: boolean;
	left: boolean;
	right: boolean;
	sprint: boolean;
};

const input = $state<InputState>({
	forward: false,
	back: false,
	left: false,
	right: false,
	sprint: false
});
const localPos = $state({ x: 0, y: 0, z: 0 });
const localVelocity = $state({ x: 0, z: 0 });
export const localAim = $state({ x: 0, z: 0 });
export const fpsCamera = $state({ yaw: 0, pitch: 0 });
export const cameraFollow = $state({
	active: false,
	x: 0,
	y: 0,
	z: 0,
	aimX: 0,
	aimZ: 0
});

export { input, localPos, localVelocity };

// Shared ability state — written by AbilityInput, read by GameHud
export const abilityState = $state({
	markCooldownUntil: 0, // ms timestamp (spotter mark, 5s)
	suppressHits: 0, // gunner suppress counter (resets on enemy change)
	lastSuppressedEnemyId: null as bigint | null,
	bashCooldownUntil: 0, // ms timestamp (tank bash, 1.5s)
	healCooldownUntil: 0, // ms timestamp (healer heal shot, 2s)
	braceCooldownUntil: 0 // ms timestamp (tank brace, 1s between activations)
});

// Heal beam — written by AbilityInput, read by HealBeam (3D scene)
export const healBeam = $state({ active: false, toX: 0, toZ: 0, until: 0 });
export const HEAL_BEAM_MS = 350;

// Muzzle flash — written by AbilityInput (gunner shot), read by PlayerEntity
// Uses optimistic local state to avoid latency issues in production
export const shotFlash = $state({ until: 0 });
export const SHOT_FLASH_MS = 200;

// Local player HP ratio [0..1] — written by GameStage, read by Renderer
export const localHealthState = $state({ ratio: 1 });

// Dev override — set by SkyExtension in studio mode, null = use session phase
export const devSky = $state({ forcedPhase: null as string | null });

// Sky state — written by GameStage (lerped per phase), read by Skybox
export const skyState = $state({
	elevation: 3,
	azimuth: 260,
	turbidity: 12,
	rayleigh: 2.5,
	mieCoefficient: 0.007,
	mieDirectionalG: 0.8,
	ambientIntensity: 0.6,
	sunIntensity: 1.0,
	sunR: 1.0,
	sunG: 0.75,
	sunB: 0.45,
	stormIntensity: 0 // 0 = clear, 1 = full storm — drives rain audio + lightning
});

export function resetLocalState() {
	input.forward = false;
	input.back = false;
	input.left = false;
	input.right = false;
	input.sprint = false;
	localPos.x = 0;
	localPos.y = 0;
	localPos.z = 0;
	localVelocity.x = 0;
	localVelocity.z = 0;
	cameraFollow.active = false;
	cameraFollow.x = 0;
	cameraFollow.y = 0;
	cameraFollow.z = 0;
	cameraFollow.aimX = 0;
	cameraFollow.aimZ = 0;
	fpsCamera.yaw = 0;
	fpsCamera.pitch = 0;
	abilityState.markCooldownUntil = 0;
	abilityState.suppressHits = 0;
	abilityState.lastSuppressedEnemyId = null;
	abilityState.bashCooldownUntil = 0;
	abilityState.healCooldownUntil = 0;
	abilityState.braceCooldownUntil = 0;
	shotFlash.until = 0;
	healBeam.active = false;
	healBeam.toX = 0;
	healBeam.toZ = 0;
	healBeam.until = 0;
}

const CLASS_SPEED: Record<string, { walk: number; sprint: number }> = {
	spotter: { walk: 5, sprint: 9 },
	gunner: { walk: 4.5, sprint: 7.5 },
	tank: { walk: 2.5, sprint: 3.5 },
	healer: { walk: 5, sprint: 8.5 }
};

export function updateLocalMovement(
	dt: number,
	playerClass: string,
	hasStamina: boolean,
	cameraYaw: number,
	isBracing: boolean = false
) {
	if (isBracing) {
		localVelocity.x = 0;
		localVelocity.z = 0;
		return;
	}
	const speeds = CLASS_SPEED[playerClass] ?? CLASS_SPEED.gunner;
	const isSprinting = input.sprint && hasStamina;
	const speed = isSprinting ? speeds.sprint : speeds.walk;

	let right = 0;
	let forward = 0;
	if (input.forward) forward += 1;
	if (input.back) forward -= 1;
	if (input.left) right -= 1;
	if (input.right) right += 1;

	const len = Math.sqrt(right * right + forward * forward);
	if (len > 0) {
		right /= len;
		forward /= len;
	}

	// Slow down backwards (0.65x) and strafing (0.75x); forward stays at 1x
	// forward > 0 = moving forward, forward < 0 = moving back
	// Blend: backwardness = max(0, -forward), strafe = |right| when not fully forward
	const backwardness = Math.max(0, -forward); // 0..1
	const strafeness = Math.abs(right) * (1 - Math.abs(forward)); // 0..1, peaks at pure strafe
	const dirMultiplier = 1 - backwardness * 0.35 - strafeness * 0.25;

	// Move relative to camera facing (local forward is -Z)
	const sin = Math.sin(cameraYaw);
	const cos = Math.cos(cameraYaw);
	const forwardX = sin;
	const forwardZ = cos;
	const rightX = -cos;
	const rightZ = sin;
	const worldX = right * rightX + forward * forwardX;
	const worldZ = right * rightZ + forward * forwardZ;

	const effectiveSpeed = speed * dirMultiplier;
	localPos.x += worldX * effectiveSpeed * dt;
	localPos.z += worldZ * effectiveSpeed * dt;
	localVelocity.x = worldX * effectiveSpeed;
	localVelocity.z = worldZ * effectiveSpeed;

	// Clamp to arena boundary
	const rSq = localPos.x * localPos.x + localPos.z * localPos.z;
	if (rSq > ARENA_PLAY_RADIUS * ARENA_PLAY_RADIUS) {
		const r = Math.sqrt(rSq);
		localPos.x = (localPos.x / r) * ARENA_PLAY_RADIUS;
		localPos.z = (localPos.z / r) * ARENA_PLAY_RADIUS;
		// Cancel outward velocity component so the player doesn't slide along the wall
		const nx = localPos.x / ARENA_PLAY_RADIUS;
		const nz = localPos.z / ARENA_PLAY_RADIUS;
		const dot = localVelocity.x * nx + localVelocity.z * nz;
		if (dot > 0) {
			localVelocity.x -= dot * nx;
			localVelocity.z -= dot * nz;
		}
	}
}
