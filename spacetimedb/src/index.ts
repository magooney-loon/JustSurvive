import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import {
	Lobby,
	LobbyPlayer,
	GameSession,
	PlayerState,
	Enemy,
	Mark,
	AcidPool,
	ReviveChannel,
	LobbyMessage,
	LobbyResult,
	LobbyResultPlayer,
	GlobalStats,
	SquadRecord,
	BossTimer
} from './tables.js';
import {
	ENEMY_BASE_SPEED,
	ENEMY_CAP_BY_PLAYERS,
	MELEE_RANGE,
	BOSS_MELEE_RANGE,
	SPITTER_RANGE_SQ,
	SPITTER_MIN_DIST_SQ,
	CASTER_RANGE_SQ,
	CASTER_MIN_DIST_SQ,
	TICK_MS,
	MAX_ENEMIES_PER_PLAYER,
	TARGET_JITTER,
	ENEMY_SPEED_PER_SEC,
	ENEMY_WEIGHTS,
	ENEMY_HP,
	ENEMY_HP_CYCLE_BONUS,
	ENEMY_HP_MAX_MULTIPLIER,
	DAY_PHASES,
	WEAPON_DAMAGE,
	HEAL_AMOUNT,
	HEAL_RANGE_SQ,
	REVIVE_COOLDOWN_US,
	REVIVE_CHANNEL_US,
	TORCH_POSITIONS_SRV,
	TORCH_COLLISION_SQ,
	SPAWN_POINT_COUNT,
	WALL_SPAWN_RADIUS,
	BOSS_SPAWN_INTERVAL_US
} from './constants.js';

// Precomputed torch positions (computed once at module load)
const TORCH_POSITIONS = TORCH_POSITIONS_SRV;

function hitsTorch(x: bigint, z: bigint): boolean {
	for (const tp of TORCH_POSITIONS) {
		const dx = x - tp.x;
		const dz = z - tp.z;
		if (dx * dx + dz * dz < TORCH_COLLISION_SQ) return true;
	}
	return false;
}

// Try direct move; if blocked by torch, slide along X or Z axis instead.
// Returns [newX, newZ] — may equal current pos if fully blocked.
function enemyMoveAvoid(curX: bigint, curZ: bigint, nx: bigint, nz: bigint): [bigint, bigint] {
	if (!hitsTorch(nx, nz)) return [nx, nz];
	if (!hitsTorch(nx, curZ)) return [nx, curZ];
	if (!hitsTorch(curX, nz)) return [curX, nz];
	return [curX, curZ];
}
import { generateCode, classMaxHp, classMaxStamina, ts, bigintSqrt as bs } from './helpers.js';

// ─── Scheduled Tables ─────────────────────────────────────────────────────────
// These must stay in index.ts — they forward-reference their reducer functions.

const LobbyCountdown = table(
	{
		name: 'lobby_countdown',
		scheduled: (): any => fire_start_game
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		lobbyId: t.u64()
	}
);

const EnemyTickJob = table(
	{
		name: 'enemy_tick_job',
		scheduled: (): any => enemy_tick
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		sessionId: t.u64()
	}
);

const EnemySpawnJob = table(
	{
		name: 'enemy_spawn_job',
		scheduled: (): any => spawn_enemy
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		sessionId: t.u64()
	}
);

const DayPhaseJob = table(
	{
		name: 'day_phase_job',
		scheduled: (): any => advance_day_phase
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		sessionId: t.u64()
	}
);

const LobbyAfkJob = table(
	{
		name: 'lobby_afk_job',
		scheduled: (): any => fire_lobby_afk_kick
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		lobbyId: t.u64(),
		playerIdentity: t.identity()
	}
);

const BossSpawnJob = table(
	{
		name: 'boss_spawn_job',
		scheduled: (): any => fire_boss_spawn
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		sessionId: t.u64()
	}
);

const ReviveCompleteJob = table(
	{
		name: 'revive_complete_job',
		scheduled: (): any => complete_revive,
		indexes: [
			{
				name: 'revive_job_session',
				accessor: 'revive_job_session',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		sessionId: t.u64(),
		healerIdentity: t.identity(),
		targetIdentity: t.identity()
	}
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
	lobby: Lobby,
	lobbyPlayer: LobbyPlayer,
	gameSession: GameSession,
	playerState: PlayerState,
	enemy: Enemy,
	lobbyCountdown: LobbyCountdown,
	lobbyAfkJob: LobbyAfkJob,
	enemyTickJob: EnemyTickJob,
	enemySpawnJob: EnemySpawnJob,
	dayPhaseJob: DayPhaseJob,
	bossSpawnJob: BossSpawnJob,
	mark: Mark,
	acidPool: AcidPool,
	reviveChannel: ReviveChannel,
	reviveCompleteJob: ReviveCompleteJob,
	lobbyMessage: LobbyMessage,
	lobbyResult: LobbyResult,
	lobbyResultPlayer: LobbyResultPlayer,
	globalStats: GlobalStats,
	squadRecord: SquadRecord,
	bossTimer: BossTimer
});

export default spacetimedb;

// ─── Internal Helpers (ctx-dependent) ────────────────────────────────────────

function clearLobbyMessages(ctx: any, lobbyId: bigint) {
	for (const m of ctx.db.lobbyMessage.lobby_message_lobby_id.filter(lobbyId)) {
		ctx.db.lobbyMessage.id.delete(m.id);
	}
}

// Apply damage to a single player (use only when one damage source per transaction, e.g. acid pool in move_player).
// For enemy_tick (multiple sources per tick), accumulate into damageAccum and use applyAccumulatedDamage instead.
function apply_player_damage(ctx: any, sessionId: bigint, ps: any, damage: bigint) {
	const newHp = ps.hp > damage ? ps.hp - damage : 0n;
	if (newHp <= 0n && ps.status === 'alive') {
		ctx.db.playerState.id.update({ ...ps, hp: 0n, status: 'downed' });

		// Interrupt revive if this player was healing someone
		for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
			if (c.healerIdentity.isEqual(ps.playerIdentity)) {
				ctx.db.reviveChannel.id.delete(c.id);
				break;
			}
		}

		// If all players are now downed, game over
		const sessionPlayers = [...ctx.db.playerState.player_state_session_id.filter(sessionId)];
		const anyStillAlive = sessionPlayers.some(
			(p) => !p.playerIdentity.isEqual(ps.playerIdentity) && p.status === 'alive'
		);
		if (!anyStillAlive) {
			end_session(ctx, sessionId);
		}
	} else {
		ctx.db.playerState.id.update({ ...ps, hp: newHp });
		// Interrupt revive if this player was healing someone
		for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
			if (c.healerIdentity.isEqual(ps.playerIdentity)) {
				ctx.db.reviveChannel.id.delete(c.id);
				break;
			}
		}
	}
}

// Apply all accumulated damage after the enemy loop — avoids snapshot isolation issues
// where multiple enemies hitting the same player in one tick each see the original HP.
function applyAccumulatedDamage(
	ctx: any,
	sessionId: bigint,
	alivePlayers: any[],
	damageAccum: Map<bigint, bigint>
) {
	if (damageAccum.size === 0) return;
	const newlyDownedIds = new Set<bigint>();

	for (const [playerId, totalDamage] of damageAccum) {
		const ps = alivePlayers.find((p) => p.id === playerId);
		if (!ps) continue;
		const newHp = ps.hp > totalDamage ? ps.hp - totalDamage : 0n;
		const willDown = newHp <= 0n;
		ctx.db.playerState.id.update({
			...ps,
			hp: willDown ? 0n : newHp,
			status: willDown ? 'downed' : ps.status
		});
		if (willDown) newlyDownedIds.add(playerId);
		// Interrupt revive if this player was a healer mid-revive
		for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
			if (c.healerIdentity.isEqual(ps.playerIdentity)) {
				ctx.db.reviveChannel.id.delete(c.id);
				break;
			}
		}
	}

	if (newlyDownedIds.size === 0) return;
	// Game over if every alive player is being downed this tick
	const anyStillAlive = alivePlayers.some((p) => !newlyDownedIds.has(p.id));
	if (!anyStillAlive) {
		end_session(ctx, sessionId);
	}
}

