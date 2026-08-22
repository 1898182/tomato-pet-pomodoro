import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TimerPreset } from "../../shared/types";
import { CreateRhythmDialog, FocusRhythms } from "./FocusRhythms";

const defaults: TimerPreset[] = [
  preset("classic", "Classic", true),
  preset("extended", "Extended"),
  preset("flow-52", "Flow 52"),
  preset("deep-work", "Deep work")
];

describe("focus rhythm cards", () => {
  it("renders the four cycles followed by a disabled fifth create card", () => {
    const html = render(defaults);

    expect(count(html, 'class="preset-option')).toBe(5);
    expect(html.indexOf("Classic")).toBeLessThan(html.indexOf("Extended"));
    expect(html.indexOf("Extended")).toBeLessThan(html.indexOf("Flow 52"));
    expect(html.indexOf("Flow 52")).toBeLessThan(html.indexOf("Deep work"));
    expect(html.indexOf("Deep work")).toBeLessThan(html.indexOf("Create rhythm"));
    expect(html).toMatch(/class="preset-option add-preset-card" disabled=""/);
    expect(html).toContain("lucide-plus");
  });

  it("enables the create card when fewer than four cycles are visible", () => {
    const html = render(defaults.slice(0, 3));
    const createCard = html.slice(html.indexOf('class="preset-option add-preset-card"'));

    expect(count(html, 'class="preset-option')).toBe(4);
    expect(createCard.slice(0, createCard.indexOf("</button>") + 9)).not.toContain("disabled");
  });

  it("renders creation errors as an alert inside the dialog", () => {
    const html = renderToStaticMarkup(createElement(CreateRhythmDialog, {
      draft: { name: "", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
      error: "Rhythm name is required.",
      onDraft: vi.fn(),
      onCancel: vi.fn(),
      onCreate: vi.fn()
    }));

    expect(html).toContain('class="rhythm-dialog"');
    expect(html).toContain('class="rhythm-form-error" role="alert"');
    expect(html).toContain("Rhythm name is required.");
  });

  it("disables dialog actions while creation is in progress", () => {
    const html = renderToStaticMarkup(createElement(CreateRhythmDialog, {
      draft: { name: "Sprint", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
      error: null,
      submitting: true,
      onDraft: vi.fn(),
      onCancel: vi.fn(),
      onCreate: vi.fn()
    }));

    expect(html).toContain("Creating...");
    expect(count(html, 'disabled=""')).toBe(2);
  });
});

function render(presets: TimerPreset[]) {
  return renderToStaticMarkup(createElement(FocusRhythms, {
    presets,
    timerActive: false,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRemove: vi.fn(),
    onReset: vi.fn()
  }));
}

function preset(id: string, name: string, isDefault = false): TimerPreset {
  return { id, name, focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, isDefault, kind: "built_in" };
}

function count(value: string, search: string) { return value.split(search).length - 1; }
