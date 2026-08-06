import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const CARS = [
  { id: "race", file: "race.glb", name: "NITRO GT" },
  { id: "sedan-sports", file: "sedan-sports.glb", name: "STREET COUPE" },
  { id: "hatchback-sports", file: "hatchback-sports.glb", name: "HATCH R" },
  { id: "race-future", file: "race-future.glb", name: "PROTO X" },
  { id: "suv-luxury", file: "suv-luxury.glb", name: "URBAN XL" },
  { id: "police", file: "police.glb", name: "INTERCEPTOR" },
  { id: "taxi", file: "taxi.glb", name: "CITY CAB" },
  { id: "sedan", file: "sedan.glb", name: "DAILY DRIVER" },
];

const PAINTS = [
  { name: "Sunburst", color: "#e8a838" },
  { name: "Teal Rush", color: "#2a8f7a" },
  { name: "Rust Fire", color: "#c45c2a" },
  { name: "Bone White", color: "#e8dcc8" },
  { name: "Night Ink", color: "#1a1410" },
  { name: "Signal Red", color: "#c83028" },
  { name: "Steel Blue", color: "#3a5a78" },
  { name: "Acid Lime", color: "#8fb83a" },
];

const PS2Shader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 pixel = resolution * 0.42;
      vec2 uv = floor(vUv * pixel) / pixel;

      vec4 color = texture2D(tDiffuse, uv);

      // posterize — PS2-ish color depth
      float levels = 20.0;
      color.rgb = floor(color.rgb * levels + 0.5) / levels;

      // ordered dither
      float d = hash(floor(vUv * resolution * 0.5) + time) * 0.04;
      color.rgb += d - 0.02;

      // slight chromatic aberration
      float aberr = 0.0018;
      float r = texture2D(tDiffuse, uv + vec2(aberr, 0.0)).r;
      float b = texture2D(tDiffuse, uv - vec2(aberr, 0.0)).b;
      color.r = mix(color.r, r, 0.55);
      color.b = mix(color.b, b, 0.55);

      // warm CRT lift
      color.rgb *= vec3(1.05, 1.0, 0.92);
      color.rgb = mix(color.rgb, vec3(dot(color.rgb, vec3(0.3, 0.55, 0.15))), 0.08);

      gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
    }
  `,
};

const canvas = document.getElementById("scene");
const loadingEl = document.getElementById("loading");
const loadFill = document.getElementById("load-fill");
const carNameEl = document.getElementById("car-name");
const swatchesEl = document.getElementById("swatches");
const btnLights = document.getElementById("btn-lights");
const btnSpin = document.getElementById("btn-spin");

let carIndex = 0;
let paintIndex = 0;
let lightsOn = true;
let spinOn = true;
let currentCar = null;
let platform = null;
let headLightL = null;
let headLightR = null;
let carCache = new Map();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1814);
scene.fog = new THREE.FogExp2(0x1c1814, 0.045);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  80,
);
camera.position.set(5.2, 2.4, 6.4);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3.2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 0.65, 0);
controls.update();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ps2Pass = new ShaderPass(PS2Shader);
composer.addPass(ps2Pass);

function setLowRes() {
  const w = Math.max(320, Math.floor(window.innerWidth * 0.42));
  const h = Math.max(180, Math.floor(window.innerHeight * 0.42));
  composer.setSize(w, h);
  ps2Pass.uniforms.resolution.value.set(w, h);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
}

function makeMat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...opts,
  });
}

function buildGarage() {
  const root = new THREE.Group();

  // Floor
  const floorGeo = new THREE.PlaneGeometry(28, 28, 14, 14);
  const floor = new THREE.Mesh(floorGeo, makeMat(0x3a342c));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // Checker tiles (low poly decals)
  const tileGeo = new THREE.PlaneGeometry(1.6, 1.6);
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      if ((x + z) % 2 !== 0) continue;
      const tile = new THREE.Mesh(
        tileGeo,
        makeMat(x === 0 && z === 0 ? 0x2a4a42 : 0x2c2822),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(x * 1.6, 0.005, z * 1.6);
      tile.receiveShadow = true;
      root.add(tile);
    }
  }

  // Center turntable ring
  platform = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.1, 0.08, 24),
    makeMat(0x4a443a),
  );
  ring.position.y = 0.04;
  ring.receiveShadow = true;
  ring.castShadow = true;
  platform.add(ring);

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.7, 2.7, 0.06, 24),
    makeMat(0x2a4a42),
  );
  pad.position.y = 0.09;
  pad.receiveShadow = true;
  platform.add(pad);

  // Accent stripes on pad
  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.02, 2.2),
      makeMat(0xe8a838),
    );
    const a = (i / 8) * Math.PI * 2;
    stripe.position.set(Math.cos(a) * 1.9, 0.13, Math.sin(a) * 1.9);
    stripe.rotation.y = -a;
    platform.add(stripe);
  }
  root.add(platform);

  // Back wall
  const wallMat = makeMat(0x2a241e);
  const back = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 0.4), wallMat);
  back.position.set(0, 4, -10);
  back.receiveShadow = true;
  root.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 20), wallMat);
  left.position.set(-11, 4, -1);
  left.receiveShadow = true;
  root.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 20), wallMat);
  right.position.set(11, 4, -1);
  right.receiveShadow = true;
  root.add(right);

  // Ceiling beams
  for (let i = -3; i <= 3; i++) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.35, 0.45),
      makeMat(0x3a3228),
    );
    beam.position.set(0, 7.6, i * 2.4 - 2);
    beam.castShadow = true;
    root.add(beam);
  }

  // Neon-ish light bars (solid emissive strips — no glow stacks)
  const barGeo = new THREE.BoxGeometry(8, 0.12, 0.2);
  [-4, 0, 4].forEach((x, i) => {
    const bar = new THREE.Mesh(
      barGeo,
      new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xe8a838 : 0x2a8f7a,
      }),
    );
    bar.position.set(x * 0.15, 7.2, -6 + i);
    root.add(bar);
  });

  // Shelves / tool benches
  const shelfMat = makeMat(0x4a4034);
  [
    [-7.5, -4],
    [7.5, -4],
    [-7.5, 2],
    [7.5, 2],
  ].forEach(([x, z]) => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.2), shelfMat);
    bench.position.set(x, 0.55, z);
    bench.castShadow = true;
    bench.receiveShadow = true;
    root.add(bench);

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.08, 1.3),
      makeMat(0x5a5044),
    );
    top.position.set(x, 1.14, z);
    root.add(top);
  });

  // Tire stacks (simple toruses as low-poly cylinders)
  [-8.5, 8.5].forEach((x) => {
    for (let i = 0; i < 3; i++) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.18, 6, 12),
        makeMat(0x1a1816),
      );
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, 0.45 + i * 0.38, 5.5);
      tire.castShadow = true;
      root.add(tire);
    }
  });

  // Back banner wall panel
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.2),
    new THREE.MeshBasicMaterial({ color: 0x1a3a32 }),
  );
  banner.position.set(0, 4.8, -9.75);
  root.add(banner);

  const stripeBanner = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xe8a838 }),
  );
  stripeBanner.position.set(0, 3.9, -9.74);
  root.add(stripeBanner);

  scene.add(root);
}

function setupLights() {
  const ambient = new THREE.AmbientLight(0x6a6054, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffe0b0, 1.35);
  key.position.set(4, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x6ab0a0, 0.55);
  fill.position.set(-6, 4, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(0xe8a838, 18, 18, 2);
  rim.position.set(0, 3.5, -4);
  scene.add(rim);

  headLightL = new THREE.SpotLight(0xfff2cc, 22, 16, Math.PI / 7, 0.4, 1.2);
  headLightR = new THREE.SpotLight(0xfff2cc, 22, 16, Math.PI / 7, 0.4, 1.2);
  headLightL.position.set(-0.7, 0.7, 2.2);
  headLightR.position.set(0.7, 0.7, 2.2);
  headLightL.target.position.set(-0.7, 0.2, 5);
  headLightR.target.position.set(0.7, 0.2, 5);
  scene.add(headLightL, headLightR, headLightL.target, headLightR.target);
}

function snapVertices(root) {
  const quant = 48;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const pos = obj.geometry.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        Math.round(pos.getX(i) * quant) / quant,
        Math.round(pos.getY(i) * quant) / quant,
        Math.round(pos.getZ(i) * quant) / quant,
      );
    }
    pos.needsUpdate = true;
    obj.geometry.computeVertexNormals();
  });
}

function flattenMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m) return;
      m.flatShading = true;
      if ("metalness" in m) m.metalness = Math.min(m.metalness ?? 0, 0.25);
      if ("roughness" in m) m.roughness = Math.max(m.roughness ?? 0.7, 0.65);
      m.needsUpdate = true;
    });
  });
}

function applyPaint(root, hex) {
  const target = new THREE.Color(hex);
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m || !m.color) return;
      // Kenney cars share one atlas material — tint multiplies the colormap.
      m.color.copy(target);
      m.needsUpdate = true;
    });
  });
}

function fitCar(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3.4 / maxDim;
  root.scale.setScalar(scale);
  root.position.x = -center.x * scale;
  root.position.y = -box.min.y * scale + 0.12;
  root.position.z = -center.z * scale;
  root.rotation.y = Math.PI;
}

async function loadCar(index) {
  const entry = CARS[index];
  if (carCache.has(entry.id)) {
    return carCache.get(entry.id).clone(true);
  }

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(`/models/${entry.file}`);
  const model = gltf.scene;
  snapVertices(model);
  flattenMaterials(model);
  fitCar(model);
  carCache.set(entry.id, model);
  return model.clone(true);
}

async function showCar(index) {
  carIndex = (index + CARS.length) % CARS.length;
  const entry = CARS[carIndex];
  carNameEl.textContent = entry.name;
  carNameEl.style.animation = "none";
  void carNameEl.offsetWidth;
  carNameEl.style.animation = "";

  if (currentCar) {
    platform.remove(currentCar);
    currentCar = null;
  }

  const model = await loadCar(carIndex);
  applyPaint(model, PAINTS[paintIndex].color);
  currentCar = model;
  platform.add(currentCar);
}

function buildSwatches() {
  swatchesEl.innerHTML = "";
  PAINTS.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (i === paintIndex ? " active" : "");
    btn.style.background = p.color;
    btn.title = p.name;
    btn.setAttribute("aria-label", p.name);
    btn.addEventListener("click", () => {
      paintIndex = i;
      [...swatchesEl.children].forEach((el, j) => {
        el.classList.toggle("active", j === i);
      });
      if (currentCar) applyPaint(currentCar, p.color);
    });
    swatchesEl.appendChild(btn);
  });
}

function setProgress(p) {
  loadFill.style.width = `${Math.round(p * 100)}%`;
}

async function preloadAll() {
  const loader = new GLTFLoader();
  let done = 0;
  const total = CARS.length + 1;

  const conePromise = loader.loadAsync("/models/cone.glb").then((gltf) => {
    done++;
    setProgress(done / total);
    const cone = gltf.scene;
    snapVertices(cone);
    flattenMaterials(cone);
    cone.scale.setScalar(1.4);
    [
      [-3.6, 3.2],
      [3.8, 3.0],
      [-4.2, -2.5],
      [4.0, -2.8],
    ].forEach(([x, z], i) => {
      const c = cone.clone(true);
      c.position.set(x, 0, z);
      c.rotation.y = i * 0.7;
      scene.add(c);
    });
  });

  const carPromises = CARS.map(async (entry) => {
    const gltf = await loader.loadAsync(`/models/${entry.file}`);
    const model = gltf.scene;
    snapVertices(model);
    flattenMaterials(model);
    fitCar(model);
    carCache.set(entry.id, model);
    done++;
    setProgress(done / total);
  });

  await Promise.all([conePromise, ...carPromises]);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  setLowRes();
}

btnLights.addEventListener("click", () => {
  lightsOn = !lightsOn;
  headLightL.visible = lightsOn;
  headLightR.visible = lightsOn;
  btnLights.textContent = lightsOn ? "Lights ON" : "Lights OFF";
  btnLights.classList.toggle("off", !lightsOn);
});

btnSpin.addEventListener("click", () => {
  spinOn = !spinOn;
  btnSpin.textContent = spinOn ? "Spin ON" : "Spin OFF";
  btnSpin.classList.toggle("off", !spinOn);
});

document.getElementById("prev-car").addEventListener("click", () => {
  showCar(carIndex - 1);
});
document.getElementById("next-car").addEventListener("click", () => {
  showCar(carIndex + 1);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") showCar(carIndex - 1);
  if (e.key === "ArrowRight") showCar(carIndex + 1);
});

window.addEventListener("resize", onResize);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  ps2Pass.uniforms.time.value = t;

  if (platform && spinOn) {
    platform.rotation.y += 0.0035;
  }

  // subtle camera bob — PS2 menu vibe
  camera.position.y += Math.sin(t * 0.7) * 0.00035;

  controls.update();
  composer.render();
}

async function boot() {
  buildGarage();
  setupLights();
  buildSwatches();
  setLowRes();
  setProgress(0.05);

  try {
    await preloadAll();
    await showCar(0);
    setProgress(1);
    setTimeout(() => loadingEl.classList.add("hidden"), 280);
  } catch (err) {
    console.error(err);
    loadingEl.querySelector(".loading-text").textContent = "LOAD FAILED";
  }

  animate();
}

boot();
