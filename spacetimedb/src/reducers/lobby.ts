// ─── Lobby Reducer Implementations ────────────────────────────────────────────
// Plain functions — registered with spacetimedb.reducer() in index.ts.
// Imports only from external packages, constants, helpers, and shared.ts.

import { SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import { generateCode, classMaxHp, classMaxStamina, ts } from '../helpers.js';
import { clearLobbyMessages } from './shared.js';
import { BOSS_SPAWN_INTERVAL_US, CLASS_WALK_SPEED, CLASS_SPRINT_SPEED } from '../constants.js';

// ─── create_lobby ─────────────────────────────────────────────────────────────

export function createLobby(ctx: any, { playerName, classChoice, isPublic }: any) {
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

// ─── join_lobby ───────────────────────────────────────────────────────────────

export function joinLobby(ctx: any, { lobbyId, playerName, classChoice }: any) {
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

// ─── join_by_code ─────────────────────────────────────────────────────────────

export function joinByCode(ctx: any, { code, playerName, classChoice }: any) {
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

// ─── quick_join ───────────────────────────────────────────────────────────────

export function quickJoin(ctx: any, { playerName, classChoice }: any) {
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

		ctx.db.lobbyAfkJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 120_000_000n),
			lobbyId: lobby.id,
			playerIdentity: ctx.sender
		});
	}
}

// ─── set_class ────────────────────────────────────────────────────────────────

export function setClass(ctx: any, { lobbyId, classChoice }: any) {
	const valid = ['spotter', 'gunner', 'tank', 'healer', ''];
	if (!valid.includes(classChoice)) throw new SenderError('Invalid class');

	const lobby = ctx.db.lobby.id.find(lobbyId);
	if (!lobby) throw new SenderError('Lobby not found');

	// Allow deselecting (empty string) even if class is taken
	if (classChoice !== '') {
		const sameClassCount = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)].filter(
			(p: any) => p.classChoice === classChoice && !p.playerIdentity.isEqual(ctx.sender)
		).length;
		if (sameClassCount >= 1) {
			throw new SenderError(`${classChoice} already taken`);
		}
	}

	for (const p of ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			if (lobby.isPublic && p.isReady) throw new SenderError('Cannot change class after readying');
			ctx.db.lobbyPlayer.id.update({ ...p, classChoice, isReady: false });
			return;
		}
	}
	throw new SenderError('Not in this lobby');
}

// ─── set_ready ────────────────────────────────────────────────────────────────

export function setReady(ctx: any, { lobbyId, isReady }: any) {
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
		if (allPlayers.length >= 2 && allPlayers.every((p: any) => p.isReady && p.classChoice)) {
			ctx.db.lobby.id.update({ ...lobby, status: 'countdown' });
			ctx.db.lobbyCountdown.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 3_000_000n),
				lobbyId
			});
		}
	}
}

// ─── leave_lobby ──────────────────────────────────────────────────────────────

export function leaveLobby(ctx: any, { lobbyId }: any) {
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

// ─── kick_player ──────────────────────────────────────────────────────────────

export function kickPlayer(ctx: any, { lobbyId, playerIdentity }: any) {
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

// ─── start_countdown ──────────────────────────────────────────────────────────

export function startCountdown(ctx: any, { lobbyId }: any) {
	const lobby = ctx.db.lobby.id.find(lobbyId);
	if (!lobby) throw new SenderError('Lobby not found');
	if (lobby.isPublic) throw new SenderError('Public lobbies start automatically');
	if (!lobby.hostIdentity.isEqual(ctx.sender)) throw new SenderError('Only host can start');
	if (lobby.status !== 'waiting') throw new SenderError('Already starting');

	const players = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(lobbyId)];
	if (players.length < 1) throw new SenderError('Need at least 1 player');
	if (!players.every((p: any) => p.isReady && p.classChoice)) {
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

// ─── fire_start_game (scheduled) ──────────────────────────────────────────────

export function fireStartGame(ctx: any, { arg }: any) {
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
		fogStartedAt: undefined,
		fogEndsAt: undefined,
		mapSeed: ctx.timestamp.microsSinceUnixEpoch,
		bossSpawnCount: 0n
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
			walkSpeed: CLASS_WALK_SPEED[p.classChoice] ?? 7500n,
			sprintSpeed: CLASS_SPRINT_SPEED[p.classChoice] ?? 9000n,
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
			speedBoostUntil: undefined,
			doubleDamageUntil: undefined,
			lastDamagedAt: undefined
		});

		if (p.classChoice === 'spotter') {
			ctx.db.spotterState.insert({
				id: 0n,
				sessionId: session.id,
				playerIdentity: p.playerIdentity,
				steadyShotCooldownUntil: undefined,
				flashCooldownUntil: undefined,
				lastFlashAt: undefined,
				ultimateCooldownUntil: undefined,
				lastUltimateAt: undefined
			});
		} else if (p.classChoice === 'gunner') {
			ctx.db.gunnerState.insert({
				id: 0n,
				sessionId: session.id,
				playerIdentity: p.playerIdentity,
				adrenalineCooldownUntil: undefined,
				lastAdrenalineAt: undefined,
				ultimateCooldownUntil: undefined,
				lastUltimateAt: undefined
			});
		} else if (p.classChoice === 'tank') {
			ctx.db.tankState.insert({
				id: 0n,
				sessionId: session.id,
				playerIdentity: p.playerIdentity,
				isCharging: false,
				chargeUntil: undefined,
				chargeDirX: 0n,
				chargeDirZ: 0n,
				chargeCooldownUntil: undefined,
				axeSwingCooldownUntil: undefined,
				lastAxeSwingAt: undefined,
				lastChargeAt: undefined,
				ultimateCooldownUntil: undefined,
				lastUltimateAt: undefined
			});
		} else if (p.classChoice === 'healer') {
			ctx.db.healerState.insert({
				id: 0n,
				sessionId: session.id,
				playerIdentity: p.playerIdentity,
				healCooldownUntil: undefined,
				reviveCooldownUntil: undefined,
				lastHealAt: undefined,
				healTargetIdentity: undefined,
				chainHealTargetIdentity: undefined,
				ultimateCooldownUntil: undefined,
				lastUltimateAt: undefined,
				regenCarry: 0n
			});
		}
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

// ─── fire_lobby_afk_kick (scheduled) ──────────────────────────────────────────

export function fireLobbyAfkKick(ctx: any, { arg }: any) {
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

// ─── send_lobby_message ───────────────────────────────────────────────────────

export function sendLobbyMessage(ctx: any, { lobbyId, message }: any) {
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
