import type { DbConnection } from './module_bindings/index.js';
import type { Lobby } from './module_bindings/types.js';

export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const gameState = $state({
	currentLobbyId: null as bigint | null,
	currentSessionId: null as bigint | null,
	localPlayerClass: null as PlayerClass | null,
	localPlayerName: 'Player',
	error: null as string | null,
	leavingLobby: false,
});

export { gameState };

let conn: DbConnection | null = null;

function setError(e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	gameState.error = msg.replace(/^SenderError:\s*/i, '');
}

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
			await conn.reducers.createLobby({
				playerName: gameState.localPlayerName,
				classChoice: gameState.localPlayerClass ?? '',
				isPublic,
			});
		} catch (e) {
			setError(e);
		}
	},
	async joinById(lobbyId: bigint) {
		if (!conn) return;
		gameState.error = null;
		try {
			await conn.reducers.joinLobby({
				lobbyId,
				playerName: gameState.localPlayerName,
				classChoice: gameState.localPlayerClass ?? '',
			});
		} catch (e) {
			setError(e);
		}
	},
	async joinByCode(code: string) {
		if (!conn) return;
		gameState.error = null;
		try {
			await conn.reducers.joinByCode({
				code: code.toUpperCase(),
				playerName: gameState.localPlayerName,
				classChoice: gameState.localPlayerClass ?? '',
			});
		} catch (e) {
			setError(e);
		}
	},
	async setClass(cls: PlayerClass, lobbyId: bigint) {
		if (!conn) return;
		gameState.localPlayerClass = cls;
		try {
			await conn.reducers.setClass({ lobbyId, classChoice: cls });
		} catch (e) {
			setError(e);
		}
	},
	async setReady(lobbyId: bigint, isReady: boolean) {
		if (!conn) return;
		try {
			await conn.reducers.setReady({ lobbyId, isReady });
		} catch (e) {
			setError(e);
		}
	},
	async startCountdown(lobbyId: bigint) {
		if (!conn) return;
		try {
			await conn.reducers.startCountdown({ lobbyId });
		} catch (e) {
			setError(e);
		}
	},
	leaveLobby(lobbyId: bigint) {
		if (!conn) return;
		gameState.leavingLobby = true;
		conn.reducers.leaveLobby({ lobbyId });
		gameState.currentLobbyId = null;
	},
	async quickplay(lobbies: readonly Lobby[]) {
		if (!conn) return;
		gameState.error = null;
		const available = lobbies.find(
			l => l.isPublic && l.status === 'waiting' && l.playerCount < l.maxPlayers,
		);
		try {
			if (available) {
				await conn.reducers.joinLobby({
					lobbyId: available.id,
					playerName: gameState.localPlayerName,
					classChoice: gameState.localPlayerClass ?? '',
				});
			} else {
				await conn.reducers.createLobby({
					playerName: gameState.localPlayerName,
					classChoice: gameState.localPlayerClass ?? '',
					isPublic: true,
				});
			}
		} catch (e) {
			setError(e);
		}
	},
	clearError() {
		gameState.error = null;
	},
};
