declare global {
  interface Window {
    __INSET_TITLEBAR__?: boolean;
    __TOGGLEABLE_MENU_BAR__?: boolean;
  }
}

export const HAS_INSET_TITLEBAR =
  typeof window !== "undefined" && window.__INSET_TITLEBAR__ === true;

export const HAS_TOGGLEABLE_MENU_BAR =
  typeof window !== "undefined" && window.__TOGGLEABLE_MENU_BAR__ === true;
