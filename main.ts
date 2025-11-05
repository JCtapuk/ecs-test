import { World } from "./src/core";
import * as THREE from "three";

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
gravitySlider.value = "0"; // 0 для хаоса
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
    },
    velocity: {
      dx: { type: "f32", byte: 4, default: 0 },
      dy: { type: "f32", byte: 4, default: 0 },
    },
  },
});

const Position = world.useComponent("position");
const Velocity = world.useComponent("velocity");

const testEntities: number[] = [];
const numEntities = 10000; // Стабильно 60 FPS

for (let i = 0; i < numEntities; i++) {
  const entityId = world.createEntity();
  Position.add(entityId);
  Velocity.add(entityId);

  Position.set(entityId, "x", Math.random() * width);
  Position.set(entityId, "y", Math.random() * height);

  const angle = Math.random() * Math.PI * 2;
  let dx = Math.cos(angle) * 100;
  let dy = Math.sin(angle) * 100;
  Velocity.set(entityId, "dx", dx);
  Velocity.set(entityId, "dy", dy);

  testEntities.push(entityId);
}

// Three.js setup (unchanged)
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, width, height, 0, 0.1, 1000);
camera.position.z = 1;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(width, height);

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(numEntities * 3);
const colors = new Float32Array(numEntities * 3);

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({ size: 8, vertexColors: true });
const points = new THREE.Points(geometry, material);
scene.add(points);

function render() {
  let idx = 0;
  for (let i = 0; i < testEntities.length; i++) {
    const entityId = testEntities[i];
    let x = Position.get(entityId, "x");
    let y = Position.get(entityId, "y");

    if (x < -100 || x > width + 100 || y < -100 || y > height + 100) {
      positions[idx] = 0;
      positions[idx + 1] = 0;
      positions[idx + 2] = 0;
    } else {
      positions[idx] = x;
      positions[idx + 1] = height - y;
      positions[idx + 2] = 0;

      const dy = Velocity.get(entityId, "dy");
      const speed = Math.min(1, Math.abs(dy) / 200);
      colors[idx] = dy < 0 ? speed : 0;
      colors[idx + 1] = 0.5;
      colors[idx + 2] = dy > 0 ? speed : 0;
    }
    idx += 3;
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
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
    let dx = Velocity.get(entityId, "dx");
    let dy = Velocity.get(entityId, "dy");

    if (x < -200 || x > width + 200 || y < -200 || y > height + 200) {
      continue;
    }

    dy -= gravity * dt; // Гравитация вниз
    dx += wind * dt;

    x += dx * dt;
    y += dy * dt;

    if (x <= 0 || x >= width) {
      dx = -dx * damping;
      x = Math.max(0.1, Math.min(width - 0.1, x));
    }
    if (y <= 0 || y >= height) {
      dy = -dy * damping;
      y = Math.max(0.1, Math.min(height - 0.1, y));
    }

    if (Math.abs(dx) < 0.5) dx += (Math.random() - 0.5) * 1;
    if (Math.abs(dy) < 0.5) dy += (Math.random() - 0.5) * 1;

    Velocity.set(entityId, "dx", dx);
    Velocity.set(entityId, "dy", dy);
    Position.set(entityId, "x", x);
    Position.set(entityId, "y", y);
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

  // Update UI labels
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
