import React from 'react';

interface FeedbackDisplayProps {
  feedback: string;
}

// A simple component to render each line based on markdown-like syntax
const FeedbackLine: React.FC<{ line: string }> = ({ line }) => {
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
    return <li className="ml-5 list-disc">{line.substring(2)}</li>;
  }
  if (line.trim() === '') {
    return <br />;
  }
  return <p className="leading-relaxed">{line}</p>;
};

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback }) => {
  const renderFeedback = () => {
    const lines = feedback.split('\n');
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
                {codeBlockLang}
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
        elements.push(<FeedbackLine key={i} line={line} />);
      }
    }

    return elements;
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-100">Review Feedback</h2>
      <div className="prose prose-invert max-w-none text-gray-300 space-y-2">
        {renderFeedback()}
      </div>
    </div>
  );
};
