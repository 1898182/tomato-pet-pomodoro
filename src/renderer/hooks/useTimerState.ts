import { useEffect, useState } from "react";
import type { TimerSnapshot } from "../../shared/types";

export function useTimerState() {
  const [state, setState] = useState<TimerSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    window.tomatoPet.timer.getState().then((snapshot) => {
      if (mounted) {
        setState(snapshot);
      }
    });
    const unsubscribe = window.tomatoPet.timer.onState(setState);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