function end_session(ctx: any, sessionId: bigint) {
	const session = ctx.db.gameSession.id.find(sessionId);
	if (!session) return;
	ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });

	// Delete enemies immediately
	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		ctx.db.enemy.id.delete(e.id);
	}
	// Clean up Phase 4 session data
	for (const m of ctx.db.mark.mark_session_id.filter(sessionId)) {
		ctx.db.mark.id.delete(m.id);
	}
	for (const p of ctx.db.acidPool.acid_pool_session_id.filter(sessionId)) {
		ctx.db.acidPool.id.delete(p.id);
	}
	for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
		ctx.db.reviveChannel.id.delete(c.id);
	}
	for (const bt of ctx.db.bossTimer.boss_timer_session_id.filter(sessionId)) {
		ctx.db.bossTimer.id.delete(bt.id);
	}
	// Note: PlayerState rows kept until next game starts (game over screen needs them)

	const lobby = ctx.db.lobby.id.find(session.lobbyId);
	if (lobby) {
		if (lobby.isPublic) {
			// Public lobbies are disbanded after a game — players use quick join for a new one
			for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)) {
				ctx.db.lobbyPlayer.id.delete(p.id);
			}
			clearLobbyMessages(ctx, lobby.id);
			ctx.db.lobby.id.delete(lobby.id);
		} else {
			ctx.db.lobby.id.update({ ...lobby, status: 'waiting' });
			for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)) {
				ctx.db.lobbyPlayer.id.update({ ...p, isReady: false });
			}
		}
	}

	// ─── Leaderboard ─────────────────────────────────────────────────────────────
	const sessionPlayers = [...ctx.db.playerState.player_state_session_id.filter(sessionId)];
	const sessionLobbyPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(session.lobbyId)];
	const classes = sessionLobbyPlayers
		.map((p) => p.classChoice)
		.filter((c) => c !== '')
		.sort();
	const combo = classes.length > 0 ? classes.join(',') : 'none';
	const totalScore = sessionPlayers.reduce((acc, p) => acc + p.score, 0n);
	const survivalMicros =
		(ctx.timestamp.microsSinceUnixEpoch as bigint) -
		(session.startedAt.microsSinceUnixEpoch as bigint);
	const survivalSecs = survivalMicros > 0n ? survivalMicros / 1_000_000n : 0n;

	// 1. GlobalStats upsert (id always 1n)
	const spotterCount = BigInt(classes.filter((c) => c === 'spotter').length);
	const gunnerCount = BigInt(classes.filter((c) => c === 'gunner').length);
	const tankCount = BigInt(classes.filter((c) => c === 'tank').length);
	const healerCount = BigInt(classes.filter((c) => c === 'healer').length);
	const gs = ctx.db.globalStats.id.find(1n);
	if (gs) {
		ctx.db.globalStats.id.update({
			...gs,
			totalGames: gs.totalGames + 1n,
			totalSurvivalSecs: gs.totalSurvivalSecs + survivalSecs,
			bestSurvivalSecs: survivalSecs > gs.bestSurvivalSecs ? survivalSecs : gs.bestSurvivalSecs,
			classSpotter: gs.classSpotter + spotterCount,
			classGunner: gs.classGunner + gunnerCount,
			classTank: gs.classTank + tankCount,
			classHealer: gs.classHealer + healerCount
		});
	} else {
		ctx.db.globalStats.insert({
			id: 1n,
			totalGames: 1n,
			totalSurvivalSecs: survivalSecs,
			bestSurvivalSecs: survivalSecs,
			classSpotter: spotterCount,
			classGunner: gunnerCount,
			classTank: tankCount,
			classHealer: healerCount
		});
	}

	// 2. SquadRecord upsert
	const existingSquad = [...ctx.db.squadRecord.squad_record_combo.filter(combo)][0];
	if (existingSquad) {
		ctx.db.squadRecord.id.update({
			...existingSquad,
			timesPlayed: existingSquad.timesPlayed + 1n,
			bestScore: totalScore > existingSquad.bestScore ? totalScore : existingSquad.bestScore,
			bestSurvivalSecs:
				survivalSecs > existingSquad.bestSurvivalSecs
					? survivalSecs
					: existingSquad.bestSurvivalSecs
		});
	} else {
		ctx.db.squadRecord.insert({
			id: 0n,
			combo,
			timesPlayed: 1n,
			bestScore: totalScore,
			bestSurvivalSecs: survivalSecs
		});
	}

	// 3. Top-20 gate
	const alreadyRecorded = [...ctx.db.lobbyResult.lobby_result_session.filter(sessionId)].length > 0;
	if (!alreadyRecorded) {
		const allResults = [...ctx.db.lobbyResult.iter()];
		let qualified = false;
		let evictRow: any = null;
		if (allResults.length < 20) {
			qualified = true;
		} else {
			let minRow = allResults[0];
			for (const r of allResults) {
				if (r.totalScore < minRow.totalScore) minRow = r;
			}
			if (totalScore > minRow.totalScore) {
				qualified = true;
				evictRow = minRow;
			}
		}
		if (qualified) {
			if (evictRow) {
				for (const p of ctx.db.lobbyResultPlayer.lobby_result_player_session.filter(
					evictRow.sessionId
				)) {
					ctx.db.lobbyResultPlayer.id.delete(p.id);
				}
				ctx.db.lobbyResult.id.delete(evictRow.id);
			}
			ctx.db.lobbyResult.insert({
				id: 0n,
				sessionId,
				lobbyCode: lobby?.code ?? '??????',
				combo,
				playerCount: BigInt(sessionLobbyPlayers.length),
				totalScore,
				survivalSecs,
				cycleNumber: session.cycleNumber,
				createdAt: ctx.timestamp
			});
			for (const lp of sessionLobbyPlayers) {
				ctx.db.lobbyResultPlayer.insert({
					id: 0n,
					sessionId,
					playerName: lp.playerName,
					classChoice: lp.classChoice || 'none'
				});
			}
		}
	}
}

// ─── Reducers ─────────────────────────────────────────────────────────────────

export const create_lobby = spacetimedb.reducer(
	{
		playerName: t.string(),
		classChoice: t.string(),
		isPublic: t.bool()
	},
	(ctx, { playerName, classChoice, isPublic }) => {
		if (!playerName) throw new SenderError('playerName required');

		const lobby = ctx.db.lobby.insert({
			id: 0n,
			hostIdentity: ctx.sender,
			code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
			isPublic,
			status: 'waiting',
			playerCount: 1n,
			maxPlayers: 4n,
			createdAt: ctx.timestamp
		});

		ctx.db.lobbyPlayer.insert({
			id: 0n,
			lobbyId: lobby.id,
			playerIdentity: ctx.sender,
			playerName,
			classChoice: classChoice || '',
			isReady: false,
			joinedAt: ctx.timestamp
		});

		if (isPublic) {
			ctx.db.lobbyAfkJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 120_000_000n),
				lobbyId: lobby.id,
				playerIdentity: ctx.sender
			});
		}
	}
);

export const join_lobby = spacetimedb.reducer(
	{
		lobbyId: t.u64(),
		playerName: t.string(),
		classChoice: t.string()
	},
	(ctx, { lobbyId, playerName, classChoice }) => {
		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby) throw new SenderError('Lobby not found');
		if (lobby.status !== 'waiting') throw new SenderError('Lobby already started');
		if (lobby.playerCount >= lobby.maxPlayers) throw new SenderError('Lobby full');

		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) throw new SenderError('Already in lobby');
		}

		ctx.db.lobbyPlayer.insert({
			id: 0n,
			lobbyId,
			playerIdentity: ctx.sender,
			playerName,
			classChoice: classChoice || '',
			isReady: false,
			joinedAt: ctx.timestamp
		});

		ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });

		if (lobby.isPublic) {
			ctx.db.lobbyAfkJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 120_000_000n),
				lobbyId,
				playerIdentity: ctx.sender
			});
		}
	}
);

export const join_by_code = spacetimedb.reducer(
	{
		code: t.string(),
		playerName: t.string(),
		classChoice: t.string()
	},
	(ctx, { code, playerName, classChoice }) => {
		const results = [...ctx.db.lobby.lobby_code.filter(code.toUpperCase())];
		if (!results.length) throw new SenderError('Lobby not found');
		const lobby = results[0];
		if (lobby.status !== 'waiting') throw new SenderError('Lobby already started');
		if (lobby.playerCount >= lobby.maxPlayers) throw new SenderError('Lobby full');

		ctx.db.lobbyPlayer.insert({
			id: 0n,
			lobbyId: lobby.id,
			playerIdentity: ctx.sender,
			playerName,
			classChoice: classChoice || '',
			isReady: false,
			joinedAt: ctx.timestamp
		});

		ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });

		if (lobby.isPublic) {
			ctx.db.lobbyAfkJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 120_000_000n),
				lobbyId: lobby.id,
				playerIdentity: ctx.sender
			});
		}
	}
);

