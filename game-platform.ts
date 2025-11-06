import * as THREE from "three";
import { World } from "./src/core";
import Stats from "three/examples/jsm/libs/stats.module.js";

let mobileKeys: { [key: string]: boolean } = {};

// Обработчики для сенсорных кнопок (адаптируем для платформера: left, right, jump)
const leftBtn = document.getElementById("leftBtn") as HTMLButtonElement;
const upBtn = document.getElementById("upBtn") as HTMLButtonElement; // Теперь jump
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
  leftBtn.addEventListener("mousedown", () => (mobileKeys["ArrowLeft"] = true));
  leftBtn.addEventListener("mouseup", () => (mobileKeys["ArrowLeft"] = false));
}

if (upBtn) {
  // Jump button
  upBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mobileKeys[" "] = true; // Пробел для прыжка
  });
  upBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    mobileKeys[" "] = false;
  });
  upBtn.addEventListener("mousedown", () => (mobileKeys[" "] = true));
  upBtn.addEventListener("mouseup", () => (mobileKeys[" "] = false));
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
const gameOverMessage = document.createElement("div"); // Сообщение о конце игры (если нужно)
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
const camera = new THREE.OrthographicCamera();
camera.position.z = 1;
const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);
document.body.appendChild(stats.dom);

// Адаптация к размеру окна
let worldWidth = 40;
let worldHeight = 20;

function resizeRenderer() {
  const aspect = window.innerWidth / window.innerHeight;
  const adjustedWorldHeight = worldWidth / aspect;

  camera.left = -worldWidth / 2;
  camera.right = worldWidth / 2;
  camera.top = adjustedWorldHeight / 2;
  camera.bottom = -adjustedWorldHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

// Инициализация мира (ECS) — добавили компоненты для платформера
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
    size: {
      // Размеры для коллизий (AABB)
      width: { type: "f32", byte: 4, default: 1 },
      height: { type: "f32", byte: 4, default: 1 },
    },
    gravity: {
      // Гравитация (только для игрока)
      value: { type: "f32", byte: 4, default: 0 },
    },
    onGround: {
      // Флаг, на земле ли игрок
      value: { type: "u8", byte: 1, default: 0 },
    },
  },
});

const Position = world.useComponent("position");
const Velocity = world.useComponent("velocity");
const Size = world.useComponent("size");
const Gravity = world.useComponent("gravity");
const OnGround = world.useComponent("onGround");

// Переменные для платформ
let platformEntities: number[] = [];
let platformMeshes: THREE.Mesh[] = [];

// Игрок: сущность и визуализация (квадрат)
let playerId = world.createEntity();
Position.add(playerId);
Velocity.add(playerId);
Size.add(playerId);
Gravity.add(playerId);
OnGround.add(playerId);
Position.set(playerId, "x", 0);
Position.set(playerId, "y", 1);
Velocity.set(playerId, "dx", 0);
Velocity.set(playerId, "dy", 0);
Size.set(playerId, "width", 1);
Size.set(playerId, "height", 1);
Gravity.set(playerId, "value", -9.8); // Гравитация вниз
OnGround.set(playerId, "value", 0);

// Геометрия игрока (квадрат)
const playerGeometry = new THREE.PlaneGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(playerMesh);

// Управление игроком (клавиши)
const keys: { [key: string]: boolean } = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === " ") e.preventDefault(); // Предотвратить скролл
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// Функция создания платформ
function createPlatform(x: number, y: number, width: number, height: number) {
  const entityId = world.createEntity();
  Position.add(entityId);
  Size.add(entityId);
  Position.set(entityId, "x", x);
  Position.set(entityId, "y", y);
  Size.set(entityId, "width", width);
  Size.set(entityId, "height", height);

  // Визуализация платформы
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  platformMeshes.push(mesh);
  platformEntities.push(entityId);
}

// Создание платформ (несколько уровней)
function initPlatforms() {
  // Земля
  createPlatform(0, -9, 40, 2);
  // Платформы
  createPlatform(-5, -5, 4, 1);
  createPlatform(5, -3, 4, 1);
  createPlatform(-8, -1, 3, 1);
  createPlatform(2, 1, 5, 1);
  createPlatform(-3, 3, 4, 1);
}
initPlatforms();

// Функция обновления платформ (если нужно динамически менять)
function updatePlatforms() {
  for (let i = 0; i < platformEntities.length; i++) {
    const entityId = platformEntities[i];
    const x = Position.get(entityId, "x");
    const y = Position.get(entityId, "y");
    platformMeshes[i].position.set(x, y, 0);
  }
}

// Переменная для состояния игры
let gameRunning = true;

