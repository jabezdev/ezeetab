import React, { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../services/firebase';
import { ref, onValue } from 'firebase/database';
import {
    Settings,
    Layers,
    Users,
    Gavel,
    ShieldCheck,
    MonitorPlay,
    Trophy,

    ChevronLeft,
    Sun,
    Moon
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';

export const AdminEventLayout: React.FC = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, setTheme } = useTheme();
    const [eventName, setEventName] = useState('Loading...');

    useEffect(() => {
        if (!eventId) return;
        const eventRef = ref(db, `events/${eventId}/name`);
        return onValue(eventRef, (snapshot) => {
            setEventName(snapshot.val() || 'Untitled Event');
        });
    }, [eventId]);

    const navItems = [
        { icon: Settings, label: 'Event Setup', path: 'setup' },
        { icon: Layers, label: 'Segments', path: 'segments' },
        { icon: Users, label: 'Roster', path: 'roster' },
        { icon: Gavel, label: 'Judges', path: 'judges' },
        { icon: ShieldCheck, label: 'Committee', path: 'committee' },
        { icon: MonitorPlay, label: 'Control Room', path: 'control' },
        { icon: Trophy, label: 'Results', path: 'results' },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center text-gray-500 hover:text-gray-900 text-sm mb-4 transition-colors"
                    >
                        <ChevronLeft size={16} className="mr-1" />
                        Back to Events
                    </button>
                    <h1 className="font-bold text-lg text-gray-900 truncate" title={eventName}>
                        {eventName}
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname.includes(`/admin/event/${eventId}/${item.path}`);
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(`/admin/event/${eventId}/${item.path}`)}
                                className={clsx(
                                    'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                    isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                )}
                            >
                                <item.icon size={18} className={clsx('mr-3', isActive ? 'text-blue-600' : 'text-gray-400')} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>


                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        {theme === 'dark' ? <Sun size={18} className="mr-3" /> : <Moon size={18} className="mr-3" />}
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
};