export const quick_join = spacetimedb.reducer(
	{
		playerName: t.string(),
		classChoice: t.string()
	},
	(ctx, { playerName, classChoice }) => {
		if (!playerName) throw new SenderError('playerName required');

		// Check caller isn't already in a lobby
		const existing = [...ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)];
		if (existing.length > 0) throw new SenderError('Already in a lobby');

		// Find an available public waiting lobby server-side
		let joined = false;
		for (const lobby of ctx.db.lobby.lobby_status.filter('waiting')) {
			if (!lobby.isPublic) continue;
			if (lobby.playerCount >= lobby.maxPlayers) continue;

			ctx.db.lobbyPlayer.insert({
				id: 0n,
				lobbyId: lobby.id,
				playerIdentity: ctx.sender,
				playerName,
				classChoice: classChoice || '',
				isReady: false,
				joinedAt: ctx.timestamp
			});
			ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount + 1n });
			ctx.db.lobbyAfkJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 120_000_000n),
				lobbyId: lobby.id,
				playerIdentity: ctx.sender
			});
			joined = true;
			break;
		}

		if (!joined) {
			// No available lobby — create a new public one
			const lobby = ctx.db.lobby.insert({
				id: 0n,
				hostIdentity: ctx.sender,
				code: generateCode(ctx.timestamp.microsSinceUnixEpoch),
				isPublic: true,
				status: 'waiting',
				playerCount: 1n,
				maxPlayers: 4n,
				createdAt: ctx.timestamp
			});

			ctx.db.lobbyPlayer.insert({
				id: 0n,
				lobbyId: lobby.id,
				playerIdentity: ctx.sender,
				playerName,
				classChoice: classChoice || '',
				isReady: false,
				joinedAt: ctx.timestamp
			});

			// New public lobbies created by quick_join also need AFK tracking
			ctx.db.lobbyAfkJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 120_000_000n),
				lobbyId: lobby.id,
				playerIdentity: ctx.sender
			});
		}
	}
);

export const set_class = spacetimedb.reducer(
	{
		lobbyId: t.u64(),
		classChoice: t.string()
	},
	(ctx, { lobbyId, classChoice }) => {
		const valid = ['spotter', 'gunner', 'tank', 'healer'];
		if (!valid.includes(classChoice)) throw new SenderError('Invalid class');

		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby) throw new SenderError('Lobby not found');

		const sameClassCount = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)].filter(
			(p) => p.classChoice === classChoice && !p.playerIdentity.isEqual(ctx.sender)
		).length;
		if (sameClassCount >= 2) {
			throw new SenderError(`Max 2 ${classChoice}s allowed per lobby`);
		}

		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				if (lobby.isPublic && p.isReady)
					throw new SenderError('Cannot change class after readying');
				ctx.db.lobbyPlayer.id.update({ ...p, classChoice, isReady: false });
				return;
			}
		}
		throw new SenderError('Not in this lobby');
	}
);

export const set_ready = spacetimedb.reducer(
	{
		lobbyId: t.u64(),
		isReady: t.bool()
	},
	(ctx, { lobbyId, isReady }) => {
		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby || lobby.status !== 'waiting') return;

		if (lobby.isPublic && !isReady) throw new SenderError('Cannot unready in a public lobby');

		let found = false;
		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				if (isReady && !p.classChoice) throw new SenderError('Select a class first');
				ctx.db.lobbyPlayer.id.update({ ...p, isReady });
				found = true;
				break;
			}
		}
		if (!found) throw new SenderError('Not in this lobby');

		// Auto-start public lobbies when every player is ready
		if (lobby.isPublic && isReady) {
			const allPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
			if (allPlayers.length >= 2 && allPlayers.every((p) => p.isReady && p.classChoice)) {
				ctx.db.lobby.id.update({ ...lobby, status: 'countdown' });
				ctx.db.lobbyCountdown.insert({
					scheduledId: 0n,
					scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 3_000_000n),
					lobbyId
				});
			}
		}
	}
);

export const leave_lobby = spacetimedb.reducer(
	{
		lobbyId: t.u64()
	},
	(ctx, { lobbyId }) => {
		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby) return;

		let found = false;
		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ctx.db.lobbyPlayer.id.delete(p.id);
				found = true;
				break;
			}
		}
		if (!found) return;

		const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
		if (remaining.length === 0) {
			clearLobbyMessages(ctx, lobbyId);
			ctx.db.lobby.id.delete(lobbyId);
			return;
		}

		const newCount = lobby.playerCount - 1n;
		if (lobby.isPublic) {
			ctx.db.lobby.id.update({ ...lobby, playerCount: newCount });
		} else {
			const isHost = lobby.hostIdentity.isEqual(ctx.sender);
			const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
			ctx.db.lobby.id.update({ ...lobby, playerCount: newCount, hostIdentity: newHost });
		}
	}
);

export const kick_player = spacetimedb.reducer(
	{
		lobbyId: t.u64(),
		playerIdentity: t.identity()
	},
	(ctx, { lobbyId, playerIdentity }) => {
		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby) return;
		if (lobby.isPublic) throw new SenderError('Cannot kick players in a public lobby');
		if (!lobby.hostIdentity.isEqual(ctx.sender)) {
			throw new SenderError('Only the host can kick players');
		}
		if (playerIdentity.isEqual(ctx.sender)) {
			throw new SenderError('Cannot kick yourself');
		}

		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(playerIdentity)) {
				ctx.db.lobbyPlayer.id.delete(p.id);
				break;
			}
		}

		const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
		if (remaining.length === 0) {
			clearLobbyMessages(ctx, lobbyId);
			ctx.db.lobby.id.delete(lobbyId);
			return;
		}

		const newCount = lobby.playerCount - 1n;
		ctx.db.lobby.id.update({ ...lobby, playerCount: newCount });
	}
);

export const start_countdown = spacetimedb.reducer(
	{
		lobbyId: t.u64()
	},
	(ctx, { lobbyId }) => {
		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby) throw new SenderError('Lobby not found');
		if (lobby.isPublic) throw new SenderError('Public lobbies start automatically');
		if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can start');
		if (lobby.status !== 'waiting') throw new SenderError('Already starting');

		const players = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
		if (players.length < 1) throw new SenderError('Need at least 1 player');
		if (!players.every((p) => p.isReady && p.classChoice)) {
			throw new SenderError('All players must be ready with a class selected');
		}

		ctx.db.lobby.id.update({ ...lobby, status: 'countdown' });

		const startAt = ctx.timestamp.microsSinceUnixEpoch + 3_000_000n;
		ctx.db.lobbyCountdown.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(startAt),
			lobbyId
		});
	}
);

export const fire_start_game = spacetimedb.reducer(
	{
		arg: LobbyCountdown.rowType
	},
	(ctx, { arg }) => {
		const lobby = ctx.db.lobby.id.find(arg.lobbyId);
		if (!lobby || lobby.status !== 'countdown') return;

		// Clean up previous session(s) for this lobby
		for (const oldSession of ctx.db.gameSession.game_session_lobby_id.filter(arg.lobbyId)) {
			for (const p of ctx.db.playerState.player_state_session_id.filter(oldSession.id)) {
				ctx.db.playerState.id.delete(p.id);
			}
			ctx.db.gameSession.id.delete(oldSession.id);
		}

		const session = ctx.db.gameSession.insert({
			id: 0n,
			lobbyId: arg.lobbyId,
			status: 'active',
			startedAt: ctx.timestamp,
			endedAt: undefined,
			dayPhase: 'sunset',
			cycleNumber: 0n,
			phaseStartedAt: ctx.timestamp,
			fogActive: false,
			mapSeed: ctx.timestamp.microsSinceUnixEpoch
		});

		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)) {
			ctx.db.playerState.insert({
				id: 0n,
				sessionId: session.id,
				playerIdentity: p.playerIdentity,
				classChoice: p.classChoice,
				hp: classMaxHp(p.classChoice),
				maxHp: classMaxHp(p.classChoice),
				stamina: classMaxStamina(p.classChoice),
				maxStamina: classMaxStamina(p.classChoice),
				lastMoveAt: ctx.timestamp,
				staminaRegenStartAt: undefined,
				staminaRegenCarry: 0n,
				lastShotAt: undefined,
				posX: 0n,
				posY: 0n,
				posZ: 0n,
				status: 'alive',
				score: 0n,
				facingAngle: 0n,
				isBracing: false,
				braceStartAt: undefined,
				braceCooldownUntil: undefined,
				speedBoostUntil: undefined,
				reviveCooldownUntil: undefined,
				healCooldownUntil: undefined,
				markCooldownUntil: undefined,
				pingCooldownUntil: undefined,
				bashCooldownUntil: undefined,
				adrenalineCooldownUntil: undefined,
				lastHealAt: undefined,
				healTargetIdentity: undefined,
				lastFlashAt: undefined
			});
		}

		ctx.db.lobby.id.update({ ...lobby, status: 'in_progress' });

		const now = ctx.timestamp.microsSinceUnixEpoch;

		ctx.db.enemyTickJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(now + 100_000n),
			sessionId: session.id
		});
		const INITIAL_SPAWN_JOBS = 3;
		for (let i = 0; i < INITIAL_SPAWN_JOBS; i++) {
			ctx.db.enemySpawnJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(now + 2_000_000n + BigInt(i) * 2_000_000n),
				sessionId: session.id
			});
		}
		ctx.db.enemySpawnJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(now + 10_000_000n),
			sessionId: session.id
		});
		ctx.db.dayPhaseJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(now + 60_000_000n),
			sessionId: session.id
		});
		const bossSpawnAt = now + BOSS_SPAWN_INTERVAL_US;
		ctx.db.bossSpawnJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(bossSpawnAt),
			sessionId: session.id
		});
		ctx.db.bossTimer.insert({
			id: 0n,
			sessionId: session.id,
			spawnAt: ts(bossSpawnAt)
		});
	}
);

