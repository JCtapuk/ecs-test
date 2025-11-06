import * as THREE from "three";
import { World } from "./src/core";
import Stats from "three/examples/jsm/libs/stats.module.js";

let mobileKeys: { [key: string]: boolean } = {};

// Обработчики для сенсорных кнопок
const leftBtn = document.getElementById("leftBtn") as HTMLButtonElement;
const upBtn = document.getElementById("upBtn") as HTMLButtonElement;
const rightBtn = document.getElementById("rightBtn") as HTMLButtonElement;

if (leftBtn) {
  leftBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mobileKeys["ArrowLeft"] = true;
  });
  leftBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    mobileKeys["ArrowLeft"] = false;
  });
  // Для десктопа, если хочешь совместимость
  leftBtn.addEventListener("mousedown", () => (mobileKeys["ArrowLeft"] = true));
  leftBtn.addEventListener("mouseup", () => (mobileKeys["ArrowLeft"] = false));
}

if (upBtn) {
  upBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mobileKeys["ArrowUp"] = true;
  });
  upBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    mobileKeys["ArrowUp"] = false;
  });
  upBtn.addEventListener("mousedown", () => (mobileKeys["ArrowUp"] = true));
  upBtn.addEventListener("mouseup", () => (mobileKeys["ArrowUp"] = false));
}

if (rightBtn) {
  rightBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mobileKeys["ArrowRight"] = true;
  });
  rightBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    mobileKeys["ArrowRight"] = false;
  });
  rightBtn.addEventListener(
    "mousedown",
    () => (mobileKeys["ArrowRight"] = true)
  );
  rightBtn.addEventListener(
    "mouseup",
    () => (mobileKeys["ArrowRight"] = false)
  );
}

// Получение элементов DOM
const entitiesValue = document.getElementById(
  "entities-value"
) as HTMLSpanElement;
const entitiesSlider = document.getElementById(
  "entities-slider"
) as HTMLInputElement;
const gameOverMessage = document.createElement("div"); // Новое: сообщение о конце игры
gameOverMessage.style.position = "absolute";
gameOverMessage.style.top = "50%";
gameOverMessage.style.left = "50%";
gameOverMessage.style.transform = "translate(-50%, -50%)";
gameOverMessage.style.color = "red";
gameOverMessage.style.fontSize = "24px";
gameOverMessage.style.display = "none";
document.body.appendChild(gameOverMessage);

// Инициализация Three.js
const scene = new THREE.Scene();
const stats = new Stats();
const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 10);
camera.position.z = 1;
const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);
document.body.appendChild(stats.dom);

// Адаптация к размеру окна (границы для игры: -10 до 10)
let boxSizeX = 10;
let boxSizeY = 10;
function resizeRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.left = -window.innerWidth / 80;
  camera.right = window.innerWidth / 80;
  camera.top = window.innerHeight / 80;
  camera.bottom = -window.innerHeight / 80;
  camera.updateProjectionMatrix();
  boxSizeX = camera.right;
  boxSizeY = camera.top;
}
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

// Инициализация мира (ECS) — добавили компонент rotation для игрока
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
    color: {
      r: { type: "f32", byte: 4, default: 1.0 },
      g: { type: "f32", byte: 4, default: 0.0 },
      b: { type: "f32", byte: 4, default: 0.0 },
    },
    rotation: {
      // Новое: для поворота игрока
      angle: { type: "f32", byte: 4, default: 0 },
    },
  },
});

const Position = world.useComponent("position");
const Velocity = world.useComponent("velocity");
const Color = world.useComponent("color");
const Rotation = world.useComponent("rotation");

// Переменные для астероидов
let numEntities = 100;
let asteroidEntities: number[] = [];
let positions: Float32Array;
let colors: Float32Array;
let pointsGeometry = new THREE.BufferGeometry();
let pointsMaterial = new THREE.PointsMaterial({
  size: 20, // Увеличил размер для астероидов
  vertexColors: true,
});
let asteroids = new THREE.Points(pointsGeometry, pointsMaterial);
scene.add(asteroids);

// Игрок: сущность и визуализация (треугольник)
let playerId = world.createEntity();
Position.add(playerId);
Velocity.add(playerId);
Rotation.add(playerId);
Position.set(playerId, "x", 0);
Position.set(playerId, "y", 0);
Velocity.set(playerId, "dx", 0);
Velocity.set(playerId, "dy", 0);
Rotation.set(playerId, "angle", 0);

// Геометрия игрока (треугольник)
const playerGeometry = new THREE.BufferGeometry();
const playerVertices = new Float32Array([
  0,
  0.5,
  0, // Верхушка
  -0.3,
  -0.5,
  0, // Левая нижняя
  0.3,
  -0.5,
  0, // Правая нижняя
]);
playerGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(playerVertices, 3)
);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(playerMesh);

