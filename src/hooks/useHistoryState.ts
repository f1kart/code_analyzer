import { useState, useCallback, useEffect } from 'react';

export interface HistoryState<T> {
  history: T[];
  currentIndex: number;
}

export const useHistoryState = <T>(initialState: T) => {
  const [state, setState] = useState<HistoryState<T>>({
    history: [initialState],
    currentIndex: 0,
  });

  // This is a bit of a hack to get the latest history state for session saving
  // without causing re-renders in App.tsx.
  useEffect(() => {
    (window as any).__HISTORY_STATE_HACK_HISTORY = state.history;
    (window as any).__HISTORY_STATE_HACK_INDEX = state.currentIndex;
  }, [state]);

  const { history, currentIndex } = state;

  const set = useCallback(
    (value: T, overwriteHistory = false) => {
      if (overwriteHistory) {
        setState({
          history: [value],
          currentIndex: 0,
        });
      } else {
        // If the new value is the same as the current, do nothing.
        if (value === history[currentIndex]) {
          return;
        }
        // If we are not at the end of the history, slice it
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(value);
        setState({
          history: newHistory,
          currentIndex: newHistory.length - 1,
        });
      }
    },
    [history, currentIndex],
  );

  const setInitialState = useCallback((initial: HistoryState<T>) => {
    if (initial && initial.history && typeof initial.currentIndex === 'number') {
      setState((prevState) => {
        // Only update if the state is actually different
        if (JSON.stringify(prevState) !== JSON.stringify(initial)) {
          return initial;
        }
        return prevState;
      });
    }
  }, []);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setState((prevState) => ({
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
      }));
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setState((prevState) => ({
        ...prevState,
        currentIndex: prevState.currentIndex + 1,
      }));
    }
  }, [currentIndex, history.length]);

  return {
    state: history[currentIndex],
    setState: set,
    setInitialState,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
};
