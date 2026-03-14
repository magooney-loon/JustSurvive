<script lang="ts">
	import { fly } from 'svelte/transition';
	import { stageActions } from '$root/stage.svelte.js';
	import {
		settingsState,
		graphicsActions,
		audioActions,
		controlsActions
	} from '$root/settings.svelte.js';
	import type { QualityLevel } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';
</script>

<!-- Example: Settings overlay -->
<!-- Replace this with your actual settings UI -->

<div
	transition:fly={{ y: -16, duration: 220 }}
	class="rpgui-content"
	style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
>
	<div class="rpgui-container framed" style="padding: 2rem; min-width: 320px;">
		<h2>Settings</h2>

		<!-- Graphics Quality -->
		<div style="margin-bottom: 1.5rem;">
			<h4>Graphics Quality</h4>
			<div style="display: flex; gap: 0.5rem;">
				{#each ['low', 'mid', 'high'] as QualityLevel[] as level}
					<button
						onclick={() => {
							soundActions.playClick();
							graphicsActions.setQuality(level);
						}}
						style="flex: 1; padding: 0.4rem; border-radius: 0.375rem; border: 1px solid rgba(255,255,255,{settingsState
							.graphics.quality === level
							? '0.6'
							: '0.2'}); background: {settingsState.graphics.quality === level
							? 'rgba(255,255,255,0.2)'
							: 'transparent'}; color: white; cursor: pointer; text-transform: capitalize;"
					>
						{level}
					</button>
				{/each}
			</div>
		</div>

		<!-- Audio -->
		<div style="margin-bottom: 1.5rem;">
			<h4>Audio</h4>
			<div style="display: flex; flex-direction: column; gap: 0.75rem;">
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
						<input
							type="checkbox"
							checked={settingsState.audio.musicEnabled}
							onchange={() => audioActions.toggleMusic()}
						/>
						Music
					</label>
					<div class="rpgui-slider-container">
						<div class="rpgui-slider-left-edge"></div>
						<div class="rpgui-slider-track"></div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							aria-label="Music volume"
							value={settingsState.audio.musicVolume}
							oninput={(e) => audioActions.setMusicVolume(+(e.target as HTMLInputElement).value)}
							style="position: relative; z-index: 1; width: 100%; height: 100%; opacity: 0.5;"
						/>
						<div
							class="rpgui-slider-thumb"
							style="left: {settingsState.audio.musicVolume * 100}%;"
						></div>
					</div>
				</div>
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
						<input
							type="checkbox"
							checked={settingsState.audio.ambienceEnabled}
							onchange={() => audioActions.toggleAmbience()}
						/>
						Ambience
					</label>
					<div class="rpgui-slider-container">
						<div class="rpgui-slider-left-edge"></div>
						<div class="rpgui-slider-track"></div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							aria-label="Ambience volume"
							value={settingsState.audio.ambienceVolume}
							oninput={(e) => audioActions.setAmbienceVolume(+(e.target as HTMLInputElement).value)}
							style="position: relative; z-index: 1; width: 100%; height: 100%; opacity: 0.5;"
						/>
						<div
							class="rpgui-slider-thumb"
							style="left: {settingsState.audio.ambienceVolume * 100}%;"
						></div>
					</div>
				</div>
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
						<input
							type="checkbox"
							checked={settingsState.audio.effectsEnabled}
							onchange={() => audioActions.toggleEffects()}
						/>
						Sound Effects
					</label>
					<div class="rpgui-slider-container">
						<div class="rpgui-slider-left-edge"></div>
						<div class="rpgui-slider-track"></div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							aria-label="Effects volume"
							value={settingsState.audio.effectsVolume}
							oninput={(e) => audioActions.setEffectsVolume(+(e.target as HTMLInputElement).value)}
							style="position: relative; z-index: 1; width: 100%; height: 100%; opacity: 0.5;"
						/>
						<div
							class="rpgui-slider-thumb"
							style="left: {settingsState.audio.effectsVolume * 100}%;"
						></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Controls -->
		<div style="margin-bottom: 1.5rem;">
			<h4>Controls</h4>
			<div style="display: flex; flex-direction: column; gap: 0.75rem;">
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<div style="display: flex; justify-content: space-between;">
						<span>Mouse Sensitivity</span>
						<span style="opacity: 0.6;">{settingsState.controls.mouseSensitivity.toFixed(2)}</span>
					</div>
					<div class="rpgui-slider-container">
						<div class="rpgui-slider-left-edge"></div>
						<div class="rpgui-slider-track"></div>
						<input
							type="range"
							min="0.1"
							max="3"
							step="0.05"
							aria-label="Mouse sensitivity"
							value={settingsState.controls.mouseSensitivity}
							oninput={(e) =>
								controlsActions.setMouseSensitivity(+(e.target as HTMLInputElement).value)}
							style="position: relative; z-index: 1; width: 100%; height: 100%; opacity: 0.5;"
						/>
						<div
							class="rpgui-slider-thumb"
							style="left: {((settingsState.controls.mouseSensitivity - 0.1) / 2.9) * 100}%;"
						></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Keybinds -->
		<div style="margin-bottom: 1.5rem;">
			<h4>Keybinds</h4>
			<div
				style="display: flex; justify-content: space-between; align-items: center; opacity: 0.6;"
			>
				<span>Toggle HUD</span>
				<kbd
					style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 0.25rem; padding: 0.15rem 0.5rem; font-family: monospace;"
					>Ctrl+H</kbd
				>
			</div>
		</div>

		<button
			class="rpgui-button"
			onclick={() => {
				soundActions.playClick();
				stageActions.goBack();
			}}
		>
			<p>Back</p>
		</button>
	</div>
</div>
