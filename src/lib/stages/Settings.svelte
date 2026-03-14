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
	<div class="rpgui-container framed" style="padding: 2rem; min-width: 420px; max-width: 500px;">
		<h2>Settings</h2>

		<!-- Graphics Quality -->
		<div style="margin-bottom: 1.5rem;">
			<h4>Graphics Quality</h4>
			<div style="display: flex; gap: 0.5rem;">
				{#each ['low', 'mid', 'high'] as QualityLevel[] as level}
					<button
						class="rpgui-button"
						onclick={() => {
							soundActions.playClick();
							graphicsActions.setQuality(level);
						}}
						style="flex: 1; min-width: auto; height: auto; padding: 0.5rem 1rem; {settingsState
							.graphics.quality === level
							? 'background-image: url(/css/img/button-down.png);'
							: ''}"
					>
						<p style="font-size: 0.75rem;">{level}</p>
					</button>
				{/each}
			</div>
		</div>

		<!-- Audio -->
		<div style="margin-bottom: 1.5rem;">
			<h4>Audio</h4>
			<div style="display: flex; flex-direction: column; gap: 1rem;">
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
						<input
							type="checkbox"
							id="music-check"
							class="rpgui-checkbox"
							checked={settingsState.audio.musicEnabled}
							onchange={() => audioActions.toggleMusic()}
						/>
						<label for="music-check">Music</label>
					</label>
					<input
						type="range"
						class="rpgui-slider"
						min="0"
						max="1"
						step="0.01"
						aria-label="Music volume"
						value={settingsState.audio.musicVolume}
						oninput={(e) => audioActions.setMusicVolume(+(e.target as HTMLInputElement).value)}
						style="width: 100%;"
					/>
				</div>
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
						<input
							type="checkbox"
							id="ambience-check"
							class="rpgui-checkbox"
							checked={settingsState.audio.ambienceEnabled}
							onchange={() => audioActions.toggleAmbience()}
						/>
						<label for="ambience-check">Ambience</label>
					</label>
					<input
						type="range"
						class="rpgui-slider"
						min="0"
						max="1"
						step="0.01"
						aria-label="Ambience volume"
						value={settingsState.audio.ambienceVolume}
						oninput={(e) => audioActions.setAmbienceVolume(+(e.target as HTMLInputElement).value)}
						style="width: 100%;"
					/>
				</div>
				<div style="display: flex; flex-direction: column; gap: 0.25rem;">
					<label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
						<input
							type="checkbox"
							id="effects-check"
							class="rpgui-checkbox"
							checked={settingsState.audio.effectsEnabled}
							onchange={() => audioActions.toggleEffects()}
						/>
						<label for="effects-check">Sound Effects</label>
					</label>
					<input
						type="range"
						class="rpgui-slider"
						min="0"
						max="1"
						step="0.01"
						aria-label="Effects volume"
						value={settingsState.audio.effectsVolume}
						oninput={(e) => audioActions.setEffectsVolume(+(e.target as HTMLInputElement).value)}
						style="width: 100%;"
					/>
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
					<input
						type="range"
						class="rpgui-slider"
						min="0.1"
						max="3"
						step="0.05"
						aria-label="Mouse sensitivity"
						value={settingsState.controls.mouseSensitivity}
						oninput={(e) =>
							controlsActions.setMouseSensitivity(+(e.target as HTMLInputElement).value)}
						style="width: 100%;"
					/>
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
			style="width: 100%;"
			onclick={() => {
				soundActions.playClick();
				stageActions.goBack();
			}}
		>
			<p>Back</p>
		</button>
	</div>
</div>
