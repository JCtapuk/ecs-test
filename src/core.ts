const ENTITY_SIZE = 256;

function getIndexChunkByEntity(enttity: number) {
  return Math.floor(enttity / ENTITY_SIZE);
}

function getIndexBufferByEntity(entity: number) {
  return entity % ENTITY_SIZE;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

class ComponentChunk {
  #occupiedCount = 0;
  #occupied: Uint8Array;
  #buffer: ArrayBuffer;
  #view: DataView;

  get occupiedCount() {
    return this.#occupiedCount;
  }

  constructor(metadata: ComponentMetadata) {
    this.#occupied = new Uint8Array(ENTITY_SIZE / 8);
    this.#buffer = new ArrayBuffer(ENTITY_SIZE * metadata.byteLength);
    this.#view = new DataView(this.#buffer);
  }

  isOccupied(index: number): boolean {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    return (this.#occupied[byteIndex] & (1 << bitIndex)) !== 0;
  }

  setOccupied(index: number, occupied: boolean): void {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    const wasOccupied = (this.#occupied[byteIndex] & (1 << bitIndex)) !== 0;

    if (occupied) {
      if (!wasOccupied) {
        this.#occupied[byteIndex] |= 1 << bitIndex;
        this.#occupiedCount++; // Инкремент, если был свободен
      }
    } else {
      if (wasOccupied) {
        this.#occupied[byteIndex] &= ~(1 << bitIndex);
        this.#occupiedCount--; // Декремент, если был занят
      }
    }
  }

  isEmpty(): boolean {
    return this.#occupiedCount === 0; // O(1) проверка вместо цикла
  }

  get(offset: number, field: ComponentField) {
    switch (field.type) {
      case "f32": {
        return this.#view.getFloat32(offset, true);
      }
      case "u32": {
        return this.#view.getUint32(offset, true);
      }
      case "string": {
        const bytes = new Uint8Array(this.#buffer, offset, field.byte);
        return decoder.decode(bytes.subarray(0, field.byte));
      }
    }
  }

  set(offset: number, field: ComponentField, value: number | string) {
    switch (field.type) {
      case "f32": {
        this.#view.setFloat32(offset, value as number, true);
        break;
      }
      case "u32": {
        this.#view.setUint32(offset, value as number, true);
        break;
      }
      case "string": {
        const bytes = encoder.encode(value as string);
        const target = new Uint8Array(this.#buffer, offset, field.byte);
        target.fill(0);
        target.set(bytes.subarray(0, field.byte));
        break;
      }
    }
  }
}

function compileMetadata(schema: ComponentSchema): ComponentMetadata {
  let offset = 0;
  const fields: Record<string, { offset: number; field: ComponentField }> = {};
  for (const [name, field] of Object.entries(schema)) {
    fields[name] = { offset, field };
    offset += field.byte;
  }
  return { fields, byteLength: offset };
}

class Component<T extends ComponentSchema> {
  #metadata: ComponentMetadata;

  #freeChunks: ComponentChunk[] = [];
  #activeChunks: ComponentChunk[] = [];
  #fields: { offset: number; field: ComponentField }[];

  constructor(schema: T) {
    this.#metadata = compileMetadata(schema);
    this.#fields = Object.values(this.#metadata.fields);
  }

  #getChunk(entity: number) {
    const indexChunk = getIndexChunkByEntity(entity);

    let chunk = this.#activeChunks[indexChunk];
    if (!chunk) {
      chunk = this.#freeChunks.pop() ?? new ComponentChunk(this.#metadata);
      this.#activeChunks[indexChunk] = chunk;
    }

    return chunk;
  }

  add(entity: number) {
    const indexEntity = getIndexBufferByEntity(entity);
    const chunk = this.#getChunk(entity);

    if (!chunk.isOccupied(indexEntity)) {
      chunk.setOccupied(indexEntity, true);

      const offsetBase = indexEntity * this.#metadata.byteLength;
      for (const data of this.#fields) {
        const fullOffset = offsetBase + data.offset;
        chunk.set(fullOffset, data.field, data.field.default);
      }
    }

    return this;
  }

  remove(entity: number) {
    const indexEntity = getIndexBufferByEntity(entity);
    const indexChunk = getIndexChunkByEntity(entity);
    const chunk = this.#activeChunks[indexChunk];

    if (!chunk || !chunk.isOccupied(indexEntity)) return;

    chunk.setOccupied(indexEntity, false);

    if (chunk.isEmpty()) {
      delete this.#activeChunks[indexChunk];
      this.#freeChunks.push(chunk);
    }

    return this;
  }

  get<K extends keyof T>(
    entity: number,
    name: K
  ): T[K]["type"] extends "string" ? string : number {
    const data = this.#metadata.fields[name as string];
    const chunk = this.#getChunk(entity);
    const index = getIndexBufferByEntity(entity);
    const offset = index * this.#metadata.byteLength + data.offset;

    if (!chunk.isOccupied(index)) {
      throw new Error(
        `Entity ${entity} does not have component ${name as string}`
      );
    }

    return chunk.get(offset, data.field) as T[K]["type"] extends "string"
      ? string
      : number;
  }

  set<K extends keyof T>(
    entity: number,
    name: K,
    value: T[K]["type"] extends "string" ? string : number
  ) {
    const data = this.#metadata.fields[name as string];
    const chunk = this.#getChunk(entity);
    const index = getIndexBufferByEntity(entity);
    const offset = index * this.#metadata.byteLength + data.offset;

    if (!chunk.isOccupied(index)) {
      throw new Error(
        `Entity ${entity} does not have component ${name as string}`
      );
    }

    chunk.set(offset, data.field, value);

    return this;
  }
}

type ComponentField =
  | {
      type: "f32";
      byte: 4;
      default: number;
    }
  | {
      type: "u32";
      byte: 4;
      default: number;
    }
  | {
      type: "string";
      byte: number;
      default: string;
    };

type ComponentMetadata = {
  fields: Record<string, { offset: number; field: ComponentField }>;
  byteLength: number;
};
type ComponentSchema = Record<string, ComponentField>;

type WorldConfig = {
  components?: Record<string, ComponentSchema>;
};

class WorldManager {
  #components: Record<string, Component<ComponentSchema>> = {};

  registerComponent(
    name: string,
    schema: ComponentSchema
  ): Component<ComponentSchema> {
    const component = new Component(schema);
    this.#components[name] = component;
    return component;
  }

  hasComponent(name: string) {
    return name in this.#components;
  }

  getComponent(name: string) {
    return this.#components[name];
  }
}

export class World<T extends WorldConfig = WorldConfig> {
  #manager = new WorldManager();
  #nextEntityId = 0;
  #freeEntities: number[] = [];

  constructor(config: T) {
    const { components = {} } = config;

    for (const name in components) {
      this.#manager.registerComponent(name, components[name]);
    }
  }

  createEntity() {
    return this.#freeEntities.pop() ?? this.#nextEntityId++;
  }

  destroyEntity(entity: number) {
    this.#freeEntities.push(entity);
  }

  useComponent<K extends keyof T["components"]>(name: K) {
    const component = this.#manager.getComponent(name as string);

    if (!component) {
      throw new Error(`Component "${String(name)}" not found`);
    }

    return component as Component<
      T["components"] extends Record<string, ComponentSchema>
        ? T["components"][K]
        : ComponentSchema
    >;
  }
}
