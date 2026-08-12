import { useState, useRef, useCallback, useEffect } from 'react';
import { StoredSignature, getAllSignatures, saveSignature, deleteSignature, updateSignatureName } from '../utils/signatureStorage';

interface SignaturePadProps {
    onSignatureSaved: (imageData: string) => void;
    onClose: () => void;
}

function SignaturePad({ onSignatureSaved, onClose }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const [penColor, setPenColor] = useState('#000000');
    const [penSize, setPenSize] = useState(3);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [savedSignatures, setSavedSignatures] = useState<StoredSignature[]>([]);
    const [activeTab, setActiveTab] = useState<'draw' | 'library'>('draw');
    const [sigName, setSigName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const penColorRef = useRef(penColor);
    const penSizeRef = useRef(penSize);
    useEffect(() => { penColorRef.current = penColor; }, [penColor]);
    useEffect(() => { penSizeRef.current = penSize; }, [penSize]);

    useEffect(() => {
        void loadSignatures();
    }, []);

    const loadSignatures = async () => {
        try {
            const sigs = await getAllSignatures();
            setSavedSignatures(sigs);
        } catch (e) {
            console.error('加载签名库失败', e);
        }
    };

    const setupCanvasEvents = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return () => {};

        const handleMouseDown = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const point = {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
            isDrawingRef.current = true;
            lastPointRef.current = point;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDrawingRef.current || !lastPointRef.current) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const point = {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
            ctx.strokeStyle = penColorRef.current;
            ctx.lineWidth = penSizeRef.current;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            lastPointRef.current = point;
        };

        const handleMouseUp = () => {
            isDrawingRef.current = false;
            lastPointRef.current = null;
        };

        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const t = e.touches[0];
            const point = {
                x: (t.clientX - rect.left) * scaleX,
                y: (t.clientY - rect.top) * scaleY,
            };
            isDrawingRef.current = true;
            lastPointRef.current = point;
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (!isDrawingRef.current || !lastPointRef.current) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const t = e.touches[0];
            const point = {
                x: (t.clientX - rect.left) * scaleX,
                y: (t.clientY - rect.top) * scaleY,
            };
            ctx.strokeStyle = penColorRef.current;
            ctx.lineWidth = penSizeRef.current;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            lastPointRef.current = point;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            isDrawingRef.current = false;
            lastPointRef.current = null;
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    useEffect(() => {
        const cleanup = setupCanvasEvents();
        return cleanup;
    }, [setupCanvasEvents]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSigName('');
    }, []);

    const saveToLibrary = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const imageData = canvas.toDataURL('image/png');
        let name = sigName.trim();
        if (!name) {
            const input = prompt('请输入签名名称', '');
            if (input === null) return;
            name = input.trim();
            if (!name) return;
        }
        try {
            await saveSignature(name, imageData);
            setSigName('');
            await loadSignatures();
            alert('签名已保存到库');
        } catch (e) {
            console.error('保存签名失败', e);
            alert('保存失败');
        }
    }, [sigName]);

    const useSignature = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const imageData = canvas.toDataURL('image/png');
        onSignatureSaved(imageData);
    }, [onSignatureSaved]);

    const useFromLibrary = useCallback((sig: StoredSignature) => {
        onSignatureSaved(sig.imageData);
    }, [onSignatureSaved]);

    const handleDeleteSig = useCallback(async (id: string) => {
        if (!confirm('确定删除该签名吗？')) return;
        try {
            await deleteSignature(id);
            await loadSignatures();
        } catch (e) {
            console.error('删除签名失败', e);
        }
    }, []);

    const handleRenameSig = useCallback(async (id: string) => {
        if (!editingName.trim()) {
            setEditingId(null);
            return;
        }
        try {
            await updateSignatureName(id, editingName.trim());
            setEditingId(null);
            setEditingName('');
            await loadSignatures();
        } catch (e) {
            console.error('重命名失败', e);
        }
    }, [editingName]);

    const uploadSignatureImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target?.result as string;
            if (imageData) {
                onSignatureSaved(imageData);
            }
        };
        reader.onerror = () => {
            alert('读取图片失败');
        };
        reader.readAsDataURL(file);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <h3 style={{ margin: 0 }}>签名管理</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#666'
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                    borderBottom: '2px solid #eee',
                }}>
                    <button
                        onClick={() => setActiveTab('draw')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: activeTab === 'draw' ? '#007bff' : 'transparent',
                            color: activeTab === 'draw' ? '#fff' : '#666',
                            border: 'none',
                            borderBottom: activeTab === 'draw' ? '2px solid #007bff' : '2px solid transparent',
                            marginBottom: '-2px',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'draw' ? 'bold' : 'normal',
                        }}
                    >
                        手写签名
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: activeTab === 'library' ? '#007bff' : 'transparent',
                            color: activeTab === 'library' ? '#fff' : '#666',
                            border: 'none',
                            borderBottom: activeTab === 'library' ? '2px solid #007bff' : '2px solid transparent',
                            marginBottom: '-2px',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'library' ? 'bold' : 'normal',
                        }}
                    >
                        签名库 ({savedSignatures.length})
                    </button>
                </div>

                {activeTab === 'draw' && (
                    <>
                        <div style={{
                            border: '2px solid #ddd',
                            borderRadius: '4px',
                            backgroundColor: '#fff',
                            marginBottom: '16px'
                        }}>
                            <canvas
                                ref={canvasRef}
                                width={550}
                                height={300}
                                style={{
                                    width: '100%',
                                    cursor: 'crosshair',
                                    display: 'block',
                                    touchAction: 'none'
                                }}
                            />
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            marginBottom: '16px',
                            alignItems: 'center'
                        }}>
                            <div>
                                <label style={{ marginRight: '8px', fontSize: '14px' }}>笔颜色:</label>
                                <input
                                    type="color"
                                    value={penColor}
                                    onChange={(e) => setPenColor(e.target.value)}
                                    style={{ width: '40px', height: '30px', border: 'none', cursor: 'pointer' }}
                                />
                            </div>
                            <div>
                                <label style={{ marginRight: '8px', fontSize: '14px' }}>笔粗细:</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={penSize}
                                    onChange={(e) => setPenSize(Number(e.target.value))}
                                    style={{ width: '100px' }}
                                />
                                <span style={{ marginLeft: '8px', fontSize: '14px' }}>{penSize}px</span>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            marginBottom: '16px',
                            alignItems: 'center'
                        }}>
                            <input
                                type="text"
                                value={sigName}
                                onChange={(e) => setSigName(e.target.value)}
                                placeholder="签名名称（用于保存到库）"
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={saveToLibrary}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#17a2b8',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                保存到库
                            </button>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={clearCanvas}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6c757d',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                清空
                            </button>
                            <label
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#17a2b8',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'inline-block'
                                }}
                            >
                                上传图片
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={uploadSignatureImage}
                                    style={{ display: 'none' }}
                                />
                            </label>
                            <button
                                onClick={useSignature}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#28a745',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                使用签名
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'library' && (
                    <>
                        {savedSignatures.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: '#999',
                            }}>
                                <p style={{ fontSize: '16px', marginBottom: '8px' }}>签名库为空</p>
                                <p style={{ fontSize: '14px' }}>请切换到「手写签名」创建并保存签名</p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '12px',
                            }}>
                                {savedSignatures.map((sig) => (
                                    <div
                                        key={sig.id}
                                        style={{
                                            border: '2px solid #eee',
                                            borderRadius: '6px',
                                            padding: '10px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            backgroundColor: '#f9f9f9',
                                        }}
                                    >
                                        <div style={{
                                            width: '100%',
                                            height: '80px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#fff',
                                            borderRadius: '4px',
                                            marginBottom: '8px',
                                            border: '1px solid #eee',
                                        }}>
                                            <img
                                                src={sig.imageData}
                                                alt={sig.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '70px',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        </div>
                                        {editingId === sig.id ? (
                                            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    style={{
                                                        width: '100px',
                                                        padding: '4px',
                                                        fontSize: '12px',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '3px',
                                                    }}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleRenameSig(sig.id)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        backgroundColor: '#28a745',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '3px',
                                                        cursor: 'pointer',
                                                    }}
                                                >✓</button>
                                                <button
                                                    onClick={() => { setEditingId(null); setEditingName(''); }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        backgroundColor: '#6c757d',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '3px',
                                                        cursor: 'pointer',
                                                    }}
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <div
                                                onDoubleClick={() => { setEditingId(sig.id); setEditingName(sig.name); }}
                                                style={{
                                                    fontSize: '13px',
                                                    color: '#333',
                                                    marginBottom: '8px',
                                                    cursor: 'pointer',
                                                    maxWidth: '100%',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    textAlign: 'center',
                                                }}
                                                title="双击重命名"
                                            >
                                                {sig.name}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                                            <button
                                                onClick={() => useFromLibrary(sig)}
                                                style={{
                                                    flex: 1,
                                                    padding: '5px',
                                                    fontSize: '12px',
                                                    backgroundColor: '#28a745',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                }}
                                            >使用</button>
                                            <button
                                                onClick={() => handleDeleteSig(sig.id)}
                                                style={{
                                                    padding: '5px 8px',
                                                    fontSize: '12px',
                                                    backgroundColor: '#dc3545',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                }}
                                            >删除</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default SignaturePad;