export const TOOL_CATEGORIES = {
  'code-quality': {
    name: 'Code Quality',
    color: 'from-blue-600 to-cyan-600',
    tools: [
      { id: 'analyze', name: 'Analyze', emoji: '🔍', desc: 'Check complexity' },
      { id: 'review', name: 'Review', emoji: '✅', desc: 'Quality review' },
      { id: 'duplicate', name: 'Find Dupes', emoji: '📋', desc: 'Similar code' },
    ],
  },
  transformation: {
    name: 'Transform Code',
    color: 'from-purple-600 to-pink-600',
    tools: [
      { id: 'refactor', name: 'Refactor', emoji: '🔧', desc: 'Improve code' },
      { id: 'optimize', name: 'Optimize', emoji: '⚡', desc: 'Performance' },
      { id: 'format', name: 'Format', emoji: '🎨', desc: 'AI styling' },
      { id: 'format-local', name: 'Prettier', emoji: '✨', desc: 'Local format' },
      { id: 'translate', name: 'Translate', emoji: '🌐', desc: 'Convert lang' },
    ],
  },
  generation: {
    name: 'Generate & Explain',
    color: 'from-green-600 to-emerald-600',
    tools: [
      { id: 'test', name: 'Tests', emoji: '🧪', desc: 'Unit tests' },
      { id: 'document', name: 'Docs', emoji: '📝', desc: 'Documentation' },
      { id: 'explain', name: 'Explain', emoji: '💡', desc: 'Understand code' },
      { id: 'complete', name: 'Complete', emoji: '🚀', desc: 'AI completion' },
    ],
  },
};

export const ALL_TOOLS = Object.values(TOOL_CATEGORIES).flatMap((cat) => cat.tools);

export const TRANSLATION_TARGETS = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
];

export const OPTIMIZATION_TYPES = [
  { value: 'performance', label: '⚡ Performance' },
  { value: 'memory', label: '💾 Memory' },
  { value: 'readability', label: '📖 Readability' },
  { value: 'security', label: '🔒 Security' },
];

export const EXPLANATION_LEVELS = [
  { value: 'beginner', label: '👶 Beginner' },
  { value: 'intermediate', label: '👨‍💻 Intermediate' },
  { value: 'advanced', label: '🧙 Advanced' },
];

export const DOC_TYPES = [
  { value: 'function', label: '⚡ Function' },
  { value: 'class', label: '📦 Class' },
  { value: 'module', label: '📁 Module' },
  { value: 'api', label: '🌐 API' },
  { value: 'readme', label: '📝 README' },
];
