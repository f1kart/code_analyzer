import { useCallback } from 'react';
// import { AppFile } from '../utils/sessionManager';
// import { createFile, deleteFile } from '../services/fileSystemService';
import { useAppContext } from '../contexts/AppContext';
import { Dispatch } from 'react';
import { AppAction } from './useAppReducer';

export interface FileManagerActions {
  selectFile: (active: string | null, selected: string[]) => void;
  openFolder: () => void;
  saveSnippet: (snippet: any) => void;
  loadSnippet: (id: string) => void;
  createNewFile: () => void;
  deleteFile: (fileIdentifier: string) => void;
}

export const useFileManager = (dispatch: Dispatch<AppAction>): FileManagerActions => {
  const { addToast } = useAppContext();

  const selectFile = useCallback(
    (active: string | null, selected: string[]) => {
      dispatch({
        type: 'HANDLE_FILE_SELECTION',
        payload: { activeFileIdentifier: active, selectedIdentifiers: selected, uploadedFiles: [] },
      });
    },
    [dispatch],
  );

  const openFolder = useCallback(() => {
    // This would be implemented to open folder dialog
    addToast('Open folder functionality to be implemented', 'info');
  }, [addToast]);

  const saveSnippet = useCallback(
    (snippet: any) => {
      dispatch({ type: 'ADD_CODE_SNIPPET', payload: snippet });
      addToast('Snippet saved successfully', 'success');
    },
    [dispatch, addToast],
  );

  const loadSnippet = useCallback(
    (_id: string) => {
      // This would load a snippet and set it as active code
      addToast('Load snippet functionality to be implemented', 'info');
    },
    [addToast],
  );

  const createNewFile = useCallback(() => {
    // This would create a new file
    addToast('Create new file functionality to be implemented', 'info');
  }, [addToast]);

  const deleteFile = useCallback(
    (fileIdentifier: string) => {
      dispatch({ type: 'REMOVE_FILE', payload: fileIdentifier });
      addToast('File deleted successfully', 'success');
    },
    [dispatch, addToast],
  );

  return {
    selectFile,
    openFolder,
    saveSnippet,
    loadSnippet,
    createNewFile,
    deleteFile,
  };
};
