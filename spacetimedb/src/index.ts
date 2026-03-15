import { schema, table, t } from 'spacetimedb/server';
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
	BossTimer,
	Boss,
	DroppedItem,
	SpotterState,
	GunnerState,
	TankState,
	HealerState
} from './tables.js';

// ─── Reducer implementations ──────────────────────────────────────────────────

import {
	createLobby,
	joinLobby,
	joinByCode,
	quickJoin,
	setClass,
	setReady,
	leaveLobby,
	kickPlayer,
	startCountdown,
	fireStartGame,
	fireLobbyAfkKick,
	sendLobbyMessage
} from './reducers/lobby.js';
import { movePlayer, advanceDayPhase } from './reducers/game.js';
import { enemyTick } from './reducers/enemies/tick.js';
import { spawnEnemy, fireBossSpawn } from './reducers/enemies/spawn.js';
import { steadyShot, spotterFlash, spotterUltimate } from './reducers/classes/spotter.js';
import { attackEnemy, adrenaline as adrenalineImpl, gunnerUltimate } from './reducers/classes/gunner.js';
import { healPlayer, reviveStart, completeRevive, healerUltimate } from './reducers/classes/healer.js';
import { axeSwing, chargeActivate, tankUltimate } from './reducers/classes/tank.js';
import { clearLobbyMessages, endSession } from './reducers/shared.js';

// ─── Scheduled Tables ─────────────────────────────────────────────────────────
// Must stay here — forward-reference their reducer via lazy `(): any => fn`.

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
	bossTimer: BossTimer,
	boss: Boss,
	droppedItem: DroppedItem,
	spotterState: SpotterState,
	gunnerState: GunnerState,
	tankState: TankState,
	healerState: HealerState
});

export default spacetimedb;

// ─── Lobby Reducers ───────────────────────────────────────────────────────────

export const create_lobby = spacetimedb.reducer(
	{ playerName: t.string(), classChoice: t.string(), isPublic: t.bool() },
	createLobby
);

export const join_lobby = spacetimedb.reducer(
	{ lobbyId: t.u64(), playerName: t.string(), classChoice: t.string() },
	joinLobby
);

export const join_by_code = spacetimedb.reducer(
	{ code: t.string(), playerName: t.string(), classChoice: t.string() },
	joinByCode
);

export const quick_join = spacetimedb.reducer(
	{ playerName: t.string(), classChoice: t.string() },
	quickJoin
);

export const set_class = spacetimedb.reducer(
	{ lobbyId: t.u64(), classChoice: t.string() },
	setClass
);

export const set_ready = spacetimedb.reducer(
	{ lobbyId: t.u64(), isReady: t.bool() },
	setReady
);

export const leave_lobby = spacetimedb.reducer(
	{ lobbyId: t.u64() },
	leaveLobby
);

export const kick_player = spacetimedb.reducer(
	{ lobbyId: t.u64(), playerIdentity: t.identity() },
	kickPlayer
);

export const start_countdown = spacetimedb.reducer(
	{ lobbyId: t.u64() },
	startCountdown
);

export const fire_start_game = spacetimedb.reducer(
	{ arg: LobbyCountdown.rowType },
	fireStartGame
);

export const fire_lobby_afk_kick = spacetimedb.reducer(
	{ arg: LobbyAfkJob.rowType },
	fireLobbyAfkKick
);

export const send_lobby_message = spacetimedb.reducer(
	{ lobbyId: t.u64(), message: t.string() },
	sendLobbyMessage
);

// ─── Game Reducers ────────────────────────────────────────────────────────────

export const move_player = spacetimedb.reducer(
	{
		sessionId: t.u64(),
		posX: t.i64(),
		posY: t.i64(),
		posZ: t.i64(),
		isSprinting: t.bool(),
		facingAngle: t.i64()
	},
	movePlayer
);

export const enemy_tick = spacetimedb.reducer(
	{ arg: EnemyTickJob.rowType },
	enemyTick
);

export const spawn_enemy = spacetimedb.reducer(
	{ arg: EnemySpawnJob.rowType },
	spawnEnemy
);

export const advance_day_phase = spacetimedb.reducer(
	{ arg: DayPhaseJob.rowType },
	advanceDayPhase
);

export const fire_boss_spawn = spacetimedb.reducer(
	{ arg: BossSpawnJob.rowType },
	fireBossSpawn
);

// ─── Ability Reducers ─────────────────────────────────────────────────────────

export const steady_shot = spacetimedb.reducer(
	{ sessionId: t.u64(), enemyId: t.u64() },
	steadyShot
);

export const spotter_flash = spacetimedb.reducer(
	{ sessionId: t.u64() },
	spotterFlash
);

export const attack_enemy = spacetimedb.reducer(
	{ sessionId: t.u64(), enemyId: t.u64(), suppress: t.bool() },
	attackEnemy
);

export const heal_player = spacetimedb.reducer(
	{ sessionId: t.u64() },
	healPlayer
);

export const adrenaline = spacetimedb.reducer(
	{ sessionId: t.u64() },
	adrenalineImpl
);

export const axe_swing = spacetimedb.reducer(
	{ sessionId: t.u64() },
	axeSwing
);


export const charge_activate = spacetimedb.reducer(
	{ sessionId: t.u64() },
	chargeActivate
);

export const spotter_ultimate = spacetimedb.reducer(
	{ sessionId: t.u64() },
	spotterUltimate
);

export const gunner_ultimate = spacetimedb.reducer(
	{ sessionId: t.u64() },
	gunnerUltimate
);

export const tank_ultimate = spacetimedb.reducer(
	{ sessionId: t.u64() },
	tankUltimate
);

export const healer_ultimate = spacetimedb.reducer(
	{ sessionId: t.u64() },
	healerUltimate
);

export const revive_start = spacetimedb.reducer(
	{ sessionId: t.u64(), targetIdentity: t.identity() },
	reviveStart
);

export const complete_revive = spacetimedb.reducer(
	{ arg: ReviveCompleteJob.rowType },
	completeRevive
);

// ─── Lifecycle ────────────────────────────────────────────────────────────────

spacetimedb.clientConnected((_ctx) => {});

spacetimedb.clientDisconnected((ctx) => {
	// Lobby cleanup
	for (const p of ctx.db.lobbyPlayer.lobby_player_identity.filter(ctx.sender)) {
		const lobby = ctx.db.lobby.id.find(p.lobbyId);
		// Public: kick on disconnect unless game is in progress. Private: only kick if waiting.
		const shouldKick =
			lobby && (lobby.isPublic ? lobby.status !== 'in_progress' : lobby.status === 'waiting');
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
			endSession(ctx, ps.sessionId);
		}
	}
});
