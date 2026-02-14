import React, { useMemo } from 'react';
import { GitLogEntry } from '../../../main/git/interface';

interface GitGraphProps {
  history: GitLogEntry[];
  height?: number; // Row height
  dotSize?: number;
  lineWidth?: number;
  spacing?: number;
}

interface GraphNode {
  hash: string;
  x: number; // Column index
  y: number; // Row index
  color: string;
  parents: string[];
}

interface GraphLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  isMerge?: boolean;
}

const COLORS = [
  '#00bcd4', // cyan
  '#ff9800', // orange
  '#2196f3', // blue
  '#9c27b0', // purple
  '#4caf50', // green
  '#f44336', // red
  '#e91e63', // pink
  '#ffeb3b', // yellow
];

export const GitGraph: React.FC<GitGraphProps> = ({
  history,
  height = 24,
  dotSize = 6,
  lineWidth = 2,
  spacing = 12,
}) => {
  const { nodes, links, width } = useMemo(() => {
    const calculatedNodes: GraphNode[] = [];
    const calculatedLinks: GraphLink[] = [];
    const activeColumns: { hash: string; color: string }[] = [];
    let maxColumn = 0;

    // Helper to get or assign a column for a hash
    const getColumn = (hash: string) => {
      const existingIndex = activeColumns.findIndex((c) => c.hash === hash);
      if (existingIndex !== -1) return existingIndex;
      return -1;
    };

    const assignColumn = (hash: string, color?: string) => {
      // Try to find an empty slot
      let colIndex = activeColumns.findIndex(
        (c) => c.hash === null || c.hash === undefined,
      );
      if (colIndex === -1) {
        colIndex = activeColumns.length;
        activeColumns.push({
          hash,
          color: color || COLORS[colIndex % COLORS.length],
        });
      } else {
        activeColumns[colIndex] = {
          hash,
          color: color || COLORS[colIndex % COLORS.length],
        };
      }
      maxColumn = Math.max(maxColumn, colIndex);
      return colIndex;
    };

    history.forEach((commit, rowIndex) => {
      // 1. Determine column for current commit
      let colIndex = getColumn(commit.hash);

      // If not tracked yet, it's a new branch tip (or we just started)
      if (colIndex === -1) {
        colIndex = assignColumn(commit.hash);
      }

      const { color } = activeColumns[colIndex];

      // Record node
      calculatedNodes.push({
        hash: commit.hash,
        x: colIndex,
        y: rowIndex,
        color,
        parents: commit.parents,
      });

      // 2. Prepare for next row (parents)
      // Remove current commit from active columns (it's done)
      // But we need to put its parents in active columns.

      // If multiple parents (merge), we keep the column for the first parent,
      // and assign/reuse columns for other parents.
      // If single parent, we reuse the column.

      // Actually, we should replace the current hash in `activeColumns` with the first parent.
      // And add other parents to other columns.

      // We need to know which active columns "flow" to which parents.

      const { parents } = commit;

      // Draw links to parents
      parents.forEach((parentHash, i) => {
        let parentColIndex = getColumn(parentHash);

        if (parentColIndex === -1) {
          if (i === 0) {
            // Primary parent inherits the column
            activeColumns[colIndex].hash = parentHash;
            parentColIndex = colIndex;
          } else {
            // Secondary parents get new/existing columns
            parentColIndex = assignColumn(parentHash);
          }
        } else {
          // Parent already has a column (merge destination logic)
          if (i === 0 && parentColIndex !== colIndex) {
            // Optimization: Try to merge columns visualy if possible?
            // For simplicity, just draw link.
            // Also, if we are the primary child, maybe we should have claimed that column?
            // Complexity involves topological sorting.
            // Simplified: Just update our slot to empty if we didn't pass it to anyone.
            if (activeColumns[colIndex].hash === commit.hash) {
              // We need to clear this slot if we are pointing to an existing column
              // But wait, what if another child also points here?
              // Standard logic:
              // Current commit consumes its slot.
              // It passes the "flow" to the FIRST parent.
              // If the first parent ALREADY has a slot, then the current slot becomes dead (merge into existing).
              // If the first parent DOES NOT have a slot, it takes the current slot.

              if (activeColumns[parentColIndex].hash === parentHash) {
                // Parent is already active elsewhere. We merge INTO it.
                // So our current slot becomes free.
                activeColumns[colIndex] = { hash: null as any, color: '' }; // Free slot
              }
            }
          }
        }

        calculatedLinks.push({
          x1: colIndex,
          y1: rowIndex,
          x2: parentColIndex,
          y2: rowIndex + 1,
          color,
          isMerge: i > 0,
        });
      });

      if (parents.length === 0) {
        // Root commit, free the slot
        activeColumns[colIndex] = { hash: null as any, color: '' };
      }
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      width: (maxColumn + 1) * spacing + dotSize,
    };
  }, [history, height, dotSize, spacing]);

  return (
    <svg
      width={width}
      height={history.length * height}
      style={{ display: 'block' }}
    >
      {/* Links */}
      {links.map((link, i) => {
        // Bezier curve
        const sx = link.x1 * spacing + spacing / 2;
        const sy = link.y1 * height + height / 2;
        const ex = link.x2 * spacing + spacing / 2;
        const ey = link.y2 * height + height / 2;

        const path = `M ${sx} ${sy} C ${sx} ${sy + height / 2}, ${ex} ${ey - height / 2}, ${ex} ${ey}`;

        return (
          <path
            key={`link-${i}`}
            d={path}
            stroke={link.color}
            strokeWidth={lineWidth}
            fill="none"
            opacity={0.8}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        <circle
          key={`node-${node.hash}`}
          cx={node.x * spacing + spacing / 2}
          cy={node.y * height + height / 2}
          r={dotSize / 2}
          fill={node.color}
          stroke="#fff"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};
