import React from 'react';

interface SummaryDisplayProps {
  summary: string;
}

// A component to render a single line of markdown
const MarkdownLine: React.FC<{ line: string }> = ({ line }) => {
  if (line.startsWith('### ')) {
    return (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-brand-purple">{line.substring(4)}</h3>
    );
  }
  if (line.startsWith('## ')) {
    return (
      <h2 className="text-xl font-bold mt-6 mb-3 border-b border-gray-600 pb-2 text-brand-blue">
        {line.substring(3)}
      </h2>
    );
  }
  if (line.startsWith('# ')) {
    return (
      <h1 className="text-2xl font-extrabold mt-8 mb-4 border-b-2 border-gray-500 pb-2">
        {line.substring(2)}
      </h1>
    );
  }
  if (line.startsWith('* ') || line.startsWith('- ')) {
    // Handle nested lists with spaces
    const indentLevel = line.match(/^\s*/)?.[0].length || 0;
    const indentRem = `${indentLevel * 1.25}rem`;
    return (
      <li
        className="list-disc [margin-left:var(--md-indent)]"
        style={{ ['--md-indent' as any]: indentRem }}
      >
        {line.substring(indentLevel + 2)}
      </li>
    );
  }
  if (line.trim() === '') {
    return <br />;
  }

  // Regex to find inline code (`) and bold (**) text
  const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <p className="leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="bg-gray-900 text-brand-blue font-mono text-sm px-1.5 py-0.5 rounded"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </p>
  );
};

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summary }) => {
  const renderSummary = () => {
    const lines = summary.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let codeBlockLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          elements.push(
            <div key={`codeblock-${i}`} className="bg-gray-900 rounded-md my-4">
              <div className="text-xs text-gray-400 px-4 py-1 border-b border-gray-700">
                {codeBlockLang || 'code'}
              </div>
              <pre className="p-4 overflow-x-auto text-sm">
                <code>{codeBlockLines.join('\n')}</code>
              </pre>
            </div>,
          );
          inCodeBlock = false;
          codeBlockLines = [];
          codeBlockLang = '';
        } else {
          // Start of code block
          inCodeBlock = true;
          codeBlockLang = line.substring(3).trim();
        }
      } else if (inCodeBlock) {
        codeBlockLines.push(line);
      } else {
        elements.push(<MarkdownLine key={i} line={line} />);
      }
    }
    // If the summary ends with an open code block, render it
    if (inCodeBlock) {
      elements.push(
        <div key="codeblock-final" className="bg-gray-900 rounded-md my-4">
          <div className="text-xs text-gray-400 px-4 py-1 border-b border-gray-700">
            {codeBlockLang || 'code'}
          </div>
          <pre className="p-4 overflow-x-auto text-sm">
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        </div>,
      );
    }
    return elements;
  };

  return (
    <div className="prose prose-invert max-w-none text-gray-300 space-y-2">{renderSummary()}</div>
  );
};
