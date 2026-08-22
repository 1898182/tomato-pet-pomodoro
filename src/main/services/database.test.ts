import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportEnvelopeV2, TimerPreset } from "../../shared/types";

vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir(), getAppPath: () => process.cwd() } }));

import { DatabaseService } from "./database";

describe("focus rhythm persistence", () => {
  let database: DatabaseService;
  let databasePath: string;

  beforeEach(async () => {
    databasePath = path.join(os.tmpdir(), `tomato-pet-test-${crypto.randomUUID()}.sqlite`);
    database = new DatabaseService(databasePath);
    await database.init();
  });

  afterEach(() => {
    database.close();
    fs.rmSync(databasePath, { force: true });
  });

  it("seeds only the four default focus cycles", () => {
    expect(database.listPresets().map(({ id, name, kind }) => ({ id, name, kind }))).toEqual([
      { id: "classic", name: "Classic", kind: "built_in" },
      { id: "extended", name: "Extended", kind: "built_in" },
      { id: "flow-52", name: "Flow 52", kind: "built_in" },
      { id: "deep-work", name: "Deep work", kind: "built_in" }
    ]);
  });

  it("enforces four visible rhythms and unique names", () => {
    expect(database.listPresets()).toHaveLength(4);
    expect(() => database.createCustomPreset(draft("Sprint"))).toThrow(/Delete a rhythm/);

    database.removePreset("deep-work");
    const custom = database.createCustomPreset(draft("Sprint"));

    expect(custom).toMatchObject({ name: "Sprint", kind: "custom" });
    expect(database.listPresets()).toHaveLength(4);
    expect(() => database.createCustomPreset(draft("sprint"))).toThrow(/already exists/);
    expect(() => database.createCustomPreset(draft("Classic"))).toThrow(/already exists/);
  });

  it("soft deletes built-ins, hard deletes customs, and falls back to Classic", () => {
    database.removePreset("deep-work");
    expect(database.exportData().hiddenBuiltInPresetIds).toEqual(["deep-work"]);
    const custom = database.createCustomPreset(draft("Writing"));
    database.selectPreset(custom.id);

    expect(database.removePreset(custom.id).id).toBe("classic");
    expect(database.listPresets().some((preset) => preset.id === custom.id)).toBe(false);
    expect(database.exportData().customPresets).toEqual([]);
    expect(database.listPresets().some((preset) => preset.id === "deep-work")).toBe(false);

    database.resetPresets();
    expect(database.listPresets().map((preset) => preset.id)).toEqual(["classic", "extended", "flow-52", "deep-work"]);
    expect(database.getDefaultPreset().id).toBe("classic");
    expect(database.exportData()).toMatchObject({ hiddenBuiltInPresetIds: [], customPresets: [] });
  });

  it("imports a schema-v2 custom rhythm without creating a fifth visible card", () => {
    const legacyCustom: TimerPreset = { id: "custom", name: "Custom", ...durations(), isDefault: true, kind: "custom" };
    const legacy: ExportEnvelopeV2 = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      settings: database.getSettings(),
      selectedPresetId: "custom",
      customPreset: legacyCustom,
      avatarPositions: []
    };

    const imported = database.importData(legacy);

    expect(imported.schemaVersion).toBe(3);
    expect(database.listPresets()).toHaveLength(4);
    expect(database.listPresets().map((preset) => preset.id)).toContain("custom");
    expect(database.listPresets().map((preset) => preset.id)).not.toContain("deep-work");
    expect(database.getDefaultPreset().id).toBe("custom");
  });

  it("rejects invalid imported settings without changing stored preferences", () => {
    const before = database.getSettings();
    const payload = database.exportData();
    const invalidPayload = {
      ...payload,
      settings: { ...payload.settings, focusAudioVolume: 4 }
    };

    expect(() => database.importData(invalidPayload)).toThrow(/volume must be between 0 and 1/);
    expect(database.getSettings()).toEqual(before);
  });
});

function durations() { return { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 }; }
function draft(name: string) { return { name, ...durations() }; }
