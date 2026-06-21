import { create } from "zustand";
import type { GameState, TurnInput, TurnOutput, TurnNotification } from "@/lib/engine/types";
import { advanceMonth as advanceMonthAction } from "@/app/actions/turn";

export interface GameStore {
  // ─── Estado ────────────────────────────────────────────────────────────────
  gameId: string | null;
  gameState: GameState | null;
  notifications: TurnNotification[];
  isLoading: boolean;
  lastTurnResult: TurnOutput | null;
  pendingInput: TurnInput;

  // ─── Acciones ──────────────────────────────────────────────────────────────
  setGameState: (state: GameState) => void;
  setGameId: (id: string) => void;
  advanceMonth: () => Promise<void>;
  updateBudget: (ministryKey: string, percent: number) => void;
  updateSubDecision: (ministryKey: string, key: string, value: number | boolean) => void;
  proposeLaw: (lawKey: string) => void;
  removeProposedLaw: (lawKey: string) => void;
  createOrganism: (type: string, name: string, monthlyBudget: number, headOfficialId?: string) => void;
  clearNotifications: () => void;
  resetPendingInput: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  gameState: null,
  notifications: [],
  isLoading: false,
  lastTurnResult: null,
  pendingInput: {},

  setGameState: (state: GameState) => {
    set({ gameState: state });
  },

  setGameId: (id: string) => {
    set({ gameId: id });
  },

  advanceMonth: async () => {
    const { gameId, pendingInput } = get();
    if (!gameId) {
      throw new Error("No se puede avanzar el mes: gameId es nulo");
    }
    set({ isLoading: true });
    try {
      const result = await advanceMonthAction(gameId, pendingInput);
      set({
        gameState: {
          ...result.newState,
          gdp: result.monthSnapshot.gdp,
          povertyRate: result.monthSnapshot.povertyRate,
          unemploymentRate: result.monthSnapshot.unemploymentRate,
          sickRate: result.monthSnapshot.sickRate,
          crimeRate: result.monthSnapshot.crimeRate,
          foodSecurity: result.monthSnapshot.foodSecurity,
          educationLevel: result.monthSnapshot.educationLevel,
          inflation: result.monthSnapshot.inflation,
        },
        lastTurnResult: result,
        notifications: [...get().notifications, ...result.notifications],
      });
      get().resetPendingInput();
    } finally {
      set({ isLoading: false });
    }
  },

  updateBudget: (ministryKey: string, percent: number) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        budgetAdjustments: {
          ...prev.pendingInput.budgetAdjustments,
          [ministryKey]: percent,
        },
      },
    }));
  },

  updateSubDecision: (ministryKey: string, key: string, value: number | boolean) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        subDecisionChanges: {
          ...prev.pendingInput.subDecisionChanges,
          [ministryKey]: {
            ...(prev.pendingInput.subDecisionChanges?.[ministryKey] ?? {}),
            [key]: value,
          },
        },
      },
    }));
  },

  proposeLaw: (lawKey: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        proposedLaws: [...(prev.pendingInput.proposedLaws ?? []), lawKey],
      },
    }));
  },

  removeProposedLaw: (lawKey: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        proposedLaws: prev.pendingInput.proposedLaws?.filter((l) => l !== lawKey) ?? [],
      },
    }));
  },

  createOrganism: (type: string, name: string, monthlyBudget: number, headOfficialId?: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        newOrganisms: {
          ...prev.pendingInput.newOrganisms,
          [type]: { name, monthlyBudget, headOfficialId },
        },
      },
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  resetPendingInput: () => {
    set({ pendingInput: {} });
  },
}));
