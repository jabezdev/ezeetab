import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Plus, Trash2, RefreshCw, Copy, Users, Gavel } from 'lucide-react';
import clsx from 'clsx';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useModal } from '../../contexts/ModalContext';

export const Judges: React.FC = () => {
    const { showAlert, showConfirm } = useModal();
    const { eventId } = useParams();

    // Judges State
    const [judges, setJudges] = useState<any[]>([]);
    const [initialJudges, setInitialJudges] = useState<any[]>([]);

    // Committee State
    const [members, setMembers] = useState<any[]>([]);

    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const judgesRef = ref(db, `events/${eventId}/judges`);
        const committeeRef = ref(db, `events/${eventId}/committee`);

        const unsubJudges = onValue(judgesRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            setJudges(list);
            setInitialJudges(JSON.parse(JSON.stringify(list)));
            setHasChanges(false);
        });

        const unsubCommittee = onValue(committeeRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            setMembers(list);
        });

        return () => {
            unsubJudges();
            unsubCommittee();
        };
    }, [eventId]);

    useEffect(() => {
        setHasChanges(JSON.stringify(judges) !== JSON.stringify(initialJudges));
    }, [judges, initialJudges]);

    // --- Judges Logic ---
    const addJudge = () => {
        const code = generateCode();
        const newJudge = {
            id: `temp_${Date.now()}`,
            name: 'New Judge',
            accessCode: code,
            status: 'offline',
            isNew: true
        };
        setJudges([...judges, newJudge]);
    };

    const deleteJudge = async (id: string) => {
        const confirmed = await showConfirm('Delete this judge account? This will be applied on save.', { destructive: true, confirmLabel: 'Delete' });
        if (confirmed) {
            setJudges(judges.filter(j => j.id !== id));
        }
    };

    const regenerateJudgeCode = (id: string) => {
        const newCode = generateCode();
        setJudges(judges.map(j => j.id === id ? { ...j, accessCode: newCode, codeChanged: true, originalCode: j.accessCode } : j));
    };

    const updateJudgeName = (id: string, name: string) => {
        setJudges(judges.map(j => j.id === id ? { ...j, name } : j));
    };

    // --- Committee Logic (Direct Writes) ---
    const addMember = async () => {
        const code = generateCode('C-');
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
        const confirmed = await showConfirm('Delete this committee member?', { destructive: true, confirmLabel: 'Delete' });
        if (confirmed) {
            await remove(ref(db, `events/${eventId}/committee/${id}`));
            await remove(ref(db, `codes/${code}`));
        }
    };

    const regenerateMemberCode = async (id: string, oldCode: string) => {
        const newCode = generateCode('C-');
        await update(ref(db, `events/${eventId}/committee/${id}`), { accessCode: newCode });
        await remove(ref(db, `codes/${oldCode}`));
        await update(ref(db, `codes/${newCode}`), {
            eventId,
            role: 'committee',
            id
        });
    };

    const updateMemberName = (id: string, name: string) => {
        update(ref(db, `events/${eventId}/committee/${id}`), { name });
    };

    // --- Helpers ---
    const generateCode = (prefix = '') => {
        return prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        // Toast needed ideally
        showAlert(`Code ${code} copied!`, { title: 'Copied' });
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            const updates: Record<string, any> = {};
            const codesUpdates: Record<string, any> = {};

            // Identify removed judges to clean up their codes
            initialJudges.forEach(initJ => {
                const stillExists = judges.find(j => j.id === initJ.id);
                if (!stillExists) {
                    codesUpdates[`codes/${initJ.accessCode}`] = null;
                } else if (stillExists.accessCode !== initJ.accessCode) {
                    codesUpdates[`codes/${initJ.accessCode}`] = null;
                }
            });

            // Process current judges
            const judgesMap: Record<string, any> = {};
            judges.forEach(judge => {
                let judgeId = judge.id;
                if (judgeId.startsWith('temp_')) {
                    judgeId = `judge_${Math.random().toString(36).substr(2, 9)}`;
                }

                // Sanitize local flags
                const { isNew, codeChanged, originalCode, ...judgeData } = judge;

                judgesMap[judgeId] = {
                    ...judgeData,
                    id: judgeId
                };

                codesUpdates[`codes/${judge.accessCode}`] = {
                    eventId,
                    role: 'judge',
                    id: judgeId
                };
            });

            updates[`events/${eventId}/judges`] = judgesMap;
            Object.assign(updates, codesUpdates);

            await update(ref(db), updates);
            setIsSaving(false);

        } catch (error) {
            console.error("Save failed", error);
            showAlert("Failed to save changes.");
            setIsSaving(false);
        }
    };

    return (
        <AdminLayout
            title="People & Access Control"
            backPath="/admin/dashboard"
            actions={
                hasChanges && (
                    <Button
                        onClick={saveChanges}
                        disabled={isSaving}
                        className={clsx(
                            "flex items-center gap-2 transition-all",
                            "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        )}
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

                {/* --- Judges Column --- */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <Gavel size={20} className="text-indigo-600 dark:text-indigo-400" />
                            Judges ({judges.length})
                        </h2>
                        <Button onClick={addJudge} size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
                            <Plus size={16} /> Add Judge
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {judges.map(judge => (
                            <div key={judge.id} className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Name</label>
                                        <Input
                                            value={judge.name}
                                            onChange={(e) => updateJudgeName(judge.id, e.target.value)}
                                            className="bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:bg-gray-50 dark:focus:bg-gray-800 focus:border-indigo-500 font-bold text-lg p-1 -ml-1 text-gray-900 dark:text-white h-auto"
                                            placeholder="Judge Name"
                                        />
                                    </div>
                                    <button onClick={() => deleteJudge(judge.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Access Code</label>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-lg border border-gray-100 dark:border-gray-800 group-hover:border-gray-300 dark:group-hover:border-gray-700 transition-colors">
                                        <code className="flex-1 font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider text-center select-all cursor-pointer" onClick={() => copyCode(judge.accessCode)}>
                                            {judge.accessCode}
                                        </code>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => copyCode(judge.accessCode)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Copy">
                                                <Copy size={12} />
                                            </button>
                                            <button onClick={() => regenerateJudgeCode(judge.id)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded" title="Regenerate">
                                                <RefreshCw size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "w-2 h-2 rounded-full",
                                            judge.status === 'online' ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"
                                        )}></span>
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                            {judge.status || 'offline'}
                                        </span>
                                    </div>
                                    {judge.isNew && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">NEW</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {judges.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No judges added yet.</p>
                            <Button variant="secondary" onClick={addJudge} className="mt-4">
                                Add your first judge
                            </Button>
                        </div>
                    )}
                </div>

                {/* --- Committee Column --- */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <Users size={20} className="text-indigo-600 dark:text-indigo-400" />
                            Committee ({members.length})
                        </h2>
                        <Button onClick={addMember} size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
                            <Plus size={16} /> Add Member
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {members.map(member => (
                            <div key={member.id} className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Name</label>
                                        <Input
                                            value={member.name}
                                            onChange={(e) => updateMemberName(member.id, e.target.value)}
                                            className="bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:bg-gray-50 dark:focus:bg-gray-800 focus:border-indigo-500 font-bold text-lg p-1 -ml-1 text-gray-900 dark:text-white h-auto"
                                            placeholder="Member Name"
                                        />
                                    </div>
                                    <button onClick={() => deleteMember(member.id, member.accessCode)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Access Code</label>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-lg border border-gray-100 dark:border-gray-800 group-hover:border-gray-300 dark:group-hover:border-gray-700 transition-colors">
                                        <code className="flex-1 font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider text-center select-all cursor-pointer" onClick={() => copyCode(member.accessCode)}>
                                            {member.accessCode}
                                        </code>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => copyCode(member.accessCode)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Copy">
                                                <Copy size={12} />
                                            </button>
                                            <button onClick={() => regenerateMemberCode(member.id, member.accessCode)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded" title="Regenerate">
                                                <RefreshCw size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "w-2 h-2 rounded-full",
                                            member.status === 'online' ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"
                                        )}></span>
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                            {member.status || 'offline'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {members.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No committee members added yet.</p>
                        </div>
                    )}
                </div>

            </div>
        </AdminLayout>
    );
};
