import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useNotifications } from './NotificationSystem';
import SnippetModal from './SnippetModal';

interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  author: string;
}

interface SnippetCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  snippetCount: number;
}

interface CodeSnippetManagerProps {
  className?: string;
  onSnippetSelect?: (snippet: CodeSnippet) => void;
  onSnippetInsert?: (snippet: CodeSnippet) => void;
}

type ViewMode = 'grid' | 'list' | 'compact';
type SortBy = 'title' | 'category' | 'language' | 'createdAt' | 'updatedAt' | 'usageCount';
type FilterBy = 'all' | 'favorites' | 'recent' | 'popular' | 'public' | 'private';

const DEFAULT_CATEGORIES: SnippetCategory[] = [
  {
    id: 'general',
    name: 'General',
    description: 'General purpose snippets',
    color: 'bg-gray-500',
    icon: 'code',
    snippetCount: 0,
  },
  {
    id: 'react',
    name: 'React',
    description: 'React components and hooks',
    color: 'bg-blue-500',
    icon: 'react',
    snippetCount: 0,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    description: 'TypeScript utilities and types',
    color: 'bg-blue-600',
    icon: 'typescript',
    snippetCount: 0,
  },
  {
    id: 'css',
    name: 'CSS',
    description: 'CSS styles and animations',
    color: 'bg-purple-500',
    icon: 'css',
    snippetCount: 0,
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    description: 'JavaScript functions and utilities',
    color: 'bg-yellow-500',
    icon: 'javascript',
    snippetCount: 0,
  },
  {
    id: 'node',
    name: 'Node.js',
    description: 'Node.js server-side code',
    color: 'bg-green-600',
    icon: 'node',
    snippetCount: 0,
  },
  {
    id: 'database',
    name: 'Database',
    description: 'SQL queries and database operations',
    color: 'bg-indigo-500',
    icon: 'database',
    snippetCount: 0,
  },
  {
    id: 'api',
    name: 'API',
    description: 'API endpoints and integrations',
    color: 'bg-orange-500',
    icon: 'api',
    snippetCount: 0,
  },
  {
    id: 'utils',
    name: 'Utilities',
    description: 'Helper functions and utilities',
    color: 'bg-teal-500',
    icon: 'utils',
    snippetCount: 0,
  },
];

const PROGRAMMING_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'dart',
  'scala',
  'r',
  'matlab',
  'sql',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'json',
  'xml',
  'yaml',
  'toml',
  'markdown',
  'bash',
  'powershell',
  'dockerfile',
];

