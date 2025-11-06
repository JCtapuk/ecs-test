import { World } from "./src/core";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"; // Для вращения камеры

const width = 800;
const height = 600;
const canvas = document.createElement("canvas");
canvas.style.display = "block";
canvas.style.border = "1px solid black";
document.body.appendChild(canvas);

// FPS display
const fpsDisplay = document.createElement("div");
fpsDisplay.id = "fps-display";
fpsDisplay.style.fontSize = "20px";
fpsDisplay.style.marginTop = "10px";
document.body.appendChild(fpsDisplay);

// UI controls
const controlsDiv = document.createElement("div");
controlsDiv.style.marginTop = "10px";
document.body.appendChild(controlsDiv);

const gravitySlider = document.createElement("input");
gravitySlider.type = "range";
gravitySlider.min = "0";
gravitySlider.max = "500";
gravitySlider.value = "0";
gravitySlider.style.width = "200px";
const gravityLabel = document.createElement("span");
gravityLabel.innerText = "Gravity: 0";
controlsDiv.appendChild(gravityLabel);
controlsDiv.appendChild(document.createElement("br"));
controlsDiv.appendChild(gravitySlider);

const dampingSlider = document.createElement("input");
dampingSlider.type = "range";
dampingSlider.min = "0.9";
dampingSlider.max = "0.999";
dampingSlider.step = "0.001";
dampingSlider.value = "0.95";
const dampingLabel = document.createElement("span");
dampingLabel.innerText = "Damping: 0.95";
controlsDiv.appendChild(dampingLabel);
controlsDiv.appendChild(document.createElement("br"));
controlsDiv.appendChild(dampingSlider);

const windSlider = document.createElement("input");
windSlider.type = "range";
windSlider.min = "0";
windSlider.max = "50";
windSlider.value = "10";
const windLabel = document.createElement("span");
windLabel.innerText = "Wind: 10";
controlsDiv.appendChild(windLabel);
controlsDiv.appendChild(document.createElement("br"));
controlsDiv.appendChild(windSlider);

const world = new World({
  components: {
    position: {
      x: { type: "f32", byte: 4, default: 0 },
      y: { type: "f32", byte: 4, default: 0 },
      z: { type: "f32", byte: 4, default: 0 },
    },
    velocity: {
      dx: { type: "f32", byte: 4, default: 0 },
      dy: { type: "f32", byte: 4, default: 0 },
      dz: { type: "f32", byte: 4, default: 0 },
    },
  },
});

const Position = world.useComponent("position");
const Velocity = world.useComponent("velocity");

const testEntities: number[] = [];
const numEntities = 10000;

for (let i = 0; i < numEntities; i++) {
  const entityId = world.createEntity();
  Position.add(entityId);
  Velocity.add(entityId);

  Position.set(entityId, "x", (Math.random() - 0.5) * 10);
  Position.set(entityId, "y", (Math.random() - 0.5) * 10);
  Position.set(entityId, "z", (Math.random() - 0.5) * 10);

  const angle = Math.random() * Math.PI * 2;
  let dx = Math.cos(angle) * 100;
  let dy = Math.sin(angle) * 100;
  let dz = (Math.random() - 0.5) * 100;
  Velocity.set(entityId, "dx", dx);
  Velocity.set(entityId, "dy", dy);
  Velocity.set(entityId, "dz", dz);

  testEntities.push(entityId);
}

// Three.js setup (3D)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.set(0, 0, 15);
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(width, height);

// Добавим контролы для вращения камеры
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Плавное движение
controls.dampingFactor = 0.05;

// Добавим сетку мира для ориентации (на плоскости XZ)
const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
scene.add(gridHelper);

// Добавим направленный свет для освещения
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5); // Направление света
scene.add(directionalLight);

// Добавим ambient light для базового освещения всей сцены
const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Мягкий серый свет, интенсивность 0.5
scene.add(ambientLight);

