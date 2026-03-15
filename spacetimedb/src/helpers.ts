// ─── Pure Utility Functions ───────────────────────────────────────────────────

export function generateCode(seed: bigint): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = seed;
	let code = '';
	for (let i = 0; i < 6; i++) {
		s = (s * 1664525n + 1013904223n) & 0xffffffffn;
		code += chars[Number(s % BigInt(chars.length))];
	}
	return code;
}

export function classMaxHp(cls: string): bigint {
	return cls === 'tank' ? 200n : 100n;
}

export function classMaxStamina(cls: string): bigint {
	if (cls === 'spotter') return 600n;
	if (cls === 'tank') return 300n;
	return 80n;
}

// Base stamina regen per second (before ramp)
export function classBaseRegen(cls: string): bigint {
	if (cls === 'spotter' || cls === 'tank') return 4n;
	return 2n;
}

// Max ramp-up stamina regen per second (added on top of base after 5s rest)
export function classRampRegen(cls: string): bigint {
	if (cls === 'spotter' || cls === 'tank') return 9n;
	return 6n;
}

// Shorthand to create a Timestamp-compatible value from raw microseconds
export function ts(micros: bigint): any {
	return { __timestamp_micros_since_unix_epoch__: micros };
}

// Returns 2n if player has an active double-damage buff, else 1n
export function damageMultiplier(ps: any, now: bigint): bigint {
	if (ps.doubleDamageUntil && now < (ps.doubleDamageUntil.microsSinceUnixEpoch as bigint)) return 2n;
	return 1n;
}

// Deterministic pseudo-random 0..range-1 from a bigint seed
export function pseudoRand(seed: bigint, range: number): number {
	let h = seed ^ (seed >> 17n);
	h = (h ^ 0xdeadbeefn) & 0xffffn;
	return Number(h) % range;
}

export function bigintSqrt(n: bigint): bigint {
	if (n < 0n) return 0n;
	if (n < 2n) return n;
	let x = n;
	let y = (x + 1n) / 2n;
	while (y < x) {
		x = y;
		y = (x + n / x) / 2n;
	}
	return x;
}
