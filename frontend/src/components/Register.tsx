import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, RegisterRequest } from '../types';
import './Register.css';

interface RegisterProps {
    onRegister: (userData: User) => void;
}

function Register({ onRegister }: RegisterProps) {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        if (password.length < 6) {
            setError('密码长度不能少于6位');
            return;
        }

        try {
            const registerRequest: RegisterRequest = {
                username,
                password,
                email
            };

            const response = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(registerRequest),
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
                onRegister(userData);
                navigate('/');
            } else {
                setError(data.message || '注册失败');
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
        }
    };

    return (
        <div className="register-container">
            <form className="register-form" onSubmit={handleSubmit}>
                <h2>用户注册</h2>

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
                    <label>邮箱</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="请输入邮箱"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>密码</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码（至少6位）"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>确认密码</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="请再次输入密码"
                        required
                    />
                </div>

                <button type="submit" className="register-btn">
                    注册
                </button>

                <p className="login-link">
                    已有账号？<Link to="/login">立即登录</Link>
                </p>
            </form>
        </div>
    );
}

export default Register;