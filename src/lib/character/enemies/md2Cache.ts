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
	| 'jumper';

export interface LoadedMD2 {
	geometry: THREE.BufferGeometry;
	animations: THREE.AnimationClip[];
	skins: THREE.Texture[];
	weaponGeometries: Map<string, THREE.BufferGeometry>;
	weaponAnimations: Map<string, THREE.AnimationClip[]>;
}

const _cache = new Map<EnemyType, Promise<LoadedMD2>>();
const _loaded = new Map<EnemyType, LoadedMD2>();

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
	jumper: 'fast.png'
};

// Weapon MD2 files — drop the Quake2 weapon models into public/models/enemies/
// to get distinct weapon shapes. Falls back gracefully if file is missing.
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
	jumper: null
};

// Material tint color per caster variant for visual distinction
export const CASTER_TINT: Partial<Record<EnemyType, number>> = {
	caster: 0xffffff,
	caster_railgun: 0xaaddff, // icy blue tint
	caster_chaingun: 0xffddaa, // warm orange tint
	caster_bfg: 0xaaffcc, // radioactive green tint
	caster_shotgun: 0xffeeaa // golden tint
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
	jumper: 0.04
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

// Caster variants share the same body model as 'caster' — avoids re-downloading model.md2 + skin.
// We resolve to the canonical key used for model loading.
function resolveModelKey(enemyType: EnemyType): EnemyType {
	if (enemyType.startsWith('caster_')) return 'caster';
	if (enemyType === 'jumper') return 'fast';
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

		// Caster variants reuse the already-loaded caster body geometry to avoid duplication
		let geometry: THREE.BufferGeometry;
		let animations: THREE.AnimationClip[];
		let baseTexture: THREE.Texture;

		if (modelKey !== enemyType && _loaded.has(modelKey)) {
			// Reuse body from already-loaded base type
			const base = _loaded.get(modelKey)!;
			geometry = base.geometry;
			animations = base.animations;
			baseTexture = base.skins[0];
		} else {
			const [md2Result, skinTexture] = await Promise.all([
				new Promise<any>((resolve, reject) => {
					md2Loader.load(`${BASE_URL}model.md2`, resolve, undefined, reject);
				}),
				loadSkin(skinName)
			]);

			geometry = md2Result.geometry || md2Result;
			animations =
				md2Result.animations ||
				(geometry as any).animations ||
				(geometry as any).userData?.animations ||
				[];
			baseTexture = skinTexture;
		}

		const weaponGeometries = new Map<string, THREE.BufferGeometry>();
		const weaponAnimations = new Map<string, THREE.AnimationClip[]>();
		if (weaponName) {
			try {
				const weaponData = await loadWeaponData(weaponName);
				weaponGeometries.set(weaponName, weaponData.geometry);
				weaponAnimations.set(weaponName, weaponData.animations);
				logEnemy.info(
					`Weapon anims for ${enemyType}: ${weaponData.animations.map((a) => a.name).join(', ')}`
				);
			} catch (_e) {
				// Weapon file not found — renders without weapon model (graceful fallback)
				logEnemy.warn(`Weapon model not found for ${enemyType} (${weaponName}), skipping`);
			}
		}

		const result: LoadedMD2 = {
			geometry,
			animations,
			skins: [baseTexture],
			weaponGeometries,
			weaponAnimations
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
		const weaponMat = new THREE.MeshLambertMaterial({
			map: loaded.skins[0],
			color: tint
		});
		// Clone geometry for this instance — animations stay in loaded.weaponAnimations (not in cloned geo)
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
