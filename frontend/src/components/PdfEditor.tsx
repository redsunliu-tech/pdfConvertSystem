import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config';
import SignaturePad from './SignaturePad';
import PdfViewer, { Annotation } from './PdfViewer';

interface PdfEditorProps {
  pdfTaskId: number;
  fileName: string;
  onClose: () => void;
}

interface WatermarkConfig {
  type: 'text' | 'image';
  text?: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
}

function PdfEditor({ pdfTaskId, fileName, onClose }: PdfEditorProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig | null>(null);
  const [pendingWatermark, setPendingWatermark] = useState<WatermarkConfig | null>(null);
  const [showWatermarkPanel, setShowWatermarkPanel] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const originalPageOrderRef = useRef<number[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');

  const displayPageCount = pageOrder.length;

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > displayPageCount) return;
    setCurrentPage(page);
  }, [displayPageCount]);

  const goPrevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goNextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  // P0: 键盘快捷键翻页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (showSignaturePad || editingAnnotation) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrevPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNextPage();
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1);
          break;
        case 'End':
          e.preventDefault();
          goToPage(displayPageCount);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrevPage, goNextPage, goToPage, displayPageCount, showSignaturePad, editingAnnotation]);

  // P2: 鼠标滚轮翻页（Ctrl+滚轮，兼容 macOS）
  // macOS Shift+滚轮会被系统拦截（切换桌面），改用 Ctrl 修饰键
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      e.preventDefault();
      if (e.deltaY > 0) {
        goNextPage();
      } else if (e.deltaY < 0) {
        goPrevPage();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [goPrevPage, goNextPage]);

  useEffect(() => {
    if (totalPages > 0 && pageOrder.length !== totalPages) {
      const initial = Array.from({ length: totalPages }, (_, i) => i);
      setPageOrder(initial);
      originalPageOrderRef.current = [...initial];
    }
  }, [totalPages]);

  useEffect(() => {
    if (pageOrder.length > 0 && currentPage > pageOrder.length) {
      setCurrentPage(pageOrder.length);
    }
  }, [pageOrder, currentPage]);

  useEffect(() => {
    setPdfUrl(`${API_BASE_URL}/api/files/preview/${pdfTaskId}`);
  }, [pdfTaskId]);

  const handlePageLoad = useCallback((total: number) => {
    setTotalPages(total);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    // page 是实际PDF页(1-based)，查找其显示位置
    const displayPos = pageOrder.indexOf(page - 1);
    setCurrentPage(displayPos >= 0 ? displayPos + 1 : page);
  }, [pageOrder]);

  const handleAddAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation]);
    setActiveTool('select');
  }, []);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId]);

  const handleCopyToPage = useCallback((annotation: Annotation, targetDisplayPage: number) => {
    const targetOrigIdx = pageOrder[targetDisplayPage - 1] ?? targetDisplayPage - 1;
    const newId = `copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAnnotation: Annotation = {
      ...annotation,
      id: newId,
      pageIndex: targetOrigIdx,
      x: 100,
      y: 100,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setCurrentPage(targetDisplayPage);
    setSelectedAnnotationId(newId);
  }, [pageOrder]);

  const handleMoveToPage = useCallback((annotationId: string, targetDisplayPage: number) => {
    const targetOrigIdx = pageOrder[targetDisplayPage - 1] ?? targetDisplayPage - 1;
    setAnnotations(prev => prev.map(a => a.id === annotationId ? { ...a, pageIndex: targetOrigIdx } : a));
    setCurrentPage(targetDisplayPage);
  }, [pageOrder]);

  const handleOpenSignaturePad = () => {
    setShowSignaturePad(true);
  };

  const handleSignatureSaved = (imageData: string) => {
    setShowSignaturePad(false);
    const origPageIdx = pageOrder[currentPage - 1] ?? currentPage - 1;

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      pageIndex: origPageIdx,
      type: 'signature',
      x: 100,
      y: 100,
      width: 180,
      height: 80,
      imageData,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setActiveTool('select');
  };

  const handlePreviewWatermark = () => {
    setWatermarkConfig(pendingWatermark);
    setShowWatermarkPanel(false);
  };

  const handleRemoveWatermark = () => {
    setWatermarkConfig(null);
    setPendingWatermark(null);
  };

  const handleTogglePageDelete = () => {
    const origPageIdx = pageOrder[currentPage - 1] ?? currentPage - 1;
    setDeletedPages(prev => {
      const next = new Set(prev);
      if (next.has(origPageIdx)) {
        next.delete(origPageIdx);
      } else {
        next.add(origPageIdx);
      }
      return next;
    });
  };

  const handleMovePage = (direction: 'up' | 'down') => {
    if (pageOrder.length === 0) return;
    const displayIdx = currentPage - 1;
    const targetIdx = direction === 'up' ? displayIdx - 1 : displayIdx + 1;
    if (targetIdx < 0 || targetIdx >= pageOrder.length) return;

    setPageOrder(prev => {
      const next = [...prev];
      [next[displayIdx], next[targetIdx]] = [next[targetIdx], next[displayIdx]];
      return next;
    });
    setCurrentPage(targetIdx + 1);
  };

  const resetPageOrder = () => {
    if (totalPages > 0) {
      const initial = Array.from({ length: totalPages }, (_, i) => i);
      setPageOrder(initial);
      originalPageOrderRef.current = [...initial];
      setCurrentPage(1);
    }
  };

  const getPageRotation = useCallback((pageIndex: number) => {
    return pageRotations[pageIndex] || 0;
  }, [pageRotations]);

  const handleRotatePage = (angle: number) => {
    const origPageIdx = pageOrder[currentPage - 1] ?? currentPage - 1;
    setPageRotations(prev => ({
      ...prev,
      [origPageIdx]: (prev[origPageIdx] || 0) + angle,
    }));
  };

  const handleResetPage = () => {
    const origPageIdx = pageOrder[currentPage - 1] ?? currentPage - 1;
    setPageRotations(prev => {
      const next = { ...prev };
      delete next[origPageIdx];
      return next;
    });
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pageOperations: { operation: string; pageIndex?: number; angle?: number; pageIndices?: number[] }[] = [];

      const isReordered = pageOrder.length > 0 && pageOrder.some((p, i) => p !== i);
      const hasDeleted = deletedPages.size > 0;

      if (isReordered || hasDeleted) {
        // 构建排除已删除页面的新顺序
        const filteredOrder = pageOrder.filter(p => !deletedPages.has(p));
        pageOperations.push({ operation: 'reorder', pageIndices: filteredOrder });

        // 构建 原页索引→新页索引 的映射
        const pageRemap: Record<number, number> = {};
        filteredOrder.forEach((origPage, newPos) => {
          pageRemap[origPage] = newPos;
        });

        // 重映射旋转操作到新页位置
        const rotateEntries = Object.entries(pageRotations).filter(([, angle]) => angle !== 0);
        for (const [pageIndexStr, angle] of rotateEntries) {
          const pageIndex = parseInt(pageIndexStr, 10);
          if (deletedPages.has(pageIndex)) continue;
          const newPageIdx = pageRemap[pageIndex] ?? pageIndex;
          pageOperations.push({ operation: 'rotate', pageIndex: newPageIdx, angle });
        }

        // 重映射批注页索引
        const exportAnnotations = annotations.map(a => {
          const newPageIdx = pageRemap[a.pageIndex] ?? a.pageIndex;
          return {
            pageIndex: newPageIdx,
            type: a.type,
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height,
            content: a.content,
            color: a.color,
            imageData: a.imageData,
          };
        });

        const requestBody: Record<string, unknown> = {
          pdfTaskId,
          annotations: exportAnnotations,
        };

        if (pageOperations.length > 0) {
          requestBody.pageOperations = pageOperations;
        }

        if (watermarkConfig) {
          requestBody.watermark = watermarkConfig;
        }

        await doExport(requestBody);
      } else {
        // 无排序无删除，保持原有逻辑
        const rotateEntries = Object.entries(pageRotations).filter(([, angle]) => angle !== 0);
        for (const [pageIndexStr, angle] of rotateEntries) {
          pageOperations.push({ operation: 'rotate', pageIndex: parseInt(pageIndexStr, 10), angle });
        }

        const exportAnnotations = annotations.map(a => ({
          pageIndex: a.pageIndex,
          type: a.type,
          x: a.x,
          y: a.y,
          width: a.width,
          height: a.height,
          content: a.content,
          color: a.color,
          imageData: a.imageData,
        }));

        const requestBody: Record<string, unknown> = {
          pdfTaskId,
          annotations: exportAnnotations,
        };

        if (pageOperations.length > 0) {
          requestBody.pageOperations = pageOperations;
        }

        if (watermarkConfig) {
          requestBody.watermark = watermarkConfig;
        }

        await doExport(requestBody);
      }
    } catch (error) {
      console.error('导出PDF失败', error);
      alert('导出PDF失败: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const doExport = async (requestBody: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/api/pdf/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    if (result.success && result.data) {
      const fileUrl = result.data.fileUrl as string;
      const downloadUrl = `${API_BASE_URL}${fileUrl}/download`;
      const fileResponse = await fetch(downloadUrl, { credentials: 'include' });
      if (!fileResponse.ok) throw new Error('下载失败');
      const blob = await fileResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const match = fileUrl.match(/\/([^/]+)\/?$/);
      a.download = match ? match[1] : 'edited.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      alert('PDF导出成功，正在下载...');
    } else {
      alert('PDF导出失败: ' + (result.message || '未知错误'));
    }
  };

  const handleToolClick = (tool: string) => {
    setActiveTool(tool);
    setSelectedAnnotationId(null);
  };

  const handleEditAnnotation = (annotation: Annotation) => {
    setEditingAnnotation(annotation);
  };

  const handleSaveAnnotationEdit = () => {
    if (!editingAnnotation) return;
    const newContent = prompt('编辑批注内容:', editingAnnotation.content || '');
    if (newContent !== null) {
      handleUpdateAnnotation(editingAnnotation.id, { content: newContent });
    }
    setEditingAnnotation(null);
  };

  const handleClearAnnotations = () => {
    if (annotations.length === 0) return;
    if (confirm('确定清空所有批注吗？')) {
      setAnnotations([]);
      setSelectedAnnotationId(null);
    }
  };

  const toolButtonStyle = (tool: string) => ({
    padding: '5px 10px',
    backgroundColor: activeTool === tool ? '#007bff' : '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  });

  const origPageIdx = pageOrder[currentPage - 1] ?? currentPage - 1;
  const pageAnnotations = annotations.filter(a => a.pageIndex === origPageIdx);
  const currentPageDeleted = deletedPages.has(origPageIdx);
  const currentRotation = getPageRotation(origPageIdx);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#f5f5f5',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: '16px' }}>{fileName}</span>
          <div style={{ display: 'flex', gap: '5px', marginLeft: '20px' }}>
            <button onClick={() => handleToolClick('select')} style={toolButtonStyle('select')}>选择</button>
            <button onClick={() => handleToolClick('highlight')} style={toolButtonStyle('highlight')}>高亮</button>
            <button onClick={() => handleToolClick('text')} style={toolButtonStyle('text')}>文字</button>
            <button onClick={() => handleToolClick('rectangle')} style={toolButtonStyle('rectangle')}>矩形</button>
            <button onClick={handleOpenSignaturePad} style={{
              padding: '5px 10px',
              backgroundColor: '#e83e8c',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}>签名</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => handleRotatePage(-90)} style={{
            padding: '5px 10px', backgroundColor: '#333', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}>左转90°</button>
          <button onClick={() => handleRotatePage(90)} style={{
            padding: '5px 10px', backgroundColor: '#333', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}>右转90°</button>
          {currentRotation !== 0 && (
            <button onClick={handleResetPage} style={{
              padding: '5px 10px', backgroundColor: '#ffc107', color: '#000',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}>重置旋转</button>
          )}
          <button onClick={handleTogglePageDelete} style={{
            padding: '5px 10px',
            backgroundColor: currentPageDeleted ? '#28a745' : '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}>{currentPageDeleted ? '恢复页面' : '删除页面'}</button>
          <div style={{ display: 'flex', gap: '5px', borderLeft: '1px solid #555', paddingLeft: '10px' }}>
            <button onClick={() => handleMovePage('up')} disabled={currentPage <= 1} style={{
              padding: '5px 10px', backgroundColor: currentPage <= 1 ? '#555' : '#6f42c1',
              color: '#fff', border: 'none', borderRadius: '4px',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}>↑上移</button>
            <button onClick={() => handleMovePage('down')} disabled={currentPage >= displayPageCount} style={{
              padding: '5px 10px', backgroundColor: currentPage >= displayPageCount ? '#555' : '#6f42c1',
              color: '#fff', border: 'none', borderRadius: '4px',
              cursor: currentPage >= displayPageCount ? 'not-allowed' : 'pointer',
            }}>↓下移</button>
            {pageOrder.some((p, i) => p !== i) && (
              <button onClick={resetPageOrder} style={{
                padding: '5px 10px', backgroundColor: '#ffc107', color: '#000',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
              }}>重置顺序</button>
            )}
          </div>
          <button onClick={() => {
            if (!showWatermarkPanel && !pendingWatermark && !watermarkConfig) {
              setPendingWatermark({
                type: 'text',
                text: '内部资料 禁止外传',
                fontSize: 36,
                opacity: 0.3,
                rotation: 30,
              });
            }
            setShowWatermarkPanel(!showWatermarkPanel);
          }} style={{
            padding: '5px 10px',
            backgroundColor: watermarkConfig ? '#6c757d' : '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}>{watermarkConfig ? '修改水印' : '水印'}</button>
          {watermarkConfig && (
            <button onClick={handleRemoveWatermark} style={{
              padding: '5px 10px', backgroundColor: '#6c757d', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}>移除水印</button>
          )}
          <button onClick={handleClearAnnotations} style={{
            padding: '5px 10px', backgroundColor: '#6c757d', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}>清空批注</button>
          <button onClick={handleExportPdf} disabled={isExporting} style={{
            padding: '5px 15px',
            backgroundColor: isExporting ? '#6c757d' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isExporting ? 'not-allowed' : 'pointer',
          }}>{isExporting ? '导出中...' : '导出PDF'}</button>
          <button onClick={onClose} style={{
            padding: '5px 10px', backgroundColor: '#6c757d', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}>关闭</button>
        </div>
      </div>

      {showWatermarkPanel && (
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '15px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff' }}>水印文字:</span>
          <input
            type="text"
            value={pendingWatermark?.text || watermarkConfig?.text || ''}
            onChange={(e) => setPendingWatermark({
              type: 'text',
              text: e.target.value,
              fontSize: pendingWatermark?.fontSize || watermarkConfig?.fontSize || 36,
              opacity: pendingWatermark?.opacity || watermarkConfig?.opacity || 0.3,
              rotation: pendingWatermark?.rotation || watermarkConfig?.rotation || 30,
            })}
            placeholder="内部资料 禁止外传"
            style={{
              padding: '5px 10px', backgroundColor: '#333', color: '#fff',
              border: '1px solid #555', borderRadius: '4px', width: '200px',
            }}
          />
          <span style={{ color: '#fff' }}>字体大小:</span>
          <input
            type="number"
            value={pendingWatermark?.fontSize || watermarkConfig?.fontSize || 36}
            onChange={(e) => setPendingWatermark({
              ...(pendingWatermark || watermarkConfig || { type: 'text', text: '' }),
              fontSize: Number(e.target.value),
            })}
            placeholder="字体大小"
            style={{
              padding: '5px 10px', backgroundColor: '#333', color: '#fff',
              border: '1px solid #555', borderRadius: '4px', width: '80px',
            }}
          />
          <span style={{ color: '#fff' }}>透明度:</span>
          <input
            type="number"
            value={pendingWatermark?.opacity || watermarkConfig?.opacity || 0.3}
            onChange={(e) => setPendingWatermark({
              ...(pendingWatermark || watermarkConfig || { type: 'text', text: '' }),
              opacity: Number(e.target.value),
            })}
            placeholder="透明度"
            step="0.1" min="0" max="1"
            style={{
              padding: '5px 10px', backgroundColor: '#333', color: '#fff',
              border: '1px solid #555', borderRadius: '4px', width: '80px',
            }}
          />
          <button onClick={handlePreviewWatermark} style={{
            padding: '5px 15px', backgroundColor: '#28a745', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}>应用水印</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PdfViewer
            pdfUrl={pdfUrl}
            currentPage={origPageIdx + 1}
            onPageLoad={handlePageLoad}
            onPageChange={handlePageChange}
            onSwipeLeft={goNextPage}
            onSwipeRight={goPrevPage}
            scale={1.4}
            annotations={annotations}
            activeTool={activeTool}
            onAddAnnotation={handleAddAnnotation}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={handleSelectAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            pageRotation={currentRotation}
            isPageDeleted={currentPageDeleted}
            watermarkConfig={watermarkConfig}
          />
        </div>

        <div style={{
          width: '300px', backgroundColor: '#fff',
          borderLeft: '1px solid #ddd', overflow: 'auto', flexShrink: 0,
        }}>
          <div style={{ padding: '15px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>操作状态</h3>
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f4f8', borderRadius: '4px' }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                已旋转页面: {Object.keys(pageRotations).filter(k => getPageRotation(parseInt(k, 10)) !== 0).length} 页
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                已删除页面: {deletedPages.size} 页
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                批注数量: {annotations.length} 个
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                水印: {watermarkConfig ? (watermarkConfig.text || '已设置') : '未设置'}
              </div>
              {pageOrder.some((p, i) => p !== i) && (
                <div style={{ fontSize: '13px', color: '#6f42c1' }}>
                  页面顺序: 已调整
                </div>
              )}
            </div>

            {pageOrder.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>页面顺序</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}>
                  {pageOrder.map((origIdx, displayPos) => {
                    const isDeleted = deletedPages.has(origIdx);
                    const isCurrent = displayPos === currentPage - 1;
                    const originalOrder = originalPageOrderRef.current;
                    const isReordered = originalOrder.length > 0 && originalOrder[displayPos] !== origIdx;
                    return (
                      <div
                        key={`p-${origIdx}`}
                        onClick={() => setCurrentPage(displayPos + 1)}
                        style={{
                          padding: '4px 8px',
                          marginBottom: '3px',
                          backgroundColor: isCurrent ? '#e3f2fd' : isDeleted ? '#ffebee' : isReordered ? '#fff9e6' : '#f9f9f9',
                          border: isCurrent ? '2px solid #007bff' : isDeleted ? '1px solid #dc3545' : isReordered ? '1px solid #ffc107' : '1px solid #eee',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          #{displayPos + 1} → 原第 {origIdx + 1} 页
                          {isReordered && (
                            <span style={{
                              marginLeft: '6px',
                              padding: '1px 5px',
                              backgroundColor: '#ffc107',
                              color: '#333',
                              borderRadius: '3px',
                              fontSize: '10px',
                            }}>
                              已调整
                            </span>
                          )}
                        </span>
                        {isDeleted && <span style={{ color: '#dc3545', fontSize: '11px' }}>已删除</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>批注列表</h3>
            {annotations.length === 0 ? (
              <p style={{ color: '#999', fontSize: '14px' }}>暂无批注</p>
            ) : (
              <div>
                {annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    onClick={() => {
                      const displayPos = pageOrder.indexOf(annotation.pageIndex);
                      setCurrentPage(displayPos >= 0 ? displayPos + 1 : annotation.pageIndex + 1);
                      setSelectedAnnotationId(annotation.id);
                    }}
                    style={{
                      padding: '10px',
                      marginBottom: '10px',
                      backgroundColor: selectedAnnotationId === annotation.id ? '#e3f2fd' : '#f9f9f9',
                      borderRadius: '4px',
                      border: selectedAnnotationId === annotation.id ? '2px solid #007bff' : '1px solid #eee',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        第 {pageOrder.indexOf(annotation.pageIndex) >= 0 ? pageOrder.indexOf(annotation.pageIndex) + 1 : annotation.pageIndex + 1} 页
                        {pageOrder.indexOf(annotation.pageIndex) >= 0 && pageOrder.indexOf(annotation.pageIndex) !== annotation.pageIndex && (
                          <span style={{ color: '#999' }}> (原{annotation.pageIndex + 1}页)</span>
                        )}
                      </span>
                      <span style={{
                        fontSize: '12px', padding: '2px 6px',
                        backgroundColor: annotation.type === 'highlight' ? '#FFFF00' :
                          annotation.type === 'text' ? '#007bff' :
                          annotation.type === 'signature' ? '#e83e8c' : '#333',
                        color: annotation.type === 'highlight' ? '#000' : '#fff',
                        borderRadius: '3px',
                      }}>
                        {annotation.type === 'highlight' ? '高亮' :
                          annotation.type === 'text' ? '文字' :
                          annotation.type === 'signature' ? '签名' : '矩形'}
                      </span>
                    </div>
                    {annotation.content && (
                      <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#333' }}>
                        {annotation.content}
                      </p>
                    )}
                    {annotation.type === 'signature' && (
                      <div style={{ marginTop: '5px' }}>
                        <img src={annotation.imageData} alt="signature" style={{ maxWidth: '100px', height: '40px' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditAnnotation(annotation); }}
                        style={{
                          padding: '3px 8px', fontSize: '12px',
                          backgroundColor: '#007bff', color: '#fff',
                          border: 'none', borderRadius: '3px', cursor: 'pointer',
                        }}
                      >编辑</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetPageStr = prompt(`复制到第几页？(1-${displayPageCount})`, String(currentPage));
                          if (targetPageStr === null) return;
                          const targetPage = parseInt(targetPageStr, 10);
                          if (isNaN(targetPage) || targetPage < 1 || targetPage > displayPageCount) {
                            alert(`请输入1-${displayPageCount}之间的页码`);
                            return;
                          }
                          handleCopyToPage(annotation, targetPage);
                        }}
                        style={{
                          padding: '3px 8px', fontSize: '12px',
                          backgroundColor: '#17a2b8', color: '#fff',
                          border: 'none', borderRadius: '3px', cursor: 'pointer',
                        }}
                      >复制</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentDisplayPage = pageOrder.indexOf(annotation.pageIndex) >= 0
                            ? pageOrder.indexOf(annotation.pageIndex) + 1
                            : annotation.pageIndex + 1;
                          const targetPageStr = prompt(`移动到第几页？(1-${displayPageCount})`, String(currentDisplayPage));
                          if (targetPageStr === null) return;
                          const targetPage = parseInt(targetPageStr, 10);
                          if (isNaN(targetPage) || targetPage < 1 || targetPage > displayPageCount) {
                            alert(`请输入1-${displayPageCount}之间的页码`);
                            return;
                          }
                          if (targetPage === currentDisplayPage) {
                            alert('已在该页');
                            return;
                          }
                          handleMoveToPage(annotation.id, targetPage);
                        }}
                        style={{
                          padding: '3px 8px', fontSize: '12px',
                          backgroundColor: '#6f42c1', color: '#fff',
                          border: 'none', borderRadius: '3px', cursor: 'pointer',
                        }}
                      >移动</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(annotation.id); }}
                        style={{
                          padding: '3px 8px', fontSize: '12px',
                          backgroundColor: '#dc3545', color: '#fff',
                          border: 'none', borderRadius: '3px', cursor: 'pointer',
                        }}
                      >删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{
        backgroundColor: '#1a1a1a', padding: '10px 20px',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: '16px', flexShrink: 0,
      }}>
        <button
          onClick={goPrevPage}
          disabled={currentPage <= 1}
          title="上一页 (←)"
          style={{
            padding: '5px 15px',
            backgroundColor: currentPage <= 1 ? '#555' : '#007bff',
            color: '#fff', border: 'none', borderRadius: '4px',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
          }}
        >上一页</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            min={1}
            max={displayPageCount}
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const p = parseInt(jumpPageInput, 10);
                if (!isNaN(p)) {
                  goToPage(p);
                  setJumpPageInput('');
                }
              }
            }}
            onBlur={() => {
              const p = parseInt(jumpPageInput, 10);
              if (!isNaN(p)) {
                goToPage(p);
                setJumpPageInput('');
              } else {
                setJumpPageInput('');
              }
            }}
            placeholder={String(currentPage)}
            style={{
              width: '56px',
              padding: '4px 6px',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              textAlign: 'center',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ color: '#999', fontSize: '14px' }}>/ {displayPageCount}</span>
          {currentRotation !== 0 && (
            <span style={{ marginLeft: '10px', color: '#ffc107' }}>
              (已旋转 {currentRotation}°)
            </span>
          )}
          {currentPageDeleted && (
            <span style={{ marginLeft: '10px', color: '#dc3545' }}>
              (已标记删除)
            </span>
          )}
        </div>

        <button
          onClick={goNextPage}
          disabled={currentPage >= displayPageCount}
          title="下一页 (→)"
          style={{
            padding: '5px 15px',
            backgroundColor: currentPage >= displayPageCount ? '#555' : '#007bff',
            color: '#fff', border: 'none', borderRadius: '4px',
            cursor: currentPage >= displayPageCount ? 'not-allowed' : 'pointer',
          }}
        >下一页</button>

        {pageAnnotations.length > 0 && (
          <span style={{ color: '#007bff', marginLeft: '10px' }}>
            当前页批注: {pageAnnotations.length}
          </span>
        )}

        <span style={{ color: '#666', fontSize: '12px', marginLeft: '16px' }}>
          ← → 翻页 | Ctrl+滚轮 翻页
        </span>
      </div>

      {showSignaturePad && (
        <SignaturePad
          onSignatureSaved={handleSignatureSaved}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {editingAnnotation && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '8px',
            padding: '24px', maxWidth: '400px', width: '90%',
          }}>
            <h3 style={{ marginTop: 0 }}>编辑批注</h3>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                类型: {editingAnnotation.type === 'highlight' ? '高亮' :
                       editingAnnotation.type === 'text' ? '文字' :
                       editingAnnotation.type === 'signature' ? '签名' : '矩形'}
              </p>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                位置: 第 {pageOrder.indexOf(editingAnnotation.pageIndex) >= 0 ? pageOrder.indexOf(editingAnnotation.pageIndex) + 1 : editingAnnotation.pageIndex + 1} 页
                {pageOrder.indexOf(editingAnnotation.pageIndex) >= 0 && pageOrder.indexOf(editingAnnotation.pageIndex) !== editingAnnotation.pageIndex && (
                  <span style={{ color: '#999' }}> (原{editingAnnotation.pageIndex + 1}页)</span>
                )}
              </p>
              {editingAnnotation.type !== 'signature' && editingAnnotation.content !== undefined && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>批注内容:</label>
                  <textarea
                    value={editingAnnotation.content}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, content: e.target.value })}
                    style={{
                      width: '100%', minHeight: '80px', padding: '8px',
                      border: '1px solid #ddd', borderRadius: '4px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>X坐标:</label>
                  <input
                    type="number"
                    value={editingAnnotation.x}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, x: Number(e.target.value) })}
                    style={{
                      width: '100%', padding: '6px',
                      border: '1px solid #ddd', borderRadius: '4px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Y坐标:</label>
                  <input
                    type="number"
                    value={editingAnnotation.y}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, y: Number(e.target.value) })}
                    style={{
                      width: '100%', padding: '6px',
                      border: '1px solid #ddd', borderRadius: '4px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>宽度:</label>
                  <input
                    type="number"
                    value={editingAnnotation.width}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, width: Number(e.target.value) })}
                    style={{
                      width: '100%', padding: '6px',
                      border: '1px solid #ddd', borderRadius: '4px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>高度:</label>
                  <input
                    type="number"
                    value={editingAnnotation.height}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, height: Number(e.target.value) })}
                    style={{
                      width: '100%', padding: '6px',
                      border: '1px solid #ddd', borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingAnnotation(null)}
                style={{
                  padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                }}
              >取消</button>
              <button
                onClick={handleSaveAnnotationEdit}
                style={{
                  padding: '8px 16px', backgroundColor: '#28a745', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                }}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfEditor;