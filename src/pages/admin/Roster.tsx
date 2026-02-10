import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';

export const Roster: React.FC = () => {
    const { eventId } = useParams();
    const [candidates, setCandidates] = useState<any[]>([]);

    useEffect(() => {
        const candidatesRef = ref(db, `events/${eventId}/candidates`);
        return onValue(candidatesRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            // Sort by number
            list.sort((a, b) => a.number - b.number);
            setCandidates(list);
        });
    }, [eventId]);

    const addCandidate = async () => {
        const nextNum = candidates.length > 0 ? Math.max(...candidates.map(c => c.number || 0)) + 1 : 1;
        await push(ref(db, `events/${eventId}/candidates`), {
            name: 'New Candidate',
            number: nextNum,
            photoUrl: '',
            details: '' // Age, City, etc.
        });
    };

    const updateCandidate = (id: string, field: string, value: any) => {
        update(ref(db, `events/${eventId}/candidates/${id}`), { [field]: value });
    };

    const deleteCandidate = async (id: string) => {
        if (confirm('Delete this candidate?')) {
            await remove(ref(db, `events/${eventId}/candidates/${id}`));
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Candidate Roster</h1>
                <Button onClick={addCandidate} className="flex items-center gap-2">
                    <Plus size={18} /> Add Candidate
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map(candidate => (
                    <div key={candidate.id} className="bg-white shadow rounded-lg p-6 relative group border border-gray-100">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => deleteCandidate(candidate.id)}
                                className="text-red-400 hover:text-red-600 p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="flex items-start gap-4">
                            {/* Photo Placeholder */}
                            <div className="w-20 h-24 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0 text-gray-400">
                                {candidate.photoUrl ? (
                                    <img src={candidate.photoUrl} alt="Candidate" className="w-full h-full object-cover rounded-md" />
                                ) : (
                                    <ImageIcon size={24} />
                                )}
                            </div>

                            <div className="flex-1 space-y-3">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Number</label>
                                    <Input
                                        type="number"
                                        value={candidate.number}
                                        onChange={(e) => updateCandidate(candidate.id, 'number', parseInt(e.target.value))}
                                        className="font-mono font-bold text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Name</label>
                                    <Input
                                        value={candidate.name}
                                        onChange={(e) => updateCandidate(candidate.id, 'name', e.target.value)}
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Details</label>
                                    <Input
                                        value={candidate.details || ''}
                                        onChange={(e) => updateCandidate(candidate.id, 'details', e.target.value)}
                                        placeholder="City, Analytics..."
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {candidates.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mt-6">
                    <p className="text-gray-500">No candidates in roster.</p>
                </div>
            )}
        </div>
    );
};
