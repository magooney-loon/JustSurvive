// ─── Enemy Movement Utilities ──────────────────────────────────────────────────
// Torch collision + tangent-vector avoidance + arena wall clamping.

import { TORCH_POSITIONS_SRV, TORCH_COLLISION_SQ, ARENA_RADIUS_SRV } from '../../constants.js';
import { bigintSqrt as bs } from '../../helpers.js';

const TORCH_POSITIONS = TORCH_POSITIONS_SRV;

export function hitsTorch(x: bigint, z: bigint): boolean {
	for (const tp of TORCH_POSITIONS) {
		const dx = x - tp.x;
		const dz = z - tp.z;
		if (dx * dx + dz * dz < TORCH_COLLISION_SQ) return true;
	}
	return false;
}

// Clamp position to arena circle.
function clampToArena(x: bigint, z: bigint): [bigint, bigint] {
	const distSq = x * x + z * z;
	if (distSq <= ARENA_RADIUS_SRV * ARENA_RADIUS_SRV) return [x, z];
	const dist = bs(distSq);
	if (dist === 0n) return [0n, 0n];
	return [(x * ARENA_RADIUS_SRV) / dist, (z * ARENA_RADIUS_SRV) / dist];
}

// Try direct move; if blocked by torch, attempt tangent slides around it.
// Also clamps result to arena wall. Returns [newX, newZ].
export function enemyMoveAvoid(
	curX: bigint,
	curZ: bigint,
	nx: bigint,
	nz: bigint
): [bigint, bigint] {
	// Direct move (after arena clamp)
	const [cx, cz] = clampToArena(nx, nz);
	if (!hitsTorch(cx, cz)) return [cx, cz];

	// Move delta from current pos to clamped target
	const mdx = cx - curX;
	const mdz = cz - curZ;

	// Tangent left: rotate move vector +90° → (-dz, dx)
	const [lx, lz] = clampToArena(curX - mdz, curZ + mdx);
	if (!hitsTorch(lx, lz)) return [lx, lz];

	// Tangent right: rotate move vector -90° → (dz, -dx)
	const [rx, rz] = clampToArena(curX + mdz, curZ - mdx);
	if (!hitsTorch(rx, rz)) return [rx, rz];

	// Axis-slide fallbacks (last resort)
	const [axX, axZ] = clampToArena(cx, curZ);
	if (!hitsTorch(axX, axZ)) return [axX, axZ];

	const [ayX, ayZ] = clampToArena(curX, cz);
	if (!hitsTorch(ayX, ayZ)) return [ayX, ayZ];

	return [curX, curZ];
}
