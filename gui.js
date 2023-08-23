import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/libs/dat.gui.module.js";

// gui
const gui = new GUI();
const lightingParameters = {
    ambientLightIntensity: 0.3,
    directionalLightColor: "#ffffff",
    directionalLightIntensity: 0.75,
    directionalLightPositionX: 2.5,
    directionalLightPositionY: 4,
    directionalLightPositionZ: 10,
};
const lightingFolder = gui.addFolder("Lighting");

lightingFolder.add(lightingParameters, "ambientLightIntensity", 0, 1).onChange(function (value) {
    ambientLight.intensity = value;
});

lightingFolder.addColor(lightingParameters, "directionalLightColor").onChange(function (value) {
    light.color.set(value);
});

lightingFolder.add(lightingParameters, "directionalLightIntensity", 0, 1).onChange(function (value) {
    light.intensity = value;
});

lightingFolder.add(lightingParameters, "directionalLightPositionX", -10, 10).onChange(function (value) {
    light.position.x = value;
});

lightingFolder.add(lightingParameters, "directionalLightPositionY", -10, 10).onChange(function (value) {
    light.position.y = value;
});

lightingFolder.add(lightingParameters, "directionalLightPositionZ", -10, 10).onChange(function (value) {
    light.position.z = value;
});

lightingFolder.open();