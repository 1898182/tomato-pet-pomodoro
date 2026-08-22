import { useEffect } from "react";
import type { AvatarInteractiveRegion } from "../../shared/types";

const REGION_PADDING = 12;

export function useInteractiveRegions(surfaceRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const root = surface;
    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(scheduleReport);

    function getInteractiveElements(): HTMLElement[] {
      return [root, ...root.querySelectorAll<HTMLElement>("[data-avatar-interactive]")]
        .filter((element) => element.matches("[data-avatar-interactive]"));
    }

    function report(): void {
      const surfaceRect = root.getBoundingClientRect();
      const regions = getInteractiveElements()
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => toInteractiveRegion(element.getBoundingClientRect(), surfaceRect));
      void window.tomatoPet.avatar.setInteractiveRegions(regions);
    }

    function scheduleReport(): void {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(report);
    }

    function observeInteractiveElements(): void {
      resizeObserver.disconnect();
      resizeObserver.observe(root);
      getInteractiveElements()
        .filter((element) => element !== root)
        .forEach((element) => resizeObserver.observe(element));
      scheduleReport();
    }

    function beginInteraction(event: PointerEvent): void {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-avatar-interactive]")) {
        void window.tomatoPet.avatar.setInteractionActive(true);
      }
    }

    function endInteraction(): void {
      void window.tomatoPet.avatar.setInteractionActive(false);
    }

    const mutationObserver = new MutationObserver(observeInteractiveElements);
    mutationObserver.observe(root, { attributes: true, childList: true, subtree: true });
    observeInteractiveElements();
    root.addEventListener("pointerdown", beginInteraction, true);
    window.addEventListener("pointerup", endInteraction, true);
    window.addEventListener("pointercancel", endInteraction, true);
    window.addEventListener("blur", endInteraction);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      root.removeEventListener("pointerdown", beginInteraction, true);
      window.removeEventListener("pointerup", endInteraction, true);
      window.removeEventListener("pointercancel", endInteraction, true);
      window.removeEventListener("blur", endInteraction);
      void window.tomatoPet.avatar.setInteractionActive(false);
      void window.tomatoPet.avatar.setInteractiveRegions([]);
    };
  }, [surfaceRef]);
}

function toInteractiveRegion(rect: DOMRect, surfaceRect: DOMRect): AvatarInteractiveRegion {
  const left = Math.max(0, Math.floor(rect.left - surfaceRect.left - REGION_PADDING));
  const top = Math.max(0, Math.floor(rect.top - surfaceRect.top - REGION_PADDING));
  const right = Math.min(surfaceRect.width, Math.ceil(rect.right - surfaceRect.left + REGION_PADDING));
  const bottom = Math.min(surfaceRect.height, Math.ceil(rect.bottom - surfaceRect.top + REGION_PADDING));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
