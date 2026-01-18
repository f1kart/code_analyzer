import { createContext, useContext } from 'react';

export interface ExplorerSelection {
  absolutePath: string | null;
  relativePath: string | null;
  isDirectory: boolean;
}

interface ProjectExplorerContextType {
  rootPath?: string;
  activeSelection?: ExplorerSelection;
  selectedEntries?: ExplorerSelection[];
  setActiveSelection?: (selection: ExplorerSelection | null) => void;
  setSelectedEntries?: (selections: ExplorerSelection[]) => void;
}

export const ProjectExplorerContext = createContext<ProjectExplorerContextType>({});

export const useProjectExplorerContext = () => useContext(ProjectExplorerContext);
