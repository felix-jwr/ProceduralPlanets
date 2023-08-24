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

// Custom Chunk object
class Chunk extends THREE.Mesh {
    constructor(params) {
        const geometry = new THREE.PlaneGeometry(params.width, params.height, params.segments, params.segments);
        const material = new THREE.MeshStandardMaterial({ 
            wireframe: false,
            color: params.color, // A part of me dies every time I type colour without a 'u'
            transparent: !(params.opacity == 1),
            opacity: params.opacity,
            side: (params.opacity == 1) ? THREE.DoubleSide : THREE.FrontSide
        });
        super(geometry, material);

        // Update chunk properties
        this.setRotation(-Math.PI / 2, 0, 0);
        this.castShadow = (params.opacity == 1);
        this.receiveShadow = (params.opacity == 1);
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
        this.n = this.roundToOdd(params.n, "up"); // Push grid length up to nearest odd integer
        this.size = params.size;
        this.color = params.color;
        this.yOffset = params.seaLevel;
        this.centralChunkPosition = params.centralChunkPosition;
        this.chunkParams = params.chunkParams;
        this.seaChunkParams = params.seaChunkParams;
        this.generator = new NoiseGenerator(params.noiseParams);
        this.chunks = [];

        // Generate grid and add chunks to scene
        this.generateGrid();

        // Generate sea chunk
        this.generateSeaChunk();
    }

    // Generates a fresh sea chunk
    generateSeaChunk() {
        // Remove existing sea chunk if one exists
        scene.remove(this.seaChunk);

        // Update the sea chunk parameters
        const newSize = (this.n % 2 == 0) ? this.size * (this.n + 1) : this.size * this.n;
        this.seaChunkParams.size = newSize;
        this.seaChunkParams.width = newSize;
        this.seaChunkParams.height = newSize;

        // Regenerate sea chunk
        this.seaChunk = new Chunk(this.seaChunkParams);
        this.scene.add(this.seaChunk);
    }
    
    // Generate a grid of chunks with side length n (floored to odd number)
    generateGrid() {
        // (TEMP) Times terrain generation
        const startTime = performance.now();

        const halfSize = Math.floor(this.n / 2);
        const centralPosition = this.centralChunkPosition.clone();

        for (let row = -halfSize; row <= halfSize; row++) {
            for (let col = -halfSize; col <= halfSize; col++) {

                // Calculate next chunk position
                const xOffset = col * this.size + centralPosition.x;
                const zOffset = row * this.size + centralPosition.y;

                // Check if there's already a chunk there
                const chunkExists = this.findChunkAtPosition(xOffset, zOffset);

                // If chunk doesn't already exist, make a new one
                if (!chunkExists) {
                    const currentChunkParams = this.chunkParams;

                    // Modify chunk colour (temp)
                    if (col == 0 && row == 0) {
                        currentChunkParams.color = 0xFFFFFF
                    }
                    else {
                        currentChunkParams.color = 0x567D46
                    }

                    // Create the chunk and add it to the scene
                    const plane = new Chunk(currentChunkParams);
                    plane.setPosition(xOffset, -this.yOffset, zOffset);
                    plane.offset = new THREE.Vector2(xOffset, -zOffset);
                    this.chunks.push(plane);
                    this.scene.add(plane);
                    
                    // Add noise to the chunk
                    this.modifyVerticesWithNoise(plane, plane.offset);
                }
            }
        }

        // (TEMP) Output terrain generation time
        console.log(
            `Time taken to generate surface: ${performance.now() - startTime} ms`
        );
    }

    // Change sea level
    changeSeaLevel(newSeaLevel) {
        this.yOffset = newSeaLevel;
        
        // Update all existing chunks
        for (let i = 0; i < this.chunks.length; i++) {
            const currentChunk = this.chunks[i];
            currentChunk.position.y = -newSeaLevel;
        }
    }

    // Update noise generator
    updateNoiseGenerator(noiseParams) {
        this.generator = new NoiseGenerator(noiseParams);

        for (let i = 0; i < this.chunks.length; i++) {
            this.modifyVerticesWithNoise(this.chunks[i], this.chunks[i].offset)
        }
    }

    // Apply noise to chunks under the chunk manager according to the noise parameters
    modifyVerticesWithNoise(chunk, offset) {
        const vertices = chunk.geometry.attributes.position.array;
        
        // Loops through each vertex and applies the positional offset to get the noise value for that position
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const result = this.generator.Get(x + offset.x, y + offset.y);
    
            vertices[i + 2] = result;
        }
    
        chunk.geometry.attributes.position.needsUpdate = true;
    }

    // If there's a change in parameters, regenerate the terrain
    regenerateChunks(newParams) {
        // Round up grid length to odd number
        newParams.n = this.roundToOdd(newParams.n, "up");

        // If the grid is getting smaller
        if (newParams.n < this.n) {
            this.pruneChunks(newParams);
            this.n = newParams.n;
            this.generateSeaChunk();
        }
        // If the grid is getting bigger
        else if (newParams.n > this.n) {
            this.n = newParams.n;
            this.generateGrid();
            this.generateSeaChunk();
        }
        
        // Update internal parameters
        this.n = newParams.n;
    }

    // Remove chunks that are outside of a new grid size specified in newParams
    pruneChunks(newParams) {
        // Find the maximum offset we want to keep from the centre
        const halfSize = Math.floor(newParams.n / 2);
        const pruneOffset = this.size * halfSize;

        // Iterate through the grid in reverse order and prune chunks that are outside the bounds of the new grid
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            const chunk = this.chunks[i];
            const xOutsideBounds = Math.abs(chunk.offset.x) > pruneOffset;
            const yOutsideBounds = Math.abs(chunk.offset.y) > pruneOffset;

            if (xOutsideBounds || yOutsideBounds) {
                scene.remove(chunk);
                this.chunks.splice(i, 1);
            }
        }
    }

    // Checks to see if a chunk already exists at a given position
    findChunkAtPosition(xOffset, zOffset) {
        for (let i = 0; i < this.chunks.length; i++) {
            if (this.chunks[i].offset.x == xOffset && this.chunks[i].offset.y == -zOffset) {
                return true;
            }
        }

        return false;
    }

    // Round an even number to an odd number, rounds up by default
    roundToOdd(value, direction = "up") {
        if (direction == "up") {
            return (value % 2 == 0) ? value + 1 : value;
        } else if (direction == "down") {
            return (value % 2 == 0) ? value - 1 : value;
        }
    }
}

// Terrain parameters
const size = 250;
const segments = 128;
const seaChunkDims = size * 5; // Initial seaChunk dims = size * grid side length

const chunkParams = {
        size: size,
        width: size,
        height: size, 
        color: 0x567D46,
        opacity: 1,
        segments: segments
};

// Ocean parameters
const seaChunkParams = {
    size: seaChunkDims,
    width: seaChunkDims,
    height: seaChunkDims,
    color: 0x00DDFF,
    opacity: 0.85,
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
    color: chunkParams.color,
    seaLevel: 10,
    centralChunkPosition: new THREE.Vector2(0, 0),
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
const terrainParameters = {
    gridSize: 5,
    octaves: 6,
    persistence: 0.707,
    lacunarity: 1.8,
    exponentiation: 4.5,
    height: 300.0,
    scale: 800.0,
    noiseType: "simplex",
    seed: 1,
    seaLevel: 10
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
    controls.update();
    renderer.render(scene, camera);
}

animate();
