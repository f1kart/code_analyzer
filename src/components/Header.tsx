import { CodeIcon } from './icons/CodeIcon';
import { UndoRedoPanel } from './UndoRedoPanel';
import { TerminalIcon } from './icons/TerminalIcon';
import { ProjectIcon } from './icons/ProjectIcon';
import { AdminIcon } from './icons/AdminIcon';
import { HelpIcon } from './icons/HelpIcon';

interface HeaderProps {
  onNewSessionClick: () => void;
  onOpenFolderClick: () => void;
  onUndoClick?: () => void;
  onRedoClick?: () => void;
  onChatClick: () => void;
  onToggleTools: () => void;
  onToggleEnterpriseTools: () => void;
  onAdminClick: () => void;
  onHelpClick: () => void;
  onTerminalClick: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewSessionClick,
  onOpenFolderClick,
  onUndoClick,
  onRedoClick,
  onChatClick,
  onToggleTools,
  onToggleEnterpriseTools,
  onAdminClick,
  onHelpClick,
  onTerminalClick,
  toggleLeftPanel,
  toggleRightPanel,
}) => {
  return (
    <header className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 flex-shrink-0 z-20 shadow-2xl">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleLeftPanel}
            className="p-2 rounded-lg hover:bg-white/20 md:hidden transition-all"
            title="Toggle Project Panel"
          >
            <ProjectIcon className="w-6 h-6 text-white" />
          </button>
          <CodeIcon className="w-10 h-10 text-white drop-shadow-lg" />
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">Gemini Code IDE</h1>
        </div>
        <div className="flex items-center gap-2">
          <UndoRedoPanel />

          <button
            onClick={onNewSessionClick}
            className="px-4 py-2 text-sm font-bold text-white bg-white/20 rounded-lg hover:bg-white/30 backdrop-blur-sm transition-all shadow-lg"
            title="Clear current session and start fresh"
          >
            New Session
          </button>
          <button
            onClick={onOpenFolderClick}
            className="px-4 py-2 text-sm font-bold text-white bg-white/20 rounded-lg hover:bg-white/30 backdrop-blur-sm transition-all shadow-lg"
            title="Open Folder"
          >
            Open Folder
          </button>
          <button
            onClick={onChatClick}
            className="px-4 py-2 text-sm font-bold text-white bg-white/20 rounded-lg hover:bg-white/30 backdrop-blur-sm transition-all shadow-lg"
            title="Open Chat"
          >
            Chat
          </button>
          <button
            onClick={onToggleTools}
            className="px-4 py-2 text-sm font-bold text-white bg-white/20 rounded-lg hover:bg-white/30 backdrop-blur-sm transition-all shadow-lg"
            title="Toggle AI Tools Panel"
          >
            Tools
          </button>
          <button
            onClick={onToggleEnterpriseTools}
            className="px-4 py-2 text-sm font-bold text-white bg-white/20 rounded-lg hover:bg-white/30 backdrop-blur-sm transition-all shadow-lg"
            title="Toggle Enterprise Tools Panel"
          >
            Enterprise
          </button>
          <button
            onClick={onTerminalClick}
            className="p-2 rounded-lg hover:bg-white/20 transition-all"
            title="Toggle Terminal"
          >
            <TerminalIcon className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={onAdminClick}
            className="p-2 rounded-lg hover:bg-white/20 transition-all"
            title="Open Admin Settings"
          >
            <AdminIcon className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={onHelpClick}
            className="p-2 rounded-lg hover:bg-white/20 transition-all"
            title="Open User Guide"
          >
            <HelpIcon className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </header>
  );
};
