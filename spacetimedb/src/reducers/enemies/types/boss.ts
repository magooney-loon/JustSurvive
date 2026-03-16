// ─── Boss AI Handler ───────────────────────────────────────────────────────────
// handleBoss is the main entry point called by tick.ts.
// Shared helpers (bossAgeSec, bossMove, bossAttack) live in boss_helpers.ts to
// avoid circular imports with the per-boss files.
//
// Per-boss logic lives in:
//   bosses/ghost_dragon.ts   — hide & seek + ice ball
//   bosses/worm_monster.ts   — chain charge + burrow
//   bosses/rabid_dog.ts      — leap + stun attack
//   bosses/scp_096.ts        — aoe slam + random charge
//   bosses/terror_reaper.ts  — soul drain + death blink

import { bossAgeSec } from './boss_helpers.js';
import { handleGhostDragon } from './bosses/ghost_dragon.js';
import { handleWormMonster } from './bosses/worm_monster.js';
import { handleRabidDog } from './bosses/rabid_dog.js';
import { handleScp096 } from './bosses/scp_096.js';
import { handleTerrorReaper } from './bosses/terror_reaper.js';

export { bossAgeSec, bossMove, bossAttack } from './boss_helpers.js';

// ─── Main entry point ──────────────────────────────────────────────────────────
export function handleBoss(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	sessionId: bigint,
	playerScale: bigint = 100n
): void {
	if (players.length === 0) return;

	// Phase transition: enrage at 20% HP
	const currentPhase = boss.phase as bigint;
	const shouldEnrage = (boss.hp as bigint) <= (boss.maxHp as bigint) / 5n;
	if (currentPhase === 0n && shouldEnrage) {
		boss = { ...boss, phase: 1n };
		ctx.db.boss.id.update(boss);
	}

	// Daze expiry
	if (boss.isDazed && boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
		boss = { ...boss, isDazed: false };
		ctx.db.boss.id.update(boss);
	}

	const ageSec = bossAgeSec(boss, now);
	const abilitiesLocked = ageSec < 5;

	switch (boss.bossType as string) {
		case 'ghost_dragon':
			handleGhostDragon(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'worm_monster':
			handleWormMonster(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'rabid_dog':
			handleRabidDog(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'scp_096':
			handleScp096(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'terror_reaper':
			handleTerrorReaper(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
	}
}
