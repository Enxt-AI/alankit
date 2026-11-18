/**
 * Component for displaying side-by-side diffs between two versions
 */

import { ContentVersion } from '@/types/content';

interface DiffViewProps {
  currentVersion: ContentVersion;
  previousVersion?: ContentVersion;
}

export function DiffView({ currentVersion, previousVersion }: DiffViewProps) {
  // Simple diff implementation - compare JSON structures
  const getDiffLines = (current: any, previous: any) => {
    const currentStr = JSON.stringify(current, null, 2);
    const previousStr = previous ? JSON.stringify(previous, null, 2) : '';

    const currentLines = currentStr.split('\n');
    const previousLines = previousStr.split('\n');

    const maxLines = Math.max(currentLines.length, previousLines.length);
    const diffLines: Array<{
      left: string;
      right: string;
      type: 'added' | 'removed' | 'unchanged' | 'modified';
    }> = [];

    for (let i = 0; i < maxLines; i++) {
      const leftLine = previousLines[i] || '';
      const rightLine = currentLines[i] || '';

      if (leftLine === rightLine) {
        diffLines.push({ left: leftLine, right: rightLine, type: 'unchanged' });
      } else if (!leftLine && rightLine) {
        diffLines.push({ left: '', right: rightLine, type: 'added' });
      } else if (leftLine && !rightLine) {
        diffLines.push({ left: leftLine, right: '', type: 'removed' });
      } else {
        diffLines.push({ left: leftLine, right: rightLine, type: 'modified' });
      }
    }

    return diffLines;
  };

  const diffLines = getDiffLines(currentVersion.content, previousVersion?.content);

  const getLineClass = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 text-green-800';
      case 'removed':
        return 'bg-red-50 text-red-800';
      case 'modified':
        return 'bg-yellow-50 text-yellow-800';
      default:
        return '';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b">
        <h4 className="font-medium text-sm">
          Comparing Version {previousVersion?.versionNumber || 'N/A'} → Version {currentVersion.versionNumber}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-0">
        {/* Left side - Previous version */}
        <div className="border-r">
          <div className="bg-gray-100 px-3 py-2 text-xs font-medium border-b">
            {previousVersion ? `Version ${previousVersion.versionNumber}` : 'No previous version'}
          </div>
          <div className="p-0">
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={`px-3 py-1 text-xs font-mono border-b border-gray-100 ${getLineClass(line.type === 'removed' ? 'removed' : '')}`}
              >
                {line.left || '\u00A0'}
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Current version */}
        <div>
          <div className="bg-gray-100 px-3 py-2 text-xs font-medium border-b">
            Version {currentVersion.versionNumber} (Current)
          </div>
          <div className="p-0">
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={`px-3 py-1 text-xs font-mono border-b border-gray-100 ${getLineClass(line.type === 'added' ? 'added' : line.type === 'modified' ? 'modified' : '')}`}
              >
                {line.right || '\u00A0'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}