// Функция AABB коллизии
function isColliding(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function update(delta: number) {
  if (!gameRunning) return;
  const dt = delta / 1000;

  // Обновление игрока
  let x = Position.get(playerId, "x");
  let y = Position.get(playerId, "y");
  let dx = Velocity.get(playerId, "dx");
  let dy = Velocity.get(playerId, "dy");
  const gravity = Gravity.get(playerId, "value");
  let onGround = false; // Сбросим флаг
  const playerWidth = Size.get(playerId, "width");
  const playerHeight = Size.get(playerId, "height");

  // Управление
  if (keys["ArrowLeft"] || mobileKeys["ArrowLeft"]) dx = -5;
  else if (keys["ArrowRight"] || mobileKeys["ArrowRight"]) dx = 5;
  else dx *= 0.8; // Замедление

  // Прыжок
  if ((keys[" "] || mobileKeys[" "]) && OnGround.get(playerId, "value")) {
    dy = 10; // Сила прыжка
    onGround = false;
  }

  // Применение гравитации
  dy += gravity * dt;

  // Предварительное обновление позиции
  let newX = x + dx * dt;
  let newY = y + dy * dt;

  // Коллизии с платформами - разделение по осям с корректным разрешением
  for (let entityId of platformEntities) {
    const px = Position.get(entityId, "x");
    const py = Position.get(entityId, "y");
    const pw = Size.get(entityId, "width");
    const ph = Size.get(entityId, "height");

    // Сначала разрешаем коллизии по X (горизонтально)
    if (
      newX + playerWidth / 2 > px - pw / 2 &&
      newX - playerWidth / 2 < px + pw / 2 &&
      y + playerHeight / 2 > py - ph / 2 &&
      y - playerHeight / 2 < py + ph / 2
    ) {
      // Есть пересечение по X и Y (используем текущий y)
      const platformLeft = px - pw / 2;
      const platformRight = px + pw / 2;
      const playerLeft = newX - playerWidth / 2;
      const playerRight = newX + playerWidth / 2;

      if (playerRight > platformLeft && playerLeft < platformLeft) {
        // Игрок пересекает левую сторону платформы
        newX = platformLeft - playerWidth / 2;
      } else if (playerLeft < platformRight && playerRight > platformRight) {
        // Игрок пересекает правую сторону платформы
        newX = platformRight + playerWidth / 2;
      }
      dx = 0; // Останавливаем горизонтальную скорость
    }

    // Затем разрешаем коллизии по Y (вертикально), используя обновленный newX
    if (
      newY + playerHeight / 2 > py - ph / 2 &&
      newY - playerHeight / 2 < py + ph / 2 &&
      newX + playerWidth / 2 > px - pw / 2 &&
      newX - playerWidth / 2 < px + pw / 2
    ) {
      // Есть пересечение по Y и X (используем обновленный newX)
      const platformTop = py - ph / 2;
      const platformBottom = py + ph / 2;
      const playerTop = newY - playerHeight / 2;
      const playerBottom = newY + playerHeight / 2;

      if (playerBottom > platformTop && playerTop < platformTop) {
        // Игрок пересекает верхнюю сторону платформы (удар головой)
        newY = platformTop - playerHeight / 2;
        dy = 0; // Останавливаем вертикальную скорость
      } else if (playerTop < platformBottom && playerBottom > platformBottom) {
        // Игрок пересекает нижнюю сторону платформы (падение на землю)
        newY = platformBottom + playerHeight / 2;
        dy = 0; // Останавливаем вертикальную скорость
        onGround = true;
      }
    }
  }

  // Границы мира (игрок не улетает за экран)
  if (newX - playerWidth / 2 < -worldWidth / 2)
    newX = -worldWidth / 2 + playerWidth / 2;
  if (newX + playerWidth / 2 > worldWidth / 2)
    newX = worldWidth / 2 - playerWidth / 2;
  if (newY - playerHeight / 2 < -worldHeight / 2) {
    newY = -worldHeight / 2 + playerHeight / 2;
    dy = 0;
    onGround = true;
  }

  Position.set(playerId, "x", newX);
  Position.set(playerId, "y", newY);
  Velocity.set(playerId, "dx", dx);
  Velocity.set(playerId, "dy", dy);
  OnGround.set(playerId, "value", onGround ? 1 : 0);
}

// Рендеринг
function render() {
  stats.begin();
  let x = Position.get(playerId, "x");
  let y = Position.get(playerId, "y");

  playerMesh.position.set(x, y, 0);
  camera.position.set(x, y, 1);

  renderer.render(scene, camera);
  stats.end();
}

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
animate(0);
