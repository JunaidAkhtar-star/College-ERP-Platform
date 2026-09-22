import { create } from 'zustand';
import { ICallState } from '@/features/role-wise-features/chat/types/chat.types';

export interface IGlobalCallState extends ICallState {
  isMinimized: boolean;
  isHiddenVideo: boolean; // whether camera is toggled off locally but stream remains
  callStartTime: number | null; // Date.now() when call is accepted
}

interface CallStore {
  callState: IGlobalCallState;
  setCallState: (state: Partial<IGlobalCallState>) => void;
  resetCallState: () => void;
}

const initialCallState: IGlobalCallState = {
  isActive: false,
  isIncoming: false,
  isMinimized: false,
  isHiddenVideo: false,
  callStartTime: null,
  waitingCall: null,
  isCallWaiting: false,
};

export const useCallStore = create<CallStore>((set) => ({
  callState: initialCallState,
  setCallState: (newState) => set((state) => ({ callState: { ...state.callState, ...newState } })),
  resetCallState: () => set({ callState: initialCallState }),
}));
