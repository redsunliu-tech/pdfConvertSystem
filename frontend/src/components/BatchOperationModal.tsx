import React, { useState, useEffect } from 'react';
import { FileItem } from '../types/file';
import './BatchOperationModal.css';

interface BatchOperationModalProps {
    visible: boolean;
    taskType: 'merge_pdf' | 'image_to_pdf_batch' | 'office_to_pdf_batch' | 'pdf_to_image_batch';
    selectedFiles: FileItem[];
    allFiles: FileItem[];
    onClose: () => void;
    onConfirm: (fileIds: string[], config: Record<string, any>) => void;
}

const IMAGE_EXTENSIONS = ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP'];
const PDF_EXTENSIONS = ['PDF'];
const OFFICE_EXTENSIONS = ['DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX'];

function BatchOperationModal({ visible, taskType, selectedFiles, allFiles, onClose, onConfirm }: BatchOperationModalProps) {
    const [fileQueue, setFileQueue] = useState<FileItem[]>([]);
    const [config, setConfig] = useState<Record<string, any>>(getDefaultConfig(taskType));
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [showFilePicker, setShowFilePicker] = useState(false);

    // 弹窗打开时同步外部选中的文件
    useEffect(() => {
        if (visible) {
            setFileQueue(selectedFiles);
            setConfig(getDefaultConfig(taskType));
        }
    }, [visible, taskType, selectedFiles]);

    const isMergeTask = taskType === 'merge_pdf';
    const isImageToPdf = taskType === 'image_to_pdf_batch';
    const needDragSort = isMergeTask || isImageToPdf;
    const allowedExtensions = getAllowedExtensions(taskType);
    const availableFiles = allFiles.filter(f => {
        const fileType = (f.fileType || '').toUpperCase().replace('.', '');
        return allowedExtensions.includes(fileType);
    });

    const handleDragStart = (index: number) => {
        setDragIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;

        setFileQueue(prev => {
            const newQueue = [...prev];
            const draggedItem = newQueue[dragIndex];
            newQueue.splice(dragIndex, 1);
            newQueue.splice(index, 0, draggedItem);
            setDragIndex(index);
            return newQueue;
        });
    };

    const handleDragEnd = () => {
        setDragIndex(null);
    };

    const handleAddFromServer = (file: FileItem) => {
        if (!fileQueue.find(f => f.id === file.id)) {
            setFileQueue(prev => [...prev, file]);
        }
    };

    const handleConfirm = () => {
        if (fileQueue.length === 0) return;
        const fileIds = fileQueue.map(f => f.id);
        onConfirm(fileIds, config);
    };

    const handleRemoveFile = (fileId: string) => {
        setFileQueue(prev => prev.filter(f => f.id !== fileId));
    };

    const handleClearQueue = () => {
        setFileQueue([]);
    };

    const isConfirmDisabled = fileQueue.length === 0;

    if (!visible) return null;

    return (
        <div className="batch-modal-overlay" onClick={onClose}>
            <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
                <div className="batch-modal-header">
                    <h2>{getTaskTypeTitle(taskType)}</h2>
                    <button className="batch-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="batch-modal-body">
                    <div className="batch-file-list">
                        <div className="batch-file-list-header">
                            <span>待处理文件：{fileQueue.length} 个</span>
                            <div className="batch-file-actions">
                                <button className="batch-add-btn" onClick={() => setShowFilePicker(true)}>
                                    添加文件
                                </button>
                                <button className="batch-clear-btn" onClick={handleClearQueue}>
                                    清空队列
                                </button>
                            </div>
                        </div>

                        <div className="batch-file-items">
                            {fileQueue.length === 0 ? (
                                <div className="batch-empty-tip">请至少添加一个文件</div>
                            ) : (
                                fileQueue.map((file, index) => (
                                    <div
                                        key={file.id}
                                        className={`batch-file-item ${needDragSort ? 'draggable' : ''}`}
                                        draggable={needDragSort}
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        {needDragSort && (
                                            <span className="batch-drag-handle">⋮⋮</span>
                                        )}
                                        <span className="batch-file-index">{index + 1}</span>
                                        <span className="batch-file-icon">📄</span>
                                        <span className="batch-file-name" title={file.fileName}>{file.fileName}</span>
                                        <button className="batch-remove-btn" onClick={() => handleRemoveFile(file.id)}>
                                            移除
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="batch-config-section">
                        <h3>转换参数</h3>
                        {renderConfigOptions(taskType, config, setConfig)}
                    </div>
                </div>

                <div className="batch-modal-footer">
                    <button className="batch-cancel-btn" onClick={onClose}>取消</button>
                    <button
                        className="batch-confirm-btn"
                        disabled={isConfirmDisabled}
                        onClick={handleConfirm}
                    >
                        {getConfirmButtonText(taskType, config)}
                    </button>
                </div>
            </div>

            {showFilePicker && (
                <div className="file-picker-overlay" onClick={() => setShowFilePicker(false)}>
                    <div className="file-picker-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="file-picker-header">
                            <h3>选择文件</h3>
                            <button className="file-picker-close" onClick={() => setShowFilePicker(false)}>✕</button>
                        </div>
                        <div className="file-picker-body">
                            {availableFiles.length === 0 ? (
                                <div className="file-picker-empty">暂无可用文件</div>
                            ) : (
                                availableFiles.map(file => (
                                    <div
                                        key={file.id}
                                        className={`file-picker-item ${fileQueue.find(f => f.id === file.id) ? 'added' : ''}`}
                                        onClick={() => handleAddFromServer(file)}
                                    >
                                        <span className="file-picker-icon">📄</span>
                                        <span className="file-picker-name" title={file.fileName}>{file.fileName}</span>
                                        {fileQueue.find(f => f.id === file.id) && (
                                            <span className="file-picker-added">已添加</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function getDefaultConfig(taskType: string): Record<string, any> {
    switch (taskType) {
        case 'merge_pdf':
            return { pageSize: 'original', orientation: 'portrait' };
        case 'image_to_pdf_batch':
            return { outputMode: 'single', pageSize: 'A4', orientation: 'portrait' };
        case 'office_to_pdf_batch':
            return { embedFonts: true };
        case 'pdf_to_image_batch':
            return { imageType: 'auto', dpi: 'auto', jpgQuality: 90 };
        default:
            return {};
    }
}

function getTaskTypeTitle(taskType: string): string {
    switch (taskType) {
        case 'merge_pdf':
            return '合并为 PDF';
        case 'image_to_pdf_batch':
            return '图片批量转 PDF';
        case 'office_to_pdf_batch':
            return 'Office 批量转 PDF';
        case 'pdf_to_image_batch':
            return 'PDF 批量转图片';
        default:
            return '批量操作';
    }
}

function getConfirmButtonText(taskType: string, config?: Record<string, any>): string {
    if (taskType === 'image_to_pdf_batch' && config?.outputMode === 'merge') {
        return '确认合并';
    }
    switch (taskType) {
        case 'merge_pdf':
            return '确认合并';
        case 'image_to_pdf_batch':
        case 'office_to_pdf_batch':
        case 'pdf_to_image_batch':
            return '确认转换';
        default:
            return '确认操作';
    }
}

function getAllowedExtensions(taskType: string): string[] {
    switch (taskType) {
        case 'merge_pdf':
            return PDF_EXTENSIONS;
        case 'image_to_pdf_batch':
            return IMAGE_EXTENSIONS;
        case 'office_to_pdf_batch':
            return OFFICE_EXTENSIONS;
        case 'pdf_to_image_batch':
            return PDF_EXTENSIONS;
        default:
            return [];
    }
}

function renderConfigOptions(
    taskType: string,
    config: Record<string, any>,
    setConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>
): React.ReactNode {
    switch (taskType) {
        case 'merge_pdf':
            return (
                <>
                    <div className="option-group">
                        <label>页面尺寸：</label>
                        <select
                            value={config.pageSize || 'original'}
                            onChange={(e) => setConfig({ ...config, pageSize: e.target.value })}
                        >
                            <option value="original">保持原格式</option>
                            <option value="A4">A4 (210 × 297 mm)</option>
                            <option value="A3">A3 (297 × 420 mm)</option>
                            <option value="Letter">Letter (8.5 × 11 in)</option>
                            <option value="Legal">Legal (8.5 × 14 in)</option>
                        </select>
                    </div>
                    {config.pageSize !== 'original' && (
                        <div className="option-group">
                            <label>页面方向：</label>
                            <select
                                value={config.orientation || 'portrait'}
                                onChange={(e) => setConfig({ ...config, orientation: e.target.value })}
                            >
                                <option value="portrait">竖向</option>
                                <option value="landscape">横向</option>
                            </select>
                        </div>
                    )}
                </>
            );

        case 'image_to_pdf_batch':
            return (
                <>
                    <div className="option-group">
                        <label>输出模式：</label>
                        <select
                            value={config.outputMode || 'single'}
                            onChange={(e) => setConfig({ ...config, outputMode: e.target.value })}
                        >
                            <option value="single">每张图片生成独立 PDF</option>
                            <option value="merge">所有图片合并为一个 PDF</option>
                        </select>
                    </div>
                    <div className="option-group">
                        <label>页面尺寸：</label>
                        <select
                            value={config.pageSize || 'A4'}
                            onChange={(e) => setConfig({ ...config, pageSize: e.target.value })}
                        >
                            <option value="A4">A4 (210 × 297 mm)</option>
                            <option value="A3">A3 (297 × 420 mm)</option>
                            <option value="Letter">Letter (8.5 × 11 in)</option>
                            <option value="FitToImage">适应图片尺寸</option>
                        </select>
                    </div>
                    {config.pageSize !== 'FitToImage' && (
                        <div className="option-group">
                            <label>页面方向：</label>
                            <select
                                value={config.orientation || 'portrait'}
                                onChange={(e) => setConfig({ ...config, orientation: e.target.value })}
                            >
                                <option value="portrait">竖向</option>
                                <option value="landscape">横向</option>
                            </select>
                        </div>
                    )}
                </>
            );

        case 'office_to_pdf_batch':
            return (
                <div className="option-group checkbox-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={config.embedFonts !== false}
                            onChange={(e) => setConfig({ ...config, embedFonts: e.target.checked })}
                        />
                        嵌入字体
                    </label>
                </div>
            );

        case 'pdf_to_image_batch':
            return (
                <>
                    <div className="option-group">
                        <label>图像类型：</label>
                        <select
                            value={config.imageType || 'auto'}
                            onChange={(e) => setConfig({ ...config, imageType: e.target.value })}
                        >
                            <option value="auto">Auto (自动)</option>
                            <option value="png">PNG</option>
                            <option value="jpg">JPG</option>
                        </select>
                    </div>
                    <div className="option-group">
                        <label>DPI：</label>
                        <select
                            value={config.dpi || 'auto'}
                            onChange={(e) => setConfig({ ...config, dpi: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value) })}
                        >
                            <option value="auto">Auto (自动)</option>
                            <option value="150">150 (标准质量)</option>
                            <option value="300">300 (高质量)</option>
                            <option value="600">600 (印刷质量)</option>
                        </select>
                    </div>
                    {config.imageType === 'jpg' && (
                        <div className="option-group">
                            <label>JPG质量：</label>
                            <select
                                value={config.jpgQuality || 90}
                                onChange={(e) => setConfig({ ...config, jpgQuality: parseInt(e.target.value) })}
                            >
                                {Array.from({ length: 10 }, (_, i) => (i + 1) * 10).map(q => (
                                    <option key={q} value={q}>{q}%</option>
                                ))}
                            </select>
                        </div>
                    )}
                </>
            );

        default:
            return null;
    }
}

export default BatchOperationModal;