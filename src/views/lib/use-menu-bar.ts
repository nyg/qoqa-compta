import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { HAS_TOGGLEABLE_MENU_BAR } from "@/lib/desktop";
import { SHOW_ABOUT_EVENT } from "@/lib/about-event";

export function useToggleableMenuBar(): void {
  useEffect(() => {
    if (!HAS_TOGGLEABLE_MENU_BAR) return;

    let visible = false;
    let armed = false;

    const apply = (next: boolean) => {
      if (next === visible) return;
      visible = next;
      apiClient.setMenuBarVisible(next).catch(() => {
        visible = !next;
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        armed = false;
        apply(false);
        return;
      }
      armed =
        event.key === "Alt" &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.metaKey;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Alt") {
        armed = false;
        return;
      }
      if (!armed) return;
      armed = false;
      apply(!visible);
    };

    const disarm = () => {
      armed = false;
    };

    const onMenuAction = () => {
      armed = false;
      visible = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", disarm);
    window.addEventListener("blur", disarm);
    window.addEventListener(SHOW_ABOUT_EVENT, onMenuAction);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", disarm);
      window.removeEventListener("blur", disarm);
      window.removeEventListener(SHOW_ABOUT_EVENT, onMenuAction);
    };
  }, []);
}
