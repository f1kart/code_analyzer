import React, { useState, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface ResizablePanelLayoutProps {
  leftPanel: React.ReactNode;
  mainPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
  rightPanel?: React.ReactNode;
  onLayoutChange?: (layout: { left: number; main: number; bottom: number; right?: number }) => void;
}

export const ResizablePanelLayout: React.FC<ResizablePanelLayoutProps> = ({
  leftPanel,
  mainPanel,
  bottomPanel,
  rightPanel,
  onLayoutChange,
}) => {
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(!!rightPanel);

  const handleLayoutChange = useCallback(
    (sizes: number[]) => {
      if (onLayoutChange) {
        const layout = rightPanel
          ? { left: sizes[0], main: sizes[1], right: sizes[2], bottom: sizes[3] || 0 }
          : { left: sizes[0], main: sizes[1], bottom: sizes[2] || 0 };
        onLayoutChange(layout);
      }
    },
    [onLayoutChange, rightPanel],
  );

  return (
    <div className="h-screen w-screen bg-background text-text-primary overflow-hidden">
      <PanelGroup direction="horizontal" onLayout={handleLayoutChange}>
        {/* Left Panel */}
        <Panel
          defaultSize={20}
          minSize={15}
          maxSize={40}
          className="bg-panel border-r border-border"
        >
          {leftPanel}
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-brand-blue transition-colors cursor-col-resize" />

        {/* Main Content Area */}
        <Panel defaultSize={rightPanel ? 50 : 60} minSize={30}>
          <PanelGroup direction="vertical">
            {/* Main Panel */}
            <Panel defaultSize={showBottomPanel ? 70 : 100} minSize={30} className="bg-background">
              {mainPanel}
            </Panel>

            {showBottomPanel && (
              <>
                <PanelResizeHandle className="h-1 bg-border hover:bg-brand-blue transition-colors cursor-row-resize" />

                {/* Bottom Panel */}
                <Panel
                  defaultSize={30}
                  minSize={15}
                  maxSize={50}
                  className="bg-panel border-t border-border"
                >
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between p-2 border-b border-border bg-panel-light">
                      <span className="text-sm font-medium text-text-secondary">
                        Terminal / Output
                      </span>
                      <button
                        onClick={() => setShowBottomPanel(false)}
                        className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-interactive"
                        title="Hide bottom panel"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">{bottomPanel}</div>
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>

        {/* Right Panel (Optional) */}
        {rightPanel && showRightPanel && (
          <>
            <PanelResizeHandle className="w-1 bg-border hover:bg-brand-blue transition-colors cursor-col-resize" />

            <Panel
              defaultSize={20}
              minSize={15}
              maxSize={40}
              className="bg-panel border-l border-border"
            >
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-2 border-b border-border bg-panel-light">
                  <span className="text-sm font-medium text-text-secondary">Properties</span>
                  <button
                    onClick={() => setShowRightPanel(false)}
                    className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-interactive"
                    title="Hide right panel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">{rightPanel}</div>
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Panel Toggle Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        {!showBottomPanel && (
          <button
            onClick={() => setShowBottomPanel(true)}
            className="px-3 py-1 text-xs bg-panel border border-border rounded hover:bg-panel-light transition-colors"
            title="Show bottom panel"
          >
            Terminal
          </button>
        )}
        {rightPanel && !showRightPanel && (
          <button
            onClick={() => setShowRightPanel(true)}
            className="px-3 py-1 text-xs bg-panel border border-border rounded hover:bg-panel-light transition-colors"
            title="Show right panel"
          >
            Properties
          </button>
        )}
      </div>
    </div>
  );
};
