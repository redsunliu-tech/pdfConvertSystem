import { NavItem } from '../types';

interface SidebarProps {
    activeNav: NavItem;              // 当前激活的导航项
    onNavChange: (nav: NavItem) => void;  // 导航切换回调
}

function Sidebar({ activeNav, onNavChange }: SidebarProps) {
    // 导航项配置
    const navItems: { key: NavItem; label: string; icon: string }[] = [
        { key: 'files', label: '我的文件', icon: '📁' },
        { key: 'history', label: '转换历史', icon: '📋' },
        { key: 'settings', label: '账户设置', icon: '⚙️' },
    ];

    return (
        <aside className="sidebar">
            {/* 侧边栏头部 - Logo */}
            <div className="sidebar-header">
                <h1 className="logo">PDF转换器</h1>
            </div>

            {/* 导航菜单 */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <button
                        key={item.key}
                        className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                        onClick={() => onNavChange(item.key)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}

export default Sidebar;