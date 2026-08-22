import type { PetState } from "./types";

export type SpriteFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PetManifest = {
  id: string;
  name: string;
  version: number;
  defaultScale: number;
  spriteSheet: string;
  sourceFrameSize: {
    width: number;
    height: number;
  };
  states: Record<PetState, {
    animation: string;
    spriteSheet: string;
    frames: SpriteFrame[];
    frameDurationMs: number;
  }>;
  slots: string[];
};

export type PetAssetBundle = {
  manifest: PetManifest;
  spriteSheetDataUrl: string;
};

export function validatePetManifest(value: unknown): PetManifest {
  if (!isRecord(value)) {
    throw new Error("Pet manifest must be an object.");
  }

  const requiredStates: PetState[] = ["sleeping", "working", "playing"];
  for (const key of ["id", "name", "spriteSheet"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new Error(`Pet manifest is missing string field: ${key}.`);
    }
  }

  if (typeof value.version !== "number" || value.version < 1) {
    throw new Error("Pet manifest version must be a positive number.");
  }

  if (typeof value.defaultScale !== "number" || value.defaultScale <= 0) {
    throw new Error("Pet manifest defaultScale must be greater than 0.");
  }

  if (!isRecord(value.sourceFrameSize)) {
    throw new Error("Pet manifest sourceFrameSize is missing.");
  }

  if (!isRecord(value.states)) {
    throw new Error("Pet manifest states are missing.");
  }

  for (const state of requiredStates) {
    const definition = value.states[state];
    if (!isRecord(definition) || typeof definition.animation !== "string" || typeof definition.spriteSheet !== "string") {
      throw new Error(`Pet state ${state} is invalid.`);
    }

    if (!Array.isArray(definition.frames) || definition.frames.length === 0 || definition.frames.some((frame) => !isFrame(frame))) {
      throw new Error(`Pet state ${state} must include at least one valid frame.`);
    }

    if (typeof definition.frameDurationMs !== "number" || definition.frameDurationMs <= 0) {
      throw new Error(`Pet state ${state} must include a positive frame duration.`);
    }
  }

  if (!Array.isArray(value.slots) || value.slots.some((slot) => typeof slot !== "string")) {
    throw new Error("Pet manifest slots must be an array of strings.");
  }

  return value as PetManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFrame(value: unknown): value is SpriteFrame {
  if (!isRecord(value)) {
    return false;
  }

  return ["x", "y", "width", "height"].every((key) => typeof value[key] === "number");
}
