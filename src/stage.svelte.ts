import type { CameraControlsRef } from '@threlte/extras';
import { soundActions } from './Sound.svelte';
import { settingsState, log } from './settings.svelte.js';

export type StageType = 'menu' | 'lobby' | 'game' | 'game_over' | 'leaderboard' | 'settings';

export type StageConfig = {
	id: StageType;
	label: string;
	icon: string;
	camera: (controls: CameraControlsRef, animated: boolean) => void;
};

export const STAGES: StageConfig[] = [
	{
		id: 'menu',
		label: 'Menu',
		icon: 'mdiHome',
		camera: (controls, animated) => {
			// Cinematic forest vista — adjust values in Phase 3 art pass
			controls.setTarget(0, 10, 0, animated);
			controls.setPosition(0, 8, 20, animated);
		}
	},
	{
		id: 'lobby',
		label: 'Lobby',
		icon: 'mdiAccountGroup',
		camera: (controls, animated) => {
			controls.setTarget(9, 10, 0, animated);
			controls.setPosition(0, 8, 20, animated);
		}
	},
	{
		id: 'game',
		label: 'Game',
		icon: 'mdiRun',
		camera: (controls, animated) => {
			// Placeholder — overridden by follow-cam in Phase 3
			controls.setTarget(0, 2, 0, animated);
			controls.setPosition(0, 6, 12, animated);
		}
	},
	{
		id: 'game_over',
		label: 'Game Over',
		icon: 'mdiSkull',
		camera: (controls, animated) => {
			controls.setTarget(0, 0, 0, animated);
			controls.setPosition(5, 4, 15, animated);
		}
	},
	{
		id: 'leaderboard',
		label: 'Leaderboard',
		icon: 'mdiTrophy',
		camera: (controls, animated) => {
			controls.setTarget(0, 0, 0, animated);
			controls.setPosition(0, 8, 20, animated);
		}
	},
	{
		id: 'settings',
		label: 'Settings',
		icon: 'mdiCog',
		camera: (controls, animated) => {
			controls.setTarget(0, 0, 0, animated);
			controls.setPosition(0, 8, 20, animated);
		}
	}
];

export interface StageState {
	currentStage: StageType;
	previousStage: StageType | null;
	isTransitioning: boolean;
}

let cameraControls = $state<CameraControlsRef | undefined>(undefined);

export const stageState = $state<StageState>({
	currentStage: 'menu',
	previousStage: null,
	isTransitioning: false
});

function applyCamera(stage: StageType) {
	if (!cameraControls) return;
	const animated = settingsState.graphics.quality !== 'low';
	STAGES.find((s) => s.id === stage)?.camera(cameraControls, animated);
}

export const stageActions = {
	setStage(stage: StageType) {
		if (stageState.currentStage === stage) return;

		log.info(`Stage: ${stageState.currentStage} → ${stage}`);
		soundActions.playSwoosh();

		stageState.previousStage = stageState.currentStage;
		stageState.currentStage = stage;
		applyCamera(stage);
	},

	goToMenu() {
		this.setStage('menu');
	},

	goToLobby() {
		this.setStage('lobby');
	},

	goToGame() {
		this.setStage('game');
	},

	goToGameOver() {
		this.setStage('game_over');
	},

	goToLeaderboard() {
		this.setStage('leaderboard');
	},

	goToSettings() {
		this.setStage('settings');
	},

	goBack() {
		if (stageState.previousStage) {
			this.setStage(stageState.previousStage);
		}
	},

	async transitionTo(stage: StageType, transitionDuration = 300) {
		if (stageState.currentStage === stage) return;

		const animated = settingsState.graphics.quality !== 'low';
		stageState.isTransitioning = true;

		if (animated) await new Promise((r) => setTimeout(r, transitionDuration / 2));
		this.setStage(stage);
		if (animated) await new Promise((r) => setTimeout(r, transitionDuration / 2));

		stageState.isTransitioning = false;
	}
};

export const cameraActions = {
	setCameraControls(controls: CameraControlsRef | undefined) {
		cameraControls = controls;
		if (controls) applyCamera(stageState.currentStage);
	}
};
