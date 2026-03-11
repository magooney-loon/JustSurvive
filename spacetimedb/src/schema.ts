import { table, t } from 'spacetimedb/server';

// Tables added Phase 2+
// Note: LobbyCountdown is defined in index.ts (it references fire_start_game which is also there)

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
		code: t.string(), // 6-char uppercase join code
		isPublic: t.bool(),
		status: t.string(), // 'waiting' | 'countdown' | 'in_progress' | 'game_over'
		playerCount: t.u64(),
		maxPlayers: t.u64(), // always 4
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
		classChoice: t.string(), // 'spotter' | 'gunner' | 'tank' | 'healer' | '' (unselected)
		isReady: t.bool(),
		joinedAt: t.timestamp()
	}
);

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
		status: t.string(), // 'active' | 'finished'
		startedAt: t.timestamp(),
		endedAt: t.timestamp().optional(),
		dayPhase: t.string(), // 'sunset' | 'dusk' | 'twilight' | 'night' | 'deep_night'
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
		posX: t.i64(), // fixed-point: value * 0.001 = world units
		posY: t.i64(),
		posZ: t.i64(),
		status: t.string(), // 'alive' | 'downed' | 'eliminated'
		score: t.u64()
	}
);
