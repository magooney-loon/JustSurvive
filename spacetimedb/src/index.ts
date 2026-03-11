import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

// ─── Tables ───────────────────────────────────────────────────────────────────

const Lobby = table(
	{
		name: 'lobby',
		public: true,
		indexes: [
			{ name: 'lobby_status', accessor: 'lobby_status', algorithm: 'btree', columns: ['status'] },
			{ name: 'lobby_code', accessor: 'lobby_code', algorithm: 'btree', columns: ['code'] }
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		hostIdentity: t.identity(),
		code: t.string(),
		isPublic: t.bool(),
		status: t.string(),
		playerCount: t.u64(),
		maxPlayers: t.u64(),
		createdAt: t.timestamp()
	}
);

const LobbyPlayer = table(
	{
		name: 'lobby_player',
		public: true,
		indexes: [
			{
				name: 'lobby_player_lobby_id',
				accessor: 'lobby_player_lobby_id',
				algorithm: 'btree',
				columns: ['lobbyId']
			},
			{
				name: 'lobby_player_identity',
				accessor: 'lobby_player_identity',
				algorithm: 'btree',
				columns: ['playerIdentity']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		lobbyId: t.u64(),
		playerIdentity: t.identity(),
		playerName: t.string(),
		classChoice: t.string(),
		isReady: t.bool(),
		joinedAt: t.timestamp()
	}
);

const GameSession = table(
	{
		name: 'game_session',
		public: true,
		indexes: [
			{
				name: 'game_session_lobby_id',
				accessor: 'game_session_lobby_id',
				algorithm: 'btree',
				columns: ['lobbyId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		lobbyId: t.u64(),
		status: t.string(),
		startedAt: t.timestamp(),
		endedAt: t.timestamp().optional(),
		dayPhase: t.string(),
		cycleNumber: t.u64(),
		phaseStartedAt: t.timestamp(),
		fogActive: t.bool(),
		mapSeed: t.u64()
	}
);

const PlayerState = table(
	{
		name: 'player_state',
		public: true,
		indexes: [
			{
				name: 'player_state_session_id',
				accessor: 'player_state_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			},
			{
				name: 'player_state_identity',
				accessor: 'player_state_identity',
				algorithm: 'btree',
				columns: ['playerIdentity']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		playerIdentity: t.identity(),
		classChoice: t.string(),
		hp: t.u64(),
		maxHp: t.u64(),
		stamina: t.u64(),
		maxStamina: t.u64(),
		lastMoveAt: t.timestamp(),
		staminaRegenStartAt: t.timestamp().optional(),
		staminaRegenCarry: t.u64(),
		lastShotAt: t.timestamp().optional(),
		posX: t.i64(),
		posY: t.i64(),
		posZ: t.i64(),
		status: t.string(),
		score: t.u64(),
		facingAngle: t.i64(), // milliradians * 1000, e.g. PI = 3142
		// Phase 4
		isBracing: t.bool(),
		braceStartAt: t.timestamp().optional(),
		braceCooldownUntil: t.timestamp().optional(),
		speedBoostUntil: t.timestamp().optional(),
		reviveCooldownUntil: t.timestamp().optional(),
		healCooldownUntil: t.timestamp().optional(),
		markCooldownUntil: t.timestamp().optional(),
		pingCooldownUntil: t.timestamp().optional(),
		bashCooldownUntil: t.timestamp().optional()
	}
);

const Enemy = table(
	{
		name: 'enemy',
		public: true,
		indexes: [
			{
				name: 'enemy_session_id',
				accessor: 'enemy_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		enemyType: t.string(),
		hp: t.u64(),
		maxHp: t.u64(),
		posX: t.i64(),
		posZ: t.i64(),
		speedMultiplier: t.u64(),
		isDazed: t.bool(),
		dazedUntil: t.timestamp().optional(),
		isAlive: t.bool(),
		// Phase 4
		isMarked: t.bool(),
		markedUntil: t.timestamp().optional(),
		lastSpitAt: t.timestamp().optional()
	}
);

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

const EliminateJob = table(
	{
		name: 'eliminate_job',
		scheduled: (): any => eliminate_downed,
		indexes: [
			{
				name: 'eliminate_job_session',
				accessor: 'eliminate_job_session',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		sessionId: t.u64(),
		targetIdentity: t.identity()
	}
);

// ─── Phase 4 Tables ──────────────────────────────────────────────────────────

const Mark = table(
	{
		name: 'mark',
		public: true,
		indexes: [
			{
				name: 'mark_session_id',
				accessor: 'mark_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		sourceIdentity: t.identity(),
		targetType: t.string(), // 'enemy' | 'location'
		posX: t.i64(),
		posZ: t.i64(),
		expiresAt: t.timestamp()
	}
);

const AcidPool = table(
	{
		name: 'acid_pool',
		public: true,
		indexes: [
			{
				name: 'acid_pool_session_id',
				accessor: 'acid_pool_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		posX: t.i64(),
		posZ: t.i64(),
		radius: t.u64(), // fixed-point: 2000 = 2 world units
		expiresAt: t.timestamp()
	}
);

const ReviveChannel = table(
	{
		name: 'revive_channel',
		public: true,
		indexes: [
			{
				name: 'revive_channel_session_id',
				accessor: 'revive_channel_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		healerIdentity: t.identity(),
		targetIdentity: t.identity(),
		channelStartedAt: t.timestamp()
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
	enemyTickJob: EnemyTickJob,
	enemySpawnJob: EnemySpawnJob,
	dayPhaseJob: DayPhaseJob,
	eliminateJob: EliminateJob,
	mark: Mark,
	acidPool: AcidPool,
	reviveChannel: ReviveChannel,
	reviveCompleteJob: ReviveCompleteJob
});

export default spacetimedb;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(seed: bigint): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = seed;
	let code = '';
	for (let i = 0; i < 6; i++) {
		s = (s * 1664525n + 1013904223n) & 0xffffffffn;
		code += chars[Number(s % BigInt(chars.length))];
	}
	return code;
}

function classMaxHp(cls: string): bigint {
	return cls === 'tank' ? 150n : 100n;
}

function classMaxStamina(cls: string): bigint {
	if (cls === 'spotter') return 150n;
	if (cls === 'tank') return 200n;
	return 80n;
}

// Shorthand to create a Timestamp-compatible value from raw microseconds
function ts(micros: bigint): any {
	return { __timestamp_micros_since_unix_epoch__: micros };
}

function bigintSqrt(n: bigint): bigint {
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

function apply_player_damage(ctx: any, sessionId: bigint, ps: any, damage: bigint) {
	const newHp = ps.hp > damage ? ps.hp - damage : 0n;
	if (newHp <= 0n && ps.status === 'alive') {
		ctx.db.playerState.id.update({ ...ps, hp: 0n, status: 'downed' });
		const eliminateAt = ctx.timestamp.microsSinceUnixEpoch + 30_000_000n;
		ctx.db.eliminateJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(eliminateAt),
			sessionId,
			targetIdentity: ps.playerIdentity
		});
		// Interrupt revive if this player was healing someone
		for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
			if (c.healerIdentity.isEqual(ps.playerIdentity)) {
				ctx.db.reviveChannel.id.delete(c.id);
				break;
			}
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
	// Note: PlayerState rows kept until next game starts (game over screen needs them)

	const lobby = ctx.db.lobby.id.find(session.lobbyId);
	if (lobby) {
		ctx.db.lobby.id.update({ ...lobby, status: 'waiting' });
		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobby.id)) {
			ctx.db.lobbyPlayer.id.update({ ...p, isReady: false });
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

		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
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
		for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
			if (p.playerIdentity.isEqual(ctx.sender)) {
				if (isReady && !p.classChoice) throw new SenderError('Select a class first');
				ctx.db.lobbyPlayer.id.update({ ...p, isReady });
				return;
			}
		}
		throw new SenderError('Not in this lobby');
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
			ctx.db.lobby.id.delete(lobbyId);
			return;
		}

		const newCount = lobby.playerCount - 1n;
		const isHost = lobby.hostIdentity.isEqual(ctx.sender);
		const newHost = isHost ? remaining[0].playerIdentity : lobby.hostIdentity;
		ctx.db.lobby.id.update({ ...lobby, playerCount: newCount, hostIdentity: newHost });
	}
);

export const start_countdown = spacetimedb.reducer(
	{
		lobbyId: t.u64()
	},
	(ctx, { lobbyId }) => {
		const lobby = ctx.db.lobby.id.find(lobbyId);
		if (!lobby) throw new SenderError('Lobby not found');
		if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can start');
		if (lobby.status !== 'waiting') throw new SenderError('Already starting');

		const players = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
		if (players.length < 2) throw new SenderError('Need at least 2 players');
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
				bashCooldownUntil: undefined
			});
		}

		ctx.db.lobby.id.update({ ...lobby, status: 'in_progress' });

		const now = ctx.timestamp.microsSinceUnixEpoch;

		ctx.db.enemyTickJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(now + 100_000n),
			sessionId: session.id
		});
		const INITIAL_SPAWN_JOBS = 2;
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

const ENEMY_BASE_SPEED: Record<string, bigint> = {
	basic: 3200n,
	fast: 5200n,
	brute: 2100n,
	spitter: 1700n
};
const ENEMY_CAP = 16;
const MELEE_RANGE = 2000n;
const SPITTER_RANGE_SQ = 144_000_000n; // 12 world units squared
const TICK_MS = 100n;
const MAX_ENEMIES_PER_PLAYER = 3;
const TARGET_JITTER = 0.08; // +-8% distance jitter

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
		const BRACE_MAX_US = 5_000_000n;
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

		const targetCounts = new Map<bigint, number>();
		for (const enemy of enemies) {
			if (players.length === 0) break;

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
					const speed = (ENEMY_BASE_SPEED['spitter'] * enemy.speedMultiplier) / 100n;
					const moveAmount = (speed * TICK_MS) / 1000n;
					const magnitude = bigintSqrt(chosenDist);
					if (magnitude > 0n) {
						const tSec = Number(now % 10_000_000n) / 1_000_000;
						const phase = Number(enemy.id % 1000n) / 1000;
						const wobble =
							Math.sin(tSec * 3.6 + phase * 6.28) + 0.5 * Math.sin(tSec * 7.2 + phase * 12.56);
						const flankBoost = chosenDist > 100_000_000n ? 1.4 : 0.6;
						const wobbleScale = BigInt(Math.round(wobble * Number(moveAmount) * 0.35 * flankBoost));
						const perpX = -dz;
						const perpZ = dx;
						ctx.db.enemy.id.update({
							...enemy,
							posX:
								enemy.posX +
								(dx * moveAmount) / magnitude +
								(perpX * wobbleScale) / (magnitude > 0n ? magnitude : 1n),
							posZ:
								enemy.posZ +
								(dz * moveAmount) / magnitude +
								(perpZ * wobbleScale) / (magnitude > 0n ? magnitude : 1n)
						});
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
				const magnitude = bigintSqrt(chosenDist);
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
			if (chosenDist <= MELEE_RANGE * MELEE_RANGE && !enemy.isDazed) {
				const damage = enemy.enemyType === 'brute' ? 3n : 1n;
				apply_player_damage(ctx, arg.sessionId, chosen, damage);
			} else if (!enemy.isDazed) {
				const speed = ((ENEMY_BASE_SPEED[enemy.enemyType] ?? 3000n) * enemy.speedMultiplier) / 100n;
				const moveAmount = (speed * TICK_MS) / 1000n;
				const magnitude = bigintSqrt(chosenDist);
				if (magnitude > 0n) {
					const tSec = Number(now % 10_000_000n) / 1_000_000;
					const phase = Number(enemy.id % 1000n) / 1000;
					const wobble =
						Math.sin(tSec * 3.6 + phase * 6.28) + 0.5 * Math.sin(tSec * 7.2 + phase * 12.56);
					const flankBoost = chosenDist > 100_000_000n ? 1.4 : 0.6;
					const wobbleScale = BigInt(Math.round(wobble * Number(moveAmount) * 0.35 * flankBoost));
					const perpX = -dz;
					const perpZ = dx;
					ctx.db.enemy.id.update({
						...enemy,
						posX:
							enemy.posX +
							(dx * moveAmount) / magnitude +
							(perpX * wobbleScale) / (magnitude > 0n ? magnitude : 1n),
						posZ:
							enemy.posZ +
							(dz * moveAmount) / magnitude +
							(perpZ * wobbleScale) / (magnitude > 0n ? magnitude : 1n)
					});
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

		const nextTick = ctx.timestamp.microsSinceUnixEpoch + TICK_MS * 1000n;
		ctx.db.enemyTickJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextTick),
			sessionId: arg.sessionId
		});
	}
);

const ENEMY_WEIGHTS = [
	{ type: 'basic', weight: 60 },
	{ type: 'fast', weight: 25 },
	{ type: 'brute', weight: 10 },
	{ type: 'spitter', weight: 5 }
];

const ENEMY_HP: Record<string, bigint> = {
	basic: 50n,
	fast: 25n,
	brute: 150n,
	spitter: 60n
};

export const spawn_enemy = spacetimedb.reducer(
	{
		arg: EnemySpawnJob.rowType
	},
	(ctx, { arg }) => {
		const session = ctx.db.gameSession.id.find(arg.sessionId);
		if (!session || session.status !== 'active') return;

		const currentEnemies = [...ctx.db.enemy.enemy_session_id.filter(arg.sessionId)].filter(
			(e) => e.isAlive
		);
		const baseInterval = 6_000_000n;
		const minInterval = 1_500_000n;
		const interval = baseInterval - session.cycleNumber * 600_000n;
		const nextInterval = interval < minInterval ? minInterval : interval;
		if (currentEnemies.length >= ENEMY_CAP) {
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

		const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)].filter(
			(p) => p.status === 'alive'
		);
		if (players.length === 0) return;

		const avgZ = players.reduce((s, p) => s + p.posZ, 0n) / BigInt(players.length);
		const seedBase = ctx.timestamp.microsSinceUnixEpoch + session.mapSeed;
		const spreadX = (seedBase % 60_000n) - 30_000n;
		const spreadZ = ((seedBase / 97n) % 40_000n) - 20_000n;
		const spawnX = spreadX;
		const spawnZ = avgZ - 30_000n + spreadZ;

		const baseMultiplier = 100n + session.cycleNumber * 5n;

		ctx.db.enemy.insert({
			id: 0n,
			sessionId: arg.sessionId,
			enemyType,
			hp: ENEMY_HP[enemyType] ?? 50n,
			maxHp: ENEMY_HP[enemyType] ?? 50n,
			posX: spawnX,
			posZ: spawnZ,
			speedMultiplier: baseMultiplier,
			isDazed: false,
			dazedUntil: undefined,
			isAlive: true,
			isMarked: false,
			markedUntil: undefined,
			lastSpitAt: undefined
		});

		const nextSpawn = ctx.timestamp.microsSinceUnixEpoch + nextInterval;
		ctx.db.enemySpawnJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextSpawn),
			sessionId: arg.sessionId
		});
	}
);

const DAY_PHASES = ['sunset', 'dusk', 'twilight', 'night', 'deep_night'];

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

export const eliminate_downed = spacetimedb.reducer(
	{
		arg: EliminateJob.rowType
	},
	(ctx, { arg }) => {
		let ps: any;
		for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
			if (p.playerIdentity.isEqual(arg.targetIdentity)) {
				ps = p;
				break;
			}
		}
		if (!ps || ps.status !== 'downed') return;

		ctx.db.playerState.id.update({ ...ps, status: 'eliminated' });

		const remaining = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)].filter(
			(p) => p.status === 'alive' || p.status === 'downed'
		);

		if (remaining.length === 0) {
			end_session(ctx, arg.sessionId);
		}
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

		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 1_500_000n);
		const scoreAdd = alreadyMarked ? 0n : 10n;
		ctx.db.playerState.id.update({
			...ps,
			score: ps.score + scoreAdd,
			markCooldownUntil: cooldownUntil
		});
	}
);

export const ping_location = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		posX: t.i64(),
		posZ: t.i64()
	},
	(ctx, { sessionId, posX, posZ }) => {
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
			ps.pingCooldownUntil &&
			ctx.timestamp.microsSinceUnixEpoch < ps.pingCooldownUntil.microsSinceUnixEpoch
		) {
			throw new SenderError('Ping on cooldown');
		}

		const expiresAt = ctx.timestamp.microsSinceUnixEpoch + 10_000_000n;
		ctx.db.mark.insert({
			id: 0n,
			sessionId,
			sourceIdentity: ctx.sender,
			targetType: 'location',
			posX,
			posZ,
			expiresAt: ts(expiresAt)
		});

		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 10_000_000n);
		ctx.db.playerState.id.update({
			...ps,
			score: ps.score + 5n,
			pingCooldownUntil: cooldownUntil
		});
	}
);

