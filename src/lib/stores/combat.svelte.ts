import type { DbConnection } from '$bindings/index.js';
import type { Identity } from 'spacetimedb';

let conn: DbConnection | null = null;

export const combatActions = {
	init(connection: DbConnection) {
		conn = connection;
	},
	movePlayer(args: {
		sessionId: bigint;
		posX: bigint;
		posY: bigint;
		posZ: bigint;
		isSprinting: boolean;
		facingAngle: bigint;
	}) {
		if (!conn) return;
		conn.reducers.movePlayer(args);
	},
	steadyShot(sessionId: bigint, enemyId: bigint) {
		if (!conn) return;
		conn.reducers.steadyShot({ sessionId, enemyId });
	},
	async spotterFlash(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.spotterFlash({ sessionId });
		} catch {}
	},
	async spotterUltimate(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.spotterUltimate({ sessionId });
		} catch {}
	},
	async attackEnemy(sessionId: bigint, enemyId: bigint, suppress: boolean) {
		if (!conn) return;
		try {
			await conn.reducers.attackEnemy({ sessionId, enemyId, suppress });
		} catch {}
	},
	async gunnerUltimate(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.gunnerUltimate({ sessionId });
		} catch {}
	},
	async healPlayer(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.healPlayer({ sessionId });
		} catch {}
	},
	async healerUltimate(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.healerUltimate({ sessionId });
		} catch {}
	},
	async axeSwing(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.axeSwing({ sessionId });
		} catch {}
	},
	async tankUltimate(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.tankUltimate({ sessionId });
		} catch {}
	},
	async adrenaline(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.adrenaline({ sessionId });
		} catch {}
	},
	braceStart(sessionId: bigint) {
		if (!conn) return;
		conn.reducers.braceStart({ sessionId });
	},
	braceEnd(sessionId: bigint) {
		if (!conn) return;
		conn.reducers.braceEnd({ sessionId });
	},
	async reviveStart(sessionId: bigint, targetIdentity: Identity) {
		if (!conn) return;
		try {
			await conn.reducers.reviveStart({ sessionId, targetIdentity });
		} catch {}
	}
};
