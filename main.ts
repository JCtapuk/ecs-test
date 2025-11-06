import * as THREE from "three";
import { World } from "./src/core";
import Stats from "three/examples/jsm/libs/stats.module.js"; // Добавлен импорт Stats

// Получение элементов DOM
const entitiesValue = document.getElementById(
  "entities-value"
) as HTMLSpanElement;
const entitiesSlider = document.getElementById(
  "entities-slider"
) as HTMLInputElement;

// Инициализация Three.js
const scene = new THREE.Scene();
const stats = new Stats();
const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 10); // Ортографическая камера для 2D вида
camera.position.z = 1;
const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);
document.body.appendChild(stats.dom);

let boxSizeX = 5;
let boxSizeY = 5;

// Адаптация к размеру окна
function resizeRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.left = -window.innerWidth / 80; // Масштаб для 2D (примерно как в Canvas2D)
  camera.right = window.innerWidth / 80;
  camera.top = window.innerHeight / 80;
  camera.bottom = -window.innerHeight / 80;
  camera.updateProjectionMatrix();

  // Обновляем границы для физики
  boxSizeX = camera.right;
  boxSizeY = camera.top;
}
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

// Инициализация мира (ECS) — добавляем компонент color
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
  },
});

const Position = world.useComponent("position");
const Velocity = world.useComponent("velocity");
const Color = world.useComponent("color");

// Переменные для сущностей
let numEntities = 100;
let testEntities: number[] = [];
let positions: Float32Array;
let colors: Float32Array;
// Геометрия и материал для Points
let pointsGeometry = new THREE.BufferGeometry();
let pointsMaterial = new THREE.PointsMaterial({
  size: 10, // Размер точек (можно менять)
  vertexColors: true, // Используем цвета вершин
});
let points = new THREE.Points(pointsGeometry, pointsMaterial);

scene.add(points);

function updateEntities(newNum: number) {
  numEntities = newNum;
  entitiesValue.textContent = numEntities.toString();

  // Удаляем старые сущности
  for (let id of testEntities) {
    world.destroyEntity(id);
  }
  testEntities.length = 0;

  // Создаём новые сущности (2D: x, y; z=0)
  for (let i = 0; i < numEntities; i++) {
    const entityId = world.createEntity();
    Position.add(entityId);
    Velocity.add(entityId);
    Color.add(entityId);

    Position.set(entityId, "x", (Math.random() - 0.5) * 10);
    Position.set(entityId, "y", (Math.random() - 0.5) * 10);

    const angle = Math.random() * Math.PI * 2;
    let dx = Math.cos(angle) * 100;
    let dy = Math.sin(angle) * 100;
    Velocity.set(entityId, "dx", dx);
    Velocity.set(entityId, "dy", dy);

    // Цвет на основе индекса (HSL -> RGB, нормализованный 0-1)
    const hue = (i / numEntities) * 360;
    const saturation = 0.7;
    const lightness = 0.5;
    const rgb = hslToRgb(hue / 360, saturation, lightness);
    Color.set(entityId, "r", rgb.r);
    Color.set(entityId, "g", rgb.g);
    Color.set(entityId, "b", rgb.b);

    testEntities.push(entityId);
  }

  // Пересоздаём буферы при изменении количества сущностей
  positions = new Float32Array(numEntities * 3); // x, y, z
  colors = new Float32Array(numEntities * 3); // r, g, b
  pointsGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  pointsGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // Обновляем геометрию сразу после создания
  updatePointsGeometry();
}

// Функция HSL to RGB (возвращает 0-1)
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

function updatePointsGeometry() {
  const posArray = pointsGeometry.attributes.position.array as Float32Array;
  const colorArray = pointsGeometry.attributes.color.array as Float32Array;

  for (let i = 0; i < testEntities.length; i++) {
    const entityId = testEntities[i];
    const x = Position.get(entityId, "x");
    const y = Position.get(entityId, "y");
    const r = Color.get(entityId, "r");
    const g = Color.get(entityId, "g");
    const b = Color.get(entityId, "b");

    posArray[i * 3] = x;
    posArray[i * 3 + 1] = y;
    posArray[i * 3 + 2] = 0; // z = 0 для 2D

    colorArray[i * 3] = r;
    colorArray[i * 3 + 1] = g;
    colorArray[i * 3 + 2] = b;
  }

  pointsGeometry.attributes.position.needsUpdate = true;
  pointsGeometry.attributes.color.needsUpdate = true;
}

// Фиксированные значения физики
const gravity = 9.8;
const damping = 0.9;
const wind = 0;

// Функция обновления физики (только x, y)
function update(delta: number) {
  const dt = delta / 1000;

  for (let i = 0; i < testEntities.length; i++) {
    const entityId = testEntities[i];
    let x = Position.get(entityId, "x");
    let y = Position.get(entityId, "y");
    let dx = Velocity.get(entityId, "dx");
    let dy = Velocity.get(entityId, "dy");

    dy -= gravity * dt;
    dx += wind * dt;

    x += dx * dt;
    y += dy * dt;

    // Отражения от стен (-5 до 5)
    if (x <= -boxSizeX || x >= boxSizeX) {
      dx = -dx * damping;
      x = Math.max(-boxSizeX + 0.1, Math.min(boxSizeX - 0.1, x));
    }
    if (y <= -boxSizeY || y >= boxSizeY) {
      dy = -dy * damping;
      y = Math.max(-boxSizeY + 0.1, Math.min(boxSizeY - 0.1, y));
    }

    // Маленькие толчки
    if (Math.abs(dx) < 0.5) dx += (Math.random() - 0.5) * 1;
    if (Math.abs(dy) < 0.5) dy += (Math.random() - 0.5) * 1;

    Velocity.set(entityId, "dx", dx);
    Velocity.set(entityId, "dy", dy);
    Position.set(entityId, "x", x);
    Position.set(entityId, "y", y);
  }
}

// Функция рендеринга
function render() {
  updatePointsGeometry(); // Обновляем геометрию каждый кадр
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
}

// Обработчик слайдера
entitiesSlider.addEventListener("input", () => {
  const newNum = parseInt(entitiesSlider.value);
  updateEntities(newNum);
});

// Основной цикл анимации с ручным FPS (как в Canvas2D версии)
let lastTime = 0;

function animate(time: number) {
  const delta = time - lastTime;
  lastTime = time;

  update(delta);
  render();

  requestAnimationFrame(animate);
}

// Запуск
updateEntities(numEntities);
animate(0);
