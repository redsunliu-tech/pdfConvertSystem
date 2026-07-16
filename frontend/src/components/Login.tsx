import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LoginRequest } from '../types';
import './Login.css';

interface LoginProps {
    onLogin: (userData: User) => void;
}

function Login({ onLogin }: LoginProps) {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [captcha, setCaptcha] = useState('');
    const [captchaUuid, setCaptchaUuid] = useState('');
    const [captchaImage, setCaptchaImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            await loadCaptcha();
        })();
    }, []);

    const loadCaptcha = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/captcha', {
                credentials: 'include'
            });
            const data = await response.json();
            setCaptchaUuid(data.uuid);
            setCaptchaImage(data.image);
            setCaptcha('');
        } catch (err) {
            console.error('获取验证码失败:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const loginRequest: LoginRequest = {
                username,
                password,
                captcha,
                captchaUuid
            };

            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginRequest),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                const userData: User = {
                    id: data.id,
                    username: data.username,
                    email: data.email
                };
                localStorage.setItem('user', JSON.stringify(userData));
                onLogin(userData);
                navigate('/');
            } else {
                setError(data.message || '登录失败');
                await loadCaptcha();
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
        }
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleSubmit}>
                <h2>用户登录</h2>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label>用户名</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>密码</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        required
                    />
                </div>

                <div className="form-group captcha-group">
                    <label>验证码</label>
                    <div className="captcha-row">
                        <input
                            type="text"
                            value={captcha}
                            onChange={(e) => setCaptcha(e.target.value)}
                            placeholder="请输入验证码"
                            maxLength={4}
                            required
                        />
                        <img
                            src={captchaImage ?? undefined}
                            alt="验证码"
                            className="captcha-image"
                            onClick={loadCaptcha}
                            title="点击刷新"
                        />
                    </div>
                </div>

                <button type="submit" className="login-btn">
                    登录
                </button>

                <p className="register-link">
                    还没有账号？<Link to="/register">立即注册</Link>
                </p>
            </form>
        </div>
    );
}

export default Login;