import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Plus, Trash2, GripVertical, AlertCircle, CheckCircle } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';

// Types
interface Segment {
    id: string;
    name: string;
    weight: number;
    criteria?: Record<string, Criterion>;
    order?: number;
}

interface Criterion {
    name: string;
    maxScore: number;
    weight?: number;
}

// Sortable Item Component
const SortableSegmentItem = ({
    segment,
    updateSegment,
    deleteSegment,
    addCriterion,
    deleteCriterion,
    updateCriterion,
}: {
    segment: Segment;
    updateSegment: (id: string, field: string, value: any) => void;
    deleteSegment: (id: string) => void;
    addCriterion: (id: string) => void;
    deleteCriterion: (sid: string, cid: string) => void;
    updateCriterion: (sid: string, cid: string, field: string, value: any) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: segment.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    // Calculate criteria total weight
    const criteriaTotal = segment.criteria
        ? Object.values(segment.criteria).reduce((acc: number, c: any) => acc + (c.weight || 0), 0)
        : 0;
    const isCriteriaValid = Math.abs(criteriaTotal - 100) < 0.1;

    return (
        <div ref={setNodeRef} style={style} className={clsx(
            "rounded-2xl overflow-hidden border transition-all mb-6 group",
            isDragging
                ? "shadow-2xl ring-2 ring-indigo-400 opacity-90 scale-105 bg-white/90 backdrop-blur-xl"
                : "shadow-sm bg-white/60 backdrop-blur-xl border-white/40 hover:bg-white/70 hover:shadow-md"
        )}>
            {/* Segment Header */}
            <div className="p-5 flex items-start gap-4 border-b border-gray-100/50">
                <div {...attributes} {...listeners} className="mt-2 cursor-grab text-gray-400 hover:text-indigo-500 p-1 transition-colors">
                    <GripVertical size={20} />
                </div>

                <div className="flex-1 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Segment Name</label>
                            <Input
                                className="bg-white/50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-200/50 transition-all font-medium text-lg"
                                placeholder="E.g. Performance"
                                value={segment.name}
                                onChange={(e) => updateSegment(segment.id, 'name', e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Weight</label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    className="bg-white/50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-200/50 transition-all font-bold text-lg pr-8 text-right"
                                    placeholder="0"
                                    value={segment.weight}
                                    onChange={(e) => updateSegment(segment.id, 'weight', parseFloat(e.target.value) || 0)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>
                        <div className="pt-6">
                            <Button variant="danger" size="sm" onClick={() => deleteSegment(segment.id)} className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 text-red-500 hover:bg-red-100 border-red-100">
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Criteria Section (Always Visible) */}
            <div className="p-5 bg-gray-50/30">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        Criteria
                        <span className={clsx(
                            "text-xs px-2 py-0.5 rounded-full border",
                            isCriteriaValid
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                        )}>
                            Total: {criteriaTotal}%
                        </span>
                    </h3>
                    <Button size="sm" onClick={() => addCriterion(segment.id)} className="bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-sm text-xs">
                        <Plus size={14} className="mr-1" /> Add Criterion
                    </Button>
                </div>

                <div className="space-y-2">
                    {!segment.criteria && <p className="text-sm text-gray-400 italic py-2 text-center">No criteria defined yet.</p>}
                    {segment.criteria && Object.entries(segment.criteria).map(([cid, criterion]: [string, any]) => (
                        <div key={cid} className="flex items-center gap-3 p-1 group/criterion">
                            <div className="flex-1">
                                <Input
                                    placeholder="Criterion Name"
                                    value={criterion.name}
                                    onChange={(e) => updateCriterion(segment.id, cid, 'name', e.target.value)}
                                    className="bg-white border-transparent hover:border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 text-sm shadow-sm"
                                />
                            </div>

                            <div className="w-24 relative" title="Max Score">
                                <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Max</span>
                                </div>
                                <input
                                    type="number"
                                    value={criterion.maxScore}
                                    onChange={(e) => updateCriterion(segment.id, cid, 'maxScore', parseFloat(e.target.value))}
                                    className="w-full pl-10 pr-2 py-2 text-sm bg-white border border-transparent hover:border-gray-200 focus:border-indigo-300 rounded-lg text-right shadow-sm outline-none transition-all"
                                />
                            </div>

                            <div className="w-24 relative" title="Weight %">
                                <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Wgt</span>
                                </div>
                                <input
                                    type="number"
                                    value={criterion.weight || 0}
                                    onChange={(e) => updateCriterion(segment.id, cid, 'weight', parseFloat(e.target.value))}
                                    className="w-full pl-10 pr-2 py-2 text-sm bg-white border border-transparent hover:border-gray-200 focus:border-indigo-300 rounded-lg text-right shadow-sm outline-none transition-all"
                                />
                                <span className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">%</span>
                            </div>

                            <button
                                onClick={() => deleteCriterion(segment.id, cid)}
                                className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover/criterion:opacity-100"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const Segments: React.FC = () => {
    const { eventId } = useParams();
    const [segments, setSegments] = useState<Segment[]>([]);
    const [initialSegments, setInitialSegments] = useState<Segment[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const segmentsRef = ref(db, `events/${eventId}/segments`);
        return onValue(segmentsRef, (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setSegments(list as Segment[]);
            setInitialSegments(JSON.parse(JSON.stringify(list)));
            setHasChanges(false);
        });
    }, [eventId]);

    // Check for changes
    useEffect(() => {
        setHasChanges(JSON.stringify(segments) !== JSON.stringify(initialSegments));
    }, [segments, initialSegments]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSegments((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                // Update order locally
                return newItems.map((item, index) => ({ ...item, order: index }));
            });
        }
    };

    const addSegment = () => {
        const newSegment: Segment = {
            id: `temp_${Date.now()}`,
            name: 'New Segment',
            weight: 0,
            criteria: {},
            order: segments.length
        };
        setSegments([...segments, newSegment]);
    };

    const deleteSegment = (id: string) => {
        if (confirm('Delete this segment? This will be applied when you save.')) {
            setSegments(segments.filter(s => s.id !== id));
        }
    };

    const updateSegment = (id: string, field: string, value: any) => {
        setSegments(segments.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const addCriterion = (segmentId: string) => {
        setSegments(segments.map(s => {
            if (s.id !== segmentId) return s;
            const newCriterionId = `temp_c_${Date.now()}`;
            return {
                ...s,
                criteria: {
                    ...(s.criteria || {}),
                    [newCriterionId]: {
                        name: 'New Criterion',
                        maxScore: 10,
                        weight: 0
                    }
                }
            };
        }) as Segment[]);
    };

    const deleteCriterion = (segmentId: string, criterionId: string) => {
        setSegments(segments.map(s => {
            if (s.id !== segmentId) return s;
            const newCriteria = { ...s.criteria };
            delete newCriteria[criterionId];
            return { ...s, criteria: newCriteria };
        }) as Segment[]);
    };

    const updateCriterion = (segmentId: string, criterionId: string, field: string, value: any) => {
        setSegments(segments.map(s => {
            if (s.id !== segmentId) return s;
            return {
                ...s,
                criteria: {
                    ...s.criteria,
                    [criterionId]: {
                        ...s.criteria?.[criterionId]!,
                        [field]: value
                    }
                }
            };
        }) as Segment[]);
    };

    const saveChanges = async () => {
        if (!isWeightValid) {
            alert("Total weight must be 100% before saving.");
            return;
        }

        setIsSaving(true);
        try {
            // Convert array to object map for Firebase
            // const updates: Record<string, any> = {};

            // We need to handle temp IDs. 
            // Strategy: Read current DB state is tricky if we want to preserve IDs.
            // Simplified strategy: For each segment, if it has a temp ID, generate a new push ID.

            const segmentMap: Record<string, any> = {};

            segments.forEach((seg, index) => {
                let segId = seg.id;
                if (segId.startsWith('temp_')) {
                    // It's new. Use the timestamp part or generate a random one. 
                    // Let's generate a proper Firebase key if possible, but we don't have push() access easily without a ref.
                    // actually we can use push(ref(db, ...)).key
                    // Using a robust random ID if not push
                    segId = `seg_${Math.random().toString(36).substr(2, 9)}`;
                }

                // Clean up criteria IDs
                const criteriaMap: Record<string, any> = {};
                if (seg.criteria) {
                    Object.entries(seg.criteria).forEach(([cid, crit]) => {
                        let critId = cid;
                        if (critId.startsWith('temp_')) {
                            critId = `crit_${Math.random().toString(36).substr(2, 9)}`;
                        }
                        criteriaMap[critId] = crit;
                    });
                }

                segmentMap[segId] = {
                    ...seg,
                    id: segId, // ensure ID is stored if needed, or just rely on key
                    order: index,
                    criteria: criteriaMap
                };
            });

            // We replace the entire segments node
            await update(ref(db, `events/${eventId}`), { segments: segmentMap });

            // Update initial state is handled by the onValue listener which will fire after write
            // But to avoid flicker/race, we might want to wait, but the listener is fast.
            setIsSaving(false);
            // setHasChanges(false) handled by useEffect
        } catch (error) {
            console.error("Failed to save", error);
            alert("Failed to save changes");
            setIsSaving(false);
        }
    };

    // Calculate total weight
    const totalWeight = segments.reduce((acc, seg) => acc + (seg.weight || 0), 0);
    const isWeightValid = Math.abs(totalWeight - 100) < 0.1; // Allow small float margin

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">Segments</h1>
                        <div className="flex items-center gap-3">
                            <Button onClick={addSegment} className="flex items-center gap-2 shadow-lg shadow-blue-200/50">
                                <Plus size={18} /> New Segment
                            </Button>
                            {hasChanges && (
                                <Button
                                    onClick={saveChanges}
                                    disabled={!isWeightValid || isSaving}
                                    className={clsx(
                                        "flex items-center gap-2 transition-all",
                                        isWeightValid
                                            ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200/50"
                                            : "bg-gray-400 cursor-not-allowed"
                                    )}
                                >
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </Button>
                            )}
                        </div>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={segments.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {segments.map(segment => (
                                    <SortableSegmentItem
                                        key={segment.id}
                                        segment={segment}
                                        updateSegment={updateSegment}
                                        deleteSegment={deleteSegment}
                                        addCriterion={addCriterion}
                                        deleteCriterion={deleteCriterion}
                                        updateCriterion={updateCriterion}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {segments.length === 0 && (
                        <div className="text-center py-16 bg-white/20 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300">
                            <p className="text-gray-500 font-medium">No segments defined yet.</p>
                            <Button variant="secondary" onClick={addSegment} className="mt-4">
                                Create your first segment
                            </Button>
                        </div>
                    )}
                </div>

                {/* Sidebar / Validation Panel */}
                <div className="lg:col-span-1 sticky top-8">
                    <div className={clsx(
                        "rounded-2xl p-6 shadow-xl backdrop-blur-md border transition-colors duration-500",
                        isWeightValid
                            ? "bg-green-50/80 border-green-200 shadow-green-100"
                            : "bg-amber-50/80 border-amber-200 shadow-amber-100"
                    )}>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Configuration Status</h2>

                        <div className="space-y-6">
                            {/* Total Weight Indicator */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-medium text-gray-700">Total Weight</span>
                                    <span className={clsx(
                                        "text-3xl font-black tabular-nums",
                                        isWeightValid ? "text-green-600" : "text-amber-600"
                                    )}>
                                        {totalWeight}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={clsx("h-2.5 rounded-full transition-all duration-500", isWeightValid ? "bg-green-500" : "bg-amber-500")}
                                        style={{ width: `${Math.min(totalWeight, 100)}%` }}
                                    ></div>
                                </div>
                                {!isWeightValid && (
                                    <div className="mt-2 text-xs text-amber-700 font-medium flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        <span>Total weight must be exactly 100%</span>
                                    </div>
                                )}
                                {isWeightValid && (
                                    <div className="mt-2 text-xs text-green-700 font-medium flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        <span>Configuration valid</span>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200/50">
                                <div>
                                    <div className="text-2xl font-bold text-gray-800">{segments.length}</div>
                                    <div className="text-xs text-gray-500 font-medium">Segments</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-800">
                                        {segments.reduce((acc, s) => acc + (s.criteria ? Object.keys(s.criteria).length : 0), 0)}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">Total Criteria</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

