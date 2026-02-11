import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Plus, Trash2, Image as ImageIcon, Save, Upload, GripVertical, Users } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useModal } from '../../contexts/ModalContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';

// Types
interface Candidate {
    id: string;
    name: string;
    number: number;
    photoUrl: string;
    details: string;
}

// Pure UI Component
const CandidateCard = ({
    candidate,
    index,
    updateCandidate,
    deleteCandidate,
    isOverlay = false,
    dragListeners,
    dragAttributes,
    showPrompt,
    showConfirm
}: {
    candidate: Candidate;
    index: number;
    updateCandidate?: (id: string, field: keyof Candidate, value: string | number) => void;
    deleteCandidate?: (id: string) => void;
    isOverlay?: boolean;
    dragListeners?: any;
    dragAttributes?: any;
    showPrompt?: (message: string, options?: any) => Promise<string | null>;
    showConfirm?: (message: string, options?: any) => Promise<boolean>;
}) => {
    return (
        <div className={clsx(
            "rounded-2xl overflow-hidden border transition-all flex flex-col group relative h-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl",
            isOverlay
                ? "shadow-2xl ring-4 ring-indigo-400 opacity-90 scale-105 z-50 cursor-grabbing"
                : "shadow-sm border-white/40 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-xl hover:-translate-y-1"
        )}>
            {/* Header: Drag Handle, Number, Delete */}
            <div className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-700/50 gap-2">
                {/* Drag Handle (Now on Left) */}
                <div {...dragListeners} {...dragAttributes} className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-500 p-2 group/handle hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <GripVertical size={20} className="group-hover/handle:scale-110 transition-transform" />
                </div>

                {/* Number Badge (Now Center/Left) */}
                <div className="flex-1 flex justify-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-black shadow-sm border border-indigo-100 dark:border-indigo-800">
                        <span className="text-xs">#{index + 1}</span>
                    </div>
                </div>

                {/* Delete Button */}
                {deleteCandidate && showConfirm && (
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await showConfirm('Delete this candidate?', { destructive: true, confirmLabel: 'Delete' });
                            if (confirmed) deleteCandidate(candidate.id);
                        }}
                        className="w-8 h-8 p-0 flex items-center justify-center rounded-full bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-500 border-transparent transition-all"
                    >
                        <Trash2 size={16} />
                    </Button>
                )}
            </div>

            {/* Photo Section */}
            <div className="aspect-4/5 w-full bg-gray-100 dark:bg-gray-700 relative group/image overflow-hidden">
                {candidate.photoUrl ? (
                    <img src={candidate.photoUrl} alt="Candidate" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                        <ImageIcon size={48} className="mb-2 opacity-50" />
                        <span className="text-xs font-bold uppercase tracking-wider opacity-50">No Image</span>
                    </div>
                )}

                {/* Image Upload Overlay */}
                {updateCandidate && showPrompt && (
                    <div className="absolute inset-0 bg-indigo-900/20 opacity-0 group-hover/image:opacity-100 flex items-center justify-center transition-all z-20 cursor-pointer backdrop-blur-[1px]"
                        onClick={async () => {
                            const url = await showPrompt("Enter image URL:", { defaultValue: candidate.photoUrl });
                            if (url !== null) updateCandidate(candidate.id, 'photoUrl', url);
                        }}
                    >
                        <div className="bg-white/90 backdrop-blur-md shadow-lg border border-white/50 px-4 py-2 rounded-full text-indigo-600 font-bold text-xs flex items-center gap-2 transform translate-y-4 group-hover/image:translate-y-0 transition-all">
                            <Upload size={14} />
                            <span>{candidate.photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-3 flex-1 flex flex-col border-t border-gray-100 dark:border-gray-700">
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Name</label>
                    <Input
                        className="bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-200/50 transition-all font-bold text-lg text-gray-800 dark:text-gray-100 w-full p-1 -ml-1"
                        placeholder="Candidate Name"
                        value={candidate.name}
                        onChange={(e) => updateCandidate && updateCandidate(candidate.id, 'name', e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        disabled={!updateCandidate}
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Details</label>
                    <Input
                        className="bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-200/50 transition-all text-sm text-gray-600 dark:text-gray-400 w-full p-1 -ml-1"
                        placeholder="Details"
                        value={candidate.details || ''}
                        onChange={(e) => updateCandidate && updateCandidate(candidate.id, 'details', e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        disabled={!updateCandidate}
                    />
                </div>
            </div>
        </div>
    );
};

// Sortable Item Wrapper
const SortableCandidateItem = ({
    candidate,
    updateCandidate,
    deleteCandidate,
    index,
    showPrompt,
    showConfirm
}: {
    candidate: Candidate;
    updateCandidate: (id: string, field: keyof Candidate, value: string | number) => void;
    deleteCandidate?: (id: string) => void;
    index: number;
    showPrompt: (message: string, options?: any) => Promise<string | null>;
    showConfirm: (message: string, options?: any) => Promise<boolean>;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: candidate.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging ? 0.3 : 1, // Fade out the original item being dragged
    };

    return (
        <div ref={setNodeRef} style={style} className="h-full">
            <CandidateCard
                candidate={candidate}
                index={index}
                updateCandidate={updateCandidate}
                deleteCandidate={deleteCandidate}
                dragListeners={listeners}
                dragAttributes={attributes}
                showPrompt={showPrompt}
                showConfirm={showConfirm}
            />
        </div>
    );
};

export const Roster: React.FC = () => {
    const { showPrompt, showConfirm, showAlert } = useModal();
    const { eventId } = useParams();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require drag of 8px to start, prevents accidental drags when clicking
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const candidatesRef = ref(db, `events/${eventId}/candidates`);
        const unsubscribe = onValue(candidatesRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]) => ({ id: k, ...(v as Omit<Candidate, 'id'>) })) : [];
            // Sort by number
            list.sort((a, b) => (a.number || 0) - (b.number || 0));
            setCandidates(list);
            setLoading(false);
        });
        return unsubscribe;
    }, [eventId]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            setCandidates((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                // Update numbers based on new order
                const reordered = newItems.map((item, index) => ({ ...item, number: index + 1 }));
                setHasChanges(true); // Flag that we have unsaved reordering
                return reordered;
            });
        }
    };

    const addCandidate = () => {
        const newCandidate: Candidate = {
            id: `temp_${Date.now()}`,
            name: 'New Candidate',
            number: candidates.length + 1,
            photoUrl: '',
            details: ''
        };
        setCandidates([...candidates, newCandidate]);
        setHasChanges(true);
    };

    const updateCandidate = (id: string, field: keyof Candidate, value: string | number) => {
        setCandidates(candidates.map(c => c.id === id ? { ...c, [field]: value } : c));
        setHasChanges(true);
    };

    // Note: Confirmation involves UI interaction now handled in the component calling this,
    // or we can keep it here if we pass the ID.
    // However, CandidateCard specifically handles the async confirm now.
    // So this function should just do the deletion.
    const deleteCandidate = (id: string) => {
        setCandidates(prev => prev.filter(c => c.id !== id));
        setHasChanges(true);
    };

    const saveAll = async () => {
        setIsSaving(true);
        try {
            const candidatesMap: Record<string, Candidate> = {};
            candidates.forEach((c, index) => {
                let cId = c.id;
                if (cId.startsWith('temp_')) {
                    cId = `cand_${Math.random().toString(36).substr(2, 9)}`;
                }
                candidatesMap[cId] = {
                    ...c,
                    id: cId,
                    number: index + 1 // Ensure strict 1-based ordering
                };
            });

            await update(ref(db, `events/${eventId}`), {
                candidates: candidatesMap
            });

            setHasChanges(false);
        } catch (error) {
            console.error("Failed to save", error);
            showAlert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const activeCandidate = activeId ? candidates.find(c => c.id === activeId) : null;

    if (loading) return <div>Loading...</div>;

    return (
        <AdminLayout
            title="Candidate Roster"
            backPath="/admin/dashboard"
            actions={
                hasChanges && (
                    <Button
                        onClick={saveAll}
                        disabled={isSaving}
                        className={clsx(
                            "flex items-center gap-2 transition-all",
                            "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        )}
                    >
                        {isSaving ? "Saving..." : <><Save size={18} /> Save Changes</>}
                    </Button>
                )
            }
        >
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <Users size={20} className="text-indigo-600 dark:text-indigo-400" />
                        Candidates ({candidates.length})
                    </h2>
                    <Button onClick={addCandidate} size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
                        <Plus size={16} /> Add Candidate
                    </Button>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={candidates.map(c => c.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                            {candidates.map((candidate, index) => (
                                <SortableCandidateItem
                                    key={candidate.id}
                                    candidate={candidate}
                                    index={index}
                                    updateCandidate={updateCandidate}
                                    deleteCandidate={deleteCandidate}
                                    showPrompt={showPrompt}
                                    showConfirm={showConfirm}
                                />
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay>
                        {activeCandidate ? (
                            <div className="w-64 h-auto"> {/* Fixed width for drag preview if needed, or matched dims */}
                                <CandidateCard
                                    candidate={activeCandidate}
                                    index={candidates.findIndex(c => c.id === activeCandidate.id)}
                                    isOverlay
                                />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {candidates.length === 0 && (
                    <div className="text-center py-24 bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700 mt-6">
                        <div className="mb-4 text-indigo-200 dark:text-indigo-900">
                            <ImageIcon size={64} className="mx-auto" />
                        </div>
                        <p className="text-gray-500 font-bold text-xl">No candidates yet</p>
                        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">Start building your roster by adding candidates. They will appear here in a grid.</p>
                        <Button variant="secondary" onClick={addCandidate}>
                            Add First Candidate
                        </Button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

