export type PlayerClass = 'spotter' | 'gunner' | 'tank' | 'healer';

const gameState = $state({
	currentLobbyId: null as bigint | null,
	currentSessionId: null as bigint | null,
	localPlayerClass: null as PlayerClass | null,
});

export { gameState };

export const gameActions = {
	setClass(cls: PlayerClass) {
		gameState.localPlayerClass = cls;
	},
	setLobby(id: bigint) {
		gameState.currentLobbyId = id;
	},
	setSession(id: bigint) {
		gameState.currentSessionId = id;
	},
	clearGame() {
		gameState.currentLobbyId = null;
		gameState.currentSessionId = null;
		gameState.localPlayerClass = null;
	},
};
