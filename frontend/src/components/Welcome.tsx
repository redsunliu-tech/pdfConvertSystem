import { User } from '../types';

interface WelcomeProps {
    user: User;
    onLogout: () => void;
}

function Welcome({ user, onLogout }: WelcomeProps) {
    return (
        <div className="welcome-message">
            <h1>欢迎, {user.username}!</h1>
            <p>您已成功登录系统</p>
            <button onClick={onLogout} className="logout-btn">退出登录</button>
        </div>
    );
}

export default Welcome;