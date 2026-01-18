import React, { useMemo } from 'react';

interface BrowserPreviewProps {
  code: string;
}

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ code }) => {
  const srcDoc = useMemo(() => {
    // A simple heuristic to wrap JS/CSS in a basic HTML structure if it's not already present
    const trimmedCode = code.trim();
    if (trimmedCode.startsWith('<') && trimmedCode.endsWith('>')) {
      return code; // Assume it's full HTML
    }
    // Otherwise, assume it's JS or CSS and wrap it
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: sans-serif; color: #e5e7eb; }
            ${languageIsCss(code) ? code : ''}
          </style>
        </head>
        <body>
          <script>
            try {
              ${!languageIsCss(code) ? code : ''}
            } catch (e) {
              document.body.innerHTML = '<pre style="color: red;">' + e + '</pre>';
            }
          </script>
        </body>
      </html>
    `;
  }, [code]);

  // Very basic check if the code is likely CSS
  const languageIsCss = (codeStr: string) => {
    return /[\.\#\w\s]*\{[\s\S]*\}/.test(codeStr.trim());
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-100 flex-shrink-0">Browser Preview</h2>
      <iframe
        srcDoc={srcDoc}
        title="Browser Preview"
        sandbox="allow-scripts"
        className="w-full h-full border-2 border-gray-700 rounded-lg bg-white"
      />
    </div>
  );
};