export const fire_lobby_afk_kick = spacetimedb.reducer(
	{ arg: LobbyAfkJob.rowType },
	(ctx, { arg }) => {
		const lobby = ctx.db.lobby.id.find(arg.lobbyId);
		if (!lobby || !lobby.isPublic || lobby.status !== 'waiting') return;

		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)) {
			if (!p.playerIdentity.isEqual(arg.playerIdentity)) continue;
			if (p.isReady) return; // player readied up in time

			// Kick the AFK player
			ctx.db.lobbyPlayer.id.delete(p.id);
			const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(arg.lobbyId)];
			if (remaining.length === 0) {
				clearLobbyMessages(ctx, arg.lobbyId);
				ctx.db.lobby.id.delete(arg.lobbyId);
			} else {
				ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount - 1n });
			}
			return;
		}
	}
);

export const send_lobby_message = spacetimedb.reducer(
	{ lobbyId: t.u64(), message: t.string() },
	(ctx, { lobbyId, message }) => {
		const msg = message.trim();
		if (!msg || msg.length > 200) throw new SenderError('Invalid message');

		let playerName = '';
		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				playerName = p.playerName;
				break;
			}
		}
		if (!playerName) throw new SenderError('Not in this lobby');

		// Keep only the last 5 messages — delete oldest if at cap
		const messages = [...ctx.db.lobbyMessage.lobby_message_lobby_id.filter(lobbyId)];
		if (messages.length >= 5) {
			let oldest = messages[0];
			for (const m of messages) {
				if (m.id < oldest.id) oldest = m;
			}
			ctx.db.lobbyMessage.id.delete(oldest.id);
		}

		ctx.db.lobbyMessage.insert({
			id: 0n,
			lobbyId,
			playerIdentity: ctx.sender,
			playerName,
			message: msg,
			sentAt: ctx.timestamp
		});
	}
);

// ─── Phase 3 Reducers ─────────────────────────────────────────────────────────

export const move_player = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		posX: t.i64(),
		posY: t.i64(),
		posZ: t.i64(),
		isSprinting: t.bool(),
		facingAngle: t.i64()
	},
	(ctx, { sessionId, posX, posY, posZ, isSprinting, facingAngle }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.status !== 'alive') return;
		if (ps.isBracing) return;

		const SPRINT_DRAIN = 3n;
		const BASE_REGEN_PER_SEC = 2n;
		const RAMP_REGEN_PER_SEC = 6n;
		const RAMP_TIME_MICROS = 5_000_000n;
		const REGEN_DELAY_MICROS = 1_000_000n;
		const MICROS_PER_SEC = 1_000_000n;
		const now = ctx.timestamp.microsSinceUnixEpoch;
		const lastMoveAt = ps.lastMoveAt?.microsSinceUnixEpoch ?? now;
		const dtMicros = now > lastMoveAt ? now - lastMoveAt : 0n;
		let newStamina = ps.stamina;
		let regenStartAt = ps.staminaRegenStartAt;
		let regenCarry = ps.staminaRegenCarry ?? 0n;
		if (isSprinting && ps.stamina > 0n) {
			newStamina = ps.stamina > SPRINT_DRAIN ? ps.stamina - SPRINT_DRAIN : 0n;
			regenStartAt = undefined;
			regenCarry = 0n;
		} else if (!isSprinting && ps.stamina < ps.maxStamina && dtMicros > 0n) {
			if (!regenStartAt) regenStartAt = ctx.timestamp;
			const sinceStart = now - regenStartAt.microsSinceUnixEpoch;
			if (sinceStart >= REGEN_DELAY_MICROS) {
				const rampMicros = sinceStart - REGEN_DELAY_MICROS;
				const ramp =
					rampMicros >= RAMP_TIME_MICROS
						? RAMP_REGEN_PER_SEC
						: (RAMP_REGEN_PER_SEC * rampMicros) / RAMP_TIME_MICROS;
				const regenRate = BASE_REGEN_PER_SEC + ramp; // per second
				const totalMicros = regenRate * dtMicros + regenCarry;
				const regenAdd = totalMicros / MICROS_PER_SEC;
				regenCarry = totalMicros % MICROS_PER_SEC;
				newStamina = ps.stamina + regenAdd > ps.maxStamina ? ps.maxStamina : ps.stamina + regenAdd;
			}
		}

		// ─── Position validation ──────────────────────────────────────────────
		// Reject out-of-arena positions
		const ARENA_RADIUS_SRV = 50_000n;
		if (posX * posX + posZ * posZ > ARENA_RADIUS_SRV * ARENA_RADIUS_SRV) return;

		// Reject positions inside torch collision zones (anti-cheat — client enforces this too)
		if (hitsTorch(posX, posZ)) return;

		// Reject positions implying faster-than-possible movement (anti-cheat)
		if (dtMicros > 0n && ps.lastMoveAt) {
			const CLASS_WALK: Record<string, bigint> = {
				spotter: 5000n,
				gunner: 4500n,
				tank: 2500n,
				healer: 5000n
			};
			const CLASS_SPRINT: Record<string, bigint> = {
				spotter: 9000n,
				gunner: 7500n,
				tank: 3500n,
				healer: 8500n
			};
			const baseSpeed =
				isSprinting && ps.stamina > 0n
					? (CLASS_SPRINT[ps.classChoice] ?? 7500n)
					: (CLASS_WALK[ps.classChoice] ?? 4500n);
			const hasSpeedBoost = ps.speedBoostUntil && ps.speedBoostUntil.microsSinceUnixEpoch > now;
			const maxSpeed = hasSpeedBoost ? (baseSpeed * 3n) / 2n : baseSpeed;
			// 1.5x tolerance for network jitter and timing imprecision
			const maxDist = (maxSpeed * dtMicros * 3n) / (2n * 1_000_000n);
			const dx = posX - ps.posX;
			const dz = posZ - ps.posZ;
			if (dx * dx + dz * dz > maxDist * maxDist) return;
		}

		const distDelta = posZ < ps.posZ ? ps.posZ - posZ : 0n;
		const newScore = ps.score + distDelta / 1000n;
		const updatedPs = {
			...ps,
			posX,
			posY,
			posZ,
			stamina: newStamina,
			score: newScore,
			facingAngle,
			lastMoveAt: ctx.timestamp,
			staminaRegenStartAt: regenStartAt,
			staminaRegenCarry: regenCarry
		};

		// Check acid pool overlap
		for (const pool of ctx.db.acidPool.acid_pool_session_id.filter(sessionId)) {
			if (pool.expiresAt.microsSinceUnixEpoch < now) {
				ctx.db.acidPool.id.delete(pool.id);
				continue;
			}
			const dxp = posX - pool.posX;
			const dzp = posZ - pool.posZ;
			if (dxp * dxp + dzp * dzp < pool.radius * pool.radius) {
				apply_player_damage(ctx, sessionId, updatedPs, 1n);
				return;
			}
		}

		ctx.db.playerState.id.update(updatedPs);
	}
);

