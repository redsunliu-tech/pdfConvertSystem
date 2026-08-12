import { useState } from 'react';
import { User } from '../types';
import { API_BASE_URL } from '../config';

interface SettingsProps {
    user: User;  // 当前用户信息
}

const AUTH_API_URL = `${API_BASE_URL}/api/auth`;

// 修改邮箱 API 调用
async function changeEmail(userId: number, password: string, newEmail: string): Promise<string> {
    const response = await fetch(`${AUTH_API_URL}/profile/${userId}/change-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password, newEmail }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '修改邮箱失败');
    }

    const result = await response.json();
    return result.message;
}

// 修改密码 API 调用
async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<string> {
    const response = await fetch(`${AUTH_API_URL}/profile/${userId}/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '修改密码失败');
    }

    const result = await response.json();
    return result.message;
}

function Settings({ user }: SettingsProps) {
    const [email, setEmail] = useState(user.email);
    const [emailPassword, setEmailPassword] = useState(''); // 验证邮箱修改时的密码
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    // 处理更新邮箱
    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setMessage('请输入有效的邮箱地址');
            setIsSuccess(false);
            return;
        }

        // 验证密码不为空
        if (!emailPassword.trim()) {
            setMessage('请输入密码以验证身份');
            setIsSuccess(false);
            return;
        }

        setLoading(true);
        try {
            const result = await changeEmail(user.id, emailPassword, email);
            setMessage(result);
            setIsSuccess(true);
            // 更新本地用户信息
            user.email = email;
            localStorage.setItem('user', JSON.stringify(user));
            setEmailPassword('');
        } catch (error) {
            setMessage((error as Error).message);
            setIsSuccess(false);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // 处理修改密码
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        // 验证密码一致性
        if (newPassword !== confirmPassword) {
            setMessage('两次输入的密码不一致');
            setIsSuccess(false);
            return;
        }

        // 验证密码长度
        if (newPassword.length < 6) {
            setMessage('密码长度至少为6位');
            setIsSuccess(false);
            return;
        }

        setLoading(true);
        try {
            const result = await changePassword(user.id, oldPassword, newPassword);
            setMessage(result);
            setIsSuccess(true);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setMessage((error as Error).message);
            setIsSuccess(false);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="settings-container">
            <h2>账户设置</h2>

            {/* 消息提示 */}
            {message && (
                <div className={`message ${isSuccess ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {/* 基本信息部分 */}
            <div className="settings-section">
                <h3>基本信息</h3>
                <div className="info-row">
                    <label>用户名</label>
                    <span className="info-value">{user.username}</span>
                </div>
                <form onSubmit={handleUpdateEmail} className="settings-form">
                    <div className="form-group">
                        <label>邮箱地址</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>输入密码以确认身份</label>
                        <input
                            type="password"
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            placeholder="请输入当前密码"
                            required
                        />
                    </div>
                    <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? '保存中...' : '保存邮箱'}
                    </button>
                </form>
            </div>

            {/* 修改密码部分 */}
            <div className="settings-section">
                <h3>修改密码</h3>
                <form onSubmit={handleChangePassword} className="settings-form">
                    <div className="form-group">
                        <label>旧密码</label>
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>新密码</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>确认密码</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? '修改中...' : '修改密码'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Settings;