import type { DbConnection } from './module_bindings/index.js';
import type { Lobby } from './module_bindings/types.js';

export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const gameState = $state({
	currentLobbyId: null as bigint | null,
	currentSessionId: null as bigint | null,
	localPlayerClass: null as PlayerClass | null,
	localPlayerName: 'Player',
	error: null as string | null,
});

export { gameState };

let conn: DbConnection | null = null;

export const gameActions = {
	init(connection: DbConnection) {
		conn = connection;
	},
	setPlayerName(name: string) {
		gameState.localPlayerName = name.trim() || 'Player';
	},
	async hostLobby(isPublic: boolean) {
		if (!conn) return;
		gameState.error = null;
		try {
			conn.reducers.createLobby({
				playerName: gameState.localPlayerName,
				classChoice: gameState.localPlayerClass ?? '',
				isPublic,
			});
		} catch (e) {
			gameState.error = String(e);
		}
	},
	async joinById(lobbyId: bigint) {
		if (!conn) return;
		conn.reducers.joinLobby({
			lobbyId,
			playerName: gameState.localPlayerName,
			classChoice: gameState.localPlayerClass ?? '',
		});
	},
	async joinByCode(code: string) {
		if (!conn) return;
		conn.reducers.joinByCode({
			code: code.toUpperCase(),
			playerName: gameState.localPlayerName,
			classChoice: gameState.localPlayerClass ?? '',
		});
	},
	setClass(cls: PlayerClass, lobbyId: bigint) {
		if (!conn) return;
		gameState.localPlayerClass = cls;
		conn.reducers.setClass({ lobbyId, classChoice: cls });
	},
	setReady(lobbyId: bigint, isReady: boolean) {
		if (!conn) return;
		conn.reducers.setReady({ lobbyId, isReady });
	},
	startCountdown(lobbyId: bigint) {
		if (!conn) return;
		conn.reducers.startCountdown({ lobbyId });
	},
	leaveLobby(lobbyId: bigint) {
		if (!conn) return;
		conn.reducers.leaveLobby({ lobbyId });
		gameState.currentLobbyId = null;
	},
	quickplay(lobbies: readonly Lobby[]) {
		if (!conn) return;
		gameState.error = null;
		const available = lobbies.find(
			l => l.isPublic && l.status === 'waiting' && l.playerCount < l.maxPlayers,
		);
		if (available) {
			conn.reducers.joinLobby({
				lobbyId: available.id,
				playerName: gameState.localPlayerName,
				classChoice: gameState.localPlayerClass ?? '',
			});
		} else {
			conn.reducers.createLobby({
				playerName: gameState.localPlayerName,
				classChoice: gameState.localPlayerClass ?? '',
				isPublic: true,
			});
		}
	},
	clearError() {
		gameState.error = null;
	},
};