export const enemy_tick = spacetimedb.reducer(
	{
		arg: EnemyTickJob.rowType
	},
	(ctx, { arg }) => {
		const session = ctx.db.gameSession.id.find(arg.sessionId);
		if (!session || session.status !== 'active') return;

		const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)].filter(
			(p) => p.status === 'alive'
		);

		const enemies = [...ctx.db.enemy.enemy_session_id.filter(arg.sessionId)].filter(
			(e) => e.isAlive
		);
		const now = ctx.timestamp.microsSinceUnixEpoch;
		for (const m of ctx.db.mark.mark_session_id.filter(arg.sessionId)) {
			if (m.expiresAt.microsSinceUnixEpoch < now) {
				ctx.db.mark.id.delete(m.id);
			}
		}
		// Clean up dead enemies after 5 seconds
		const DEAD_CLEANUP_MS = 5_000_000n; // 5 seconds
		for (const e of ctx.db.enemy.enemy_session_id.filter(arg.sessionId)) {
			if (!e.isAlive && e.diedAt && now - e.diedAt.microsSinceUnixEpoch >= DEAD_CLEANUP_MS) {
				ctx.db.enemy.id.delete(e.id);
				if (e.enemyType === 'boss') {
					const nextBossAt = now + BOSS_SPAWN_INTERVAL_US;
					ctx.db.bossSpawnJob.insert({
						scheduledId: 0n,
						scheduledAt: ScheduleAt.time(nextBossAt),
						sessionId: arg.sessionId
					});
					ctx.db.bossTimer.insert({
						id: 0n,
						sessionId: arg.sessionId,
						spawnAt: ts(nextBossAt)
					});
				}
			}
		}
		const BRACE_MAX_US = 5_000_000n;
		// Only iterate if at least one player is bracing
		if (players.some((p) => p.isBracing)) {
			for (let i = 0; i < players.length; i++) {
				const p = players[i];
				if (
					p.isBracing &&
					p.braceStartAt &&
					now - p.braceStartAt.microsSinceUnixEpoch >= BRACE_MAX_US
				) {
					const cooldownUntil = ts(now + 1_000_000n);
					const updated = {
						...p,
						isBracing: false,
						braceStartAt: undefined,
						braceCooldownUntil: cooldownUntil
					};
					ctx.db.playerState.id.update(updated);
					players[i] = updated;
				}
			}
		}

		if (players.length === 0 || enemies.length === 0) {
			const nextTick = ctx.timestamp.microsSinceUnixEpoch + TICK_MS * 1000n;
			ctx.db.enemyTickJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(nextTick),
				sessionId: arg.sessionId
			});
			return;
		}

		const damageAccum = new Map<bigint, bigint>();
		const targetCounts = new Map<bigint, number>();
		for (const enemy of enemies) {
			let chosen = players[0];
			let chosenDist = BigInt(Number.MAX_SAFE_INTEGER);
			let bestAny = players[0];
			let bestAnyDist = BigInt(Number.MAX_SAFE_INTEGER);
			let bestAnyScore = Number.POSITIVE_INFINITY;
			let bestCap = players[0];
			let bestCapDist = BigInt(Number.MAX_SAFE_INTEGER);
			let bestCapScore = Number.POSITIVE_INFINITY;
			for (const p of players) {
				const dx = p.posX - enemy.posX;
				const dz = p.posZ - enemy.posZ;
				const dist = dx * dx + dz * dz;
				const baseScore = Number(dist);
				const jitterSeed = (now + enemy.id + p.id) % 1000n;
				const jitter = (Number(jitterSeed) / 1000 - 0.5) * TARGET_JITTER;
				const score = baseScore * (1 + jitter);
				if (score < bestAnyScore) {
					bestAnyScore = score;
					bestAny = p;
					bestAnyDist = dist;
				}
				const count = targetCounts.get(p.id) ?? 0;
				if (count < MAX_ENEMIES_PER_PLAYER && score < bestCapScore) {
					bestCapScore = score;
					bestCap = p;
					bestCapDist = dist;
				}
			}

			if (bestCapScore < Number.POSITIVE_INFINITY) {
				chosen = bestCap;
				chosenDist = bestCapDist;
			} else {
				chosen = bestAny;
				chosenDist = bestAnyDist;
			}
			targetCounts.set(chosen.id, (targetCounts.get(chosen.id) ?? 0) + 1);

			const dx = chosen.posX - enemy.posX;
			const dz = chosen.posZ - enemy.posZ;

			// Spitter: ranged acid spit instead of melee (7s cooldown)
			if (enemy.enemyType === 'spitter') {
				const SPIT_COOLDOWN_US = 7_000_000n;
				const canSpit =
					!enemy.lastSpitAt ||
					ctx.timestamp.microsSinceUnixEpoch >=
						enemy.lastSpitAt.microsSinceUnixEpoch + SPIT_COOLDOWN_US;
				if (chosenDist <= SPITTER_RANGE_SQ && !enemy.isDazed && canSpit) {
					const poolExpiry = ctx.timestamp.microsSinceUnixEpoch + 10_000_000n;
					ctx.db.acidPool.insert({
						id: 0n,
						sessionId: arg.sessionId,
						posX: enemy.posX + dx / 2n,
						posZ: enemy.posZ + dz / 2n,
						radius: 2000n,
						expiresAt: ts(poolExpiry)
					});
					ctx.db.enemy.id.update({ ...enemy, lastSpitAt: ts(now) });
				} else if (!enemy.isDazed) {
					const ageSec = enemy.spawnedAt
						? Number(now - enemy.spawnedAt.microsSinceUnixEpoch) / 1_000_000
						: 0;
					const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
					const speed = (ENEMY_BASE_SPEED['spitter'] * (enemy.speedMultiplier + timeBonus)) / 100n;
					const moveAmount = (speed * TICK_MS) / 1000n;
					const magnitude = bs(chosenDist);
					if (magnitude > 0n) {
						const dir = chosenDist < SPITTER_MIN_DIST_SQ ? -1n : 1n;
						const nx = enemy.posX + (dir * dx * moveAmount) / magnitude;
						const nz = enemy.posZ + (dir * dz * moveAmount) / magnitude;
						const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
						if (ax !== enemy.posX || az !== enemy.posZ)
							ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
					}
				} else if (
					enemy.dazedUntil &&
					ctx.timestamp.microsSinceUnixEpoch >= enemy.dazedUntil.microsSinceUnixEpoch
				) {
					ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
				}
				continue;
			}

			// Caster: fires a beam that deals damage at medium range (8s cooldown)
			if (enemy.enemyType === 'caster') {
				const BEAM_COOLDOWN_US = 4_000_000n;
				const canBeam =
					!enemy.lastSpitAt ||
					ctx.timestamp.microsSinceUnixEpoch >=
						enemy.lastSpitAt.microsSinceUnixEpoch + BEAM_COOLDOWN_US;
				if (chosenDist <= CASTER_RANGE_SQ && !enemy.isDazed && canBeam) {
					damageAccum.set(chosen.id, (damageAccum.get(chosen.id) ?? 0n) + 2n);
					ctx.db.enemy.id.update({ ...enemy, lastSpitAt: ts(now) });
				} else if (!enemy.isDazed) {
					const ageSec = enemy.spawnedAt
						? Number(now - enemy.spawnedAt.microsSinceUnixEpoch) / 1_000_000
						: 0;
					const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
					const speed = (ENEMY_BASE_SPEED['caster'] * (enemy.speedMultiplier + timeBonus)) / 100n;
					const moveAmount = (speed * TICK_MS) / 1000n;
					const magnitude = bs(chosenDist);
					if (magnitude > 0n) {
						const dir = chosenDist < CASTER_MIN_DIST_SQ ? -1n : 1n;
						const nx = enemy.posX + (dir * dx * moveAmount) / magnitude;
						const nz = enemy.posZ + (dir * dz * moveAmount) / magnitude;
						const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
						if (ax !== enemy.posX || az !== enemy.posZ)
							ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
					}
				} else if (
					enemy.dazedUntil &&
					ctx.timestamp.microsSinceUnixEpoch >= enemy.dazedUntil.microsSinceUnixEpoch
				) {
					ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
				}
				continue;
			}

			// Tank brace: bounce enemy back instead of dealing damage
			if (chosenDist <= MELEE_RANGE * MELEE_RANGE && chosen.isBracing && !enemy.isDazed) {
				const magnitude = bs(chosenDist);
				const knockback = 4000n;
				const newX =
					magnitude > 0n ? enemy.posX - (dx * knockback) / magnitude : enemy.posX - knockback;
				const newZ =
					magnitude > 0n ? enemy.posZ - (dz * knockback) / magnitude : enemy.posZ - knockback;
				const dazedUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 1_500_000n);
				ctx.db.enemy.id.update({ ...enemy, posX: newX, posZ: newZ, isDazed: true, dazedUntil });
				ctx.db.playerState.id.update({ ...chosen, score: chosen.score + 5n });
				continue;
			}

			// Normal: melee damage or move toward player
			const enemyRange = enemy.enemyType === 'boss' ? BOSS_MELEE_RANGE : MELEE_RANGE;
			if (chosenDist <= enemyRange * enemyRange && !enemy.isDazed) {
				const damage = enemy.enemyType === 'boss' ? 5n : enemy.enemyType === 'brute' ? 3n : 1n;
				damageAccum.set(chosen.id, (damageAccum.get(chosen.id) ?? 0n) + damage);
			} else if (!enemy.isDazed) {
				const ageSec = enemy.spawnedAt
					? Number(now - enemy.spawnedAt.microsSinceUnixEpoch) / 1_000_000
					: 0;
				const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
				const speed =
					((ENEMY_BASE_SPEED[enemy.enemyType] ?? 3000n) * (enemy.speedMultiplier + timeBonus)) /
					100n;
				const moveAmount = (speed * TICK_MS) / 1000n;
				const magnitude = bs(chosenDist);
				if (magnitude > 0n) {
					// Close range: always charge straight in
					const STRAFE_MIN_DIST_SQ = 36_000_000n; // ~6000 units (3x melee range)
					const perpX = -dz;
					const perpZ = dx;
					let strafeBias = 0;
					if (chosenDist > STRAFE_MIN_DIST_SQ) {
						// Phase-based strafing: 2.5s periods, unique per enemy (no oscillation)
						const STRAFE_PERIOD_US = 2_500_000n;
						const strafePhase = Number((now / STRAFE_PERIOD_US + enemy.id * 7n) % 12n);
						// fast: 6/12 phases strafe (~50%), basic: 4/12 (~33%), brute: never
						if (enemy.enemyType === 'fast') {
							if (strafePhase < 3) strafeBias = -1;
							else if (strafePhase < 6) strafeBias = 1;
						} else if (enemy.enemyType === 'basic') {
							if (strafePhase < 2) strafeBias = -1;
							else if (strafePhase < 4) strafeBias = 1;
						}
					}
					if (strafeBias !== 0) {
						// Diagonal strafe: 55% forward + 55% lateral
						const fwd = BigInt(Math.round(Number(moveAmount) * 0.55));
						const side = BigInt(Math.round(strafeBias * Number(moveAmount) * 0.55));
						const nx = enemy.posX + (dx * fwd) / magnitude + (perpX * side) / magnitude;
						const nz = enemy.posZ + (dz * fwd) / magnitude + (perpZ * side) / magnitude;
						const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
						if (ax !== enemy.posX || az !== enemy.posZ)
							ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
					} else {
						// Direct charge
						const nx = enemy.posX + (dx * moveAmount) / magnitude;
						const nz = enemy.posZ + (dz * moveAmount) / magnitude;
						const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
						if (ax !== enemy.posX || az !== enemy.posZ)
							ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
					}
				}
			} else {
				if (
					enemy.dazedUntil &&
					ctx.timestamp.microsSinceUnixEpoch >= enemy.dazedUntil.microsSinceUnixEpoch
				) {
					ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
				}
			}
		}

		// Apply all damage accumulated this tick — one write per player, correct total
		applyAccumulatedDamage(ctx, arg.sessionId, players, damageAccum);

		const nextTick = ctx.timestamp.microsSinceUnixEpoch + TICK_MS * 1000n;
		ctx.db.enemyTickJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextTick),
			sessionId: arg.sessionId
		});
	}
);

