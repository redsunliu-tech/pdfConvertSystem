import { useState, useEffect } from 'react';
import { ConvertHistoryItem } from '../types';
import { API_BASE_URL } from '../config';
import './History.css';

// 转换类型映射
const convertTypeMap: Record<string, string> = {
    'pdf_to_image': 'PDF转图片',
    'pdf_to_office': 'PDF转Office',
    'image_to_pdf': '图片转PDF',
    'office_to_pdf': 'Office转PDF',
};

function History() {
    const [history, setHistory] = useState<ConvertHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/convert/history`, {
                credentials: 'include',
            });
            const data = await response.json();
            if (data.success) {
                setHistory(data.data);
            } else {
                console.error('获取转换历史失败:', data.message);
            }
        } catch (error) {
            console.error('获取转换历史出错:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // 格式化时间
    const formatTime = (timeStr: string) => {
        const date = new Date(timeStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    // 获取状态显示文本
    const getStatusText = (status: string) => {
        switch (status) {
            case 'completed':
                return '✓ 成功';
            case 'failed':
                return '✗ 失败';
            case 'processing':
                return '⟳ 转换中';
            case 'pending':
                return '⏳ 等待中';
            default:
                return status;
        }
    };

    // 获取状态CSS类
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'success';
            case 'failed':
                return 'failed';
            case 'processing':
            case 'pending':
                return 'processing';
            default:
                return '';
        }
    };

    return (
        <div className="history-container">
            <h2>转换历史</h2>

            {isLoading ? (
                <div className="loading-state">加载中...</div>
            ) : history.length > 0 ? (
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>原始文件</th>
                            <th>转换类型</th>
                            <th>转换时间</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((item) => (
                            <tr key={item.taskId}>
                                <td>{item.sourceFileName}</td>
                                <td>{convertTypeMap[item.convertType] || item.convertType}</td>
                                <td>{formatTime(item.createdAt)}</td>
                                <td>
                                    <span
                                        className={`history-status ${getStatusClass(item.status)}`}
                                    >
                                        {getStatusText(item.status)}
                                    </span>
                                </td>
                                <td>
                                    {item.status === 'completed' && item.resultFileUrl && (
                                        <>
                                            {(item.convertType === 'pdf_to_image' || 
                                              item.convertType === 'image_to_pdf' || 
                                              item.convertType === 'office_to_pdf') && (
                                                <>
                                                    {item.resultFileUrl.includes('.zip') ? (
                                                        <a
                                                            href={`${API_BASE_URL}${item.resultFileUrl}/download`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="download-link"
                                                        >
                                                            下载
                                                        </a>
                                                    ) : (
                                                        <>
                                                            <a
                                                                href={`${API_BASE_URL}${item.resultFileUrl}/preview`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="view-link"
                                                            >
                                                                查看
                                                            </a>
                                                            <a
                                                                href={`${API_BASE_URL}${item.resultFileUrl}/download`}
                                                                download
                                                                className="download-link"
                                                                style={{ marginLeft: '12px' }}
                                                            >
                                                                下载
                                                            </a>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            {item.convertType === 'pdf_to_office' && (
                                                <a
                                                    href={`${API_BASE_URL}${item.resultFileUrl}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="download-link"
                                                >
                                                    下载
                                                </a>
                                            )}
                                        </>
                                    )}
                                    {item.status === 'failed' && item.message && (
                                        <span 
                                            className="error-message" 
                                            onClick={() => alert(item.message)}
                                            style={{ cursor: 'pointer' }}
                                            title={item.message}
                                        >
                                            查看错误
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="empty-state">
                    <p>暂无转换记录</p>
                </div>
            )}
        </div>
    );
}

export default History;