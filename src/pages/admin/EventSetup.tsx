import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Save } from 'lucide-react';

export const EventSetup: React.FC = () => {
    const { eventId } = useParams();
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventStatus, setEventStatus] = useState('setup');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const eventRef = ref(db, `events/${eventId}`);
        const unsubscribe = onValue(eventRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setEventName(data.name || '');
                setEventDate(data.date || '');
                setEventStatus(data.status || 'setup');
            }
            setLoading(false);
        });
        return unsubscribe;
    }, [eventId]);

    const saveDetails = async () => {
        await update(ref(db, `events/${eventId}`), {
            name: eventName,
            date: eventDate,
            status: eventStatus
        });
        alert('Settings Saved!');
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="max-w-5xl mx-auto p-8">
            <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight mb-6">General Settings</h1>

            <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl space-y-6">
                <Input
                    label="Event Name"
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                    className="bg-white/50 border-transparent focus:bg-white transition-all font-medium text-lg"
                />

                <Input
                    label="Event Date"
                    type="date"
                    value={eventDate ? new Date(eventDate).toISOString().split('T')[0] : ''}
                    onChange={e => setEventDate(new Date(e.target.value).toISOString())}
                    className="bg-white/50 border-transparent focus:bg-white transition-all font-medium"
                />

                <div>
                    <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
                    <div className="relative">
                        <select
                            className="w-full rounded-xl border-transparent bg-white/50 px-4 py-3 font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                            value={eventStatus}
                            onChange={e => setEventStatus(e.target.value)}
                        >
                            <option value="setup">Setup Mode</option>
                            <option value="active">Active / Ongoing</option>
                            <option value="completed">Completed</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100/50">
                    <Button onClick={saveDetails} className="flex items-center gap-2 shadow-lg shadow-blue-200/50 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3">
                        <Save size={18} /> Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
};
