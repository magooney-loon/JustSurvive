import { table, t } from 'spacetimedb/server';

// ─── Lobby Tables ─────────────────────────────────────────────────────────────

export const Lobby = table(
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

export const LobbyPlayer = table(
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

// ─── Game Tables ──────────────────────────────────────────────────────────────

export const GameSession = table(
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

export const PlayerState = table(
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
		bashCooldownUntil: t.timestamp().optional(),
		adrenalineCooldownUntil: t.timestamp().optional(),
		lastHealAt: t.timestamp().optional(),
		healTargetIdentity: t.identity().optional(),
		lastFlashAt: t.timestamp().optional()
	}
);

export const Enemy = table(
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
		lastSpitAt: t.timestamp().optional(),
		diedAt: t.timestamp().optional(),
		spawnedAt: t.timestamp().optional()
	}
);

// ─── Phase 4 Tables ───────────────────────────────────────────────────────────

export const Mark = table(
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

export const AcidPool = table(
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

export const ReviveChannel = table(
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
		channelStartedAt: t.timestamp(),
		shieldHp: t.u64()
	}
);

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const LobbyMessage = table(
	{
		name: 'lobby_message',
		public: true,
		indexes: [
			{
				name: 'lobby_message_lobby_id',
				accessor: 'lobby_message_lobby_id',
				algorithm: 'btree',
				columns: ['lobbyId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		lobbyId: t.u64(),
		playerIdentity: t.identity(),
		playerName: t.string(),
		message: t.string(),
		sentAt: t.timestamp()
	}
);

// ─── Boss Tables ──────────────────────────────────────────────────────────────

export const BossTimer = table(
	{
		name: 'boss_timer',
		public: true,
		indexes: [
			{
				name: 'boss_timer_session_id',
				accessor: 'boss_timer_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		spawnAt: t.timestamp()
	}
);

// ─── Leaderboard Tables ───────────────────────────────────────────────────────

export const LobbyResult = table(
	{
		name: 'lobby_result',
		public: true,
		indexes: [
			{
				name: 'lobby_result_score',
				accessor: 'lobby_result_score',
				algorithm: 'btree',
				columns: ['totalScore']
			},
			{
				name: 'lobby_result_session',
				accessor: 'lobby_result_session',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		lobbyCode: t.string(),
		combo: t.string(),
		playerCount: t.u64(),
		totalScore: t.u64(),
		survivalSecs: t.u64(),
		cycleNumber: t.u64(),
		createdAt: t.timestamp()
	}
);

export const LobbyResultPlayer = table(
	{
		name: 'lobby_result_player',
		public: true,
		indexes: [
			{
				name: 'lobby_result_player_session',
				accessor: 'lobby_result_player_session',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		playerName: t.string(),
		classChoice: t.string()
	}
);

export const GlobalStats = table(
	{
		name: 'global_stats',
		public: true
	},
	{
		id: t.u64().primaryKey(),
		totalGames: t.u64(),
		totalSurvivalSecs: t.u64(),
		bestSurvivalSecs: t.u64(),
		classSpotter: t.u64(),
		classGunner: t.u64(),
		classTank: t.u64(),
		classHealer: t.u64()
	}
);

export const SquadRecord = table(
	{
		name: 'squad_record',
		public: true,
		indexes: [
			{
				name: 'squad_record_combo',
				accessor: 'squad_record_combo',
				algorithm: 'btree',
				columns: ['combo']
			},
			{
				name: 'squad_record_times_played',
				accessor: 'squad_record_times_played',
				algorithm: 'btree',
				columns: ['timesPlayed']
			},
			{
				name: 'squad_record_best_score',
				accessor: 'squad_record_best_score',
				algorithm: 'btree',
				columns: ['bestScore']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		combo: t.string(),
		timesPlayed: t.u64(),
		bestScore: t.u64(),
		bestSurvivalSecs: t.u64()
	}
);
