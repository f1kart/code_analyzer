import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Feature: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-brand-blue mb-1">{title}</h3>
    <div className="text-gray-400 leading-relaxed space-y-2">{children}</div>
  </div>
);

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="bg-gray-900 rounded-md p-3 my-2 text-xs text-gray-300 font-mono overflow-x-auto">
    <code>{children.trim()}</code>
  </pre>
);

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-800/80 backdrop-blur-md border-b border-gray-700 px-6 py-4 flex justify-between items-center z-10">
          <h2 id="help-modal-title" className="text-2xl font-bold text-gray-100">
            User & Developer Guide
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 text-gray-300">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-200 mb-2">
              Advanced AI Team Configuration
            </h3>
            <div className="space-y-4">
              <Feature title="How it Works: A Single AI, Multiple Personas">
                <p>
                  The "AI Team" uses one powerful AI model (like Gemini) that takes on the roles of
                  different experts in a sequence. This simulates a team debate and produces a more
                  robust, error-checked result than a single pass. It allows for a "chain of
                  thought" where the AI can plan, execute, critique, and finalize its own work.
                </p>
              </Feature>
              <Feature title="Step 1: Configure Your Team (Admin Panel)">
                <p>
                  Click the gear icon to open the Admin panel. In the "AI Team Configuration" tab,
                  you can enable/disable different agent personas like "SecurityAnalyst" or
                  "Optimizer". You can also drag-and-drop the agents to change the order they run
                  in.
                </p>
              </Feature>
              <Feature title="Step 2: Customize Agent Behavior (Admin Panel)">
                <p>
                  In the "Agent Behavior" tab, you can select any agent from your team and give it a
                  specific System Prompt. This allows you to write custom instructions that override
                  the default behavior. You can also assign different AI models (e.g., a local
                  model) to specific agents, giving you granular control over your team's workflow.
                </p>
              </Feature>
              <Feature title="Step 3: Analyze a File or Folder">
                <p>
                  Use the **"AI Team"** button to analyze your currently active file, or the **"Scan
                  Folder with Team"** button to analyze all uploaded files. This will kick off your
                  custom-configured agent workflow.
                </p>
              </Feature>
              <Feature title="Step 4: The Brainstorm & Clarification Step">
                <p>
                  The first agent, the "Brainstormer," will analyze your request and may ask for
                  your approval or clarification if it identifies missing requirements or potential
                  improvements. This gives you a chance to guide the process before the full
                  refactoring begins. Click "Approve & Continue" to proceed.
                </p>
              </Feature>
              <Feature title="Step 5: Review and Save">
                <p>
                  For a single file, the results are shown in a "War Room" view. For a full folder
                  scan, you'll get an aggregated report. You can view the diff for each file and
                  choose to save individual files or download a ZIP of the entire revamped project.
                </p>
              </Feature>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
