import { create } from "zustand";
import type { GameState, TurnInput, TurnOutput, TurnNotification, GameOverResult, MonthSnapshotData } from "@/lib/engine/types";
import { advanceMonth as advanceMonthAction } from "@/app/actions/turn";

export interface GameStore {
  // ─── Estado ────────────────────────────────────────────────────────────────
  gameId: string | null;
  gameState: GameState | null;
  notifications: TurnNotification[];
  isLoading: boolean;
  lastTurnResult: TurnOutput | null;
  pendingInput: TurnInput;
  snapshots: MonthSnapshotData[];
  gameOver: GameOverResult | null;

  // ─── Acciones ──────────────────────────────────────────────────────────────
  setGameState: (state: GameState) => void;
  setGameId: (id: string) => void;
  setSnapshots: (snapshots: MonthSnapshotData[]) => void;
  advanceMonth: () => Promise<void>;
  updateBudget: (ministryKey: string, percent: number) => void;
  updateSubDecision: (ministryKey: string, key: string, value: number | boolean) => void;
  proposeLaw: (lawKey: string) => void;
  removeProposedLaw: (lawKey: string) => void;
  createOrganism: (type: string, name: string, monthlyBudget: number, headOfficialId?: string) => void;
  clearNotifications: () => void;
  resetPendingInput: () => void;
  setMediaAction: (mediaId: string, action: "censor" | "close" | "boost" | "restore" | "buyAffinity" | "none") => void;
  appointMinister: (ministryKey: string, officialId: string) => void;
  hireCandidate: (officialId: string) => void;
  assignOrganismHead: (organismId: string, officialId: string) => void;
  dissolveOrganism: (organismId: string) => void;
  startLongRunningDecision: (type: string, name: string, totalMonths: number, monthlyCost: number, parameters?: Record<string, unknown>, effectOnCompletion?: Record<string, unknown>) => void;
  cancelLongRunningDecision: (lrdId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  gameState: null,
  notifications: [],
  isLoading: false,
  lastTurnResult: null,
  pendingInput: {},
  snapshots: [],
  gameOver: null,

  setGameState: (state: GameState) => {
    set({ gameState: state });
  },

  setGameId: (id: string) => {
    set({ gameId: id });
  },

  setSnapshots: (snapshots: MonthSnapshotData[]) => {
    set({ snapshots });
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
          lifeExpectancy: result.monthSnapshot.lifeExpectancy,
        },
        lastTurnResult: result,
        notifications: [...get().notifications, ...result.notifications],
        gameOver: result.gameOver ?? null,
        snapshots: [...get().snapshots, result.monthSnapshot],
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

  setMediaAction: (mediaId: string, action: "censor" | "close" | "boost" | "restore" | "buyAffinity" | "none") => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        mediaActions: {
          ...prev.pendingInput.mediaActions,
          [mediaId]: action,
        },
      },
    }));
  },

  appointMinister: (ministryKey: string, officialId: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        appointments: {
          ...prev.pendingInput.appointments,
          [ministryKey]: officialId,
        },
      },
    }));
  },

  hireCandidate: (officialId: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        hireCandidateIds: [
          ...(prev.pendingInput.hireCandidateIds ?? []),
          officialId,
        ],
      },
    }));
  },

  assignOrganismHead: (organismId: string, officialId: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        organismHeadChanges: {
          ...prev.pendingInput.organismHeadChanges,
          [organismId]: officialId,
        },
      },
    }));
  },

  dissolveOrganism: (organismId: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        dissolveOrganismIds: [
          ...(prev.pendingInput.dissolveOrganismIds ?? []),
          organismId,
        ],
      },
    }));
  },

  startLongRunningDecision: (
    type: string,
    name: string,
    totalMonths: number,
    monthlyCost: number,
    parameters?: Record<string, unknown>,
    effectOnCompletion?: Record<string, unknown>,
  ) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        newLongRunningDecisions: [
          ...(prev.pendingInput.newLongRunningDecisions ?? []),
          { type, name, totalMonths, monthlyCost, parameters, effectOnCompletion },
        ],
      },
    }));
  },

  cancelLongRunningDecision: (lrdId: string) => {
    set((prev) => ({
      pendingInput: {
        ...prev.pendingInput,
        cancelDecisionIds: [
          ...(prev.pendingInput.cancelDecisionIds ?? []),
          lrdId,
        ],
      },
    }));
  },
}));
