import React from 'react';
import { Button } from '../common/Button';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminLayoutProps {
    title: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    backPath?: string;
    fullWidth?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ title, actions, children, backPath, fullWidth = true }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
            {/* Header */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                <div className={`mx-auto px-6 py-4 flex items-center justify-between ${fullWidth ? 'w-full' : 'max-w-7xl'}`}>
                    <div className="flex items-center gap-4">
                        {backPath && (
                            <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
                                <ChevronLeft size={20} />
                            </Button>
                        )}
                        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
                    </div>

                    {actions && (
                        <div className="flex items-center gap-3">
                            {actions}
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className={`flex-1 py-8 px-6 ${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'}`}>
                {children}
            </main>
        </div>
    );
};
