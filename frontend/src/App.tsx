import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Welcome from './components/Welcome';
import { User } from './types';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleRegister = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
      <BrowserRouter>
        <div className="app-container">
          <Routes>
            <Route
                path="/"
                element={user ? <Welcome user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
            />
            <Route
                path="/login"
                element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
            />
            <Route
                path="/register"
                element={!user ? <Register onRegister={handleRegister} /> : <Navigate to="/" />}
            />
          </Routes>
        </div>
      </BrowserRouter>
  );
}

export default App;