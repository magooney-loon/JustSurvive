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

export { input, localPos, localVelocity };

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
	cameraYaw: number
) {
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

	// Move relative to camera facing (local forward is -Z)
	const sin = Math.sin(cameraYaw);
	const cos = Math.cos(cameraYaw);
	const forwardX = sin;
	const forwardZ = cos;
	const rightX = -cos;
	const rightZ = sin;
	const worldX = right * rightX + forward * forwardX;
	const worldZ = right * rightZ + forward * forwardZ;

	localPos.x += worldX * speed * dt;
	localPos.z += worldZ * speed * dt;
	localVelocity.x = worldX * speed;
	localVelocity.z = worldZ * speed;
}
