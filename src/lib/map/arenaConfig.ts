export const ARENA_RADIUS = 50; // world units — visual boundary
export const ARENA_PLAY_RADIUS = 48; // player movement clamp (inside wall)

// Torch positions in world units — must match TORCH_POSITIONS_SRV in spacetimedb/src/constants.ts (÷1000)
export const TORCH_POSITIONS: ReadonlyArray<{ x: number; z: number }> = [
	// Wall ring — 12 torches at r=48.5
	{ x:  48.500, z:   0.000 },
	{ x:  42.002, z:  24.250 },
	{ x:  24.250, z:  42.002 },
	{ x:   0.000, z:  48.500 },
	{ x: -24.250, z:  42.002 },
	{ x: -42.002, z:  24.250 },
	{ x: -48.500, z:   0.000 },
	{ x: -42.002, z: -24.250 },
	{ x: -24.250, z: -42.002 },
	{ x:   0.000, z: -48.500 },
	{ x:  24.250, z: -42.002 },
	{ x:  42.002, z: -24.250 },
	// Mid ring — 7 torches at r=33
	{ x:  33.000, z:   0.000 },
	{ x:  20.575, z:  25.800 },
	{ x:  -7.343, z:  32.173 },
	{ x: -29.732, z:  14.318 },
	{ x: -29.732, z: -14.318 },
	{ x:  -7.343, z: -32.173 },
	{ x:  20.575, z: -25.800 },
	// Inner ring — 4 torches at r=18
	{ x:  18.000, z:   0.000 },
	{ x:   0.000, z:  18.000 },
	{ x: -18.000, z:   0.000 },
	{ x:   0.000, z: -18.000 },
];
export const TORCH_COLLISION_R = 0.8; // world units — must match sqrt(TORCH_COLLISION_SQ/1e6) in constants.ts