export const spawn_enemy = spacetimedb.reducer(
	{
		arg: EnemySpawnJob.rowType
	},
	(ctx, { arg }) => {
		const session = ctx.db.gameSession.id.find(arg.sessionId);
		if (!session || session.status !== 'active') return;

		const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)].filter(
			(p) => p.status === 'alive'
		);
		if (players.length === 0) return;

		const dynamicCap = ENEMY_CAP_BY_PLAYERS[Math.min(players.length, 4)] ?? 12;

		const currentEnemies = [...ctx.db.enemy.enemy_session_id.filter(arg.sessionId)].filter(
			(e) => e.isAlive
		);
		const baseInterval = 6_000_000n;
		const minInterval = 1_500_000n;
		const interval = baseInterval - session.cycleNumber * 600_000n;
		const nextInterval = interval < minInterval ? minInterval : interval;
		if (currentEnemies.length >= dynamicCap) {
			const nextSpawn = ctx.timestamp.microsSinceUnixEpoch + nextInterval;
			ctx.db.enemySpawnJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(nextSpawn),
				sessionId: arg.sessionId
			});
			return;
		}

		const seed = Number(ctx.timestamp.microsSinceUnixEpoch % 100n);
		let cumWeight = 0;
		let enemyType = 'basic';
		for (const { type, weight } of ENEMY_WEIGHTS) {
			cumWeight += weight;
			if (seed < cumWeight) {
				enemyType = type;
				break;
			}
		}

		// Pick a fixed wall spawn point — cycle through them with some pressure toward
		// the spawn point closest to the most threatened player
		const seedBase = ctx.timestamp.microsSinceUnixEpoch + session.mapSeed;
		const spawnIdx = Number(seedBase % BigInt(SPAWN_POINT_COUNT));
		const spawnAngle = ((spawnIdx + 0.5) / SPAWN_POINT_COUNT) * Math.PI * 2; // +0.5 offset matches frontend portal positions
		const spawnX = BigInt(Math.round(Math.cos(spawnAngle) * WALL_SPAWN_RADIUS));
		const spawnZ = BigInt(Math.round(Math.sin(spawnAngle) * WALL_SPAWN_RADIUS));

		const baseMultiplier = 100n + session.cycleNumber * 5n;
		const hpBonus = session.cycleNumber * ENEMY_HP_CYCLE_BONUS;
		const baseHp = ENEMY_HP[enemyType] ?? 50n;
		const maxHp = baseHp + hpBonus;
		const maxCap = (baseHp * ENEMY_HP_MAX_MULTIPLIER) / 100n;
		const cappedHp = maxHp > maxCap ? maxCap : maxHp;

		ctx.db.enemy.insert({
			id: 0n,
			sessionId: arg.sessionId,
			enemyType,
			hp: cappedHp,
			maxHp: cappedHp,
			posX: spawnX,
			posZ: spawnZ,
			speedMultiplier: baseMultiplier,
			isDazed: false,
			dazedUntil: undefined,
			isAlive: true,
			isMarked: false,
			markedUntil: undefined,
			lastSpitAt: undefined,
			diedAt: undefined,
			spawnedAt: ts(ctx.timestamp.microsSinceUnixEpoch)
		});

		const nextSpawn = ctx.timestamp.microsSinceUnixEpoch + nextInterval;
		ctx.db.enemySpawnJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextSpawn),
			sessionId: arg.sessionId
		});
	}
);

export const advance_day_phase = spacetimedb.reducer(
	{
		arg: DayPhaseJob.rowType
	},
	(ctx, { arg }) => {
		const session = ctx.db.gameSession.id.find(arg.sessionId);
		if (!session || session.status !== 'active') return;

		const currentIdx = DAY_PHASES.indexOf(session.dayPhase);
		const nextIdx = (currentIdx + 1) % DAY_PHASES.length;
		const nextPhase = DAY_PHASES[nextIdx];
		const newCycle = nextIdx === 0 ? session.cycleNumber + 1n : session.cycleNumber;

		ctx.db.gameSession.id.update({
			...session,
			dayPhase: nextPhase,
			cycleNumber: newCycle,
			phaseStartedAt: ctx.timestamp
		});

		const nextAdvance = ctx.timestamp.microsSinceUnixEpoch + 60_000_000n;
		ctx.db.dayPhaseJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextAdvance),
			sessionId: arg.sessionId
		});
	}
);

// ─── Boss Reducer ─────────────────────────────────────────────────────────────

