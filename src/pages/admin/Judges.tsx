import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Plus, Trash2, RefreshCw, Copy } from 'lucide-react';
import clsx from 'clsx';

export const Judges: React.FC = () => {
    const { eventId } = useParams();
    const [judges, setJudges] = useState<any[]>([]);
    const [initialJudges, setInitialJudges] = useState<any[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const judgesRef = ref(db, `events/${eventId}/judges`);
        return onValue(judgesRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            setJudges(list);
            setInitialJudges(JSON.parse(JSON.stringify(list)));
            setHasChanges(false);
        });
    }, [eventId]);

    useEffect(() => {
        setHasChanges(JSON.stringify(judges) !== JSON.stringify(initialJudges));
    }, [judges, initialJudges]);

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

    const deleteJudge = (id: string) => {
        if (confirm('Delete this judge account? This will be applied on save.')) {
            setJudges(judges.filter(j => j.id !== id));
        }
    };

    const regenerateCode = (id: string) => {
        const newCode = generateCode();
        setJudges(judges.map(j => j.id === id ? { ...j, accessCode: newCode, codeChanged: true, originalCode: j.accessCode } : j));
    };

    const updateName = (id: string, name: string) => {
        setJudges(judges.map(j => j.id === id ? { ...j, name } : j));
    };

    const generateCode = () => {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        alert(`Code ${code} copied!`);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            const updates: Record<string, any> = {};
            const codesUpdates: Record<string, any> = {};

            // 1. Calculate Judges State
            const judgesMap: Record<string, any> = {};

            // Track codes to remove (from deleted judges or regenerated codes)
            // const initialCodes = new Set(initialJudges.map(j => j.accessCode));
            // const currentCodes = new Set(judges.map(j => j.accessCode));

            // Identify removed judges to clean up their codes
            initialJudges.forEach(initJ => {
                const stillExists = judges.find(j => j.id === initJ.id);
                if (!stillExists) {
                    // Judge deleted, remove their code
                    codesUpdates[`codes/${initJ.accessCode}`] = null;
                } else if (stillExists.accessCode !== initJ.accessCode) {
                    // Code changed (regenerated), remove old code
                    codesUpdates[`codes/${initJ.accessCode}`] = null;
                }
            });

            // Process current judges
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

                // Update/Add code mapping
                // We always write the code mapping to ensure it exists and points to correct judge ID
                codesUpdates[`codes/${judge.accessCode}`] = {
                    eventId,
                    role: 'judge',
                    id: judgeId
                };
            });

            // Commit Judges
            updates[`events/${eventId}/judges`] = judgesMap;

            // Commit Codes
            Object.assign(updates, codesUpdates);

            await update(ref(db), updates);

            setIsSaving(false);
            // setHasChanges(false) handled by listener

        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save changes.");
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">Judges Management</h1>
                <div className="flex items-center gap-3">
                    <Button onClick={addJudge} className="flex items-center gap-2 shadow-lg shadow-blue-200/50">
                        <Plus size={18} /> Add Judge
                    </Button>
                    {hasChanges && (
                        <Button
                            onClick={saveChanges}
                            disabled={isSaving}
                            className={clsx(
                                "flex items-center gap-2 transition-all",
                                "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200/50"
                            )}
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {judges.map(judge => (
                    <div key={judge.id} className="group relative rounded-2xl overflow-hidden border border-white/40 bg-white/60 backdrop-blur-xl shadow-sm hover:shadow-lg transition-all p-5 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Name</label>
                                <Input
                                    value={judge.name}
                                    onChange={(e) => updateName(judge.id, e.target.value)}
                                    className="bg-transparent border-transparent hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-bold text-lg p-1 -ml-1"
                                    placeholder="Judge Name"
                                />
                            </div>
                            <button onClick={() => deleteJudge(judge.id)} className="text-gray-300 hover:text-red-500 transition-colors bg-white/50 p-2 rounded-full hover:bg-red-50">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Access Code</label>
                            <div className="flex items-center gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100 group-hover:bg-white transition-colors">
                                <code className="flex-1 font-mono text-xl font-black text-indigo-600 tracking-wider text-center select-all cursor-pointer" onClick={() => copyCode(judge.accessCode)}>
                                    {judge.accessCode}
                                </code>
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => copyCode(judge.accessCode)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded" title="Copy">
                                        <Copy size={14} />
                                    </button>
                                    <button onClick={() => regenerateCode(judge.id)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded" title="Regenerate">
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100/50">
                            <div className="flex items-center gap-2">
                                <span className={clsx(
                                    "w-2 h-2 rounded-full",
                                    judge.status === 'online' ? "bg-green-500 animate-pulse" : "bg-gray-300"
                                )}></span>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    {judge.status || 'offline'}
                                </span>
                            </div>
                            {judge.isNew && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">NEW</span>}
                        </div>
                    </div>
                ))}

                {judges.length === 0 && (
                    <div className="col-span-full text-center py-16 bg-white/20 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300">
                        <p className="text-gray-500 font-medium">No judges added yet.</p>
                        <Button variant="secondary" onClick={addJudge} className="mt-4">
                            Add your first judge
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