const WEAPON_DAMAGE: Record<string, bigint> = {
	gunner: 15n,
	healer: 35n
};

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
			ctx.db.enemy.id.update({ ...enemy, hp: 0n, isAlive: false });
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

const HEAL_AMOUNT = 30n;
const HEAL_RANGE_SQ = 100_000_000n; // 10 units

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

		const cooldownUntil = ts(ctx.timestamp.microsSinceUnixEpoch + 2_000_000n);
		const healed = newHp > target.hp;
		const scoreAdd = healed ? 5n : 0n;
		ctx.db.playerState.id.update({
			...healer,
			lastShotAt: shotAt,
			score: healer.score + scoreAdd,
			healCooldownUntil: cooldownUntil
		});
	}
);

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
			const mag = bigintSqrt(dx * dx + dz * dz);
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

const REVIVE_COOLDOWN_US = 15_000_000n;
const REVIVE_CHANNEL_US = 2_000_000n;

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
			reviveCooldownUntil: cooldownUntil,
			score: healer.score + 20n
		});

		ctx.db.reviveChannel.id.delete(channel.id);
	}
);

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

spacetimedb.clientConnected((_ctx) => {});

spacetimedb.clientDisconnected((ctx) => {
	for (const p of ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)) {
		const lobby = ctx.db.lobby.id.find(p.lobbyId);
		if (lobby && lobby.status === 'waiting') {
			ctx.db.lobbyPlayer.id.delete(p.id);
			const remaining = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(p.lobbyId)];
			if (remaining.length === 0) {
				ctx.db.lobby.id.delete(p.lobbyId);
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
		break;
	}
});