// Управление игроком (клавиши)
const keys: { [key: string]: boolean } = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// Функция обновления астероидов
function updateEntities(newNum: number) {
  numEntities = newNum;
  entitiesValue.textContent = numEntities.toString();

  // Удаляем старые
  for (let id of asteroidEntities) {
    world.destroyEntity(id);
  }
  asteroidEntities.length = 0;

  // Создаём новые астероиды
  for (let i = 0; i < numEntities; i++) {
    const entityId = world.createEntity();
    Position.add(entityId);
    Velocity.add(entityId);
    Color.add(entityId);

    // Случайная позиция на краю экрана
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) {
      x = -boxSizeX;
      y = (Math.random() - 0.5) * boxSizeY * 2;
    } else if (side === 1) {
      x = boxSizeX;
      y = (Math.random() - 0.5) * boxSizeY * 2;
    } else if (side === 2) {
      y = -boxSizeY;
      x = (Math.random() - 0.5) * boxSizeX * 2;
    } else {
      y = boxSizeY;
      x = (Math.random() - 0.5) * boxSizeX * 2;
    }
    Position.set(entityId, "x", x);
    Position.set(entityId, "y", y);

    // Случайная скорость (постоянная, без гравитации)
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.1 + Math.random() * 1;
    Velocity.set(entityId, "dx", Math.cos(angle) * speed);
    Velocity.set(entityId, "dy", Math.sin(angle) * speed);

    // Цвет HSL
    const hue = (i / numEntities) * 360;
    const rgb = hslToRgb(hue / 360, 0.7, 0.5);
    Color.set(entityId, "r", rgb.r);
    Color.set(entityId, "g", rgb.g);
    Color.set(entityId, "b", rgb.b);

    asteroidEntities.push(entityId);
  }

  // Буферы
  positions = new Float32Array(numEntities * 3);
  colors = new Float32Array(numEntities * 3);
  pointsGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  pointsGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  updateAsteroidsGeometry();
}

// HSL to RGB
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r, g, b };
}

// Обновление геометрии астероидов
function updateAsteroidsGeometry() {
  const posArray = pointsGeometry.attributes.position.array as Float32Array;
  const colorArray = pointsGeometry.attributes.color.array as Float32Array;

  for (let i = 0; i < asteroidEntities.length; i++) {
    const entityId = asteroidEntities[i];
    const x = Position.get(entityId, "x");
    const y = Position.get(entityId, "y");
    const r = Color.get(entityId, "r");
    const g = Color.get(entityId, "g");
    const b = Color.get(entityId, "b");

    posArray[i * 3] = x;
    posArray[i * 3 + 1] = y;
    posArray[i * 3 + 2] = 0;

    colorArray[i * 3] = r;
    colorArray[i * 3 + 1] = g;
    colorArray[i * 3 + 2] = b;
  }

  pointsGeometry.attributes.position.needsUpdate = true;
  pointsGeometry.attributes.color.needsUpdate = true;
}

// Переменная для состояния игры
let gameRunning = true;

// Функция обновления (физика)
function update(delta: number) {
  if (!gameRunning) return;
  const dt = delta / 1000;

  // Обновление игрока
  let x = Position.get(playerId, "x");
  let y = Position.get(playerId, "y");
  let dx = Velocity.get(playerId, "dx");
  let dy = Velocity.get(playerId, "dy");
  let angle = Rotation.get(playerId, "angle");

  // Поворот
  if (keys["ArrowLeft"] || mobileKeys["ArrowLeft"]) angle += 3 * dt;
  if (keys["ArrowRight"] || mobileKeys["ArrowRight"]) angle -= 3 * dt;

  // Ускорение (как в предыдущем патче)
  if (keys["ArrowUp"] || mobileKeys["ArrowUp"]) {
    dx += -Math.sin(angle) * 5 * dt;
    dy += Math.cos(angle) * 5 * dt;
  }

  // Инерция (замедление)
  dx *= 0.99;
  dy *= 0.99;

  // Обновление позиции
  x += dx * dt;
  y += dy * dt;

  // Границы (тороидальный мир, как в Asteroids)
  if (x < -boxSizeX) x = boxSizeX;
  if (x > boxSizeX) x = -boxSizeX;
  if (y < -boxSizeY) y = boxSizeY;
  if (y > boxSizeY) y = -boxSizeY;

  Position.set(playerId, "x", x);
  Position.set(playerId, "y", y);
  Velocity.set(playerId, "dx", dx);
  Velocity.set(playerId, "dy", dy);
  Rotation.set(playerId, "angle", angle);

  // Обновление астероидов (движение по прямой)
  for (let i = 0; i < asteroidEntities.length; i++) {
    const entityId = asteroidEntities[i];
    let ax = Position.get(entityId, "x");
    let ay = Position.get(entityId, "y");
    const adx = Velocity.get(entityId, "dx");
    const ady = Velocity.get(entityId, "dy");

    ax += adx * dt;
    ay += ady * dt;

    // Тор (астероиды улетают за край и появляются с другой стороны)
    if (ax < -boxSizeX) ax = boxSizeX;
    if (ax > boxSizeX) ax = -boxSizeX;
    if (ay < -boxSizeY) ay = boxSizeY;
    if (ay > boxSizeY) ay = -boxSizeY;

    Position.set(entityId, "x", ax);
    Position.set(entityId, "y", ay);
  }

  // Проверка столкновений
  const playerRadius = 0.5;
  const asteroidRadius = 0.5;
  for (let entityId of asteroidEntities) {
    const ax = Position.get(entityId, "x");
    const ay = Position.get(entityId, "y");
    const distance = Math.sqrt((x - ax) ** 2 + (y - ay) ** 2);
    if (distance < playerRadius + asteroidRadius) {
      gameRunning = false;
      gameOverMessage.textContent = "Game Over! Collision detected.";
      gameOverMessage.style.display = "block";
      return;
    }
  }
}

// Рендеринг
function render() {
  updateAsteroidsGeometry();
  stats.begin();
  let x = Position.get(playerId, "x");
  let y = Position.get(playerId, "y");
  let angle = Rotation.get(playerId, "angle");

  playerMesh.position.set(x, y, 0);
  playerMesh.rotation.z = angle;

  renderer.render(scene, camera);
  stats.end();
}

// Обработчик слайдера
entitiesSlider.addEventListener("input", () => {
  const newNum = parseInt(entitiesSlider.value);
  updateEntities(newNum);
});

// Основной цикл
let lastTime = 0;
function animate(time: number) {
  const delta = time - lastTime;
  lastTime = time;

  update(delta);
  render();

  if (gameRunning) requestAnimationFrame(animate);
}

// Запуск
updateEntities(numEntities);
animate(0);
