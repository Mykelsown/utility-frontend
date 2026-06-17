"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { SpatialHashGrid, type Bounds } from "@/utils/spatial";

interface GridNode {
  id: string;
  x: number;
  y: number;
  resource: number;
  status: "active" | "idle" | "fault";
}

function generateNodes(count: number, width: number, height: number): GridNode[] {
  const nodes: GridNode[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = width / cols;
  const cellH = height / rows;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({
      id: `node-${i}`,
      x: col * cellW + cellW / 2 + (Math.random() - 0.5) * cellW * 0.4,
      y: row * cellH + cellH / 2 + (Math.random() - 0.5) * cellH * 0.4,
      resource: 0.2 + Math.random() * 0.8,
      status: Math.random() > 0.15 ? "active" : Math.random() > 0.5 ? "idle" : "fault",
    });
  }
  return nodes;
}

const NODE_RADIUS = 6;
const NODE_COUNT = 500;
const CELL_SIZE = NODE_RADIUS * 4;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

function getViewportBounds(
  canvas: HTMLCanvasElement,
  camera: Camera
): Bounds {
  const halfW = canvas.clientWidth / 2;
  const halfH = canvas.clientHeight / 2;
  return {
    x: camera.x - halfW / camera.zoom,
    y: camera.y - halfH / camera.zoom,
    width: canvas.clientWidth / camera.zoom,
    height: canvas.clientHeight / camera.zoom,
  };
}

export function GridMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offScreenRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const nodesRef = useRef<GridNode[]>([]);
  const spatialRef = useRef<SpatialHashGrid<GridNode> | null>(null);
  const animFrameRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const dprRef = useRef(1);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const needsRebuildRef = useRef(true);
  const { mode } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  const getCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { w: 800, h: 500 };
    const dpr = dprRef.current;
    return { w: canvas.clientWidth * dpr, h: canvas.clientHeight * dpr };
  }, []);

  const setupCanvasDpr = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
  }, []);

  useEffect(() => {
    spatialRef.current = new SpatialHashGrid<GridNode>(CELL_SIZE);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }, 100);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(resizeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    nodesRef.current = generateNodes(NODE_COUNT, dimensions.width, dimensions.height);
    needsRebuildRef.current = true;
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCanvasDpr();
  }, [dimensions, setupCanvasDpr]);

  const rebuildSpatialIndex = useCallback(() => {
    const spatial = spatialRef.current;
    if (!spatial) return;
    spatial.clear();
    const nodes = nodesRef.current;
    for (let i = 0; i < nodes.length; i++) {
      spatial.insert(nodes[i]);
    }
    needsRebuildRef.current = false;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = dprRef.current;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }

    if (needsRebuildRef.current) {
      rebuildSpatialIndex();
    }

    let offScreen = offScreenRef.current;
    if (!offScreen) {
      offScreen = document.createElement("canvas");
      offScreenRef.current = offScreen;
    }
    offScreen.width = canvas.width;
    offScreen.height = canvas.height;

    const ctx = canvas.getContext("2d");
    const offCtx = offScreen.getContext("2d");
    if (!ctx || !offCtx) return;

    const camera = cameraRef.current;

    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = mode === "dark" || mode === "high-contrast";
    const bg = isDark ? "#0a0a0a" : "#ffffff";
    const activeColor = isDark ? "#22c55e" : "#16a34a";
    const idleColor = isDark ? "#a3a3a3" : "#737373";
    const faultColor = "#ef4444";
    const gridColor = isDark ? "#1a1a1a" : "#f0f0f0";

    offCtx.fillStyle = bg;
    offCtx.fillRect(0, 0, cssW, cssH);

    offCtx.save();
    offCtx.translate(cssW / 2, cssH / 2);
    offCtx.scale(camera.zoom, camera.zoom);
    offCtx.translate(-camera.x, -camera.y);

    offCtx.strokeStyle = gridColor;
    offCtx.lineWidth = 1 / camera.zoom;
    const spacing = 40;
    const vp = getViewportBounds(canvas, camera);
    const gridStartX = Math.floor(vp.x / spacing) * spacing;
    const gridStartY = Math.floor(vp.y / spacing) * spacing;
    const gridEndX = vp.x + vp.width;
    const gridEndY = vp.y + vp.height;
    for (let x = gridStartX; x <= gridEndX; x += spacing) {
      offCtx.beginPath();
      offCtx.moveTo(x, gridStartY);
      offCtx.lineTo(x, gridEndY);
      offCtx.stroke();
    }
    for (let y = gridStartY; y <= gridEndY; y += spacing) {
      offCtx.beginPath();
      offCtx.moveTo(gridStartX, y);
      offCtx.lineTo(gridEndX, y);
      offCtx.stroke();
    }

    const visible = spatialRef.current?.query(vp) ?? [];
    const now = Date.now();
    for (let i = 0; i < visible.length; i++) {
      const node = visible[i];
      const pulse = 0.3 + Math.sin(now * 0.002 + i) * 0.1 + 0.1;
      const alpha = pulse * 0.7 + 0.3;

      offCtx.beginPath();
      offCtx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
      const color =
        node.status === "active"
          ? activeColor
          : node.status === "idle"
          ? idleColor
          : faultColor;
      offCtx.fillStyle = color;
      offCtx.globalAlpha = alpha;
      offCtx.fill();
      offCtx.globalAlpha = 1;
      offCtx.strokeStyle = color;
      offCtx.lineWidth = 1.5 / camera.zoom;
      offCtx.stroke();
    }

    offCtx.restore();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(offScreen, 0, 0, cssW, cssH);
  }, [mode, rebuildSpatialIndex]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(function loop() {
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    const canvas = canvasRef.current;
    if (canvas) canvas.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      const camera = cameraRef.current;
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));

    const worldX = (mx - rect.width / 2) / camera.zoom + camera.x;
    const worldY = (my - rect.height / 2) / camera.zoom + camera.y;

    camera.x = worldX - (mx - rect.width / 2) / newZoom;
    camera.y = worldY - (my - rect.height / 2) / newZoom;
    camera.zoom = newZoom;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[500px] rounded-xl border border-border overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
