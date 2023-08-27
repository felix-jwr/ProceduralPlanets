import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/libs/dat.gui.module.js";
import { ChunkManager } from "./terrain.js";
import { QuadTree } from "./quadtree.js";

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadow map rendering
document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5D98F0);

// Controllable camera
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 150, 0);
camera.rotation.set(-Math.PI / 2, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableKeys = true;
scene.add(camera);

// quadtree test
const quadTree = new QuadTree({
    min: new THREE.Vector2(-32000, -32000),
    max: new THREE.Vector2(32000, 32000),
    minNodeSize: 250
})
console.log(quadTree);
quadTree.insertObject(camera.position);
console.log(quadTree);

// Parameters
const size = 250;
const segments = 128;
const seaChunkDims = size * 5; // Initial seaChunk dims = size * grid side length

// Terrain parameters
const chunkParams = {
    size: size,
    width: size,
    height: size,
    opacity: 1,
    segments: segments
};

// Ocean parameters
const seaChunkParams = {
    size: seaChunkDims,
    width: seaChunkDims,
    height: seaChunkDims,
    color: 0x00DDFF,
    opacity: 0.45,
    segments: 1
};

// Noise parameters
const noiseParams = {
    octaves: 6,
    persistence: 0.707,
    lacunarity: 1.8,
    exponentiation: 4.5,
    height: 300.0,
    scale: 800.0,
    noiseType: "simplex",
    seed: 1,
};

// Chunk manager parameters
const chunkManagerParams = {
    scene: scene,
    n: 5,
    size: chunkParams.size,
    seaLevel: 10,
    camera: camera,
    seaChunkParams: seaChunkParams,
    chunkParams: chunkParams,
    noiseParams: noiseParams
}

// Generate the terrain
const chunkManager = new ChunkManager(chunkManagerParams);

// Lighting
// Create ambient light for base level illumination (soft white colour)
const ambientLight = new THREE.AmbientLight(0x404040, 5);
scene.add(ambientLight);

// Create directional light and give it initial position
const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1); // Colour: white, Intensity: 1
const initialLightPos = new THREE.Vector3(size * chunkManagerParams.n + 100, 200, (size * (chunkManagerParams.n / 2)) + size);   // Places light a bit outside one corner of the grid
directionalLight.position.set(initialLightPos.x, initialLightPos.y, initialLightPos.z);
directionalLight.rotation.set(0, 0, 0);
scene.add(directionalLight);

// Set up shadow properties for the directionalLight
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 5000;
directionalLight.shadow.camera.left = -2000;
directionalLight.shadow.camera.right = 2000;
directionalLight.shadow.camera.top = 2000;
directionalLight.shadow.camera.bottom = -2000;
directionalLight.shadow.bias = -0.005;

// Indicates light position
const lightHelper = new THREE.DirectionalLightHelper(directionalLight, 1); // Second parameter is the size of the helper
scene.add(lightHelper);

// GUI setup
const gui = new GUI();
const lightingParameters = {
    ambientLightColour: "#404040",
    ambientLightIntensity: ambientLight.intensity,
    lightColour: "#ffffff",
    lightIntensity: directionalLight.intensity,
    lightPositionX: initialLightPos.x,
    lightPositionY: initialLightPos.y,
    lightPositionZ: initialLightPos.z,

};
const terrainParameters = {
    gridSize: chunkManagerParams.n,
    octaves: 6,
    persistence: 0.707,
    lacunarity: 1.8,
    exponentiation: 4.5,
    height: 300.0,
    scale: 800.0,
    noiseType: "simplex",
    seed: 1,
    seaLevel: chunkManagerParams.seaLevel
};

// GUI light settings
const lightingFolder = gui.addFolder("Lighting");

lightingFolder.add(lightingParameters, "ambientLightColour").onChange(function (value) {
    ambientLight.color.set(value);
});
lightingFolder.add(lightingParameters, "ambientLightIntensity", 0, 15).onChange(function (value) {
    ambientLight.intensity = value;
});
lightingFolder.addColor(lightingParameters, "lightColour").onChange(function (value) {
    directionalLight.color.set(value);
});
lightingFolder.add(lightingParameters, "lightIntensity", 0, 1).onChange(function (value) {
    directionalLight.intensity = value;
});
lightingFolder.add(lightingParameters, "lightPositionX", -(3 * size * chunkManagerParams.n), 3 * size * chunkManagerParams.n).onChange(function (value) {
    directionalLight.position.x = value;
});
lightingFolder.add(lightingParameters, "lightPositionY", 1, 250).onChange(function (value) {
    directionalLight.position.y = value;
});
lightingFolder.add(lightingParameters, "lightPositionZ", -(3 * size * chunkManagerParams.n), 3 * size * chunkManagerParams.n).onChange(function (value) {
    directionalLight.position.z = value;
});

lightingFolder.open();

// GUI terrain settings
const terrainFolder = gui.addFolder("Terrain");

terrainFolder.add(terrainParameters, "gridSize", 1, 15).step(1).onChange(function (value) {
    chunkManagerParams.n = value;
    chunkManager.regenerateChunks(chunkManagerParams);
})
terrainFolder.add(terrainParameters, "octaves", 1, 10).step(1).onChange(function (value) {
    chunkManagerParams.noiseParams.octaves = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "persistence", 0, 1).onChange(function (value) {
    chunkManagerParams.noiseParams.persistence = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "lacunarity", 1, 5).onChange(function (value) {
    chunkManagerParams.noiseParams.lacunarity = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "exponentiation", 1, 10).step(1).onChange(function (value) {
    chunkManagerParams.noiseParams.exponentiation = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "height", 1, 1000).onChange(function (value) {
    chunkManagerParams.noiseParams.height = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "scale", 1, 1000).onChange(function (value) {
    chunkManagerParams.noiseParams.scale = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "noiseType", ["simplex", "perlin"]).onChange(function (value) {
    chunkManagerParams.noiseParams.noiseType = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "seed").onChange(function (value) {
    chunkManagerParams.noiseParams.seed = value;
    chunkManager.updateNoiseGenerator(chunkManagerParams.noiseParams);
})
terrainFolder.add(terrainParameters, "seaLevel", 0).onChange(function (value) {
    chunkManagerParams.seaLevel = value;
    chunkManager.changeSeaLevel(value);
})

terrainFolder.open();

// Animate
function animate() {
    requestAnimationFrame(animate);
    // Update the camera
    controls.update();

    chunkManager.update();
    renderer.render(scene, camera);
}

animate();
