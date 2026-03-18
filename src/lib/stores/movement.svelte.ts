import { ARENA_PLAY_RADIUS, TORCH_POSITIONS, TORCH_COLLISION_R } from '../map/arenaConfig.js';

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
export const tpsCamera = $state({ yaw: 0 });
export const cameraFollow = $state({
	active: false,
	x: 0,
	y: 0,
	z: 0,
	aimX: 0,
	aimZ: 0
});

export { input, localPos, localVelocity };

export const bossShake = $state({ intensity: 0 });
export const spectateState = $state({ index: 0 });

export function resetMovement() {
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
	tpsCamera.yaw = 0;
	bossShake.intensity = 0;
	spectateState.index = 0;
}

export function updateLocalMovement(
	dt: number,
	walkSpeed: number,
	sprintSpeed: number,
	hasStamina: boolean,
	cameraYaw: number,
	isBracing: boolean = false,
	isStunned: boolean = false,
	slowMultiplier: number = 1.0,
	chargeYaw: number = 0
) {
	if (isStunned) {
		localVelocity.x = 0;
		localVelocity.z = 0;
		return;
	}

	if (isBracing) {
		// Tank charge: force movement in locked charge direction at high speed
		const CHARGE_SPEED = 14; // world units/s
		const sin = Math.sin(chargeYaw);
		const cos = Math.cos(chargeYaw);
		localPos.x += sin * CHARGE_SPEED * dt;
		localPos.z += cos * CHARGE_SPEED * dt;
		localVelocity.x = sin * CHARGE_SPEED;
		localVelocity.z = cos * CHARGE_SPEED;
		// Arena clamp
		const rSq = localPos.x * localPos.x + localPos.z * localPos.z;
		if (rSq > ARENA_PLAY_RADIUS * ARENA_PLAY_RADIUS) {
			const r = Math.sqrt(rSq);
			localPos.x = (localPos.x / r) * ARENA_PLAY_RADIUS;
			localPos.z = (localPos.z / r) * ARENA_PLAY_RADIUS;
		}
		return;
	}
	const speeds = { walk: walkSpeed, sprint: sprintSpeed };
	const isSprinting = input.sprint && hasStamina;
	const speed = (isSprinting ? speeds.sprint : speeds.walk) * slowMultiplier;

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
		const nx = localPos.x / ARENA_PLAY_RADIUS;
		const nz = localPos.z / ARENA_PLAY_RADIUS;
		const dot = localVelocity.x * nx + localVelocity.z * nz;
		if (dot > 0) {
			localVelocity.x -= dot * nx;
			localVelocity.z -= dot * nz;
		}
	}

	// Push player out of torch collision cylinders (slide along surface)
	for (const torch of TORCH_POSITIONS) {
		const tdx = localPos.x - torch.x;
		const tdz = localPos.z - torch.z;
		const distSq = tdx * tdx + tdz * tdz;
		if (distSq < TORCH_COLLISION_R * TORCH_COLLISION_R) {
			const dist = Math.sqrt(distSq) || 0.001;
			localPos.x = torch.x + (tdx / dist) * TORCH_COLLISION_R;
			localPos.z = torch.z + (tdz / dist) * TORCH_COLLISION_R;
			// Cancel inward velocity so player slides around the torch
			const nx = tdx / dist;
			const nz = tdz / dist;
			const dot = localVelocity.x * nx + localVelocity.z * nz;
			if (dot < 0) {
				localVelocity.x -= dot * nx;
				localVelocity.z -= dot * nz;
			}
		}
	}
}