export const CodeSnippetManager: React.FC<CodeSnippetManagerProps> = ({
  className = '',
  onSnippetSelect,
  onSnippetInsert,
}) => {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [categories, setCategories] = useState<SnippetCategory[]>(DEFAULT_CATEGORIES);
  const [filteredSnippets, setFilteredSnippets] = useState<CodeSnippet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<CodeSnippet | null>(null);
  const [filterLanguage, setFilterLanguage] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useNotifications();

  // Load snippets from localStorage
  useEffect(() => {
    const loadSnippets = () => {
      try {
        const savedSnippets = localStorage.getItem('codeSnippets');
        const savedCategories = localStorage.getItem('snippetCategories');

        if (savedSnippets) {
          const parsedSnippets = JSON.parse(savedSnippets);
          setSnippets(parsedSnippets);
        }

        if (savedCategories) {
          const parsedCategories = JSON.parse(savedCategories);
          setCategories(parsedCategories);
        } else {
          localStorage.setItem('snippetCategories', JSON.stringify(DEFAULT_CATEGORIES));
        }
      } catch (error) {
        console.error('Failed to load snippets:', error);
        addNotification('error', 'Load Error', {
          message: 'Failed to load code snippets',
          duration: 5000,
        });
      }
    };

    loadSnippets();
  }, [addNotification]);

  // Save snippets to localStorage
  const saveSnippets = useCallback(
    (updatedSnippets: CodeSnippet[]) => {
      try {
        localStorage.setItem('codeSnippets', JSON.stringify(updatedSnippets));
      } catch (error) {
        console.error('Failed to save snippets:', error);
        addNotification('error', 'Save Error', {
          message: 'Failed to save code snippets',
          duration: 5000,
        });
      }
    },
    [addNotification],
  );

  // Filter and sort snippets
  useEffect(() => {
    let filtered = [...snippets];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (snippet) =>
          snippet.title.toLowerCase().includes(query) ||
          snippet.description.toLowerCase().includes(query) ||
          snippet.code.toLowerCase().includes(query) ||
          snippet.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          snippet.language.toLowerCase().includes(query),
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((snippet) => snippet.category === selectedCategory);
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((snippet) =>
        selectedTags.every((tag) => snippet.tags.includes(tag)),
      );
    }

    // Apply language filter
    if (filterLanguage) {
      filtered = filtered.filter((snippet) => snippet.language === filterLanguage);
    }

    // Apply general filter
    switch (filterBy) {
      case 'favorites':
        filtered = filtered.filter((snippet) => snippet.isFavorite);
        break;
      case 'recent':
        filtered = filtered.filter(
          (snippet) => Date.now() - snippet.updatedAt < 7 * 24 * 60 * 60 * 1000, // Last 7 days
        );
        break;
      case 'popular':
        filtered = filtered.filter((snippet) => snippet.usageCount > 0);
        break;
      case 'public':
        filtered = filtered.filter((snippet) => snippet.isPublic);
        break;
      case 'private':
        filtered = filtered.filter((snippet) => !snippet.isPublic);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'language':
          return a.language.localeCompare(b.language);
        case 'createdAt':
          return b.createdAt - a.createdAt;
        case 'updatedAt':
          return b.updatedAt - a.updatedAt;
        case 'usageCount':
          return b.usageCount - a.usageCount;
        default:
          return 0;
      }
    });

    setFilteredSnippets(filtered);
  }, [snippets, searchQuery, selectedCategory, selectedTags, filterBy, sortBy, filterLanguage]);

  // Get all unique tags
  const allTags = Array.from(new Set(snippets.flatMap((snippet) => snippet.tags))).sort();

  // Get all unique languages
  const uniqueLanguages = Array.from(new Set(snippets.map((snippet) => snippet.language))).sort();

  // CRUD Operations
  const createSnippet = useCallback(
    (snippetData: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
      const newSnippet: CodeSnippet = {
        ...snippetData,
        id: `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
      };

      const updatedSnippets = [...snippets, newSnippet];
      saveSnippets(updatedSnippets);

      addNotification('success', 'Snippet Created', {
        message: `Created snippet: ${newSnippet.title}`,
        duration: 3000,
      });

      return newSnippet;
    },
    [snippets, saveSnippets, addNotification],
  );

  const updateSnippet = useCallback(
    (id: string, updates: Partial<CodeSnippet>) => {
      const updatedSnippets = snippets.map((snippet) =>
        snippet.id === id ? { ...snippet, ...updates, updatedAt: Date.now() } : snippet,
      );

      saveSnippets(updatedSnippets);

      addNotification('success', 'Snippet Updated', {
        message: 'Snippet has been updated successfully',
        duration: 3000,
      });
    },
    [snippets, saveSnippets, addNotification],
  );

  const deleteSnippet = useCallback(
    (id: string) => {
      const snippet = snippets.find((s) => s.id === id);
      if (!snippet) return;

      const confirmed = confirm(`Are you sure you want to delete "${snippet.title}"?`);
      if (!confirmed) return;

      const updatedSnippets = snippets.filter((s) => s.id !== id);
      saveSnippets(updatedSnippets);

      addNotification('success', 'Snippet Deleted', {
        message: `Deleted snippet: ${snippet.title}`,
        duration: 3000,
      });
    },
    [snippets, saveSnippets, addNotification],
  );

  const duplicateSnippet = useCallback(
    (id: string) => {
      const snippet = snippets.find((s) => s.id === id);
      if (!snippet) return;

      const duplicatedSnippet = createSnippet({
        ...snippet,
        title: `${snippet.title} (Copy)`,
        author: 'Current User',
      });

      addNotification('success', 'Snippet Duplicated', {
        message: `Duplicated snippet: ${snippet.title}`,
        duration: 3000,
      });

      return duplicatedSnippet;
    },
    [snippets, createSnippet, addNotification],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const snippet = snippets.find((s) => s.id === id);
      if (!snippet) return;

      updateSnippet(id, { isFavorite: !snippet.isFavorite });
    },
    [snippets, updateSnippet],
  );

  const incrementUsage = useCallback(
    (id: string) => {
      const snippet = snippets.find((s) => s.id === id);
      if (!snippet) return;

      updateSnippet(id, { usageCount: snippet.usageCount + 1 });
    },
    [snippets, updateSnippet],
  );

  // Handle snippet selection and insertion
  const handleSnippetSelect = useCallback(
    (snippet: CodeSnippet) => {
      incrementUsage(snippet.id);
      onSnippetSelect?.(snippet);
    },
    [incrementUsage, onSnippetSelect],
  );

  const handleSnippetInsert = useCallback(
    (snippet: CodeSnippet) => {
      incrementUsage(snippet.id);
      onSnippetInsert?.(snippet);
    },
    [incrementUsage, onSnippetInsert],
  );

  const handleCreateSnippet = useCallback(
    (data: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
      const newSnippet: CodeSnippet = {
        ...data,
        id: Date.now().toString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
      };

      const updatedSnippets = [...snippets, newSnippet];
      setSnippets(updatedSnippets);
      localStorage.setItem('codeSnippets', JSON.stringify(updatedSnippets));

      addNotification('success', 'Snippet Created', {
        message: `"${newSnippet.title}" has been created successfully`,
        duration: 3000,
      });
    },
    [snippets, addNotification],
  );

  const handleUpdateSnippet = useCallback(
    (data: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
      if (!editingSnippet) return;

      const updatedSnippet: CodeSnippet = {
        ...editingSnippet,
        ...data,
        updatedAt: Date.now(),
      };

      const updatedSnippets = snippets.map((s) =>
        s.id === editingSnippet.id ? updatedSnippet : s,
      );
      setSnippets(updatedSnippets);
      localStorage.setItem('codeSnippets', JSON.stringify(updatedSnippets));

      addNotification('success', 'Snippet Updated', {
        message: `"${updatedSnippet.title}" has been updated successfully`,
        duration: 3000,
      });

      setEditingSnippet(null);
    },
    [editingSnippet, snippets, addNotification],
  );

  const handleModalSave = useCallback(
    (data: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
      if (editingSnippet) {
        handleUpdateSnippet(data);
      } else {
        handleCreateSnippet(data);
      }
    },
    [editingSnippet, handleUpdateSnippet, handleCreateSnippet],
  );

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingSnippet(null);
  }, []);

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Code Snippets</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          New Snippet
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search snippets..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            title="Filter by language"
            aria-label="Filter by language"
          >
            <option value="">All Languages</option>
            {uniqueLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            title="Sort snippets by"
            aria-label="Sort snippets by"
          >
            <option value="title">Name</option>
            <option value="language">Language</option>
            <option value="createdAt">Created</option>
            <option value="usageCount">Usage Count</option>
          </select>

          <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-gray-400'}`}
              title="Grid view"
              aria-label="Switch to grid view"
            >
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-gray-400'}`}
              title="List view"
              aria-label="Switch to list view"
            >
              <div className="w-4 h-4 flex flex-col gap-0.5">
                <div className="bg-current h-1 rounded-sm"></div>
                <div className="bg-current h-1 rounded-sm"></div>
                <div className="bg-current h-1 rounded-sm"></div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Snippets List */}
      <div className="flex-1 overflow-auto p-4">
        {filteredSnippets.length === 0 ? (
          <div className="text-center py-12">
            <CodeBracketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No snippets found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery || selectedCategory !== 'all' || filterBy !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first code snippet to get started'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Snippet
            </button>
          </div>
        ) : (
          <div
            className={`
                        ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}
                    `}
          >
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {snippet.title}
                    </h3>
                    {snippet.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {snippet.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFavorite(snippet.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    {snippet.isFavorite ? (
                      <StarSolidIcon className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <StarIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full text-white ${
                      categories.find((cat) => cat.id === snippet.category)?.color || 'bg-gray-500'
                    }`}
                  >
                    {categories.find((cat) => cat.id === snippet.category)?.name ||
                      snippet.category}
                  </span>
                  <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                    {snippet.language}
                  </span>
                  {snippet.isPublic && (
                    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                      Public
                    </span>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mb-3">
                  <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-hidden line-clamp-4">
                    <code>{snippet.code}</code>
                  </pre>
                </div>

                {snippet.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {snippet.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {snippet.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        +{snippet.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span>Used {snippet.usageCount} times</span>
                  <span>{new Date(snippet.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSnippetSelect(snippet)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => handleSnippetInsert(snippet)}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    Insert
                  </button>
                  <button
                    onClick={() => {
                      setEditingSnippet(snippet);
                      setShowEditModal(true);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title={`Edit ${snippet.title} snippet`}
                    aria-label={`Edit ${snippet.title} snippet`}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => duplicateSnippet(snippet.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title={`Duplicate ${snippet.title} snippet`}
                    aria-label={`Duplicate ${snippet.title} snippet`}
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSnippet(snippet.id)}
                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                    title={`Delete ${snippet.title} snippet`}
                    aria-label={`Delete ${snippet.title} snippet`}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SnippetModal
        isOpen={showCreateModal || showEditModal}
        onClose={handleCloseModal}
        snippet={editingSnippet}
        categories={categories}
        onSave={handleModalSave}
      />
    </div>
  );
};

export default CodeSnippetManager;
