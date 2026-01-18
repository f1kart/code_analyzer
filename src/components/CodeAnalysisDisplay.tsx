import React, { useMemo, useState, useCallback } from "react";

interface CodeAnalysisDisplayProps {
  code: string;
}

// Define analysis options and their corresponding regex patterns
interface AnalysisPattern {
  id: keyof AnalysisOptions;
  label: string;
  pattern?: string; // Optional for non-regex options like 'incomplete'
}

const ANALYSIS_PATTERNS_CONFIG: AnalysisPattern[] = [
  {
    id: "keywords",
    label: "Keywords",
    pattern: `(TODO|FIXME|XXX|NOTE|HACK):?`,
  },
  {
    id: "placeholders",
    label: "Placeholders",
    pattern: `(MOCK|SIMULATION|PLACEHOLDER|DUMMY DATA)`,
  },
  {
    id: "incomplete",
    label: "Incomplete",
    // No pattern as this is a structural check, not regex-based
  },
  {
    id: "caseSensitive",
    label: "Case-sensitive",
    // No pattern as this is a flag for other patterns
  },
];

interface AnalysisOptions {
  keywords: boolean;
  placeholders: boolean;
  incomplete: boolean;
  caseSensitive: boolean;
}

interface CheckboxProps {
  id: keyof AnalysisOptions;
  label: string;
  checked: boolean;
  onChange: () => void;
}

// Checkbox component wrapped with React.memo for performance optimization
const Checkbox: React.FC<CheckboxProps> = React.memo(
  ({ id, label, checked, onChange }) => (
    <div className="relative flex items-start">
      <div className="flex h-5 items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-brand-blue focus:ring-brand-blue"
        />
      </div>
      <div className="ml-2 text-xs">
        <label htmlFor={id} className="text-gray-400 cursor-pointer">
          {label}
        </label>
      </div>
    </div>
  ),
);
Checkbox.displayName = "Checkbox"; // Add display name for easier debugging

/**
 * Counts the occurrences of a target character within a source string.
 * @param source The string to search within.
 * @param target The single character to count.
 * @returns The number of times the target character appears in the source.
 */
const countOccurrences = (source: string, target: string): number => {
  // Using split is generally more efficient and concise for single character counts
  return source.split(target).length - 1;
};

export const CodeAnalysisDisplay: React.FC<CodeAnalysisDisplayProps> = ({
  code,
}) => {
  // Initialize options based on ANALYSIS_PATTERNS_CONFIG for default 'true' or specific values
  const [options, setOptions] = useState<AnalysisOptions>(() => {
    const initialOptions: AnalysisOptions = {
      keywords: true,
      placeholders: true,
      incomplete: true,
      caseSensitive: false,
    };
    return initialOptions;
  });

  // Memoize handleOptionChange using useCallback to prevent unnecessary re-renders of Checkbox
  const handleOptionChange = useCallback((option: keyof AnalysisOptions) => {
    setOptions((prev) => ({ ...prev, [option]: !prev[option] }));
  }, []); // No dependencies needed as setOptions is stable

  const findings = useMemo(() => {
    if (!code) return [];

    const results: { line: number; content: string }[] = [];
    const lines = code.split("\n");
    const regexPatternsToCombine: string[] = [];
    const flags = options.caseSensitive ? "g" : "gi";

    // --- Collect Regex Patterns based on options ---
    ANALYSIS_PATTERNS_CONFIG.forEach((config) => {
      if (options[config.id] && config.pattern) {
        regexPatternsToCombine.push(config.pattern);
      }
    });

    if (regexPatternsToCombine.length > 0) {
      // Combine patterns into a single regex for efficiency
      const regex = new RegExp(regexPatternsToCombine.join("|"), flags);
      lines.forEach((lineContent, index) => {
        // Use regex.test() for efficient checking if a line contains any match
        if (regex.test(lineContent)) {
          results.push({ line: index + 1, content: lineContent.trim() });
        }
      });
    }

    // --- Incomplete Code (Balance Checks) ---
    if (options.incomplete) {
      const trimmedCode = code.trim();
      if (trimmedCode.length > 0) {
        // Helper function to check balance for a pair of characters
        const checkBalance = (
          openChar: string,
          closeChar: string,
          name: string,
        ) => {
          const openCount = countOccurrences(trimmedCode, openChar);
          const closeCount = countOccurrences(trimmedCode, closeChar);
          if (openCount !== closeCount) {
            results.push({
              line: lines.length,
              content: `Incomplete code: ${name} mismatch (found ${openCount} open, ${closeCount} closed).`,
            });
          }
        };

        checkBalance("{", "}", "Curly braces");
        checkBalance("(", ")", "Parentheses");
        checkBalance("[", "]", "Square brackets");
      }
    }

    // Ensure findings are unique and sorted by line number
    // The current unique logic using Map is robust for `line-content` keying.
    const uniqueFindings = Array.from(
      new Map(
        results.map((item) => [`${item.line}-${item.content}`, item]),
      ).values(),
    );
    return uniqueFindings.sort((a, b) => a.line - b.line);
  }, [code, options]); // Dependencies are correctly defined

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm max-h-56 flex flex-col">
      <h3 className="font-semibold text-gray-300 mb-2">Code Analysis</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 border-b border-gray-700 pb-3">
        {ANALYSIS_PATTERNS_CONFIG.map((config) => (
          <Checkbox
            key={config.id}
            id={config.id}
            label={config.label}
            checked={options[config.id]}
            onChange={() => handleOptionChange(config.id)}
          />
        ))}
      </div>
      {findings.length > 0 ? (
        <ul className="space-y-2 overflow-y-auto flex-grow">
          {findings.map((finding) => (
            <li
              key={`${finding.line}-${finding.content}`}
              className="flex items-start font-mono text-gray-400"
            >
              <span className="w-10 text-right mr-3 text-gray-500 flex-shrink-0">{`L${finding.line}:`}</span>
              <code className="bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded text-xs font-bold flex-1 break-all">
                {finding.content}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center text-gray-500 text-xs py-4">
          No findings for selected options.
        </div>
      )}
    </div>
  );
};
