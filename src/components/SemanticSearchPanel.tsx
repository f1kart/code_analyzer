import React, { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  FolderIcon,
  TagIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
  EyeIcon,
  BookOpenIcon,
  CubeIcon,
  SparklesIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  semanticSearch,
  SearchResult,
  SearchOptions,
  SymbolIndex,
  ConceptIndex,
} from '../services/semanticSearch';
import { useNotifications } from './NotificationSystem';

interface SemanticSearchPanelProps {
  className?: string;
  projectPath?: string;
}

type SearchMode = 'unified' | 'symbols' | 'concepts';

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({
  className = '',
  projectPath,
}) => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('unified');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [symbolResults, setSymbolResults] = useState<SymbolIndex[]>([]);
  const [conceptResults, setConceptResults] = useState<ConceptIndex[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [searchOptions, setSearchOptions] = useState<Partial<SearchOptions>>({
    includeCode: true,
    includeComments: true,
    includeDocumentation: true,
    fileTypes: [],
    maxResults: 50,
    minRelevanceScore: 0.3,
    searchType: 'semantic',
    contextLines: 3,
  });

  const { addNotification } = useNotifications();

  // Monitor indexing progress
  useEffect(() => {
    const updateIndexingState = () => {
      setIsIndexing(semanticSearch.isIndexingInProgress());
      setIndexingProgress(semanticSearch.getIndexingProgress());
    };

    updateIndexingState();
    const interval = setInterval(updateIndexingState, 500);

    const unsubscribe = semanticSearch.onIndexingProgress((progress) => {
      setIndexingProgress(progress);
      if (progress === 100) {
        addNotification('success', 'Indexing Complete', {
          message: 'Project has been indexed for semantic search',
          duration: 3000,
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [addNotification]);

  const startIndexing = useCallback(async () => {
    if (!projectPath) {
      addNotification('warning', 'No Project', {
        message: 'Please open a project to start indexing',
        duration: 3000,
      });
      return;
    }

    try {
      await semanticSearch.indexProject(projectPath);
    } catch (error) {
      addNotification('error', 'Indexing Failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000,
      });
    }
  }, [projectPath, addNotification]);

  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setSymbolResults([]);
      setConceptResults([]);
      return;
    }

    setIsSearching(true);

    try {
      switch (searchMode) {
        case 'unified':
          const searchResults = await semanticSearch.search(query, searchOptions);
          setResults(searchResults);
          break;
        case 'symbols':
          const symbols = await semanticSearch.searchSymbols(query);
          setSymbolResults(symbols);
          break;
        case 'concepts':
          const concepts = await semanticSearch.searchConcepts(query);
          setConceptResults(concepts);
          break;
      }
    } catch (error) {
      addNotification('error', 'Search Failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000,
      });
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode, searchOptions, addNotification]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const updateSearchOption = (key: keyof SearchOptions, value: any) => {
    setSearchOptions((prev) => ({ ...prev, [key]: value }));
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'code':
        return <CodeBracketIcon className="w-4 h-4 text-blue-500" />;
      case 'comment':
        return <ChatBubbleLeftRightIcon className="w-4 h-4 text-green-500" />;
      case 'documentation':
        return <DocumentTextIcon className="w-4 h-4 text-purple-500" />;
      case 'function':
        return <CubeIcon className="w-4 h-4 text-orange-500" />;
      case 'class':
        return <BookOpenIcon className="w-4 h-4 text-red-500" />;
      case 'variable':
        return <TagIcon className="w-4 h-4 text-yellow-500" />;
      default:
        return <DocumentTextIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-blue-600 bg-blue-50';
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const indexStats = semanticSearch.getIndexStats();

  return (
    <div className={`h-full flex flex-col bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Semantic Search
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Search Filters"
          >
            <FunnelIcon className="w-4 h-4" />
          </button>

          <button
            onClick={startIndexing}
            disabled={isIndexing}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isIndexing ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Indexing...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Index
              </>
            )}
          </button>
        </div>
      </div>

      {/* Indexing Progress */}
      {isIndexing && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Indexing Project...
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {Math.round(indexingProgress)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${indexingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Index Stats */}
      {indexStats.files > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">{indexStats.files}</div>
              <div className="text-gray-500 dark:text-gray-400">Files</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {indexStats.symbols}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Symbols</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {indexStats.concepts}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Concepts</div>
            </div>
          </div>
          {indexStats.lastUpdated > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              Last updated: {new Date(indexStats.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, comments, documentation..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            disabled={isIndexing}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Search Mode Tabs */}
        <div className="flex mt-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSearchMode('unified')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              searchMode === 'unified'
                ? 'bg-panel text-text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setSearchMode('symbols')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              searchMode === 'symbols'
                ? 'bg-panel text-text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Symbols
          </button>
          <button
            onClick={() => setSearchMode('concepts')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              searchMode === 'concepts'
                ? 'bg-panel text-text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Concepts
          </button>
        </div>
      </div>

      {/* Search Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Type
              </label>
              <select
                value={searchOptions.searchType}
                onChange={(e) => updateSearchOption('searchType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                title="Select search type"
                aria-label="Search type selection"
              >
                <option value="semantic">Semantic</option>
                <option value="exact">Exact</option>
                <option value="fuzzy">Fuzzy</option>
                <option value="regex">Regex</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Results
              </label>
              <input
                type="number"
                value={searchOptions.maxResults}
                onChange={(e) => updateSearchOption('maxResults', parseInt(e.target.value))}
                min="10"
                max="200"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                title="Maximum number of search results"
                placeholder="Enter max results (10-200)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Min Relevance
              </label>
              <input
                type="range"
                value={searchOptions.minRelevanceScore}
                onChange={(e) =>
                  updateSearchOption('minRelevanceScore', parseFloat(e.target.value))
                }
                min="0"
                max="1"
                step="0.1"
                title="Minimum relevance score threshold"
                aria-label="Minimum relevance score slider"
                className="w-full"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {Math.round((searchOptions.minRelevanceScore || 0.3) * 100)}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Context Lines
              </label>
              <input
                type="number"
                value={searchOptions.contextLines}
                onChange={(e) => updateSearchOption('contextLines', parseInt(e.target.value))}
                min="0"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                title="Number of context lines to show"
                placeholder="Enter context lines (0-10)"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Include
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={searchOptions.includeCode}
                  onChange={(e) => updateSearchOption('includeCode', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Code</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={searchOptions.includeComments}
                  onChange={(e) => updateSearchOption('includeComments', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Comments</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={searchOptions.includeDocumentation}
                  onChange={(e) => updateSearchOption('includeDocumentation', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Documentation</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searchMode === 'unified' && (
          <div className="p-4">
            {results.length === 0 && query.trim() && !isSearching ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">Try adjusting your search terms or filters</p>
              </div>
            ) : results.length === 0 && !query.trim() ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Enter a search query to find code, comments, and documentation</p>
                {indexStats.files === 0 && (
                  <p className="text-sm mt-1">Index your project first to enable semantic search</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(result.type)}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {result.fileName}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Line {result.lineNumber}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getRelevanceColor(result.relevanceScore)}`}
                      >
                        {Math.round(result.relevanceScore * 100)}%
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {result.filePath}
                    </div>

                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                      {result.content}
                    </pre>

                    {result.context && (
                      <details className="mt-2">
                        <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                          Show context
                        </summary>
                        <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap mt-2">
                          {result.context}
                        </pre>
                      </details>
                    )}

                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {result.matchReason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {searchMode === 'symbols' && (
          <div className="p-4">
            {symbolResults.length === 0 && query.trim() ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CubeIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No symbols found for "{query}"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {symbolResults.map((symbol, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CubeIcon className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {symbol.name}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {symbol.type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {symbol.filePath}:{symbol.lineNumber}
                    </div>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm">
                      {symbol.signature}
                    </pre>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {symbol.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {searchMode === 'concepts' && (
          <div className="p-4">
            {conceptResults.length === 0 && query.trim() ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <TagIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No concepts found for "{query}"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conceptResults.map((concept, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-5 h-5 text-purple-500" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {concept.concept}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <ChartBarIcon className="w-4 h-4" />
                        {concept.frequency}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {concept.description}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Found in {concept.relatedFiles.length} files, {concept.relatedSymbols.length}{' '}
                      symbols
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SemanticSearchPanel;