// Геометрия и материал для сфер (InstancedMesh) — теперь без vertexColors, только instanceColor
const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
const sphereMaterial = new THREE.MeshPhongMaterial(); // Без vertexColors, цвета через instanceColor
const instancedMesh = new THREE.InstancedMesh(
  sphereGeometry,
  sphereMaterial,
  numEntities
);
scene.add(instancedMesh);

// Матрица для позиций и цвета (присвоим случайные цвета на старте)
const matrix = new THREE.Matrix4();
const color = new THREE.Color();

// Присвоим случайные цвета на старте (яркие, чтобы были заметны)
for (let i = 0; i < testEntities.length; i++) {
  const randomColor = new THREE.Color(
    Math.random(),
    Math.random(),
    Math.random()
  );
  instancedMesh.setColorAt(i, randomColor);
}
instancedMesh.instanceColor!.needsUpdate = true; // Обновим цвета один раз

function render() {
  for (let i = 0; i < testEntities.length; i++) {
    const entityId = testEntities[i];
    const x = Position.get(entityId, "x");
    const y = Position.get(entityId, "y");
    const z = Position.get(entityId, "z");

    matrix.setPosition(x, y, z);
    instancedMesh.setMatrixAt(i, matrix);
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
  // Цвета больше не обновляем каждый кадр — они статичные
  renderer.render(scene, camera);
}

function update(delta: number) {
  const dt = delta / 1000;
  const gravity = parseFloat(gravitySlider.value);
  const damping = parseFloat(dampingSlider.value);
  const wind = parseFloat(windSlider.value);

  for (let i = 0; i < testEntities.length; i++) {
    const entityId = testEntities[i];
    let x = Position.get(entityId, "x");
    let y = Position.get(entityId, "y");
    let z = Position.get(entityId, "z");
    let dx = Velocity.get(entityId, "dx");
    let dy = Velocity.get(entityId, "dy");
    let dz = Velocity.get(entityId, "dz");

    dy -= gravity * dt;
    dz -= gravity * dt * 0.5;
    dx += wind * dt;

    x += dx * dt;
    y += dy * dt;
    z += dz * dt;

    if (x <= -5 || x >= 5) {
      dx = -dx * damping;
      x = Math.max(-4.9, Math.min(4.9, x));
    }
    if (y <= -5 || y >= 5) {
      dy = -dy * damping;
      y = Math.max(-4.9, Math.min(4.9, y));
    }
    if (z <= -5 || z >= 5) {
      dz = -dz * damping;
      z = Math.max(-4.9, Math.min(4.9, z));
    }

    if (Math.abs(dx) < 0.5) dx += (Math.random() - 0.5) * 1;
    if (Math.abs(dy) < 0.5) dy += (Math.random() - 0.5) * 1;
    if (Math.abs(dz) < 0.5) dz += (Math.random() - 0.5) * 1;

    Velocity.set(entityId, "dx", dx);
    Velocity.set(entityId, "dy", dy);
    Velocity.set(entityId, "dz", dz);
    Position.set(entityId, "x", x);
    Position.set(entityId, "y", y);
    Position.set(entityId, "z", z);
  }
}

let frameCount = 0;
let lastLogTime = 0;
let lastTime = 0;

function loop(timestamp: number) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  frameCount++;

  update(delta);
  render();

  gravityLabel.innerText = `Gravity: ${gravitySlider.value}`;
  dampingLabel.innerText = `Damping: ${dampingSlider.value}`;
  windLabel.innerText = `Wind: ${windSlider.value}`;

  if (timestamp - lastLogTime >= 1000) {
    const fps = frameCount / ((timestamp - lastLogTime) / 1000);
    fpsDisplay.innerText = `FPS: ${fps.toFixed(1)} (entities: ${numEntities})`;
    frameCount = 0;
    lastLogTime = timestamp;
  }

  requestAnimationFrame(loop);
}

loop(0);
