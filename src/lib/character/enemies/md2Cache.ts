import * as THREE from 'three';
import { MD2Loader } from 'three/addons/loaders/MD2Loader.js';

export type EnemyType = 'basic' | 'fast' | 'brute' | 'spitter' | 'caster';

export interface LoadedMD2 {
	geometry: THREE.BufferGeometry;
	animations: THREE.AnimationClip[];
	skins: THREE.Texture[];
	weaponGeometries: Map<string, THREE.BufferGeometry>;
}

const _cache = new Map<EnemyType, Promise<LoadedMD2>>();
const _loaded = new Map<EnemyType, LoadedMD2>();

const SKIN_MAP: Record<EnemyType, string> = {
	basic: 'basic.png',
	fast: 'fast.png',
	brute: 'brute.png',
	spitter: 'spitter.png',
	caster: 'caster.png'
};

const WEAPON_MAP: Record<EnemyType, string | null> = {
	basic: null,
	fast: null,
	brute: null,
	spitter: 'spitter_weapon.md2',
	caster: 'caster_weapon.md2'
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

function loadWeaponGeometry(weaponPath: string): Promise<THREE.BufferGeometry> {
	return new Promise((resolve, reject) => {
		md2Loader.load(
			`${BASE_URL}${weaponPath}`,
			(result: any) => {
				const geo = result.geometry || result;
				resolve(geo);
			},
			undefined,
			reject
		);
	});
}

export async function loadEnemyModel(enemyType: EnemyType): Promise<LoadedMD2> {
	if (_loaded.has(enemyType)) {
		console.log(`[MD2] Cache hit: ${enemyType}`);
		return _loaded.get(enemyType)!;
	}

	if (_cache.has(enemyType)) {
		return _cache.get(enemyType)!;
	}

	const promise = (async () => {
		console.log(`[MD2] Loading enemy model: ${enemyType}`);

		const skinName = SKIN_MAP[enemyType];
		const weaponName = WEAPON_MAP[enemyType];

		const [md2Result, skinTexture] = await Promise.all([
			new Promise<any>((resolve, reject) => {
				md2Loader.load(`${BASE_URL}model.md2`, resolve, undefined, reject);
			}),
			loadSkin(skinName)
		]);

		const geometry = md2Result.geometry || md2Result;

		const weaponGeometries = new Map<string, THREE.BufferGeometry>();
		if (weaponName) {
			const weaponGeo = await loadWeaponGeometry(weaponName);
			weaponGeometries.set(weaponName, weaponGeo);
		}
		const animations: THREE.AnimationClip[] =
			md2Result.animations ||
			(geometry as any).animations ||
			(geometry as any).userData?.animations ||
			[];

		const result: LoadedMD2 = {
			geometry,
			animations,
			skins: [skinTexture],
			weaponGeometries
		};

		_loaded.set(enemyType, result);
		console.log(
			`[MD2] Loaded: ${enemyType}, animations: ${animations.map((a) => a.name).join(', ')}`
		);

		return result;
	})();

	_cache.set(enemyType, promise);
	return promise;
}

export function createEnemyMesh(
	loaded: LoadedMD2,
	enemyType: EnemyType
): { body: THREE.Mesh; weapon?: THREE.Mesh } {
	const material = new THREE.MeshLambertMaterial({
		map: loaded.skins[0],
		color: 0xffffff
	});

	const bodyGeo = loaded.geometry.clone();
	const body = new THREE.Mesh(bodyGeo, material);
	body.scale.setScalar(0.03);
	body.castShadow = true;
	body.receiveShadow = true;

	let weapon: THREE.Mesh | undefined;
	const weaponPath = WEAPON_MAP[enemyType];
	if (weaponPath && loaded.weaponGeometries.has(weaponPath)) {
		const weaponGeo = loaded.weaponGeometries.get(weaponPath)!;
		const weaponMat = new THREE.MeshLambertMaterial({
			map: loaded.skins[0],
			color: 0xffffff
		});
		const weaponMesh = new THREE.Mesh(weaponGeo.clone(), weaponMat);
		weaponMesh.scale.setScalar(0.03);
		weaponMesh.castShadow = true;
		weaponMesh.receiveShadow = true;
		weapon = weaponMesh;
	}

	return { body, weapon };
}

export function findAnimation(
	animations: THREE.AnimationClip[],
	name: string
): THREE.AnimationClip | undefined {
	const lower = name.toLowerCase();
	return animations.find((a) => a.name.toLowerCase() === lower);
}
