import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Plus, Trash2, RefreshCw, Copy } from 'lucide-react';

export const Committee: React.FC = () => {
    const { eventId } = useParams();
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        const membersRef = ref(db, `events/${eventId}/committee`);
        return onValue(membersRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            setMembers(list);
        });
    }, [eventId]);

    const addMember = async () => {
        const code = generateCode();
        const newRef = await push(ref(db, `events/${eventId}/committee`), {
            name: 'New Member',
            accessCode: code,
            status: 'offline'
        });
        // Write to root /codes/{code}
        await update(ref(db, `codes/${code}`), {
            eventId,
            role: 'committee',
            id: newRef.key
        });
    };

    const deleteMember = async (id: string, code: string) => {
        if (confirm('Delete this committee member?')) {
            await remove(ref(db, `events/${eventId}/committee/${id}`));
            await remove(ref(db, `codes/${code}`));
        }
    };

    const regenerateCode = async (id: string, oldCode: string) => {
        const newCode = generateCode();
        await update(ref(db, `events/${eventId}/committee/${id}`), { accessCode: newCode });
        await remove(ref(db, `codes/${oldCode}`));
        await update(ref(db, `codes/${newCode}`), {
            eventId,
            role: 'committee',
            id
        });
    };

    const updateName = (id: string, name: string) => {
        update(ref(db, `events/${eventId}/committee/${id}`), { name });
    };

    const generateCode = () => {
        return 'C-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        alert(`Code ${code} copied!`);
    };

    return (
        <div className="max-w-5xl mx-auto p-8 min-h-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold dark:text-white">Certification Committee</h1>
                <Button onClick={addMember} className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
                    <Plus size={18} /> Add Member
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Access Code</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {members.map(member => (
                            <tr key={member.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Input
                                        value={member.name}
                                        onChange={(e) => updateName(member.id, e.target.value)}
                                        className="border-none shadow-none focus:ring-0 p-0 font-medium bg-transparent dark:text-white"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <code className="bg-gray-100 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono tracking-wide">{member.accessCode}</code>
                                        <button onClick={() => copyCode(member.accessCode)} className="text-gray-400 hover:text-blue-500" title="Copy">
                                            <Copy size={16} />
                                        </button>
                                        <button onClick={() => regenerateCode(member.id, member.accessCode)} className="text-gray-400 hover:text-orange-500" title="Regenerate">
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.status === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                        {member.status || 'offline'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => deleteMember(member.id, member.accessCode)} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {members.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No committee members added yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