export const fire_boss_spawn = spacetimedb.reducer(
	{ arg: BossSpawnJob.rowType },
	(ctx, { arg }) => {
		const session = ctx.db.gameSession.id.find(arg.sessionId);
		if (!session || session.status !== 'active') return;

		// Only spawn if no boss is currently alive
		for (const e of ctx.db.enemy.enemy_session_id.filter(arg.sessionId)) {
			if (e.enemyType === 'boss' && e.isAlive) return;
		}

		// Kill all existing non-boss enemies
		const now = ctx.timestamp.microsSinceUnixEpoch;
		for (const e of ctx.db.enemy.enemy_session_id.filter(arg.sessionId)) {
			if (e.isAlive && e.enemyType !== 'boss') {
				ctx.db.enemy.id.update({ ...e, isAlive: false, diedAt: ts(now) });
			}
		}

		// Delete the countdown timer
		for (const bt of ctx.db.bossTimer.boss_timer_session_id.filter(arg.sessionId)) {
			ctx.db.bossTimer.id.delete(bt.id);
		}

		const bossHp = ENEMY_HP['boss'];
		const bossSpeed = ENEMY_BASE_SPEED['boss'];

		ctx.db.enemy.insert({
			id: 0n,
			sessionId: arg.sessionId,
			enemyType: 'boss',
			hp: bossHp,
			maxHp: bossHp,
			posX: 0n,
			posZ: 0n,
			speedMultiplier: bossSpeed,
			isDazed: false,
			dazedUntil: undefined,
			isAlive: true,
			isMarked: false,
			markedUntil: undefined,
			lastSpitAt: undefined,
			diedAt: undefined,
			spawnedAt: ts(ctx.timestamp.microsSinceUnixEpoch)
		});
	}
);

// ─── Phase 4 Reducers ─────────────────────────────────────────────────────────

export const mark_enemy = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		enemyId: t.u64()
	},
	(ctx, { sessionId, enemyId }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.classChoice !== 'spotter') throw new SenderError('Not a Spotter');
		if (ps.status !== 'alive') return;
		if (
			ps.markCooldownUntil &&
			ctx.timestamp.microsSinceUnixEpoch < ps.markCooldownUntil.microsSinceUnixEpoch
		) {
			throw new SenderError('Mark on cooldown');
		}

		const enemy = ctx.db.enemy.id.find(enemyId);
		if (!enemy || !enemy.isAlive) return;
		const dx = enemy.posX - ps.posX;
		const dz = enemy.posZ - ps.posZ;
		if (dx * dx + dz * dz > 225_000_000n) return; // 15 units

		const expiresAt = ctx.timestamp.microsSinceUnixEpoch + 5_000_000n;
		// Mark info lives directly on the enemy row — no separate mark insert needed
		const alreadyMarked =
			enemy.isMarked &&
			enemy.markedUntil &&
			ctx.timestamp.microsSinceUnixEpoch < enemy.markedUntil.microsSinceUnixEpoch;
		ctx.db.enemy.id.update({ ...enemy, isMarked: true, markedUntil: ts(expiresAt) });

		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 2_000_000n);
		const scoreAdd = alreadyMarked ? 0n : 10n;
		ctx.db.playerState.id.update({
			...ps,
			score: ps.score + scoreAdd,
			markCooldownUntil: cooldownUntil
		});
	}
);

export const spotter_flash = spacetimedb.reducer({ sessionId: t.u64() }, (ctx, { sessionId }) => {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'spotter') throw new SenderError('Not a Spotter');
	if (ps.status !== 'alive') return;
	const COOLDOWN_US = 1_500_000n;
	if (
		ps.pingCooldownUntil &&
		ctx.timestamp.microsSinceUnixEpoch < ps.pingCooldownUntil.microsSinceUnixEpoch
	)
		throw new SenderError('Flash on cooldown');

	// Cone parameters: 5 unit range, ±45° (90° total)
	const CONE_RANGE = 5000; // fixed-point (× 1000)
	const HALF_ANGLE = Math.PI / 4;
	const STUN_US = 2_000_000n;

	const facingRad = Number(ps.facingAngle) / 1000;
	const fwdX = -Math.sin(facingRad);
	const fwdZ = -Math.cos(facingRad);
	const cosHalf = Math.cos(HALF_ANGLE);

	let stunned = 0n;
	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive) continue;
		const ex = Number(e.posX) - Number(ps.posX);
		const ez = Number(e.posZ) - Number(ps.posZ);
		const dist = Math.sqrt(ex * ex + ez * ez);
		if (dist > CONE_RANGE || dist < 1) continue;
		const dot = (ex * fwdX + ez * fwdZ) / dist;
		if (dot < cosHalf) continue;
		// Enemy is in cone — stun it
		const dazedUntil = ts(ctx.timestamp.microsSinceUnixEpoch + STUN_US);
		ctx.db.enemy.id.update({ ...e, isDazed: true, dazedUntil });
		stunned += 1n;
	}

	ctx.db.playerState.id.update({
		...ps,
		score: ps.score + stunned * 10n,
		pingCooldownUntil: ts(ctx.timestamp.microsSinceUnixEpoch + COOLDOWN_US),
		lastFlashAt: ctx.timestamp
	});
});

export const attack_enemy = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		enemyId: t.u64(),
		suppress: t.bool()
	},
	(ctx, { sessionId, enemyId, suppress }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || (ps.classChoice !== 'gunner' && ps.classChoice !== 'healer')) {
			throw new SenderError('Class cannot attack');
		}
		if (ps.status !== 'alive') return;

		const enemy = ctx.db.enemy.id.find(enemyId);
		if (!enemy || !enemy.isAlive) return;
		const dx = enemy.posX - ps.posX;
		const dz = enemy.posZ - ps.posZ;
		if (dx * dx + dz * dz > 100_000_000n) return; // 10 units

		const dmg = WEAPON_DAMAGE[ps.classChoice] ?? 15n;
		const newHp = enemy.hp > dmg ? enemy.hp - dmg : 0n;

		const shotAt = ctx.timestamp;
		if (newHp <= 0n) {
			ctx.db.enemy.id.update({
				...enemy,
				hp: 0n,
				isAlive: false,
				diedAt: ts(ctx.timestamp.microsSinceUnixEpoch)
			});
			ctx.db.playerState.id.update({ ...ps, score: ps.score + 1n, lastShotAt: shotAt });
		} else {
			let updatedEnemy = { ...enemy, hp: newHp };
			if (suppress && ps.classChoice === 'gunner') {
				const suppressUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 1_000_000n);
				updatedEnemy = { ...updatedEnemy, isDazed: true, dazedUntil: suppressUntil };
			}
			ctx.db.enemy.id.update(updatedEnemy);
			ctx.db.playerState.id.update({ ...ps, lastShotAt: shotAt });
		}
	}
);

export const heal_player = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		targetIdentity: t.identity()
	},
	(ctx, { sessionId, targetIdentity }) => {
		let healer: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				healer = p;
				break;
			}
		}
		if (!healer || healer.classChoice !== 'healer') throw new SenderError('Not a Healer');
		if (healer.status !== 'alive') return;
		if (
			healer.healCooldownUntil &&
			ctx.timestamp.microsSinceUnixEpoch < healer.healCooldownUntil.microsSinceUnixEpoch
		) {
			throw new SenderError('Heal on cooldown');
		}

		let target: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(targetIdentity)) {
				target = p;
				break;
			}
		}
		if (!target || target.status !== 'alive') return;
		if (target.playerIdentity.isEqual(ctx.sender)) return;

		const dx = target.posX - healer.posX;
		const dz = target.posZ - healer.posZ;
		if (dx * dx + dz * dz > HEAL_RANGE_SQ) return;

		const newHp = target.hp + HEAL_AMOUNT > target.maxHp ? target.maxHp : target.hp + HEAL_AMOUNT;
		const shotAt = ctx.timestamp;
		ctx.db.playerState.id.update({ ...target, hp: newHp });

		const HEALER_SELF_HEAL = 8n;
		const healerNewHp =
			healer.hp + HEALER_SELF_HEAL > healer.maxHp ? healer.maxHp : healer.hp + HEALER_SELF_HEAL;
		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 2_000_000n);
		const healed = newHp > target.hp;
		const scoreAdd = healed ? 5n : 0n;
		ctx.db.playerState.id.update({
			...healer,
			hp: healerNewHp,
			lastShotAt: shotAt,
			score: healer.score + scoreAdd,
			healCooldownUntil: cooldownUntil,
			lastHealAt: shotAt,
			healTargetIdentity: targetIdentity
		});
	}
);

