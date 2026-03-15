import * as THREE from 'three';
import { MD2Loader } from 'three/addons/loaders/MD2Loader.js';
import { logEnemy } from '$root/settings.svelte.js';

export type EnemyType =
	| 'basic'
	| 'fast'
	| 'brute'
	| 'spitter'
	| 'caster'
	| 'caster_railgun'
	| 'caster_chaingun'
	| 'caster_bfg'
	| 'caster_shotgun'
	| 'jumper'
	| 'ogre'
	| 'ogre_berserker'
	| 'ogre_stalker';

export interface LoadedMD2 {
	geometry: THREE.BufferGeometry;
	animations: THREE.AnimationClip[];
	skins: THREE.Texture[];
	weaponGeometries: Map<string, THREE.BufferGeometry>;
	weaponAnimations: Map<string, THREE.AnimationClip[]>;
	weaponSkins: Map<string, THREE.Texture>;
}

const _cache = new Map<EnemyType, Promise<LoadedMD2>>();
const _loaded = new Map<EnemyType, LoadedMD2>();

// Body model file — defaults to model.md2 (Q2 soldier) unless overridden
const MODEL_FILE_MAP: Partial<Record<EnemyType, string>> = {
	ogre: 'ogro.md2',
	ogre_berserker: 'ogro.md2',
	ogre_stalker: 'ogro.md2'
};

const SKIN_MAP: Record<EnemyType, string> = {
	basic: 'basic.png',
	fast: 'fast.png',
	brute: 'brute.png',
	spitter: 'spitter.png',
	caster: 'caster.png',
	caster_railgun: 'basic.png',
	caster_chaingun: 'caster.png',
	caster_bfg: 'fast.png',
	caster_shotgun: 'caster.png',
	jumper: 'fast.png',
	ogre: 'ogrobase.png',
	ogre_berserker: 'khorne.png',
	ogre_stalker: 'darkam.png'
};

// Weapon MD2 files — drop into public/models/enemies/. Falls back gracefully if missing.
export const WEAPON_MAP: Record<EnemyType, string | null> = {
	basic: null,
	fast: null,
	brute: null,
	spitter: 'spitter_weapon.md2',
	caster: 'caster_weapon.md2',
	caster_railgun: 'w_railgun.md2',
	caster_chaingun: 'w_chaingun.md2',
	caster_bfg: 'w_bfg.md2',
	caster_shotgun: 'w_shotgun.md2',
	jumper: null,
	ogre: 'ogre_weapon.md2',
	ogre_berserker: 'ogre_weapon.md2',
	ogre_stalker: 'ogre_weapon.md2'
};

// Optional dedicated weapon skin (when weapon uses a different texture than the body)
const WEAPON_SKIN_MAP: Partial<Record<EnemyType, string>> = {
	ogre: 'ogre_weapon.jpg',
	ogre_berserker: 'ogre_weapon.jpg',
	ogre_stalker: 'ogre_weapon.jpg'
};

// Material tint per type for visual distinction
export const CASTER_TINT: Partial<Record<EnemyType, number>> = {
	caster: 0xffffff,
	caster_railgun: 0xaaddff,
	caster_chaingun: 0xffddaa,
	caster_bfg: 0xaaffcc,
	caster_shotgun: 0xffeeaa,
	ogre_berserker: 0xffbbbb, // blood-red tint
	ogre_stalker: 0xaabbcc    // cool shadowy tint
};

const SCALE_MAP: Record<EnemyType, number> = {
	basic: 0.045,
	fast: 0.04,
	brute: 0.055,
	spitter: 0.045,
	caster: 0.045,
	caster_railgun: 0.045,
	caster_chaingun: 0.045,
	caster_bfg: 0.048,
	caster_shotgun: 0.045,
	jumper: 0.04,
	ogre: 0.05,
	ogre_berserker: 0.05,
	ogre_stalker: 0.052
};

const md2Loader = new MD2Loader();
const textureLoader = new THREE.TextureLoader();

const BASE_URL = `${import.meta.env.BASE_URL}models/enemies/`;

function loadSkin(skinName: string): Promise<THREE.Texture> {
	return new Promise((resolve, reject) => {
		textureLoader.load(
			`${BASE_URL}${skinName}`,
			(texture) => {
				texture.flipY = false;
				texture.colorSpace = THREE.SRGBColorSpace;
				resolve(texture);
			},
			undefined,
			reject
		);
	});
}

function loadWeaponData(
	weaponPath: string
): Promise<{ geometry: THREE.BufferGeometry; animations: THREE.AnimationClip[] }> {
	return new Promise((resolve, reject) => {
		md2Loader.load(
			`${BASE_URL}${weaponPath}`,
			(result: any) => {
				const geo: THREE.BufferGeometry = result.geometry || result;
				const anims: THREE.AnimationClip[] =
					result.animations || (geo as any).animations || (geo as any).userData?.animations || [];
				resolve({ geometry: geo, animations: anims });
			},
			undefined,
			reject
		);
	});
}

// Variants that share a body model with a base type (avoids re-downloading heavy geometry)
function resolveModelKey(enemyType: EnemyType): EnemyType {
	if (enemyType.startsWith('caster_')) return 'caster';
	if (enemyType === 'jumper') return 'fast';
	if (enemyType.startsWith('ogre_')) return 'ogre';
	return enemyType;
}

