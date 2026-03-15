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
		fogStartedAt: t.timestamp().optional(),  // VFX: when current fog event began
		fogEndsAt: t.timestamp().optional(),      // VFX: when current fog event ends
		mapSeed: t.u64(),
		bossSpawnCount: t.u64()
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
		speedBoostUntil: t.timestamp().optional(),
		stunUntil: t.timestamp().optional(),  // player stun from boss abilities
		slowedUntil: t.timestamp().optional(), // player slow from scp_096 slam
		lastDamagedAt: t.timestamp().optional() // healer regen ramp tracking
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

export const Boss = table(
	{
		name: 'boss',
		public: true,
		indexes: [
			{
				name: 'boss_session_id',
				accessor: 'boss_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		bossType: t.string(), // 'ghost_dragon' | 'worm_monster' | 'rabid_dog' | 'scp_096'
		hp: t.u64(),
		maxHp: t.u64(),
		posX: t.i64(),
		posZ: t.i64(),
		phase: t.u64(), // 0 = normal, 1 = enraged (≤50% HP)
		isAlive: t.bool(),
		isDazed: t.bool(),
		dazedUntil: t.timestamp().optional(),
		isMarked: t.bool(),
		markedUntil: t.timestamp().optional(),
		spawnedAt: t.timestamp(),
		diedAt: t.timestamp().optional(),
		ability1CooldownUntil: t.timestamp().optional(),
		ability2CooldownUntil: t.timestamp().optional(),
		isHidden: t.bool(),   // ghost_dragon: invisible during hide & seek
		isBurrowed: t.bool()  // worm_monster: underground during burrow
	}
);

// ─── Class State Tables ───────────────────────────────────────────────────────

export const SpotterState = table(
	{
		name: 'spotter_state',
		public: true,
		indexes: [
			{
				name: 'spotter_state_session_id',
				accessor: 'spotter_state_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		playerIdentity: t.identity(),
		steadyShotCooldownUntil: t.timestamp().optional(),
		flashCooldownUntil: t.timestamp().optional(),
		lastFlashAt: t.timestamp().optional(),   // VFX: when flash cone was fired
		ultimateCooldownUntil: t.timestamp().optional(),
		lastUltimateAt: t.timestamp().optional() // VFX: when ultimate was last fired
	}
);

export const GunnerState = table(
	{
		name: 'gunner_state',
		public: true,
		indexes: [
			{
				name: 'gunner_state_session_id',
				accessor: 'gunner_state_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		playerIdentity: t.identity(),
		adrenalineCooldownUntil: t.timestamp().optional(),
		ultimateCooldownUntil: t.timestamp().optional(),
		lastUltimateAt: t.timestamp().optional() // VFX: when ultimate was last fired
	}
);

export const TankState = table(
	{
		name: 'tank_state',
		public: true,
		indexes: [
			{
				name: 'tank_state_session_id',
				accessor: 'tank_state_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		playerIdentity: t.identity(),
		isCharging: t.bool(),
		chargeUntil: t.timestamp().optional(),
		chargeDirX: t.i64(),
		chargeDirZ: t.i64(),
		chargeCooldownUntil: t.timestamp().optional(),
		axeSwingCooldownUntil: t.timestamp().optional(),
		lastAxeSwingAt: t.timestamp().optional(),   // VFX: when axe was last swung
		lastChargeAt: t.timestamp().optional(),     // VFX: when charge was last activated
		ultimateCooldownUntil: t.timestamp().optional(),
		lastUltimateAt: t.timestamp().optional()  // VFX: when ultimate was last fired
	}
);

export const HealerState = table(
	{
		name: 'healer_state',
		public: true,
		indexes: [
			{
				name: 'healer_state_session_id',
				accessor: 'healer_state_session_id',
				algorithm: 'btree',
				columns: ['sessionId']
			}
		]
	},
	{
		id: t.u64().primaryKey().autoInc(),
		sessionId: t.u64(),
		playerIdentity: t.identity(),
		healCooldownUntil: t.timestamp().optional(),
		reviveCooldownUntil: t.timestamp().optional(),
		lastHealAt: t.timestamp().optional(),                // VFX: primary heal beam
		healTargetIdentity: t.identity().optional(),         // VFX: primary beam target
		chainHealTargetIdentity: t.identity().optional(),    // VFX: chain beam target
		ultimateCooldownUntil: t.timestamp().optional(),
		lastUltimateAt: t.timestamp().optional(),            // VFX: when ultimate was last fired
		regenCarry: t.u64()                                  // milliHP carry for fractional regen (1000 = 1 HP)
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