export const adrenaline = spacetimedb.reducer({ sessionId: t.u64() }, (ctx, { sessionId }) => {
	console.log('ADRENALINE: reducer called, sessionId=' + sessionId);
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	console.log('ADRENALINE: found player', ps ? 'yes' : 'no', 'status=', ps?.status);
	if (!ps || ps.status !== 'alive') return;

	// Server-side cooldown check (5s)
	const now = ctx.timestamp.microsSinceUnixEpoch;
	console.log('ADRENALINE: cooldown check', ps.adrenalineCooldownUntil);
	if (ps.adrenalineCooldownUntil && ps.adrenalineCooldownUntil.microsSinceUnixEpoch > now) {
		console.log('ADRENALINE: rejected - on cooldown');
		return;
	}

	// Fill stamina to max
	console.log('ADRENALINE: filling stamina', ps.stamina, '->', ps.maxStamina);

	const cooldownUntil = ts(now + 5_000_000n);
	ctx.db.playerState.id.update({
		...ps,
		stamina: ps.maxStamina,
		lastMoveAt: ctx.timestamp,
		adrenalineCooldownUntil: cooldownUntil
	});
	console.log('ADRENALINE: success!');
});

export const shield_bash = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		enemyId: t.u64().optional()
	},
	(ctx, { sessionId, enemyId }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.classChoice !== 'tank') throw new SenderError('Not a Tank');
		if (ps.status !== 'alive') return;

		if (
			ps.bashCooldownUntil &&
			ctx.timestamp.microsSinceUnixEpoch < ps.bashCooldownUntil.microsSinceUnixEpoch
		)
			return;

		const BASH_COOLDOWN_US = 1_500_000n;
		const bashCooldown = ts(ctx.timestamp.microsSinceUnixEpoch + BASH_COOLDOWN_US);
		ctx.db.playerState.id.update({ ...ps, bashCooldownUntil: bashCooldown });
		ps = { ...ps, bashCooldownUntil: bashCooldown };

		if (enemyId !== undefined) {
			const enemy = ctx.db.enemy.id.find(enemyId);
			if (!enemy || !enemy.isAlive) return;
			const dx0 = enemy.posX - ps.posX;
			const dz0 = enemy.posZ - ps.posZ;
			if (dx0 * dx0 + dz0 * dz0 > 25_000_000n) return; // 5 units

			const dx = enemy.posX - ps.posX;
			const dz = enemy.posZ - ps.posZ;
			const mag = bs(dx * dx + dz * dz);
			const knockback = 4000n;
			const newX = mag > 0n ? enemy.posX + (dx * knockback) / mag : enemy.posX + knockback;
			const newZ = mag > 0n ? enemy.posZ + (dz * knockback) / mag : enemy.posZ + knockback;
			const dazedUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 1_500_000n);
			ctx.db.enemy.id.update({ ...enemy, posX: newX, posZ: newZ, isDazed: true, dazedUntil });
			ctx.db.playerState.id.update({ ...ps, score: ps.score + 5n });
		}
	}
);

export const clear_debris = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		debrisId: t.u64()
	},
	(ctx, { sessionId, debrisId }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.status !== 'alive') return;
		// Debris table added in Phase 5 — placeholder
	}
);

export const brace_start = spacetimedb.reducer(
	{
		sessionId: t.u64()
	},
	(ctx, { sessionId }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.classChoice !== 'tank') return;
		if (ps.status !== 'alive') return;
		if (
			ps.braceCooldownUntil &&
			ctx.timestamp.microsSinceUnixEpoch < ps.braceCooldownUntil.microsSinceUnixEpoch
		) {
			return;
		}
		if (ps.isBracing) return;
		ctx.db.playerState.id.update({ ...ps, isBracing: true, braceStartAt: ctx.timestamp });
	}
);

export const brace_end = spacetimedb.reducer(
	{
		sessionId: t.u64()
	},
	(ctx, { sessionId }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.classChoice !== 'tank') return;
		if (ps.status !== 'alive') return;
		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 1_000_000n);
		ctx.db.playerState.id.update({
			...ps,
			isBracing: false,
			braceStartAt: undefined,
			braceCooldownUntil: cooldownUntil
		});
	}
);

export const revive_start = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		targetIdentity: t.identity()
	},
	(ctx, { sessionId, targetIdentity }) => {
		let healer: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				healer = p;
				break;
			}
		}
		if (!healer || healer.classChoice !== 'healer') throw new SenderError('Not a Healer');
		if (healer.status !== 'alive') return;

		if (
			healer.reviveCooldownUntil &&
			ctx.timestamp.microsSinceUnixEpoch < healer.reviveCooldownUntil.microsSinceUnixEpoch
		) {
			throw new SenderError('Revive on cooldown');
		}

		let target: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
			if (p.playerIdentity.isEqual(targetIdentity)) {
				target = p;
				break;
			}
		}
		if (!target || target.status !== 'downed') throw new SenderError('Target is not downed');

		const dx = healer.posX - target.posX;
		const dz = healer.posZ - target.posZ;
		if (dx * dx + dz * dz > 9_000_000n) throw new SenderError('Too far from downed player');

		ctx.db.reviveChannel.insert({
			id: 0n,
			sessionId,
			healerIdentity: ctx.sender,
			targetIdentity,
			channelStartedAt: ctx.timestamp
		});

		const completeAt = ctx.timestamp.microsSinceUnixEpoch + REVIVE_CHANNEL_US;
		ctx.db.reviveCompleteJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(completeAt),
			sessionId,
			healerIdentity: ctx.sender,
			targetIdentity
		});
	}
);

export const complete_revive = spacetimedb.reducer(
	{
		arg: ReviveCompleteJob.rowType
	},
	(ctx, { arg }) => {
		let channel: any;
		for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(arg.sessionId)) {
			if (
				c.healerIdentity.isEqual(arg.healerIdentity) &&
				c.targetIdentity.isEqual(arg.targetIdentity)
			) {
				channel = c;
				break;
			}
		}
		if (!channel) return; // interrupted

		let healer: any, target: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
			if (p.playerIdentity.isEqual(arg.healerIdentity)) healer = p;
			if (p.playerIdentity.isEqual(arg.targetIdentity)) target = p;
		}

		if (!healer || !target || target.status !== 'downed') {
			ctx.db.reviveChannel.id.delete(channel.id);
			return;
		}

		const speedBoostUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 5_000_000n);
		ctx.db.playerState.id.update({ ...target, hp: 50n, status: 'alive', speedBoostUntil });

		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + REVIVE_COOLDOWN_US);
		ctx.db.playerState.id.update({
			...healer,
			hp: healer.maxHp,
			reviveCooldownUntil: cooldownUntil,
			score: healer.score + 20n
		});

		ctx.db.reviveChannel.id.delete(channel.id);
	}
);

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

spacetimedb.clientConnected((_ctx) => {});

spacetimedb.clientDisconnected((ctx) => {
	// Lobby cleanup
	for (const p of ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)) {
		const lobby = ctx.db.lobby.id.find(p.lobbyId);
		// Public: kick on disconnect unless game is active. Private: only kick if waiting.
		const shouldKick =
			lobby && (lobby.isPublic ? lobby.status !== 'active' : lobby.status === 'waiting');
		if (shouldKick) {
			ctx.db.lobbyPlayer.id.delete(p.id);
			const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(p.lobbyId)];
			if (remaining.length === 0) {
				clearLobbyMessages(ctx, p.lobbyId);
				ctx.db.lobby.id.delete(p.lobbyId);
			} else {
				if (lobby.isPublic) {
					ctx.db.lobby.id.update({ ...lobby, playerCount: lobby.playerCount - 1n });
				} else {
					const isHost = lobby.hostIdentity.isEqual(ctx.sender);
					const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
					ctx.db.lobby.id.update({
						...lobby,
						playerCount: lobby.playerCount - 1n,
						hostIdentity: newHost
					});
				}
			}
		}
		break;
	}

	// In-game cleanup — if all players have disconnected, end the session
	for (const ps of ctx.db.playerState.player_state_identity.filter(ctx.sender)) {
		if (ps.status !== 'alive' && ps.status !== 'downed') continue;
		const others = [...ctx.db.playerState.player_state_session_id.filter(ps.sessionId)].filter(
			(p) =>
				!p.playerIdentity.isEqual(ctx.sender) && (p.status === 'alive' || p.status === 'downed')
		);
		if (others.length === 0) {
			end_session(ctx, ps.sessionId);
		}
	}
});
