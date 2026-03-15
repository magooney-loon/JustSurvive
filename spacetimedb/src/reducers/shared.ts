// ─── Shared ctx-dependent helpers ─────────────────────────────────────────────
// These functions require a SpacetimeDB reducer context (ctx) and are shared
// across multiple reducer files. They have no imports beyond `any`-typed ctx.

export function clearLobbyMessages(ctx: any, lobbyId: bigint) {
	for (const m of ctx.db.lobbyMessage.lobby_message_lobby_id.filter(lobbyId)) {
		ctx.db.lobbyMessage.id.delete(m.id);
	}
}

// Apply damage to a single player (use only when one damage source per transaction,
// e.g. acid pool in move_player). For enemy_tick (multiple sources per tick),
// accumulate into damageAccum and use applyAccumulatedDamage instead.
export function applyPlayerDamage(ctx: any, sessionId: bigint, ps: any, damage: bigint) {
	// If this player is a healer currently channeling a revive, absorb damage into the revive shield first
	let remainingDamage = damage;
	for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
		if (c.healerIdentity.isEqual(ps.playerIdentity)) {
			if (c.shieldHp >= remainingDamage) {
				// Shield absorbs all damage — revive continues
				ctx.db.reviveChannel.id.update({ ...c, shieldHp: c.shieldHp - remainingDamage });
				return;
			} else {
				// Shield breaks — overflow damages healer and interrupts revive
				remainingDamage -= c.shieldHp;
				ctx.db.reviveChannel.id.delete(c.id);
			}
			break;
		}
	}

	const newHp = ps.hp > remainingDamage ? ps.hp - remainingDamage : 0n;
	if (newHp <= 0n && ps.status === 'alive') {
		ctx.db.playerState.id.update({ ...ps, hp: 0n, status: 'downed', lastDamagedAt: ctx.timestamp });

		// Interrupt any revive this player was healing
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
			endSession(ctx, sessionId);
		}
	} else {
		ctx.db.playerState.id.update({ ...ps, hp: newHp, lastDamagedAt: ctx.timestamp });
	}
}

// Apply all accumulated damage after the enemy loop — avoids snapshot isolation issues
// where multiple enemies hitting the same player in one tick each see the original HP.
export function applyAccumulatedDamage(
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

		let remainingDamage = totalDamage;
		for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
			if (c.healerIdentity.isEqual(ps.playerIdentity)) {
				if (c.shieldHp >= remainingDamage) {
					ctx.db.reviveChannel.id.update({ ...c, shieldHp: c.shieldHp - remainingDamage });
					remainingDamage = 0n;
				} else {
					remainingDamage -= c.shieldHp;
					ctx.db.reviveChannel.id.delete(c.id);
				}
				break;
			}
		}
		if (remainingDamage === 0n) continue;

		const newHp = ps.hp > remainingDamage ? ps.hp - remainingDamage : 0n;
		const willDown = newHp <= 0n;
		ctx.db.playerState.id.update({
			...ps,
			hp: willDown ? 0n : newHp,
			status: willDown ? 'downed' : ps.status,
			lastDamagedAt: ctx.timestamp
		});
		if (willDown) {
			newlyDownedIds.add(playerId);
			for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(sessionId)) {
				if (c.healerIdentity.isEqual(ps.playerIdentity)) {
					ctx.db.reviveChannel.id.delete(c.id);
					break;
				}
			}
		}
	}

	if (newlyDownedIds.size === 0) return;
	const anyStillAlive = alivePlayers.some((p) => !newlyDownedIds.has(p.id));
	if (!anyStillAlive) {
		endSession(ctx, sessionId);
	}
}

export function endSession(ctx: any, sessionId: bigint) {
	const session = ctx.db.gameSession.id.find(sessionId);
	if (!session) return;
	ctx.db.gameSession.id.update({ ...session, status: 'finished', endedAt: ctx.timestamp });

	// Delete enemies immediately
	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		ctx.db.enemy.id.delete(e.id);
	}
	// Delete boss immediately
	for (const b of ctx.db.boss.boss_session_id.filter(sessionId)) {
		ctx.db.boss.id.delete(b.id);
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
	// Clean up class state tables
	for (const s of ctx.db.spotterState.spotter_state_session_id.filter(sessionId)) {
		ctx.db.spotterState.id.delete(s.id);
	}
	for (const g of ctx.db.gunnerState.gunner_state_session_id.filter(sessionId)) {
		ctx.db.gunnerState.id.delete(g.id);
	}
	for (const t of ctx.db.tankState.tank_state_session_id.filter(sessionId)) {
		ctx.db.tankState.id.delete(t.id);
	}
	for (const h of ctx.db.healerState.healer_state_session_id.filter(sessionId)) {
		ctx.db.healerState.id.delete(h.id);
	}
	// Note: PlayerState rows kept until next game starts (game over screen needs them)

	// Get lobby reference early (before it's deleted for public lobbies)
	const lobby = ctx.db.lobby.id.find(session.lobbyId);

	// ─── Leaderboard ─────────────────────────────────────────────────────────────
	// MUST run BEFORE cleaning up lobbyPlayers (they're deleted for public lobbies)
	const sessionPlayers = [...ctx.db.playerState.player_state_session_id.filter(sessionId)];
	const sessionLobbyPlayers = [...ctx.db.lobbyPlayer.lobby_player_lobby_id.filter(session.lobbyId)];
	const classes = sessionLobbyPlayers
		.map((p: any) => p.classChoice)
		.filter((c: string) => c !== '')
		.sort();
	const combo = classes.length > 0 ? classes.join(',') : 'none';
	const totalScore = sessionPlayers.reduce((acc: bigint, p: any) => acc + p.score, 0n);
	const survivalMicros =
		(ctx.timestamp.microsSinceUnixEpoch as bigint) -
		(session.startedAt.microsSinceUnixEpoch as bigint);
	const survivalSecs = survivalMicros > 0n ? survivalMicros / 1_000_000n : 0n;

	// 1. GlobalStats upsert (id always 1n)
	const spotterCount = BigInt(classes.filter((c: string) => c === 'spotter').length);
	const gunnerCount = BigInt(classes.filter((c: string) => c === 'gunner').length);
	const tankCount = BigInt(classes.filter((c: string) => c === 'tank').length);
	const healerCount = BigInt(classes.filter((c: string) => c === 'healer').length);
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
}
