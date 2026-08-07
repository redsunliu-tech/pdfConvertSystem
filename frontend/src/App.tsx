import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';  // 新增导入
import { User } from './types';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // 处理登录成功
  const handleLogin = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  // 处理注册成功
  const handleRegister = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  // 处理退出登录
  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
      <BrowserRouter future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
      }}>
        <div className="app-container">
          <Routes>
            {/* 默认路由 - 登录后跳转到Dashboard */}
            <Route
                path="/"
                element={
                  user ? (
                      <Dashboard user={user} onLogout={handleLogout} />
                  ) : (
                      <Navigate to="/login" />
                  )
                }
            />
            {/* 登录路由 */}
            <Route
                path="/login"
                element={
                  !user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />
                }
            />
            {/* 注册路由 */}
            <Route
                path="/register"
                element={
                  !user ? (
                      <Register onRegister={handleRegister} />
                  ) : (
                      <Navigate to="/" />
                  )
                }
            />
          </Routes>
        </div>
      </BrowserRouter>
  );
}

export default App;