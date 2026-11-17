// Meridian Bay — daylight. A warm late-afternoon sun, a teal-to-peach sky and
// soft fog, so the low-poly city reads sun-soaked from every camera angle.
import * as THREE from 'three';
import { COLORS } from '../config.js';

export function createDaylight(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 260, 700);

  const sun = new THREE.DirectionalLight(COLORS.sun, 2.4);
  sun.position.set(180, 220, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.4));

  // A big gradient sky dome: teal overhead fading to warm peach at the horizon.
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f8fc4) },
      bottom: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  return {
    sun,
    /** Warm the light as the in-game clock slides toward evening. */
    setTimeOfDay(t) {
      const warmth = 0.7 + 0.3 * Math.sin(t * 0.05);
      sun.intensity = 2.4 * warmth;
      sun.color.setHSL(0.09, 0.7, 0.6 + 0.1 * warmth);
    },
  };
}
