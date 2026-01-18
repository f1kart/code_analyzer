import React, { useState, useCallback } from 'react';

interface WelcomeScreenProps {
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onCreateProject: () => void;
  onOpenAITools: () => void;
  onOpenEnterpriseTools: () => void;
  onOpenChat: () => void;
  onOpenRecent?: (path: string) => void;
  recentProjects?: Array<{
    name: string;
    path: string;
    lastOpened: number;
    type: 'folder' | 'file';
  }>;
  className?: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenFolder,
  onOpenFile,
  onCreateProject,
  onOpenAITools,
  onOpenEnterpriseTools,
  onOpenChat,
  onOpenRecent,
  recentProjects = [],
  className = '',
}) => {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const formatLastOpened = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }, []);

  const quickActions = [
    {
      id: 'open-folder',
      title: 'Open Folder',
      description: 'Open an existing project folder',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      ),
      action: onOpenFolder,
      shortcut: 'Ctrl+O',
      color: 'text-blue-400',
    },
    {
      id: 'open-file',
      title: 'Open File',
      description: 'Open a single file for editing',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      action: onOpenFile,
      shortcut: 'Ctrl+Shift+O',
      color: 'text-green-400',
    },
    {
      id: 'create-project',
      title: 'Create Project',
      description: 'Start a new project from scratch',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      ),
      action: onCreateProject,
      shortcut: 'Ctrl+N',
      color: 'text-purple-400',
    },
  ];

  const powerfulTools = [
    {
      id: 'ai-tools',
      title: 'AI Coding Tools',
      description: 'Refactor, explain, and optimize your code with AI',
      icon: '🤖',
      action: onOpenAITools,
      color: 'text-cyan-400',
    },
    {
      id: 'enterprise-tools',
      title: 'Enterprise Tools',
      description: 'Advanced features: Windsurf, CI/CD, workflows',
      icon: '⚡',
      action: onOpenEnterpriseTools,
      color: 'text-yellow-400',
    },
    {
      id: 'ai-chat',
      title: 'AI Chat',
      description: 'Chat with AI about your code and project',
      icon: '💬',
      action: onOpenChat,
      color: 'text-pink-400',
    },
  ];

  const features = [
    {
      title: 'AI-Powered Development',
      description: 'Get intelligent code suggestions, explanations, and refactoring assistance',
      icon: '🤖',
    },
    {
      title: 'Multi-Agent Workflows',
      description: 'Deploy specialized AI agents for complex development tasks',
      icon: '⚡',
    },
    {
      title: 'Integrated Terminal',
      description: 'Full terminal access with AI-powered debugging assistance',
      icon: '💻',
    },
    {
      title: 'Git Integration',
      description: 'Seamless version control with AI-generated commit messages',
      icon: '🔄',
    },
    {
      title: 'Project Analysis',
      description: 'Comprehensive code analysis, similarity detection, and dependency insights',
      icon: '📊',
    },
    {
      title: 'Smart Search',
      description: 'Semantic search across your entire codebase with AI understanding',
      icon: '🔍',
    },
  ];

  return (
    <div className={`h-full bg-gradient-to-b from-slate-950 to-slate-900 overflow-y-auto ${className}`}>
      <div className="max-w-7xl mx-auto p-12">
        {/* BRAND NEW: Hero Header with Gradient */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl mb-4 shadow-2xl">
              <span className="text-2xl">🚀</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Welcome to Gemini Code IDE</h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            The next-generation development environment powered by AI. Build faster, smarter, and
            more efficiently.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-16">
          {/* BRAND NEW: Large Card-Based Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-white mb-6">Get Started</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className={`group relative overflow-hidden w-full p-6 text-left rounded-2xl border-2 transition-all duration-300 ${
                    hoveredAction === action.id
                      ? 'border-violet-500 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 scale-105 shadow-2xl'
                      : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600'
                  }`}
                  onMouseEnter={() => setHoveredAction(action.id)}
                  onMouseLeave={() => setHoveredAction(null)}
                  onClick={action.action}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-700/50 mb-4 ${action.color} group-hover:scale-110 transition-transform`}
                  >
                    {action.icon}
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{action.title}</h3>
                  <p className="text-sm text-gray-400 mb-3">{action.description}</p>
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">{action.shortcut}</span>
                  {hoveredAction === action.id && (
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-2xl"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* BRAND NEW: Gradient Powered Tools Cards */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/50 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-5">Powerful Tools</h3>
            <div className="space-y-3">
              {powerfulTools.map((tool) => (
                <button
                  key={tool.id}
                  className="w-full p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-left hover:bg-gradient-to-r hover:from-violet-600/20 hover:to-fuchsia-600/20 hover:border-violet-500/50 transition-all duration-300 hover:scale-102"
                  onClick={tool.action}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{tool.icon}</div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">{tool.title}</h4>
                      <p className="text-xs text-gray-400">{tool.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* BRAND NEW: Recent Projects */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Recent Projects</h2>
            {recentProjects.length > 0 ? (
              <div className="space-y-3">
                {recentProjects.slice(0, 5).map((project, index) => (
                  <button
                    key={project.path}
                    className="w-full p-4 text-left rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-700/50 transition-all duration-300"
                    onClick={() => onOpenRecent?.(project.path)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-lg">
                        {project.type === 'folder' ? (
                          <svg
                            className="w-5 h-5 text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-green-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{project.name}</p>
                        <p className="text-xs text-text-secondary">{project.path}</p>
                        <p className="text-[10px] text-text-tertiary mt-1">{formatLastOpened(project.lastOpened)}</p>
                      </div>
                      <span className="text-2xl text-text-tertiary">›</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700/50">
                <div className="text-2xl mb-3">📁</div>
                <p className="text-gray-400 text-sm font-medium">No recent projects yet</p>
                <p className="text-gray-600 text-xs mt-2">Open a folder to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* BRAND NEW: Modern Feature Cards with Gradient Hover */}
        <div className="mb-16">
          <h2 className="text-3xl font-black text-white mb-8 text-center">
            Powerful Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:border-violet-500/50 hover:bg-gradient-to-br hover:from-violet-600/10 hover:to-fuchsia-600/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="text-2xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* BRAND NEW: Modern Keyboard Shortcuts Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h3 className="text-2xl font-bold text-white mb-6">
            Essential Keyboard Shortcuts
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">Command Palette</span>
              <kbd className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-white shadow">
                Ctrl+P
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">Open Folder</span>
              <kbd className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-white shadow">
                Ctrl+O
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">New File</span>
              <kbd className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-white shadow">
                Ctrl+N
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">Save File</span>
              <kbd className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-white shadow">
                Ctrl+S
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">Find in Files</span>
              <kbd className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-white shadow">
                Ctrl+Shift+F
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">Toggle Terminal</span>
              <kbd className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-white shadow">
                Ctrl+`
              </kbd>
            </div>
          </div>
        </div>

        {/* BRAND NEW: Call-to-Action Footer */}
        <div className="text-center mt-16 pt-12 border-t border-slate-800">
          <p className="text-gray-400 text-base mb-4">
            Ready to transform your development workflow?
          </p>
          <button
            onClick={onOpenFolder}
            className="px-8 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105"
          >
            Open Your First Project →
          </button>
        </div>
      </div>
    </div>
  );
};
