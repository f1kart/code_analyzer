import React from 'react';

interface SearchResult {
  web: {
    uri: string;
    title: string;
  };
}

interface SearchResultsDisplayProps {
  results: SearchResult[];
}

export const SearchResultsDisplay: React.FC<SearchResultsDisplayProps> = ({ results }) => {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-gray-600 pt-2">
      <h4 className="text-xs font-semibold text-gray-400 mb-1">Web Search Results:</h4>
      <div className="space-y-1">
        {results.map((result, index) => (
          <a
            href={result.web.uri}
            target="_blank"
            rel="noopener noreferrer"
            key={index}
            className="block p-1.5 bg-gray-800 hover:bg-gray-700/50 rounded-md text-xs"
          >
            <p className="truncate text-blue-400">{result.web.title}</p>
            <p className="truncate text-gray-500">{result.web.uri}</p>
          </a>
        ))}
      </div>
    </div>
  );
};
