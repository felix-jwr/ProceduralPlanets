import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/libs/dat.gui.module.js";
import { NoiseGenerator } from "./noise.js";

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadow map rendering
document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5D98F0);

// Times terrain generation
const startTime = performance.now();

// Custom Chunk object
class Chunk extends THREE.Mesh {
    constructor(params) {
        const geometry = new THREE.PlaneGeometry(params.width, params.height, 128, 128);
        const material = new THREE.MeshStandardMaterial({ 
            wireframe: false,
            color: params.color, // A part of me dies every time I type colour without a 'u'
            side: THREE.DoubleSide
        });
        super(geometry, material);

        // Update chunk properties
        this.setRotation(-Math.PI / 2, 0, 0);
        this.castShadow = true;
        this.receiveShadow = true;
        this.offset = params.offset;    // Store x, z offset in the chunk data
    }
  
    setPosition(x, y, z) {
      this.position.set(x, y, z);
    }
  
    setRotation(x, y, z) {
      this.rotation.set(x, y, z);
    }
}

// Class for managing chunks including initial generation etc.
class ChunkManager {
    constructor(params) {
        this.scene = params.scene;
        this.n = params.n;
        this.size = params.size;
        this.color = params.color;
        this.yOffset = params.seaLevel;
        this.centralChunkPosition = params.centralChunkPosition;
        this.chunkParams = params.chunkParams;
        this.chunks = [];

        this.generateGrid();

        for (let i = 0; i < this.chunks.length; i++) {
            this.modifyVerticesWithNoise(this.chunks[i], this.chunks[i].offset)
            this.scene.add(this.chunks[i]);
        }
      }
    
    // Generate a grid of chunks with side length n (floored to odd number)
    generateGrid() {
        const halfSize = Math.floor(this.n / 2);

        for (let row = -halfSize; row <= halfSize; row++) {

            for (let col = -halfSize; col <= halfSize; col++) {
                let currentChunkParams = this.chunkParams;
                
                // Modify chunk colour (temp)
                if (col % 2 == 0 && row % 2 == 0) {
                    currentChunkParams.color = 0x0000FF
                }
                else {
                    currentChunkParams.color = 0x567D46
                }

                const plane = new Chunk(currentChunkParams);
                const xOffset = col * this.size + this.centralChunkPosition.x;
                const zOffset = row * this.size + this.centralChunkPosition.y;
                plane.setPosition(xOffset, -this.yOffset, zOffset);
                plane.offset = new THREE.Vector2(xOffset, -zOffset);
                this.chunks.push(plane);
            }
        }
    }

    // Apply noise to chunks under the chunk manager according to the noise parameters
    modifyVerticesWithNoise(chunk, offset) {
        const generator = new NoiseGenerator(noiseParams);
        const vertices = chunk.geometry.attributes.position.array;
        
        // Loops through each vertex and applies the positional offset to get the noise value for that position
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const result = generator.Get(x + offset.x, y + offset.y);
    
            vertices[i + 2] = result;
        }
    
        chunk.geometry.attributes.position.needsUpdate = true;
    }
}

// Terrain parameters
const size = 250;

const chunkParams = {
        size: size,
        width: size,
        height: size, 
        color: 0x567D46
};

const chunkManagerParams = {
    scene: scene,
    n: 5,
    size: chunkParams.size,
    color: chunkParams.color,
    seaLevel: 10,
    centralChunkPosition: new THREE.Vector2(0, 0),
    chunkParams: chunkParams
}

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

// Generate the terrain
const griddy = new ChunkManager(chunkManagerParams);

// Generate ocean
let seaChunkParams = {
    size: chunkManagerParams.n * size,
    color: 0x00DDFF
}

const seaChunk = new THREE.Mesh(
    new THREE.PlaneGeometry(seaChunkParams.size, seaChunkParams.size),
    new THREE.MeshStandardMaterial({ 
            color: seaChunkParams.color,
            transparent: true,
            opacity: 0.85,
            wireframe: false
    }),
);
seaChunk.rotation.set(-Math.PI / 2, 0, 0);
scene.add(seaChunk);

// Output terrain generation time
console.log(
    `Time taken to generate surface: ${performance.now() - startTime} ms`
);

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

// Controllable camera
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    10000
);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(300, 200, 0);
scene.add(camera);

// GUI setup
const gui = new GUI();
const lightingParameters = {
    ambientLightColour: "#404040",
    ambientLightIntensity: 5,
    lightColour: "#ffffff",
    lightIntensity: 1,
    lightPositionX: initialLightPos.x,
    lightPositionY: initialLightPos.y,
    lightPositionZ: initialLightPos.z,

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

// Animate
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
