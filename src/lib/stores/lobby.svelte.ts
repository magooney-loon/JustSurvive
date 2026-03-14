import type { DbConnection } from '$bindings/index.js';
import type { Identity } from 'spacetimedb';

export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const lobbyState = $state({
	currentLobbyId: null as bigint | null,
	currentSessionId: null as bigint | null,
	localPlayerClass: null as PlayerClass | null,
	localPlayerName: 'Player',
	error: null as string | null,
	leavingLobby: false,
	gameStartedAt: null as number | null,
	playerJoinedAt: null as number | null
});

export { lobbyState };

let conn: DbConnection | null = null;

function setError(e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	lobbyState.error = msg.replace(/^SenderError:\s*/i, '');
}

export const lobbyActions = {
	init(connection: DbConnection) {
		conn = connection;
	},
	setPlayerName(name: string) {
		lobbyState.localPlayerName = name.trim() || 'Player';
	},
	async hostLobby(isPublic: boolean) {
		if (!conn) return;
		lobbyState.error = null;
		try {
			await conn.reducers.createLobby({
				playerName: lobbyState.localPlayerName,
				classChoice: lobbyState.localPlayerClass ?? '',
				isPublic
			});
		} catch (e) {
			setError(e);
		}
	},
	async joinById(lobbyId: bigint) {
		if (!conn) return;
		lobbyState.error = null;
		try {
			await conn.reducers.joinLobby({
				lobbyId,
				playerName: lobbyState.localPlayerName,
				classChoice: lobbyState.localPlayerClass ?? ''
			});
		} catch (e) {
			setError(e);
		}
	},
	async joinByCode(code: string) {
		if (!conn) return;
		lobbyState.error = null;
		try {
			await conn.reducers.joinByCode({
				code: code.toUpperCase(),
				playerName: lobbyState.localPlayerName,
				classChoice: lobbyState.localPlayerClass ?? ''
			});
		} catch (e) {
			setError(e);
		}
	},
	async setClass(cls: PlayerClass, lobbyId: bigint) {
		if (!conn) return;
		lobbyState.localPlayerClass = cls;
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
		lobbyState.leavingLobby = true;
		conn.reducers.leaveLobby({ lobbyId });
		lobbyState.currentLobbyId = null;
		lobbyState.currentSessionId = null;
	},
	leaveCurrentLobby() {
		if (!conn || !lobbyState.currentLobbyId) return;
		this.leaveLobby(lobbyState.currentLobbyId);
	},
	kickPlayer(lobbyId: bigint, playerIdentity: Identity) {
		if (!conn) return;
		conn.reducers.kickPlayer({ lobbyId, playerIdentity });
	},
	async quickplay() {
		if (!conn) return;
		lobbyState.error = null;
		try {
			await conn.reducers.quickJoin({
				playerName: lobbyState.localPlayerName,
				classChoice: lobbyState.localPlayerClass ?? ''
			});
		} catch (e) {
			setError(e);
		}
	},
	sendMessage(lobbyId: bigint, message: string) {
		if (!conn) return;
		conn.reducers.sendLobbyMessage({ lobbyId, message });
	},
	clearError() {
		lobbyState.error = null;
	}
};
