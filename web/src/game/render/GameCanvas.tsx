import { useCallback, useEffect, useRef, useState } from 'react';
import type { Grid, Path, TowerInstance } from '../types';
import { THEME } from './theme';

type Props = {
  map: { grid: Grid; path: Path };
  towers?: TowerInstance[];
  onCellClick?: (pos: { x: number; y: number }) => void;
};

function buildPathCellSet(path: Path): Set<string> {
  const set = new Set<string>();
  const { waypoints } = path;
  for (let w = 0; w < waypoints.length - 1; w++) {
    const from = waypoints[w];
    const to = waypoints[w + 1];
    if (from.x === to.x) {
      const minY = Math.min(from.y, to.y);
      const maxY = Math.max(from.y, to.y);
      for (let y = minY; y <= maxY; y++) {
        set.add(`${from.x},${y}`);
      }
    } else {
      const minX = Math.min(from.x, to.x);
      const maxX = Math.max(from.x, to.x);
      for (let x = minX; x <= maxX; x++) {
        set.add(`${x},${from.y}`);
      }
    }
  }
  return set;
}

export function GameCanvas({ map, towers = [], onCellClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logicalSize = useRef({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = logicalSize.current;
    const { grid, path } = map;
    const pathSet = buildPathCellSet(path);
    const cellSize = Math.floor(Math.min(w / grid.cols, h / grid.rows));

    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    for (const cell of grid.cells) {
      const px = cell.x * cellSize;
      const py = cell.y * cellSize;
      if (pathSet.has(`${cell.x},${cell.y}`)) {
        ctx.fillStyle = THEME.path;
      } else if (cell.buildable) {
        ctx.fillStyle = THEME.buildable;
      } else {
        ctx.fillStyle = THEME.bg;
      }
      ctx.fillRect(px, py, cellSize, cellSize);
    }

    ctx.strokeStyle = THEME.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= grid.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, grid.rows * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= grid.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(grid.cols * cellSize, y * cellSize);
      ctx.stroke();
    }

    for (const tower of towers) {
      ctx.fillStyle = THEME.towerGhost;
      ctx.fillRect(tower.x * cellSize, tower.y * cellSize, cellSize, cellSize);
    }

    if (hovered) {
      const cell = grid.cells.find((c) => c.x === hovered.x && c.y === hovered.y);
      if (cell?.buildable) {
        ctx.fillStyle = THEME.hover;
        ctx.fillRect(hovered.x * cellSize, hovered.y * cellSize, cellSize, cellSize);
      }
    }
  }, [map, towers, hovered]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      logicalSize.current = { w: width, h: height };
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      draw();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  const getCellCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const { w, h } = logicalSize.current;
      const { grid } = map;
      const cellSize = Math.floor(Math.min(w / grid.cols, h / grid.rows));
      if (cellSize === 0) return null;
      const x = Math.floor((clientX - rect.left) / cellSize);
      const y = Math.floor((clientY - rect.top) / cellSize);
      if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return null;
      return { x, y };
    },
    [map],
  );

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onMouseMove={(e) => {
          const pos = getCellCoords(e.clientX, e.clientY);
          setHovered(pos);
        }}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          const pos = getCellCoords(e.clientX, e.clientY);
          if (pos) onCellClick?.(pos);
        }}
      />
    </div>
  );
}
