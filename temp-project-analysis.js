import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, 'src');
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const visited = new Set();
const files = [];

function walk(dir) {
  let realPath;
  try {
    realPath = fs.realpathSync(dir);
  } catch (error) {
    return;
  }
  if (visited.has(realPath)) return;
  visited.add(realPath);

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build'].includes(entry.name)) {
        continue;
      }
      walk(fullPath);
    } else {
      const ext = path.extname(entry.name);
      if (EXTS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
}

function analyzeFileContent(filePath, content) {
  const lines = content.split(/\r?\n/);
  const issues = [];

  const isAnalyzerTestCode = filePath.includes('EnterpriseToolsPanel') &&
    (content.includes('analyzeTestFile') || content.includes('analyzeCurrentComponent'));
  if (isAnalyzerTestCode) {
    return issues;
  }

  const patterns = [
    {
      type: 'todo',
      check(line) {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (!(lower.includes('todo') || lower.includes('fixme') || lower.includes('hack'))) return null;
        return (trimmed.startsWith('//') || trimmed.includes('* TODO') || trimmed.includes('TODO:'))
          ? { severity: 'medium', message: 'TODO comment found - work incomplete' }
          : null;
      }
    },
    {
      type: 'incomplete',
      check(line) {
        const trimmed = line.trim();
        if (/:\s*any\b|<any>|as any/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
          return { severity: 'medium', message: 'TypeScript "any" type used - loses type safety' };
        }
        return null;
      }
    },
    {
      type: 'incomplete',
      check(line, idx, arr) {
        const trimmed = line.trim();
        if (trimmed === 'catch (error) {' || trimmed === 'catch (e) {') {
          const nextLine = (arr[idx + 1] || '').trim();
          if (nextLine === '}' || nextLine === '// Empty') {
            return { severity: 'high', message: 'Empty catch block - errors are silently swallowed' };
          }
        }
        return null;
      }
    },
    {
      type: 'dependency',
      check(line) {
        const trimmed = line.trim();
        if (/password\s*=\s*['"]|api[_-]?key\s*=\s*['"]|secret\s*=\s*['"]|token\s*=\s*['"]/i.test(trimmed) &&
            !trimmed.includes('process.env') && !trimmed.startsWith('//')) {
          return { severity: 'high', message: 'Hardcoded credentials detected - security risk!' };
        }
        return null;
      }
    },
    {
      type: 'placeholder',
      check(line) {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (!(lower.includes('placeholder') || lower.includes('coming soon') || lower.includes('not implemented'))) {
          return null;
        }
        let severity = 'medium';
        let message = 'Placeholder text found';
        if ((trimmed.includes('return') && (lower.includes('coming soon') || lower.includes('not implemented'))) ||
            (trimmed.includes('= ') && (lower.includes('coming soon') || lower.includes('not implemented')))) {
          severity = 'high';
          message = 'Placeholder implementation found';
        } else if (trimmed.includes('placeholder=') &&
                   (lower.includes('"placeholder"') || lower.includes("'placeholder'") ||
                    lower.includes('"enter ') || lower.includes("'enter "))) {
          severity = 'medium';
          message = 'Generic placeholder text in UI';
        } else if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
          severity = 'low';
          message = 'Comment indicates placeholder or incomplete work';
        }
        return { severity, message };
      }
    },
    {
      type: 'mock',
      check(line, idx, arr, file) {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (!(lower.includes('mock') || lower.includes('fake') || lower.includes('stub')) ||
            trimmed.startsWith('//') || trimmed.startsWith('*')) {
          return null;
        }
        const isTest = /test|spec|\.test\./i.test(file);
        if (!isTest && (trimmed.includes('function') || trimmed.includes('class') || /(mock|fake|stub)[A-Z]/.test(trimmed))) {
          return { severity: 'high', message: 'Mock/fake implementation in production code' };
        }
        if (!isTest && (trimmed.includes('const ') || trimmed.includes('let '))) {
          return { severity: 'medium', message: 'Mock data in production code' };
        }
        return null;
      }
    },
    {
      type: 'mock',
      check(line) {
        const trimmed = line.trim();
        if (trimmed === 'debugger;' || trimmed.startsWith('debugger;')) {
          return { severity: 'high', message: 'Debugger statement found - must be removed' };
        }
        return null;
      }
    },
    {
      type: 'feature',
      check(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('*')) {
          return null;
        }
        const lower = trimmed.toLowerCase();
        const keywords = ['missing feature', 'feature not implemented', 'feature todo', 'todo feature'];
        const containsKeyword = keywords.some((keyword) => lower.includes(keyword));
        const hasExplicitFlag = /FEATURE\s*[:=-]\s*(missing|todo|pending)/i.test(trimmed);
        const hasCommentMarker = /(TODO|FIXME|NOTE).*feature/i.test(trimmed);
        if (containsKeyword || hasExplicitFlag || hasCommentMarker) {
          return {
            severity: hasExplicitFlag ? 'high' : 'medium',
            message: 'Missing feature detected',
          };
        }
        if (lower.includes('feature') && (lower.includes('not') || lower.includes('missing'))) {
          return {
            severity: 'medium',
            message: 'Missing feature detected',
          };
        }
        return null;
      }
    }
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      const result = pattern.check(line, i, lines, filePath);
      if (result) {
        issues.push({
          id: `${filePath}-${i + 1}-${pattern.type}`,
          file: filePath.replace(ROOT + path.sep, ''),
          line: i + 1,
          type: pattern.type,
          severity: result.severity,
          message: result.message,
          codeSnippet: line.trim().slice(0, 160)
        });
        break;
      }
    }
  }

  return issues;
}

walk(ROOT);

const allIssues = [];
for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    continue;
  }
  const fileIssues = analyzeFileContent(file, content);
  allIssues.push(...fileIssues);
}

const categories = {
  todo: 0,
  placeholder: 0,
  mock: 0,
  debug: 0,
  incomplete: 0,
  dependency: 0,
  feature: 0
};

for (const issue of allIssues) {
  if (!Object.prototype.hasOwnProperty.call(categories, issue.type)) {
    categories[issue.type] = 0;
  }
  categories[issue.type] += 1;
}

const summary = {
  totalFiles: files.length,
  issuesFound: allIssues.length,
  categories,
  criticalIssues: allIssues.filter(issue => issue.severity === 'high').length
};

const output = {
  summary,
  topIssues: allIssues.slice(0, 50)
};

process.stdout.write(JSON.stringify(output, null, 2));
