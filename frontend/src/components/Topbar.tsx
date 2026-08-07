import { User } from '../types';

interface TopBarProps {
    user: User;           // 当前用户信息
    onLogout: () => void; // 退出登录回调
}

function Topbar({ user, onLogout }: TopBarProps) {
    return (
        <header className="top-bar">
            {/* 用户信息区域 */}
            <div className="user-info">
                <span className="user-avatar">👤</span>
                <span className="user-name">{user.username}</span>
            </div>

            {/* 退出登录按钮 */}
            <button className="logout-btn" onClick={onLogout}>
                退出登录
            </button>
        </header>
    );
}

export default Topbar;