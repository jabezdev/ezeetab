import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { ref, onValue, push } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Calendar, Settings } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';

interface Event {
    id: string;
    name: string;
    status: 'setup' | 'active' | 'completed';
    date: string;
}

export const Dashboard: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        // In real app, filter by adminId
        const eventsRef = ref(db, 'events');
        const unsubscribe = onValue(eventsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const eventList = Object.entries(data).map(([key, value]: [string, any]) => ({
                    id: key,
                    ...value,
                }));
                setEvents(eventList);
            } else {
                setEvents([]);
            }
        });

        return unsubscribe;
    }, []);

    const createEvent = async () => {
        // Temporary quick create for MVP
        const eventsRef = ref(db, 'events');
        const newEventRef = await push(eventsRef, {
            name: 'New Untitled Event',
            status: 'setup',
            date: new Date().toISOString(),
            adminId: user?.uid
        });
        navigate(`/admin/event/${newEventRef.key}/setup`);
    };

    return (
        <AdminLayout
            title="My Events"
            actions={
                <Button onClick={createEvent} className="flex items-center gap-2">
                    <Plus size={20} />
                    Create Event
                </Button>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {events.map((event) => (
                    <div
                        key={event.id}
                        className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer p-6 group"
                        onClick={() => navigate(`/admin/event/${event.id}/setup`)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                <Calendar size={20} />
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${event.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                event.status === 'completed' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                {event.status.toUpperCase()}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{event.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {new Date(event.date).toLocaleDateString()}
                        </p>

                        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-auto">
                            <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/event/${event.id}/setup`);
                            }}>
                                <Settings size={14} className="mr-1" /> Setup
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/event/${event.id}/control`);
                            }}>
                                Control Room
                            </Button>
                        </div>
                    </div>
                ))}

                {events.length === 0 && (
                    <div className="col-span-full text-center py-16 bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">No events found.</p>
                        <Button onClick={createEvent} variant="secondary">Create your first event</Button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};
