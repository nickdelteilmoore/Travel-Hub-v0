import { create } from "zustand";

export type SnackbarAction = { label: string; onPress: () => void };

export type Snackbar = {
  id: number;
  message: string;
  action?: SnackbarAction;
  durationMs: number;
};

type UiState = {
  snackbar: Snackbar | null;
  showSnackbar: (
    message: string,
    opts?: { action?: SnackbarAction; durationMs?: number },
  ) => void;
  hideSnackbar: () => void;
};

let nextId = 1;

export const useUiStore = create<UiState>((set) => ({
  snackbar: null,
  showSnackbar: (message, opts) =>
    set({
      snackbar: {
        id: nextId++,
        message,
        action: opts?.action,
        durationMs: opts?.durationMs ?? 4000,
      },
    }),
  hideSnackbar: () => set({ snackbar: null }),
}));

// Convenience for non-hook call sites (mutations, handlers).
export const toast = (message: string, opts?: { durationMs?: number }) =>
  useUiStore.getState().showSnackbar(message, opts);
