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
	markEnemy(sessionId: bigint, enemyId: bigint) {
		if (!conn) return;
		conn.reducers.markEnemy({ sessionId, enemyId });
	},
	async spotterFlash(sessionId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.spotterFlash({ sessionId });
		} catch {}
	},
	async attackEnemy(sessionId: bigint, enemyId: bigint, suppress: boolean) {
		if (!conn) return;
		try {
			await conn.reducers.attackEnemy({ sessionId, enemyId, suppress });
		} catch {}
	},
	async healPlayer(sessionId: bigint, targetIdentity: Identity) {
		if (!conn) return;
		try {
			await conn.reducers.healPlayer({ sessionId, targetIdentity });
		} catch {}
	},
	async shieldBash(sessionId: bigint, enemyId?: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.shieldBash({ sessionId, enemyId });
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
