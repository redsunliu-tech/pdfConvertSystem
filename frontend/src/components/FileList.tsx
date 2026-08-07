import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileItem, ConvertOptions, ConvertTask, ConvertType, BatchTaskResult } from '../types';
import { API_BASE_URL } from '../config';
import './FileList.css';
import BatchOperationModal from './BatchOperationModal';
interface FileListProps {
    onNavigate: (path: Array<{label: string, action?: () => void}>) => void;
}

type BatchTaskType = 'merge_pdf' | 'image_to_pdf_batch' | 'office_to_pdf_batch' | 'pdf_to_image_batch' | null;

const CONVERT_TYPE_OPTIONS: Array<{value: ConvertType, label: string, description: string}> = [
    { value: 'pdf_to_image', label: 'PDF转图片', description: '将PDF文件转换为图片格式' },
    { value: 'pdf_to_office', label: 'PDF转Office', description: '将PDF转换为Word、Excel或PowerPoint' },
    { value: 'image_to_pdf', label: '图片转PDF', description: '将图片转换为PDF文件' },
    { value: 'office_to_pdf', label: 'Office转PDF', description: '将Office文档转换为PDF' },
];

function FileList({ onNavigate }: FileListProps) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    
    const [showConvertPanel, setShowConvertPanel] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [convertType, setConvertType] = useState<ConvertType | null>(null);
    const [convertOptions, setConvertOptions] = useState<ConvertOptions>({});
    const [currentTask, setCurrentTask] = useState<ConvertTask | null>(null);
    const pollingTimerRef = useRef<number | null>(null);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchTaskType, setBatchTaskType] = useState<BatchTaskType>(null);
    const [showBatchResult, setShowBatchResult] = useState(false);
    const [batchResult, setBatchResult] = useState<BatchTaskResult | null>(null);
    const batchPollTimerRef = useRef<number | null>(null);

    const fetchFiles = useCallback(async (signal?: AbortSignal) => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/files`, {
                credentials: 'include',
                signal, // 传入 signal 用于取消请求
            });
            // 1. 检查 HTTP 状态码
            if (!response.ok) {
                console.error(`请求失败: ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                setFiles(data.data);
            } else {
                console.error('获取文件列表失败:', data.message);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('获取文件列表出错:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void fetchFiles(controller.signal);
        // 4. 清理函数：组件卸载时取消请求
        return () => {
            controller.abort();
        };
    }, []);

    useEffect(() => {
        return () => {
            if (pollingTimerRef.current) {
                clearInterval(pollingTimerRef.current);
            }
            if (batchPollTimerRef.current) {
                clearInterval(batchPollTimerRef.current);
            }
        };
    }, []);

    const formatFileSize = (bytes: number): string => {
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(2) + ' MB';
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();

            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            const url = files.length > 1
                ? `${API_BASE_URL}/api/files/upload/batch`
                : `${API_BASE_URL}/api/files/upload`;

            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const data = await response.json();
            if (data.success) {
                await fetchFiles();
                const count = files.length > 1 ? `${files.length} 个` : '1 个';
                setMessage(`成功上传 ${count} 文件`);
            } else {
                setMessage(data.message || '上传失败');
            }
        } catch (error) {
            setMessage('上传失败: ' + (error as Error).message);
        } finally {
            setUploading(false);
            // 无论成功还是失败，都清空文件输入框，防止重复选择同一文件不触发onChange
            event.target.value = '';
        }
    };

    const getAvailableConvertTypes = (file: FileItem): ConvertType[] => {
        const fileType = file.fileType?.toUpperCase();
        const types: ConvertType[] = [];

        if (fileType === 'PDF') {
            types.push('pdf_to_image', 'pdf_to_office');
        } else if (['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP'].includes(fileType)) {
            types.push('image_to_pdf');
        } else if (['DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX'].includes(fileType)) {
            types.push('office_to_pdf');
        }

        return types;
    };

    // 根据转换类型获取默认选项
    const getDefaultOptions = (type: ConvertType | null): ConvertOptions => {
        const options: ConvertOptions = {};
        if (type === 'pdf_to_image') {
            options.imageType = 'auto';
            options.dpi = 'auto';
            options.jpgQuality = 90;
        } else if (type === 'pdf_to_office') {
            options.officeFormat = 'docx';
        } else if (type === 'image_to_pdf') {
            options.pageSize = 'A4';
            options.orientation = 'portrait';
        } else if (type === 'office_to_pdf') {
            options.embedFonts = true;
        }
        return options;
    };

    const handleOpenConvertPanel = (file: FileItem) => {
        const availableTypes = getAvailableConvertTypes(file);
        if (availableTypes.length === 0) {
            alert('该文件类型不支持转换');
            return;
        }

        setSelectedFile(file);
        setConvertType(availableTypes[0]);
        setShowConvertPanel(true);
        setCurrentTask(null);
        setConvertOptions(getDefaultOptions(availableTypes[0]));
    };

    const handleCloseConvertPanel = useCallback(() => {
        setShowConvertPanel(false);
        setSelectedFile(null);
        setConvertType(null);
        setConvertOptions({});
        setCurrentTask(null);
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }
        if (onNavigate) {
            onNavigate([{ label: '首页' }, { label: '我的文件' }]);
        }
    }, [onNavigate]);

    // 面包屑由 showConvertPanel 和 currentTask 状态推导，无需手动维护
    const breadcrumb = useMemo(() => {
        if (!showConvertPanel) {
            return [];
        }

        const items: Array<{label: string, action?: () => void}> = [
            { label: '文件列表', action: handleCloseConvertPanel }
        ];

        if (!currentTask) {
            items.push({ label: '转换设置' });
        } else if (currentTask.status === 'processing' || currentTask.status === 'pending') {
            items.push({ label: '转换进度' });
        } else {
            items.push({ label: '转换结果' });
        }

        return items;
    }, [showConvertPanel, currentTask, handleCloseConvertPanel]);

    const handleStartConvert = async () => {
        if (!selectedFile || !convertType) return;

        // 安全过滤：移除null和undefined的值，避免类型强制断言
        const filteredOptions = Object.fromEntries(
            Object.entries(convertOptions).filter(([_, value]) => value !== null && value !== undefined)
        ) as ConvertOptions;

        try {
            const response = await fetch(`${API_BASE_URL}/api/convert/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    fileId: selectedFile.id,
                    convertType: convertType,
                    options: filteredOptions,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setCurrentTask(data.data);
                startPolling(data.data.taskId);
            } else {
                setMessage(data.message || '启动转换失败');
            }
        } catch (error) {
            setMessage('启动转换失败: ' + (error as Error).message);
        }
    };

    const startPolling = (taskId: number) => {
        // 启动新轮询前，先销毁旧的轮询定时器，防止并行请求
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }

        const timer = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/convert/status/${taskId}`, {
                    credentials: 'include',
                });
                const data = await response.json();
                
                if (data.success) {
                    setCurrentTask(data.data);
                    
                    if (data.data.status === 'completed' || data.data.status === 'failed') {
                        clearInterval(timer);
                        pollingTimerRef.current = null;
                    }
                }
            } catch (error) {
                console.error('获取转换状态失败:', error);
            }
        }, 2000);
        
        pollingTimerRef.current = timer;
    };

    const handleViewResult = () => {
        if (currentTask?.resultFileUrl) {
            const fullUrl = API_BASE_URL + currentTask.resultFileUrl + '/preview';
            window.open(fullUrl, '_blank');
        }
    };

    const handleDelete = async (fileId: string) => {
        if (!confirm('确定要删除该文件吗？')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const data = await response.json();
            if (data.success) {
                setFiles((prev) => prev.filter((file) => file.id !== fileId));
                setMessage('文件删除成功');
            } else {
                setMessage('删除失败: ' + data.message);
            }
        } catch (error) {
            setMessage('删除失败，请稍后重试');
            console.error('删除出错:', error);
        } finally {
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const startBatchTaskPolling = (taskId: string) => {
        if (batchPollTimerRef.current) {
            clearInterval(batchPollTimerRef.current);
        }

        batchPollTimerRef.current = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/convert/batch/${taskId}`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (data.success) {
                    setBatchResult(data.data);
                    if (data.data.status === 'completed' || data.data.status === 'failed') {
                        if (batchPollTimerRef.current) {
                            clearInterval(batchPollTimerRef.current);
                            batchPollTimerRef.current = null;
                        }
                        setMessage(`批量任务完成，成功 ${data.data.successCount} 个，失败 ${data.data.failCount} 个`);
                        setShowBatchResult(true);
                        await fetchFiles();
                        setTimeout(() => setMessage(''), 5000);
                    }
                }
            } catch (error) {
                console.error('轮询批量任务状态失败:', error);
            }
        }, 2000);
    };

    const handleDownload = (file: FileItem) => {
        let downloadFileUrl = file.fileUrl + '/download';
        if (file.fileUrl) {
            window.open(downloadFileUrl, '_blank');
        } else {
            alert('文件下载链接不可用');
        }
    };

    const IMAGE_EXTENSIONS = ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP'];
    const PDF_EXTENSIONS = ['PDF'];
    const OFFICE_EXTENSIONS = ['DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX'];

    const handleSelectFile = (fileId: string, checked: boolean) => {
        setSelectedFileIds(prev => {
            const next = new Set(prev);
            if (checked) {
                next.add(fileId);
            } else {
                next.delete(fileId);
            }
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedFileIds(new Set(files.map(f => f.id)));
        } else {
            setSelectedFileIds(new Set());
        }
    };

    const getSelectedFiles = (): FileItem[] => {
        return files.filter(f => selectedFileIds.has(f.id));
    };

    const validateFileTypes = (fileTypes: (string | undefined)[], allowed: string[]): boolean => {
        return fileTypes.every(type => allowed.includes((type ?? '').toUpperCase()));
    };

    const handleBatchOperation = (taskType: BatchTaskType) => {
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            alert('请先选择文件');
            return;
        }

        const fileTypes = selectedFiles.map(f => f.fileType);

        switch (taskType) {
            case 'merge_pdf':
                if (!validateFileTypes(fileTypes, PDF_EXTENSIONS)) {
                    alert('请仅选择PDF文件进行合并操作');
                    return;
                }
                break;
            case 'image_to_pdf_batch':
                if (!validateFileTypes(fileTypes, IMAGE_EXTENSIONS)) {
                    alert('当前选中包含非图片文件，请仅选择图片使用该功能');
                    return;
                }
                break;
            case 'office_to_pdf_batch':
                if (!validateFileTypes(fileTypes, OFFICE_EXTENSIONS)) {
                    alert('仅支持Word、Excel、PPT文档批量转PDF');
                    return;
                }
                break;
            case 'pdf_to_image_batch':
                if (!validateFileTypes(fileTypes, PDF_EXTENSIONS)) {
                    alert('请仅选择PDF文件进行操作');
                    return;
                }
                break;
        }

        setBatchTaskType(taskType);
        setShowBatchModal(true);
    };

    const handleBatchConfirm = async (fileIds: string[], config: Record<string, any>) => {
        setShowBatchModal(false);
        setSelectedFileIds(new Set());

        try {
            const response = await fetch(`${API_BASE_URL}/api/convert/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    taskType: batchTaskType,
                    fileIdList: fileIds,
                    config: config,
                }),
            });

            const data = await response.json();
            if (data.success) {
                const taskId = data.data.taskId;
                setMessage(`批量任务已提交，正在处理中...`);
                startBatchTaskPolling(taskId);
            } else {
                setMessage(data.message || '批量任务提交失败');
            }
        } catch (error) {
            setMessage('批量任务提交失败: ' + (error as Error).message);
        }
    };

    const isMixedSelection = (): boolean => {
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length <= 1) return false;

        const hasImage = selectedFiles.some(f => IMAGE_EXTENSIONS.includes(f.fileType?.toUpperCase() || ''));
        const hasPdf = selectedFiles.some(f => PDF_EXTENSIONS.includes(f.fileType?.toUpperCase() || ''));
        const hasOffice = selectedFiles.some(f => OFFICE_EXTENSIONS.includes(f.fileType?.toUpperCase() || ''));

        return (hasImage && hasPdf) || (hasImage && hasOffice) || (hasPdf && hasOffice);
    };

    const getStatusBadge = (status: FileItem['status']) => {
        const badges = {
            uploaded: { text: '已上传', className: 'status-uploaded' },
            processing: { text: '转换中', className: 'status-processing' },
            completed: { text: '已完成', className: 'status-completed' },
            failed: { text: '失败', className: 'status-failed' },
        };
        const badge = badges[status];
        return (
            <span className={`status-badge ${badge.className}`}>{badge.text}</span>
        );
    };

    const handleView = (file: FileItem) => {
        const previewFileUrl = file.fileUrl + '/preview';
        if (!file.fileUrl) {
            alert('文件链接不可用');
            return;
        }

        const fileType = file.fileType?.toUpperCase();

        const imageTypes = ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP', 'SVG'];
        if (imageTypes.includes(fileType)) {
            window.open(previewFileUrl, '_blank');
            return;
        }

        if (fileType === 'PDF') {
            window.open(previewFileUrl, '_blank');
            return;
        }
        
        window.open(file.fileUrl+'/download', '_blank');
    };

    const renderConvertTypeSelector = () => {
        if (!selectedFile) return null;
        
        const availableTypes = getAvailableConvertTypes(selectedFile);
        
        if (availableTypes.length === 1) {
            return null;
        }

        return (
            <div className="option-group">
                <label>转换类型：</label>
                <select 
                    value={convertType || ''} 
                    onChange={(e) => {
                    const newType = e.target.value as ConvertType;
                    setConvertType(newType);
                    setConvertOptions(getDefaultOptions(newType));
                }}
                >
                    {availableTypes.map(type => {
                        const option = CONVERT_TYPE_OPTIONS.find(opt => opt.value === type);
                        return (
                            <option key={type} value={type}>
                                {option?.label || type}
                            </option>
                        );
                    })}
                </select>
            </div>
        );
    };

    const renderConvertOptions = () => {
        if (!convertType) return null;

        if (convertType === 'pdf_to_image') {
            return (
                <div className="convert-options">
                    <h3>PDF转图片选项</h3>
                    
                    <div className="option-group">
                        <label>图像类型：</label>
                        <select
                            value={convertOptions.imageType || 'auto'}
                            onChange={(e) => setConvertOptions({...convertOptions, imageType: e.target.value})}
                        >
                            <option value="auto">Auto (自动)</option>
                            <option value="png">PNG</option>
                            <option value="jpg">JPG</option>
                        </select>
                    </div>

                    {convertOptions.imageType === 'jpg' && (
                        <div className="option-group">
                            <label>JPG质量：</label>
                            <select
                                value={convertOptions.jpgQuality || 'original'}
                                onChange={(e) => setConvertOptions({...convertOptions, jpgQuality: e.target.value === 'original' ? undefined : parseInt(e.target.value)})}
                            >
                                <option value="original">Original (原始质量)</option>
                                {Array.from({ length: 10 }, (_, i) => (i + 1) * 10).map(q => (
                                    <option key={q} value={q}>{q}%</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="option-group">
                        <label>DPI：</label>
                        <select
                            value={convertOptions.dpi || 'auto'}
                            onChange={(e) => setConvertOptions({...convertOptions, dpi: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value)})}
                        >
                            <option value="auto">Auto (自动)</option>
                            <option value="72">72 (屏幕显示)</option>
                            <option value="150">150 (标准质量)</option>
                            <option value="300">300 (高质量)</option>
                            <option value="600">600 (印刷质量)</option>
                        </select>
                    </div>
                </div>
            );
        }

        if (convertType === 'pdf_to_office') {
            return (
                <div className="convert-options">
                    <h3>PDF转Office</h3>
                    <div style={{padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '12px', border: '1px solid #ffc107'}}>
                        <p style={{margin: 0, color: '#856404'}}>⚠️ 提示：PDF 转 Office 功能正在优化中，暂不可用。预计近期完成升级，敬请期待。</p>
                    </div>
                    
                    <div className="option-group">
                        <label>输出格式：</label>
                        <select disabled>
                            <option value="docx" disabled>Word (.docx) - 暂不支持</option>
                            <option value="xlsx" disabled>Excel (.xlsx) - 暂不支持</option>
                            <option value="pptx" disabled>PowerPoint (.pptx) - 暂不支持</option>
                        </select>
                    </div>
                </div>
            );
        }

        if (convertType === 'image_to_pdf') {
            return (
                <div className="convert-options">
                    <h3>图片转PDF选项</h3>

                    <div className="option-group">
                        <label>页面尺寸：</label>
                        <select 
                            value={convertOptions.pageSize || 'A4'}
                            onChange={(e) => setConvertOptions({...convertOptions, pageSize: e.target.value})}
                        >
                            <option value="A4">A4 (210 × 297 mm)</option>
                            <option value="A3">A3 (297 × 420 mm)</option>
                            <option value="Letter">Letter (8.5 × 11 in)</option>
                            <option value="Legal">Legal (8.5 × 14 in)</option>
                            <option value="FitToImage">适应图片尺寸</option>
                        </select>
                    </div>

                    {convertOptions.pageSize !== 'FitToImage' && (
                        <div className="option-group">
                            <label>页面方向：</label>
                            <select
                                value={convertOptions.orientation || 'portrait'}
                                onChange={(e) => setConvertOptions({...convertOptions, orientation: e.target.value})}
                            >
                                <option value="portrait">竖向 (Portrait)</option>
                                <option value="landscape">横向 (Landscape)</option>
                            </select>
                        </div>
                    )}
                </div>
            );
        }

        if (convertType === 'office_to_pdf') {
            return (
                <div className="convert-options">
                    <h3>Office转PDF选项</h3>
                    
                    <div className="option-group checkbox-group">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={convertOptions.embedFonts !== false}
                                onChange={(e) => setConvertOptions({...convertOptions, embedFonts: e.target.checked})}
                            />
                            嵌入字体
                        </label>
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderConvertProgress = () => {
        if (!currentTask) return null;

        const statusText = {
            pending: '等待处理...',
            processing: '转换中...',
            completed: '转换完成！',
            failed: '转换失败',
        };

        return (
            <div className="convert-progress">
                <h3>转换进度</h3>
                <div className={`status-indicator status-${currentTask.status}`}>
                    {statusText[currentTask.status]}
                </div>
                
                {currentTask.status === 'processing' && (
                    <div className="loading-spinner"></div>
                )}

                {currentTask.status === 'completed' && (
                    <div className="result-actions">
                        <button className="action-btn view-btn" onClick={handleViewResult}>
                            查看结果
                        </button>
                        <button className="action-btn" onClick={handleCloseConvertPanel}>
                            返回文件列表
                        </button>
                    </div>
                )}

                {currentTask.status === 'failed' && (
                    <div className="error-message">
                        {currentTask.message || '转换失败，请稍后重试'}
                    </div>
                )}
            </div>
        );
    };

    const renderBreadcrumb = () => {
        return (
            <div className="breadcrumb">
                {breadcrumb.map((item, index) => (
                    <span key={index} className="breadcrumb-item">
                        {item.action ? (
                            <button className="breadcrumb-link" onClick={item.action}>
                                {item.label}
                            </button>
                        ) : (
                            <span className="breadcrumb-current">{item.label}</span>
                        )}
                        {index < breadcrumb.length - 1 && <span className="breadcrumb-separator"> / </span>}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="file-list-container">
            {message && (
                <div className={`message ${message.includes('成功') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {showConvertPanel && renderBreadcrumb()}

            {showConvertPanel ? (
                <div className="convert-panel">
                    {!currentTask ? (
                        <>
                            <div className="convert-header">
                                <h2>转换设置</h2>
                                <button className="close-btn" onClick={handleCloseConvertPanel}>
                                    ✕
                                </button>
                            </div>
                            
                            <div className="convert-info">
                                <p><strong>文件：</strong>{selectedFile?.fileName}</p>
                                <p><strong>文件类型：</strong>{selectedFile?.fileType}</p>
                            </div>

                            {renderConvertTypeSelector()}
                            {renderConvertOptions()}

                            <div className="convert-actions">
                                <button 
                                    className="action-btn convert-btn" 
                                    onClick={handleStartConvert}
                                    disabled={convertType === 'pdf_to_office'}
                                    style={convertType === 'pdf_to_office' ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
                                >
                                    开始转换
                                </button>
                                <button className="action-btn" onClick={handleCloseConvertPanel}>
                                    取消
                                </button>
                            </div>
                        </>
                    ) : (
                        renderConvertProgress()
                    )}
                </div>
            ) : (
                <>
                    <div className="file-list-header">
                        <h2>我的文件</h2>
                        <label className="upload-btn">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,.ods,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.ppt,.pptx,.zip,.rar,.7z"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                disabled={uploading}
                                multiple
                            />
                            {uploading ? '上传中...' : '上传文件'}
                        </label>
                    </div>

                    {isLoading ? (
                        <div className="loading-state">加载中...</div>
                    ) : (
                        <>
                            {selectedFileIds.size > 0 && (
                                <div className="batch-toolbar">
                                    <div className="batch-selection-info">
                                        已选中 {selectedFileIds.size} 个文件
                                        {isMixedSelection() && (
                                            <span className="batch-mixed-tip">
                                                文件格式混杂，批量功能将无法正常使用
                                            </span>
                                        )}
                                    </div>
                                    <div className="batch-action-buttons">
                                        <button
                                            className="batch-btn batch-btn-image"
                                            onClick={() => handleBatchOperation('image_to_pdf_batch')}
                                            disabled={selectedFileIds.size === 0}
                                        >
                                            图片转PDF
                                        </button>
                                        <button
                                            className="batch-btn batch-btn-pdf"
                                            onClick={() => handleBatchOperation('merge_pdf')}
                                            disabled={selectedFileIds.size === 0}
                                        >
                                            合并为PDF
                                        </button>
                                        <button
                                            className="batch-btn batch-btn-pdf"
                                            onClick={() => handleBatchOperation('pdf_to_image_batch')}
                                            disabled={selectedFileIds.size === 0}
                                        >
                                            PDF转图片
                                        </button>
                                        <button
                                            className="batch-btn batch-btn-office"
                                            onClick={() => handleBatchOperation('office_to_pdf_batch')}
                                            disabled={selectedFileIds.size === 0}
                                        >
                                            Office转PDF
                                        </button>
                                    </div>
                                </div>
                            )}
                            {files.length > 0 ? (
                                <table className="file-table">
                                    <thead>
                                    <tr>
                                        <th className="select-all-cell">
                                            <input
                                                type="checkbox"
                                                checked={selectedFileIds.size === files.length && files.length > 0}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <th>文件名</th>
                                        <th>大小</th>
                                        <th>类型</th>
                                        <th>上传时间</th>
                                        <th>状态</th>
                                        <th>操作</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {files.map((file) => {
                                        const availableTypes = getAvailableConvertTypes(file);
                                        const isSelected = selectedFileIds.has(file.id);
                                        return (
                                            <tr key={file.id} className={isSelected ? 'file-row-selected' : ''}>
                                                <td className="select-all-cell">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => handleSelectFile(file.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td>{file.fileName}</td>
                                                <td>{formatFileSize(file.fileSize)}</td>
                                                <td>{file.fileType}</td>
                                                <td>{file.uploadTime?.replace('T', ' ').substring(0, 19)}</td>
                                                <td>{getStatusBadge(file.status)}</td>
                                                <td>
                                                    <button
                                                        className="action-btn convert-btn"
                                                        onClick={() => handleOpenConvertPanel(file)}
                                                        disabled={availableTypes.length === 0 || file.status === 'processing'}
                                                        title={availableTypes.length === 0 ? '不支持转换' : '转换'}
                                                    >
                                                        转换
                                                    </button>
                                                    <button
                                                        className="action-btn download-btn"
                                                        onClick={() => handleDownload(file)}
                                                        disabled={!file.fileUrl}
                                                    >
                                                        下载
                                                    </button>
                                                    <button
                                                        className="action-btn view-btn"
                                                        onClick={() => handleView(file)}
                                                        disabled={!file.fileUrl}
                                                        title={`查看 ${file.fileName}`}
                                                    >
                                                        查看
                                                    </button>
                                                    <button
                                                        className="action-btn delete-btn"
                                                        onClick={() => handleDelete(file.id)}
                                                    >
                                                        删除
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <p>暂无文件，请点击"上传文件"按钮上传文件</p>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            <BatchOperationModal
                visible={showBatchModal}
                taskType={batchTaskType!}
                selectedFiles={getSelectedFiles()}
                allFiles={files}
                onClose={() => {
                    setShowBatchModal(false);
                    setBatchTaskType(null);
                }}
                onConfirm={handleBatchConfirm}
            />

            {showBatchResult && batchResult && (
                <div className="batch-result-overlay" onClick={() => setShowBatchResult(false)}>
                    <div className="batch-result-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="batch-result-header">
                            <h3>批量任务结果</h3>
                            <button className="batch-result-close" onClick={() => setShowBatchResult(false)}>✕</button>
                        </div>
                        <div className="batch-result-summary">
                            <span>总数：{batchResult.totalCount}</span>
                            <span className="batch-success-count">成功：{batchResult.successCount}</span>
                            <span className="batch-fail-count">失败：{batchResult.failCount}</span>
                            {batchResult.taskResultFileUrl && (
                                <a href={API_BASE_URL + batchResult.taskResultFileUrl + '/download'} target="_blank" rel="noopener noreferrer" className="batch-result-download-all">
                                    下载合并文件
                                </a>
                            )}
                        </div>
                        <div className="batch-result-list">
                            {batchResult.taskResultFileUrl ? (
                                // 合并模式：只显示合并后的PDF
                                <div className="batch-result-item completed">
                                    <span className="batch-result-index">1</span>
                                    <span className="batch-result-name" title="合并后的PDF">合并后的PDF</span>
                                    <a href={API_BASE_URL + batchResult.taskResultFileUrl + '/download'} target="_blank" rel="noopener noreferrer" className="batch-result-download">
                                        下载
                                    </a>
                                </div>
                            ) : (
                                // 非合并模式：显示每个文件的处理结果
                                batchResult.items?.map((item, index) => (
                                    <div key={index} className={`batch-result-item ${item.status}`}>
                                        <span className="batch-result-index">{index + 1}</span>
                                        <span className="batch-result-name" title={item.sourceFileName}>{item.sourceFileName}</span>
                                        {item.status === 'completed' ? (
                                            item.resultFileUrl && (
                                                <a href={API_BASE_URL + item.resultFileUrl + '/download'} target="_blank" rel="noopener noreferrer" className="batch-result-download">
                                                    下载
                                                </a>
                                            )
                                        ) : item.status === 'failed' ? (
                                            <span className="batch-result-error" title={item.errorMessage}>失败：{item.errorMessage}</span>
                                        ) : (
                                            <span className="batch-result-processing">处理中...</span>
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

export default FileList;