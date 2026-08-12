import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  pdfUrl: string;
  currentPage: number;
  onPageLoad: (totalPages: number) => void;
  onPageChange: (page: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  scale?: number;
  annotations?: Annotation[];
  activeTool?: string;
  onAddAnnotation?: (annotation: Annotation) => void;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  onUpdateAnnotation?: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation?: (id: string) => void;
  pageRotation?: number;
  isPageDeleted?: boolean;
  watermarkConfig?: WatermarkConfig | null;
}

export interface WatermarkConfig {
  type: 'text' | 'image';
  text?: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
}

export interface Annotation {
  id: string;
  pageIndex: number;
  type: 'highlight' | 'text' | 'signature' | 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  color?: string;
  imageData?: string;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

function PdfViewer({
  pdfUrl,
  currentPage,
  onPageLoad,
  scale = 1.4,
  annotations = [],
  activeTool = 'select',
  onAddAnnotation,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  pageRotation = 0,
  isPageDeleted = false,
  watermarkConfig = null,
  onSwipeLeft,
  onSwipeRight,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragOrigPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);

  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const resizeStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const resizeOrigRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!pdfUrl) return;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: true,
        });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        onPageLoad(pdf.numPages);
      } catch (error) {
        console.error('加载PDF失败:', error);
        setIsLoading(false);
      }
    };

    void loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDoc) return;

    if (isPageDeleted) {
      setIsLoading(false);
      return;
    }

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rotation = pageRotation % 360;
        const vp = page.getViewport({ scale, rotation });
        canvas.width = vp.width;
        canvas.height = vp.height;
        setViewport({ width: vp.width, height: vp.height });

        setPdfPageSize({ width: page.getViewport({ scale: 1 }).width, height: page.getViewport({ scale: 1 }).height });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        if (watermarkConfig && watermarkConfig.type === 'text' && watermarkConfig.text) {
          drawWatermark(ctx, canvas.width, canvas.height, watermarkConfig);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('渲染页面失败:', error);
        setIsLoading(false);
      }
    };

    void renderPage();
  }, [pdfDoc, currentPage, scale, pageRotation, isPageDeleted, watermarkConfig]);

  const drawWatermark = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: WatermarkConfig,
  ) => {
    const fontSize = config.fontSize || 36;
    const opacity = config.opacity ?? 0.3;
    const angle = config.rotation || 30;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = config.text || '';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    const angleRad = (angle * Math.PI) / 180;
    const stepX = textWidth + fontSize * 2;
    const stepY = textHeight * 4;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(angleRad);

    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }

    ctx.restore();
  };

  const getOverlayCoords = useCallback((e: React.MouseEvent<HTMLDivElement> | React.MouseEvent) => {
    const overlay = overlayRef.current;
    if (!overlay || !viewport || !pdfPageSize) return null;
    const rect = overlay.getBoundingClientRect();
    const scaleX = pdfPageSize.width / viewport.width;
    const scaleY = pdfPageSize.height / viewport.height;
    const pixelX = (e.clientX - rect.left) * (viewport.width / rect.width);
    const pixelY = (e.clientY - rect.top) * (viewport.height / rect.height);
    const pdfX = pixelX * scaleX;
    const pdfY = (viewport.height - pixelY) * scaleY;
    return { x: pdfX, y: pdfY };
  }, [viewport, pdfPageSize]);

  const getCurrentPageAnnotations = useCallback(() => {
    return annotations.filter(a => a.pageIndex === currentPage - 1);
  }, [annotations, currentPage]);

  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();

    if (onSelectAnnotation) {
      onSelectAnnotation(annotation.id);
    }

    const coords = getOverlayCoords(e as React.MouseEvent<HTMLDivElement>);
    if (!coords) return;

    setDraggingId(annotation.id);
    dragStartPosRef.current = coords;
    dragOrigPosRef.current = { x: annotation.x, y: annotation.y };
    hasMovedRef.current = false;
  }, [activeTool, getOverlayCoords, onSelectAnnotation]);

  const handleResizeHandleMouseDown = useCallback((e: React.MouseEvent, annotation: Annotation, handle: ResizeHandle) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();

    const coords = getOverlayCoords(e as React.MouseEvent<HTMLDivElement>);
    if (!coords) return;

    setResizingId(annotation.id);
    setResizeHandle(handle);
    resizeStartPosRef.current = coords;
    resizeOrigRectRef.current = { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
  }, [activeTool, getOverlayCoords]);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!viewport) return;

    if (activeTool === 'select') {
      if (e.target === e.currentTarget) {
        if (onSelectAnnotation) onSelectAnnotation(null);
      }
      return;
    }

    if (activeTool === 'text') {
      const coords = getOverlayCoords(e);
      if (!coords || !onAddAnnotation) return;

      const text = prompt('请输入批注文字:');
      if (!text) return;

      onAddAnnotation({
        id: Date.now().toString(),
        pageIndex: currentPage - 1,
        type: 'text',
        x: coords.x - 80,
        y: coords.y,
        width: 160,
        height: 24,
        content: text,
        color: '#000000',
      });
      return;
    }

    if (activeTool === 'highlight' || activeTool === 'rectangle') {
      const coords = getOverlayCoords(e);
      if (!coords) return;
      setDrawStart(coords);
      setDrawEnd(coords);
      setIsDrawing(true);
    }
  }, [activeTool, viewport, pdfPageSize, currentPage, getOverlayCoords, onAddAnnotation, onSelectAnnotation]);

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId && dragStartPosRef.current && dragOrigPosRef.current && pdfPageSize) {
      const coords = getOverlayCoords(e);
      if (!coords) return;

      const dx = coords.x - dragStartPosRef.current.x;
      const dy = coords.y - dragStartPosRef.current.y;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        hasMovedRef.current = true;
      }

      const newX = Math.max(0, Math.min(pdfPageSize.width, dragOrigPosRef.current.x + dx));
      const newY = Math.max(0, Math.min(pdfPageSize.height, dragOrigPosRef.current.y + dy));

      if (onUpdateAnnotation) {
        onUpdateAnnotation(draggingId, { x: newX, y: newY });
      }
      return;
    }

    if (resizingId && resizeStartPosRef.current && resizeOrigRectRef.current && resizeHandle && pdfPageSize) {
      const coords = getOverlayCoords(e);
      if (!coords) return;

      const dx = coords.x - resizeStartPosRef.current.x;
      const dy = coords.y - resizeStartPosRef.current.y;
      const orig = resizeOrigRectRef.current;

      let newX = orig.x;
      let newY = orig.y;
      let newW = orig.width;
      let newH = orig.height;

      const MIN_SIZE = 20;

      switch (resizeHandle) {
        case 'se':
          // 锚定顶部(y+height)和左侧(x)，拖拽底部和右侧
          newY = orig.y + dy;
          newX = orig.x;
          newH = Math.max(MIN_SIZE, orig.y + orig.height - newY);
          newW = Math.max(MIN_SIZE, orig.width + dx);
          break;
        case 'ne':
          // 锚定底部(y)和左侧(x)，拖拽顶部和右侧
          newY = orig.y;
          newX = orig.x;
          newH = Math.max(MIN_SIZE, orig.height + dy);
          newW = Math.max(MIN_SIZE, orig.width + dx);
          break;
        case 'sw':
          // 锚定顶部(y+height)和右侧(x+width)，拖拽底部和左侧
          newY = orig.y + dy;
          newX = orig.x + dx;
          newH = Math.max(MIN_SIZE, orig.y + orig.height - newY);
          newW = Math.max(MIN_SIZE, orig.width - dx);
          break;
        case 'nw':
          // 锚定底部(y)和右侧(x+width)，拖拽顶部和左侧
          newY = orig.y;
          newX = orig.x + dx;
          newH = Math.max(MIN_SIZE, orig.height + dy);
          newW = Math.max(MIN_SIZE, orig.width - dx);
          break;
      }

      if (onUpdateAnnotation) {
        onUpdateAnnotation(resizingId, { x: newX, y: newY, width: newW, height: newH });
      }
      return;
    }

    if (!isDrawing) return;
    const coords = getOverlayCoords(e);
    if (!coords) return;
    setDrawEnd(coords);
  }, [draggingId, resizingId, resizeHandle, isDrawing, getOverlayCoords, onUpdateAnnotation, pdfPageSize]);

  const handleOverlayMouseUp = useCallback(() => {
    if (draggingId) {
      setDraggingId(null);
      dragStartPosRef.current = null;
      dragOrigPosRef.current = null;
      return;
    }

    if (resizingId) {
      setResizingId(null);
      setResizeHandle(null);
      resizeStartPosRef.current = null;
      resizeOrigRectRef.current = null;
      return;
    }

    if (!isDrawing || !drawStart || !drawEnd || !viewport) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawEnd(null);
      return;
    }

    const x = Math.min(drawStart.x, drawEnd.x);
    const y = Math.min(drawStart.y, drawEnd.y);
    const width = Math.abs(drawEnd.x - drawStart.x);
    const height = Math.abs(drawEnd.y - drawStart.y);

    if (width < 3 || height < 3) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawEnd(null);
      return;
    }

    if (onAddAnnotation) {
      onAddAnnotation({
        id: Date.now().toString(),
        pageIndex: currentPage - 1,
        type: activeTool === 'highlight' ? 'highlight' : 'rectangle',
        x,
        y,
        width,
        height,
        color: activeTool === 'highlight' ? '#FFFF00' : '#000000',
      });
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  }, [draggingId, resizingId, isDrawing, drawStart, drawEnd, pdfPageSize, activeTool, currentPage, onAddAnnotation, getOverlayCoords]);

  const handleAnnotationClick = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    e.stopPropagation();
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    if (activeTool === 'select' && onSelectAnnotation) {
      onSelectAnnotation(annotation.id);
    }
  }, [activeTool, onSelectAnnotation]);

  const handleAnnotationDoubleClick = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    e.stopPropagation();
    if (onDeleteAnnotation) {
      if (confirm(`确定删除此批注吗？`)) {
        onDeleteAnnotation(annotation.id);
      }
    }
  }, [onDeleteAnnotation]);

  const currentPageAnnotations = getCurrentPageAnnotations();

  const getAnnotationStyle = (annotation: Annotation) => {
    if (!viewport || !pdfPageSize) return {};
    const scaleX = viewport.width / pdfPageSize.width;
    const scaleY = viewport.height / pdfPageSize.height;
    const leftPx = annotation.x * scaleX;
    const topPx = (pdfPageSize.height - annotation.y - annotation.height) * scaleY;
    const widthPx = annotation.width * scaleX;
    const heightPx = annotation.height * scaleY;
    return {
      left: `${(leftPx / viewport.width) * 100}%`,
      top: `${(topPx / viewport.height) * 100}%`,
      width: `${(widthPx / viewport.width) * 100}%`,
      height: `${(heightPx / viewport.height) * 100}%`,
    };
  };

  const renderResizeHandles = (annotation: Annotation) => {
    if (activeTool !== 'select' || annotation.id !== selectedAnnotationId) return null;
    if (!viewport) return null;

    const handleSize = 10;
    const handleStyle = (hx: number, hy: number, cursor: string): React.CSSProperties => ({
      position: 'absolute',
      left: `${hx}%`,
      top: `${hy}%`,
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      backgroundColor: '#fff',
      border: '2px solid #007bff',
      borderRadius: '2px',
      cursor,
      zIndex: 10,
      transform: 'translate(-50%, -50%)',
    });

    const handles: { handle: ResizeHandle; hx: number; hy: number; cursor: string }[] = [
      { handle: 'nw', hx: 0, hy: 0, cursor: 'nwse-resize' },
      { handle: 'ne', hx: 100, hy: 0, cursor: 'nesw-resize' },
      { handle: 'sw', hx: 0, hy: 100, cursor: 'nesw-resize' },
      { handle: 'se', hx: 100, hy: 100, cursor: 'nwse-resize' },
    ];

    return handles.map(({ handle, hx, hy, cursor }) => (
      <div
        key={handle}
        style={handleStyle(hx, hy, cursor)}
        onMouseDown={(e) => handleResizeHandleMouseDown(e, annotation, handle)}
        onDoubleClick={(e) => e.stopPropagation()}
      />
    ));
  };

  const getAnnotationCursor = (annotation: Annotation) => {
    if (activeTool === 'select') {
      return annotation.id === selectedAnnotationId ? 'move' : 'pointer';
    }
    if (annotation.type === 'text') return 'text';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0].clientX;
        touchStartYRef.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStartXRef.current;
        const dy = e.changedTouches[0].clientY - touchStartYRef.current;
        if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0 && onSwipeLeft) {
            onSwipeLeft();
          } else if (dx > 0 && onSwipeRight) {
            onSwipeRight();
          }
        }
      }}
      style={{
        position: 'relative',
        overflow: 'auto',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        backgroundColor: '#525659',
      }}
    >
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '16px',
          zIndex: 10,
        }}>
          加载中...
        </div>
      )}

      <div style={{ position: 'relative', margin: '20px 0' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            backgroundColor: '#fff',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
        />

        {isPageDeleted && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            border: '3px dashed #dc3545',
            boxSizing: 'border-box',
          }}>
            <span style={{
              color: '#dc3545',
              fontSize: '24px',
              fontWeight: 'bold',
              textShadow: '0 0 10px rgba(255,255,255,0.8)',
            }}>
              此页已标记删除
            </span>
          </div>
        )}

        <div
          ref={overlayRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: activeTool === 'select' ? 'default' :
                   activeTool === 'text' ? 'text' :
                   activeTool === 'highlight' || activeTool === 'rectangle' ? 'crosshair' : 'default',
          }}
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
          onMouseLeave={handleOverlayMouseUp}
        >
          {currentPageAnnotations.map((annotation) => {
            const style = getAnnotationStyle(annotation);
            const isSelected = annotation.id === selectedAnnotationId;
            const cursor = getAnnotationCursor(annotation);

            if (annotation.type === 'highlight') {
              return (
                <div
                  key={annotation.id}
                  style={{
                    ...style,
                    position: 'absolute',
                    backgroundColor: annotation.color || '#FFFF00',
                    opacity: isSelected ? 0.6 : 0.4,
                    border: isSelected ? '2px solid #007bff' : 'none',
                    cursor,
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
                  onClick={(e) => handleAnnotationClick(e, annotation)}
                  onDoubleClick={(e) => handleAnnotationDoubleClick(e, annotation)}
                >
                  {renderResizeHandles(annotation)}
                </div>
              );
            }

            if (annotation.type === 'rectangle') {
              return (
                <div
                  key={annotation.id}
                  style={{
                    ...style,
                    position: 'absolute',
                    border: `2px solid ${annotation.color || '#000000'}`,
                    backgroundColor: 'transparent',
                    cursor,
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
                  onClick={(e) => handleAnnotationClick(e, annotation)}
                  onDoubleClick={(e) => handleAnnotationDoubleClick(e, annotation)}
                >
                  {renderResizeHandles(annotation)}
                </div>
              );
            }

            if (annotation.type === 'text') {
              return (
                <div
                  key={annotation.id}
                  style={{
                    ...style,
                    position: 'absolute',
                    color: '#000',
                    fontSize: '14px',
                    fontFamily: 'sans-serif',
                    padding: '2px 4px',
                    backgroundColor: 'transparent',
                    border: isSelected ? '2px dashed #007bff' : '1px dotted #ccc',
                    cursor,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    userSelect: 'none',
                  }}
                  onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
                  onClick={(e) => handleAnnotationClick(e, annotation)}
                  onDoubleClick={(e) => handleAnnotationDoubleClick(e, annotation)}
                >
                  {annotation.content}
                  {renderResizeHandles(annotation)}
                </div>
              );
            }

            if (annotation.type === 'signature' && annotation.imageData) {
              return (
                <div
                  key={annotation.id}
                  style={{
                    ...style,
                    position: 'absolute',
                    cursor,
                    border: isSelected ? '2px dashed #007bff' : 'none',
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
                  onClick={(e) => handleAnnotationClick(e, annotation)}
                  onDoubleClick={(e) => handleAnnotationDoubleClick(e, annotation)}
                >
                  <img
                    src={annotation.imageData}
                    alt="signature"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                    draggable={false}
                  />
                  {renderResizeHandles(annotation)}
                </div>
              );
            }

            return null;
          })}

          {isDrawing && drawStart && drawEnd && viewport && pdfPageSize && (
            <div
              style={(() => {
                const scaleX = viewport.width / pdfPageSize.width;
                const scaleY = viewport.height / pdfPageSize.height;
                const xMin = Math.min(drawStart.x, drawEnd.x);
                const xMax = Math.max(drawStart.x, drawEnd.x);
                const yMin = Math.min(drawStart.y, drawEnd.y);
                const yMax = Math.max(drawStart.y, drawEnd.y);
                const leftPx = xMin * scaleX;
                const topPx = (pdfPageSize.height - yMax) * scaleY;
                const widthPx = (xMax - xMin) * scaleX;
                const heightPx = (yMax - yMin) * scaleY;
                return {
                  position: 'absolute' as const,
                  left: `${(leftPx / viewport.width) * 100}%`,
                  top: `${(topPx / viewport.height) * 100}%`,
                  width: `${(widthPx / viewport.width) * 100}%`,
                  height: `${(heightPx / viewport.height) * 100}%`,
                  backgroundColor: activeTool === 'highlight' ? '#FFFF00' : 'transparent',
                  opacity: 0.4,
                  border: activeTool === 'rectangle' ? '2px solid #000000' : 'none',
                  pointerEvents: 'none' as const,
                  boxSizing: 'border-box' as const,
                };
              })()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default PdfViewer;