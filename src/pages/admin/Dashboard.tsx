import React, { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { ref, onValue, push } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Calendar } from 'lucide-react';

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
                <Button onClick={createEvent} className="flex items-center gap-2">
                    <Plus size={20} />
                    Create Event
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                    <div
                        key={event.id}
                        className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-6 border border-gray-100"
                        onClick={() => navigate(`/admin/event/${event.id}/setup`)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 mb-4">
                                <Calendar size={24} />
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${event.status === 'active' ? 'bg-green-100 text-green-800' :
                                    event.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                        'bg-yellow-100 text-yellow-800'
                                }`}>
                                {event.status.toUpperCase()}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {new Date(event.date).toLocaleDateString()}
                        </p>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/event/${event.id}/control`);
                            }}>
                                Open Control Room
                            </Button>
                        </div>
                    </div>
                ))}

                {events.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">No events found. Create your first event!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
