declare global {
  interface Window {
    __INSET_TITLEBAR__?: boolean;
  }
}

export const HAS_INSET_TITLEBAR =
  typeof window !== "undefined" && window.__INSET_TITLEBAR__ === true;
