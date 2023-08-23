import "https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.js";
import perlin from "https://cdn.jsdelivr.net/gh/mikechambers/es6-perlin-module@master/perlin.js";

// Exports a noise generator based on the type of noise specified
class _perlin {
    constructor() { }

    noise2D(x, y) {
        return perlin(x, y) * 2.0 - 1.0;
    }
}

export class NoiseGenerator {
    constructor(params) {
        this._params = params;
        this.__Init__();
    }

    __Init__() {
        this._noise = {
            simplex: new SimplexNoise(this._params.seed),
            perlin: new _perlin()
        };
    }

    Get(x, y) {
        const xs = x / this._params.scale;
        const ys = y / this._params.scale;

        const noiseFunc = this._noise[this._params.noiseType];

        const G = 2.0 ** (-this._params.persistence);

        let amplitude = 1.0;
        let frequency = 1.0;
        let normalization = 0;
        let total = 0;

        for (let o = 0; o < this._params.octaves; o++) {
            const noiseValue = noiseFunc.noise2D(xs * frequency, ys * frequency) * 0.5 + 0.5;

            total += noiseValue * amplitude;
            normalization += amplitude;
            amplitude *= G;
            frequency *= this._params.lacunarity;
        }
        total /= normalization;

        return Math.pow(total, this._params.exponentiation) * this._params.height;
    }
}