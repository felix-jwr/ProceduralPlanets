import * as THREE from "three";
import { NoiseGenerator } from "./noise.js";

// Custom Chunk object
class Chunk extends THREE.Mesh {
    constructor(params) {
        const geometry = new THREE.PlaneGeometry(params.width, params.height, params.segments, params.segments);
        const material = new THREE.MeshStandardMaterial({
            wireframe: false,
            vertexColors: true, // A part of me dies every time I type colour without a 'u'
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
export class ChunkManager {
    constructor(params) {
        this.scene = params.scene;
        this.n = this.roundToOdd(params.n, "up"); // Push grid length up to nearest odd integer
        this.size = params.size;
        this.color = params.color;
        this.yOffset = params.seaLevel;
        this.initialCameraPosition = params.camera.position.clone();
        this.chunkParams = params.chunkParams;
        this.seaChunkParams = params.seaChunkParams;
        this.generator = new NoiseGenerator(params.noiseParams);
        this.chunks = [];

        // Initial chunk
        this.currentChunk = new Chunk(params.chunkParams);
        this.currentChunk.boundaries = new THREE.Vector2(params.size / 2, params.size / 2);

        // Generate grid and add chunks to scene
        this.generateGrid();

        // Generate sea chunk
        this.generateSeaChunk();
    }

    // Called every frame
    update() {

    }

    // Generates a fresh sea chunk
    generateSeaChunk() {
        // Remove existing sea chunk if one exists
        this.scene.remove(this.seaChunk);

        // Update the sea chunk parameters
        const newSize = (this.n % 2 == 0) ? this.size * (this.n + 1) : this.size * this.n;
        this.seaChunkParams.size = newSize;
        this.seaChunkParams.width = newSize;
        this.seaChunkParams.height = newSize;

        // Regenerate sea chunk
        this.seaChunk = new Chunk(this.seaChunkParams);
        this.seaChunk.position.set(0, 0, 0);

        // Set sea chunk colour
        const colours = [];
        const colour = new THREE.Color(0x00DDFF);
        for (let i = 0; i < this.seaChunk.geometry.attributes.position.count; i++) {
            colours.push(colour.r, colour.g, colour.b);
        }
        this.seaChunk.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));

        this.scene.add(this.seaChunk);
    }

    generateChunk(xOffset, zOffset) {
        // Check if there's already a chunk there
        const chunkExists = this.findChunkAtPosition(xOffset, zOffset);

        // If chunk doesn't already exist, make a new one
        if (!chunkExists) {
            // Create the chunk and add it to the scene
            const chunk = new Chunk(this.chunkParams);
            chunk.setPosition(xOffset, -this.yOffset, zOffset);
            chunk.offset = new THREE.Vector2(xOffset, -zOffset);
            chunk.boundaries = new THREE.Vector2(chunk.offset.x + this.size / 2, chunk.offset.y + this.size / 2)
            this.chunks.push(chunk);
            this.scene.add(chunk);

            // Add noise to the chunk
            this.modifyVerticesWithNoise(chunk, chunk.offset);

            // Generate vertex colours for the chunk
            this.generateVertexColors(chunk.geometry);

            return chunk;
        }
    }

    // Generate a grid of chunks with side length n (floored to odd number)
    generateGrid() {
        // (TEMP) Times terrain generation
        const startTime = performance.now();

        const halfSize = Math.floor(this.n / 2);
        const centralPosition = this.initialCameraPosition;

        for (let row = -halfSize; row <= halfSize; row++) {
            for (let col = -halfSize; col <= halfSize; col++) {

                // Calculate next chunk position
                const xOffset = col * this.size + centralPosition.x;
                const zOffset = row * this.size + centralPosition.z;

                this.generateChunk(xOffset, zOffset);
            }
        }

        // (TEMP) Output terrain generation time
        console.log(`Time taken to generate surface: ${performance.now() - startTime} ms`);
    }

    // Apply colour to each vertex of a chunk
    generateVertexColors(geometry) {
        const vertices = geometry.attributes.position.array;

        const colours = [];


        // Set vertex colour based on height
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            const y = vertices[i * 3 + 2];
            const colour = new THREE.Color();

            if (y < 15) {
                // Sandy beaches
                colour.setHex(0xC2B280)
            }
            else if (y > 85) {
                // Snowy peaks
                colour.setHex(0xFFFFFF)
            }
            else if (y > 45) {
                // Mountains
                colour.setHex(0x808080)
            }
            else {
                // Normal terrain
                colour.setHex(0x567D46)
            }

            colours.push(colour.r, colour.g, colour.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
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
            this.generateVertexColors(this.chunks[i].geometry)
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
                this.scene.remove(chunk);
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
