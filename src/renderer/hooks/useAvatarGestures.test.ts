import { afterEach, describe, expect, it, vi } from "vitest";
import { createClickDisambiguator } from "./useAvatarGestures";

describe("pet click disambiguation", () => {
  afterEach(() => vi.useRealTimers());

  it("fires one delayed poke for a single click", () => {
    vi.useFakeTimers();
    const onSingleClick = vi.fn();
    const onDoubleClick = vi.fn();
    const clicks = createClickDisambiguator({ onSingleClick, onDoubleClick });

    clicks.click();
    vi.advanceTimersByTime(299);
    expect(onSingleClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onSingleClick).toHaveBeenCalledOnce();
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it("coalesces two clicks into a double-click without poking", () => {
    vi.useFakeTimers();
    const onSingleClick = vi.fn();
    const onDoubleClick = vi.fn();
    const clicks = createClickDisambiguator({ onSingleClick, onDoubleClick });

    clicks.click();
    vi.advanceTimersByTime(150);
    clicks.click();
    vi.runAllTimers();

    expect(onSingleClick).not.toHaveBeenCalled();
    expect(onDoubleClick).toHaveBeenCalledOnce();
  });
});
