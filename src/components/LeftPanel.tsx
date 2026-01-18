import React from 'react';
import { ProjectIcon } from './icons/ProjectIcon';
import { SnippetIcon } from './icons/SnippetIcon';

interface LeftPanelProps {
  activeTab: 'project' | 'snippets' | 'source';
  onTabChange: (tab: 'project' | 'snippets' | 'source') => void;
  children?: React.ReactNode; // backward compatibility: treated as projectContent if new props not provided
  projectContent?: React.ReactNode;
  snippetsContent?: React.ReactNode;
  sourceContent?: React.ReactNode;
  alwaysShowProject?: boolean; // when true, always render projectContent at top and tabs switch lower area
}

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  id: string;
  controls: string;
}> = ({ active, onClick, children, title, id, controls }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex-1 flex justify-center items-center p-3 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'text-brand-blue border-brand-blue'
        : 'text-text-secondary border-transparent hover:bg-panel-light hover:text-text-primary'
    }`}
    role="tab"
    aria-selected={active ? 'true' : 'false'}
    id={id}
    aria-controls={controls}
    tabIndex={active ? 0 : -1}
  >
    {children}
  </button>
);

export const LeftPanel: React.FC<LeftPanelProps> = ({
  activeTab,
  onTabChange,
  children,
  projectContent,
  snippetsContent,
  sourceContent,
  alwaysShowProject = false,
}) => {
  const project = projectContent ?? children;
  const snippets = snippetsContent ?? children;
  const source = sourceContent ?? children;

  if (alwaysShowProject) {
    return (
      <div className="bg-panel/50 flex flex-col h-full border-r border-border">
        {/* Always-visible Project Explorer at top */}
        <div className="flex-shrink-0 p-2 border-b border-border" aria-label="Project Explorer">
          <div className="flex items-center gap-2 mb-2 text-text-secondary">
            <ProjectIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Project Explorer</span>
          </div>
          <div className="max-h-72 overflow-y-auto">{project}</div>
        </div>

        {/* Secondary tabs for Snippets / Source */}
        <div
          className="flex-shrink-0 flex border-b border-border"
          role="tablist"
          aria-label="Left panel tabs"
          aria-orientation="horizontal"
        >
          <TabButton
            active={activeTab === 'snippets'}
            onClick={() => onTabChange('snippets')}
            title="Code Snippets"
            id="left-tab-snippets"
            controls="left-panel-snippets"
          >
            <SnippetIcon className="w-5 h-5" />
          </TabButton>
          <TabButton
            active={activeTab === 'source'}
            onClick={() => onTabChange('source')}
            title="Source Control"
            id="left-tab-source"
            controls="left-panel-source"
          >
            <span className="text-xs font-semibold">SC</span>
          </TabButton>
        </div>

        {/* Panels for Snippets / Source */}
        <div
          className="flex-grow p-4 overflow-y-auto"
          role="tabpanel"
          id="left-panel-snippets"
          aria-labelledby="left-tab-snippets"
          hidden={activeTab !== 'snippets'}
        >
          {activeTab === 'snippets' && snippets}
        </div>
        <div
          className="flex-grow p-4 overflow-y-auto"
          role="tabpanel"
          id="left-panel-source"
          aria-labelledby="left-tab-source"
          hidden={activeTab !== 'source'}
        >
          {activeTab === 'source' && source}
        </div>
      </div>
    );
  }

  // Backward compatible: original behavior with single-tab switch
  return (
    <div className="bg-panel/50 flex flex-col h-full border-r border-border">
      <div
        className="flex-shrink-0 flex border-b border-border"
        role="tablist"
        aria-label="Left panel tabs"
        aria-orientation="horizontal"
      >
        <TabButton
          active={activeTab === 'project'}
          onClick={() => onTabChange('project')}
          title="Project Explorer"
          id="left-tab-project"
          controls="left-panel-project"
        >
          <ProjectIcon className="w-5 h-5" />
        </TabButton>
        <TabButton
          active={activeTab === 'snippets'}
          onClick={() => onTabChange('snippets')}
          title="Code Snippets"
          id="left-tab-snippets"
          controls="left-panel-snippets"
        >
          <SnippetIcon className="w-5 h-5" />
        </TabButton>
        <TabButton
          active={activeTab === 'source'}
          onClick={() => onTabChange('source')}
          title="Source Control"
          id="left-tab-source"
          controls="left-panel-source"
        >
          <span className="text-xs font-semibold">SC</span>
        </TabButton>
      </div>

      <div
        className="flex-grow p-4 overflow-y-auto"
        role="tabpanel"
        id="left-panel-project"
        aria-labelledby="left-tab-project"
        hidden={activeTab !== 'project'}
      >
        {activeTab === 'project' && project}
      </div>
      <div
        className="flex-grow p-4 overflow-y-auto"
        role="tabpanel"
        id="left-panel-snippets"
        aria-labelledby="left-tab-snippets"
        hidden={activeTab !== 'snippets'}
      >
        {activeTab === 'snippets' && snippets}
      </div>
      <div
        className="flex-grow p-4 overflow-y-auto"
        role="tabpanel"
        id="left-panel-source"
        aria-labelledby="left-tab-source"
        hidden={activeTab !== 'source'}
      >
        {activeTab === 'source' && source}
      </div>
    </div>
  );
};
