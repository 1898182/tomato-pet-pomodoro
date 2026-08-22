import { useEffect } from "react";

type TimerHandle = ReturnType<typeof setTimeout>;

type ClickDisambiguatorOptions = {
  onSingleClick: () => void;
  onDoubleClick: () => void;
  delayMs?: number;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  cancelScheduled?: (handle: TimerHandle) => void;
};

export type ClickDisambiguator = {
  click: () => void;
  cancel: () => void;
};

export function createClickDisambiguator({
  onSingleClick,
  onDoubleClick,
  delayMs = 300,
  schedule = setTimeout,
  cancelScheduled = clearTimeout
}: ClickDisambiguatorOptions): ClickDisambiguator {
  let pendingSingleClick: TimerHandle | null = null;

  return {
    click() {
      if (pendingSingleClick) {
        cancelScheduled(pendingSingleClick);
        pendingSingleClick = null;
        onDoubleClick();
        return;
      }

      pendingSingleClick = schedule(() => {
        pendingSingleClick = null;
        onSingleClick();
      }, delayMs);
    },
    cancel() {
      if (!pendingSingleClick) return;
      cancelScheduled(pendingSingleClick);
      pendingSingleClick = null;
    }
  };
}

export function usePetGesture(
  targetRef: React.RefObject<HTMLDivElement | null>,
  onSingleClick: () => void,
  onDoubleClick: () => void
): void {
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    const element = target;

    let gesture: DragGesture | null = null;
    const clicks = createClickDisambiguator({ onSingleClick, onDoubleClick });

    async function handlePointerDown(event: PointerEvent) {
      element.setPointerCapture(event.pointerId);
      gesture = createDragGesture(event);
      const bounds = await window.tomatoPet.avatar.getBounds();
      if (gesture?.pointerId === event.pointerId) {
        gesture.windowX = bounds.x;
        gesture.windowY = bounds.y;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      moveAvatarWindow(event, gesture);
    }

    function handlePointerUp(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (!gesture.dragged) clicks.click();
      gesture = null;
    }

    function cancelGesture() {
      gesture = null;
    }

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", cancelGesture);
    return () => {
      clicks.cancel();
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", cancelGesture);
    };
  }, [onDoubleClick, onSingleClick, targetRef]);
}

export function useWindowDragGesture(
  targetRef: React.RefObject<HTMLElement | null>,
  onClick: () => void,
  active = true
): void {
  useEffect(() => {
    if (!active) return;
    const target = targetRef.current;
    if (!target) return;
    const element = target;

    let gesture: DragGesture | null = null;

    async function handlePointerDown(event: PointerEvent) {
      const eventTarget = event.target;
      if (eventTarget instanceof Element && eventTarget.closest("button, input, select, textarea, label")) return;
      element.setPointerCapture(event.pointerId);
      gesture = createDragGesture(event);
      const bounds = await window.tomatoPet.avatar.getBounds();
      if (gesture?.pointerId === event.pointerId) {
        gesture.windowX = bounds.x;
        gesture.windowY = bounds.y;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      moveAvatarWindow(event, gesture);
    }

    function handlePointerUp(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (!gesture.dragged) onClick();
      gesture = null;
    }

    function cancelGesture() {
      gesture = null;
    }

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", cancelGesture);
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", cancelGesture);
    };
  }, [active, onClick, targetRef]);
}

type DragGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  windowX: number | null;
  windowY: number | null;
  dragged: boolean;
};

function createDragGesture(event: PointerEvent): DragGesture {
  return {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    windowX: null,
    windowY: null,
    dragged: false
  };
}

function moveAvatarWindow(event: PointerEvent, gesture: DragGesture): void {
  const deltaX = event.screenX - gesture.startX;
  const deltaY = event.screenY - gesture.startY;
  if (Math.hypot(deltaX, deltaY) >= 5) gesture.dragged = true;
  if (!gesture.dragged || gesture.windowX === null || gesture.windowY === null) return;
  void window.tomatoPet.avatar.setPosition(gesture.windowX + deltaX, gesture.windowY + deltaY);
}