export async function loadEnemyModel(enemyType: EnemyType): Promise<LoadedMD2> {
	if (_loaded.has(enemyType)) {
		logEnemy.info(`Cache hit: ${enemyType}`);
		return _loaded.get(enemyType)!;
	}

	if (_cache.has(enemyType)) {
		return _cache.get(enemyType)!;
	}

	const promise = (async () => {
		logEnemy.info(`Loading enemy model: ${enemyType}`);

		const skinName = SKIN_MAP[enemyType];
		const weaponName = WEAPON_MAP[enemyType];
		const modelKey = resolveModelKey(enemyType);
		const modelFile = MODEL_FILE_MAP[enemyType] ?? 'model.md2';

		let geometry: THREE.BufferGeometry;
		let animations: THREE.AnimationClip[];

		if (modelKey !== enemyType && _loaded.has(modelKey)) {
			// Reuse geometry + animations from already-loaded base type (heavy assets)
			const base = _loaded.get(modelKey)!;
			geometry = base.geometry;
			animations = base.animations;
		} else {
			const md2Result = await new Promise<any>((resolve, reject) => {
				md2Loader.load(`${BASE_URL}${modelFile}`, resolve, undefined, reject);
			});
			geometry = md2Result.geometry || md2Result;
			animations =
				md2Result.animations ||
				(geometry as any).animations ||
				(geometry as any).userData?.animations ||
				[];
		}

		// Each type loads its own skin independently — variants get distinct looks
		const baseTexture = await loadSkin(skinName);

		const weaponGeometries = new Map<string, THREE.BufferGeometry>();
		const weaponAnimations = new Map<string, THREE.AnimationClip[]>();
		const weaponSkins = new Map<string, THREE.Texture>();

		if (weaponName) {
			try {
				const weaponData = await loadWeaponData(weaponName);
				weaponGeometries.set(weaponName, weaponData.geometry);
				weaponAnimations.set(weaponName, weaponData.animations);

				// Load dedicated weapon skin if specified, otherwise fall back to body skin
				const weaponSkinFile = WEAPON_SKIN_MAP[enemyType];
				if (weaponSkinFile) {
					try {
						const wSkin = await loadSkin(weaponSkinFile);
						weaponSkins.set(weaponName, wSkin);
					} catch (_e) {
						logEnemy.warn(`Weapon skin not found for ${enemyType} (${weaponSkinFile}), using body skin`);
					}
				}

				logEnemy.info(
					`Weapon anims for ${enemyType}: ${weaponData.animations.map((a) => a.name).join(', ')}`
				);
			} catch (_e) {
				logEnemy.warn(`Weapon model not found for ${enemyType} (${weaponName}), skipping`);
			}
		}

		const result: LoadedMD2 = {
			geometry,
			animations,
			skins: [baseTexture],
			weaponGeometries,
			weaponAnimations,
			weaponSkins
		};

		_loaded.set(enemyType, result);
		logEnemy.info(`Loaded: ${enemyType}, animations: ${animations.map((a) => a.name).join(', ')}`);

		return result;
	})();

	_cache.set(enemyType, promise);
	return promise;
}

export function createEnemyMesh(
	loaded: LoadedMD2,
	enemyType: EnemyType
): { group: THREE.Group; body: THREE.Mesh; weapon?: THREE.Mesh } {
	const group = new THREE.Group();
	group.rotation.y = Math.PI / 2;
	group.position.y = 0.9;

	const scale = SCALE_MAP[enemyType] || 0.04;
	const tint = CASTER_TINT[enemyType] ?? 0xffffff;

	const material = new THREE.MeshLambertMaterial({
		map: loaded.skins[0],
		color: tint
	});

	const bodyGeo = loaded.geometry.clone();
	const body = new THREE.Mesh(bodyGeo, material);
	body.scale.setScalar(scale);
	body.castShadow = true;
	body.receiveShadow = true;
	group.add(body);

	let weapon: THREE.Mesh | undefined;
	const weaponPath = WEAPON_MAP[enemyType];
	if (weaponPath && loaded.weaponGeometries.has(weaponPath)) {
		const weaponGeo = loaded.weaponGeometries.get(weaponPath)!;
		// Use dedicated weapon skin if loaded, otherwise fall back to body skin
		const weaponTex = loaded.weaponSkins.get(weaponPath) ?? loaded.skins[0];
		const weaponMat = new THREE.MeshLambertMaterial({
			map: weaponTex,
			color: tint
		});
		const weaponMesh = new THREE.Mesh(weaponGeo.clone(), weaponMat);
		weaponMesh.scale.setScalar(scale);
		weaponMesh.castShadow = true;
		weaponMesh.receiveShadow = true;
		weapon = weaponMesh;
		group.add(weaponMesh);
	}

	return { group, body, weapon };
}

export function findAnimation(
	animations: THREE.AnimationClip[],
	name: string
): THREE.AnimationClip | undefined {
	const lower = name.toLowerCase();
	return animations.find((a) => a.name.toLowerCase() === lower);
}
