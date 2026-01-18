export interface DiffPart {
  type: 'common' | 'added' | 'removed';
  value: string;
}

export interface DiffLine {
  type: 'common' | 'added' | 'removed' | 'modified';
  oldLineNumber?: number;
  newLineNumber?: number;
  oldLineContent?: string;
  newLineContent?: string;
  oldLineParts?: DiffPart[];
  newLineParts?: DiffPart[];
}

// Character-level diff based on LCS
const diffChars = (
  oldStr: string,
  newStr: string,
): { oldParts: DiffPart[]; newParts: DiffPart[] } => {
  const M = oldStr.length;
  const N = newStr.length;
  const lcsMatrix = Array(M + 1)
    .fill(0)
    .map(() => Array(N + 1).fill(0));

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (oldStr[i - 1] === newStr[j - 1]) {
        lcsMatrix[i][j] = 1 + lcsMatrix[i - 1][j - 1];
      } else {
        lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
      }
    }
  }

  const oldParts: DiffPart[] = [];
  const newParts: DiffPart[] = [];
  let i = M,
    j = N;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldStr[i - 1] === newStr[j - 1]) {
      oldParts.unshift({ type: 'common', value: oldStr[i - 1] });
      newParts.unshift({ type: 'common', value: newStr[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcsMatrix[i][j - 1] >= lcsMatrix[i - 1][j])) {
      newParts.unshift({ type: 'added', value: newStr[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || lcsMatrix[i][j - 1] < lcsMatrix[i - 1][j])) {
      oldParts.unshift({ type: 'removed', value: oldStr[i - 1] });
      i--;
    } else {
      break;
    }
  }

  const mergeParts = (parts: DiffPart[]): DiffPart[] => {
    if (parts.length === 0) return [];
    const merged = [parts[0]];
    for (let k = 1; k < parts.length; k++) {
      const last = merged[merged.length - 1];
      if (parts[k].type === last.type) {
        last.value += parts[k].value;
      } else {
        merged.push(parts[k]);
      }
    }
    return merged;
  };

  return { oldParts: mergeParts(oldParts), newParts: mergeParts(newParts) };
};

// Simple Longest Common Subsequence (LCS) based diff algorithm for lines
export const getDiffLines = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const M = oldLines.length;
  const N = newLines.length;

  const lcsMatrix = Array(M + 1)
    .fill(0)
    .map(() => Array(N + 1).fill(0));

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcsMatrix[i][j] = 1 + lcsMatrix[i - 1][j - 1];
      } else {
        lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = M,
    j = N;
  let oldLineNum = M,
    newLineNum = N;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'common',
        oldLineNumber: oldLineNum--,
        newLineNumber: newLineNum--,
        oldLineContent: oldLines[i - 1],
        newLineContent: newLines[j - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcsMatrix[i][j - 1] >= lcsMatrix[i - 1][j])) {
      result.unshift({
        type: 'added',
        newLineNumber: newLineNum--,
        oldLineContent: '',
        newLineContent: newLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || lcsMatrix[i][j - 1] < lcsMatrix[i - 1][j])) {
      result.unshift({
        type: 'removed',
        oldLineNumber: oldLineNum--,
        oldLineContent: oldLines[i - 1],
        newLineContent: '',
      });
      i--;
    } else {
      break;
    }
  }

  // Balance the lines for side-by-side view and calculate intra-line diffs
  const balancedResult: DiffLine[] = [];
  let addedBuffer: DiffLine[] = [];
  let removedBuffer: DiffLine[] = [];

  for (const line of result) {
    if (line.type === 'added') {
      addedBuffer.push(line);
    } else if (line.type === 'removed') {
      removedBuffer.push(line);
    } else {
      while (addedBuffer.length > 0 && removedBuffer.length > 0) {
        const removed = removedBuffer.shift()!;
        const added = addedBuffer.shift()!;
        const { oldParts, newParts } = diffChars(removed.oldLineContent!, added.newLineContent!);
        balancedResult.push({
          type: 'modified',
          oldLineNumber: removed.oldLineNumber,
          newLineNumber: added.newLineNumber,
          oldLineContent: removed.oldLineContent,
          newLineContent: added.newLineContent,
          oldLineParts: oldParts,
          newLineParts: newParts,
        });
      }
      balancedResult.push(...removedBuffer);
      balancedResult.push(...addedBuffer);
      addedBuffer = [];
      removedBuffer = [];
      balancedResult.push(line);
    }
  }
  balancedResult.push(...removedBuffer);
  balancedResult.push(...addedBuffer);

  return balancedResult;
};
