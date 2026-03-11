export type InputState = {
	forward: boolean;
	back: boolean;
	left: boolean;
	right: boolean;
	sprint: boolean;
};

const input = $state<InputState>({ forward: false, back: false, left: false, right: false, sprint: false });
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
	gunner:  { walk: 4.5, sprint: 7.5 },
	tank:    { walk: 2.5, sprint: 3.5 },
	healer:  { walk: 5, sprint: 8.5 },
};

export function updateLocalMovement(dt: number, playerClass: string, hasStamina: boolean) {
	const speeds = CLASS_SPEED[playerClass] ?? CLASS_SPEED.gunner;
	const isSprinting = input.sprint && hasStamina;
	const speed = isSprinting ? speeds.sprint : speeds.walk;

	let vx = 0, vz = 0;
	if (input.forward) vz -= 1;
	if (input.back)    vz += 1;
	if (input.left)    vx -= 1;
	if (input.right)   vx += 1;

	const len = Math.sqrt(vx * vx + vz * vz);
	if (len > 0) { vx /= len; vz /= len; }

	localPos.x += vx * speed * dt;
	localPos.z += vz * speed * dt;
	localVelocity.x = vx * speed;
	localVelocity.z = vz * speed;
}
