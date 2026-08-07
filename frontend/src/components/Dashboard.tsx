import { useState, useEffect, useCallback } from 'react';
import { User, NavItem } from '../types';
import Sidebar from './Sidebar';
import TopBar from './Topbar';
import FileList from './FileList';
import History from './History';
import Settings from './Settings';

interface DashboardProps {
    user: User;
    onLogout: () => void;
}

function Dashboard({ user, onLogout }: DashboardProps) {
    const [activeNav, setActiveNav] = useState<NavItem>('files');
    const [breadcrumb, setBreadcrumb] = useState<Array<{label: string, action?: () => void}>>(() => {
        return [
            { label: '首页' },
            { label: '我的文件' }
        ];
    });
    useEffect(() => {
        switch (activeNav) {
            case 'files':
                setBreadcrumb([
                    { label: '首页' },
                    { label: '我的文件' }
                ]);
                break;
            case 'history':
                setBreadcrumb([
                    { label: '首页' },
                    { label: '转换历史' }
                ]);
                break;
            case 'settings':
                setBreadcrumb([
                    { label: '首页' },
                    { label: '设置' }
                ]);
                break;
        }
    }, [activeNav]);

    const handleNavigate = useCallback((path: Array<{label: string, action?: () => void}>) => {
        setBreadcrumb(path);
    }, []);

    const renderContent = () => {
        switch (activeNav) {
            case 'files':
                return <FileList onNavigate={handleNavigate} />;
            case 'history':
                return <History />;
            case 'settings':
                return <Settings user={user} />;
            default:
                return <FileList onNavigate={handleNavigate} />;
        }
    };

    return (
        <div className="dashboard">
            <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />
            <main className="main-content">
                <TopBar user={user} onLogout={onLogout} />
                <div className="breadcrumb-nav">
                    {breadcrumb.map((item, index) => (
                        <span key={index} className="breadcrumb-item">
                            {item.action ? (
                                <button className="breadcrumb-link" onClick={item.action}>
                                    {item.label}
                                </button>
                            ) : (
                                <span className="breadcrumb-current">{item.label}</span>
                            )}
                            {index < breadcrumb.length - 1 && <span className="breadcrumb-separator"> &gt; </span>}
                        </span>
                    ))}
                </div>
                <div className="content-area">{renderContent()}</div>
            </main>
        </div>
    );
}

export default Dashboard;