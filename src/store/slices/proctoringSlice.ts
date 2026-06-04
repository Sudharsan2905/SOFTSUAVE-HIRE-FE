import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MalpracticeType } from "../../types";

interface ProctoringState {
  malpracticeCount: number;
  totalMalpracticeLimit: number;
  lastViolationType: MalpracticeType | null;
  isWarningVisible: boolean;
  warningMessage: string;
  isTerminated: boolean;
  terminationReason: string | null;
}

const initialState: ProctoringState = {
  malpracticeCount: 0,
  totalMalpracticeLimit: 3,
  lastViolationType: null,
  isWarningVisible: false,
  warningMessage: "",
  isTerminated: false,
  terminationReason: null,
};

const proctoringSlice = createSlice({
  name: "proctoring",
  initialState,
  reducers: {
    setMalpracticeCount(state, action: PayloadAction<number>) {
      state.malpracticeCount = action.payload;
    },
    setLastViolation(state, action: PayloadAction<{ type: MalpracticeType; message: string }>) {
      state.lastViolationType = action.payload.type;
      state.warningMessage = action.payload.message;
      state.isWarningVisible = true;
    },
    dismissWarning(state) {
      state.isWarningVisible = false;
    },
    setTerminated(state, action: PayloadAction<{ reason: string }>) {
      state.isTerminated = true;
      state.terminationReason = action.payload.reason;
      state.isWarningVisible = false;
    },
    resetProctoring() {
      return initialState;
    },
  },
});

export const {
  setMalpracticeCount,
  setLastViolation,
  dismissWarning,
  setTerminated,
  resetProctoring,
} = proctoringSlice.actions;

export default proctoringSlice.reducer;
