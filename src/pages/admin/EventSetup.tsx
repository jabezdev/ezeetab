import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Save, Plus, Trash2, GripVertical, AlertCircle, CheckCircle } from 'lucide-react';
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
            "rounded-lg overflow-hidden border transition-all mb-4 group",
            isDragging
                ? "shadow-lg ring-2 ring-indigo-400 opacity-90 scale-105 bg-white dark:bg-gray-800"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
        )}>
            {/* Segment Header */}
            <div className="p-4 flex items-start gap-4 border-b border-gray-100 dark:border-gray-800">
                <div {...attributes} {...listeners} className="mt-2 cursor-grab text-gray-400 hover:text-indigo-500 p-1 transition-colors">
                    <GripVertical size={20} />
                </div>

                <div className="flex-1 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Segment Name</label>
                            <Input
                                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-all font-medium text-lg dark:text-white"
                                placeholder="E.g. Performance"
                                value={segment.name}
                                onChange={(e) => updateSegment(segment.id, 'name', e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Weight</label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold text-lg pr-8 text-right dark:text-white"
                                    placeholder="0"
                                    value={segment.weight}
                                    onChange={(e) => updateSegment(segment.id, 'weight', parseFloat(e.target.value) || 0)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>
                        <div className="pt-6">
                            <Button variant="danger" size="sm" onClick={() => deleteSegment(segment.id)} className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-100 dark:border-red-900/30">
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Criteria Section (Always Visible) */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        Criteria
                        <span className={clsx(
                            "text-xs px-2 py-0.5 rounded-full border",
                            isCriteriaValid
                                ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                        )}>
                            Total: {criteriaTotal}%
                        </span>
                    </h3>
                    <Button size="sm" onClick={() => addCriterion(segment.id)} className="bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-xs">
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
                                    className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-sm dark:text-white"
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
                                    className="w-full pl-10 pr-2 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-lg text-right outline-none transition-all dark:text-white"
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
                                    className="w-full pl-10 pr-2 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-lg text-right outline-none transition-all dark:text-white"
                                />
                                <span className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>
                            </div>

                            <button
                                onClick={() => deleteCriterion(segment.id, cid)}
                                className="text-gray-300 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover/criterion:opacity-100"
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

export const EventSetup: React.FC = () => {
    const { eventId } = useParams();

    // Event Details State
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventStatus, setEventStatus] = useState('setup');

    // Segments State
    const [segments, setSegments] = useState<Segment[]>([]);

    // Loading & Saving State
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const eventRef = ref(db, `events/${eventId}`);
        const unsubscribe = onValue(eventRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setEventName(data.name || '');
                setEventDate(data.date || '');
                setEventStatus(data.status || 'setup');

                // Handle Segments
                const segmentsData = data.segments;
                const list = segmentsData ? Object.entries(segmentsData).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
                list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                // Only update segments if we are not currently editing/saving to avoid overwriting user valid input with DB updates if they are lagging
                // Actually, for real-time collaboration we might want to update, but for this "Save" button model we might probably just load once.
                // However, the previous EventSetup used real-time binding. 
                // Let's rely on the fact that if 'hasChanges' is true, we might want to be careful.
                // For simplicity, we'll load it initially and update it if we haven't touched it? 
                // Let's just update for now, standard Firebase pattern.
                setSegments(list as Segment[]);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, [eventId]);

    // Drag and Drop Handler
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setSegments((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                return newItems.map((item, index) => ({ ...item, order: index }));
            });
        }
    };

    // Segment Handlers
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
        if (confirm('Delete this segment?')) {
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

    // Derived State
    const totalWeight = segments.reduce((acc, seg) => acc + (seg.weight || 0), 0);
    const isWeightValid = Math.abs(totalWeight - 100) < 0.1;

    // Save All
    const saveAll = async () => {
        if (!isWeightValid) {
            alert("Total segment weight must be 100% before saving.");
            return;
        }

        setIsSaving(true);
        try {
            // Prepare Segments for DB
            const segmentMap: Record<string, any> = {};
            segments.forEach((seg, index) => {
                let segId = seg.id;
                if (segId.startsWith('temp_')) {
                    segId = `seg_${Math.random().toString(36).substr(2, 9)}`; // Consider better ID generation
                }

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
                    id: segId,
                    order: index,
                    criteria: criteriaMap
                };
            });

            // Update entire event object or fields
            await update(ref(db, `events/${eventId}`), {
                name: eventName,
                date: eventDate,
                status: eventStatus,
                segments: segmentMap
            });

            alert('Event setup saved successfully!');
        } catch (error) {
            console.error("Failed to save", error);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <AdminLayout
            title="Event Setup"
            backPath="/admin/dashboard"
            actions={
                <div className="flex items-center gap-2">
                    <span className={clsx(
                        "text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider",
                        eventStatus === 'active' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            eventStatus === 'completed' ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" :
                                "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    )}>
                        {eventStatus}
                    </span>
                </div>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Main Column */}
                <div className="lg:col-span-2 space-y-8">

                    {/* General Settings */}
                    <div className="rounded-lg p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">General Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Event Name"
                                value={eventName}
                                onChange={e => { setEventName(e.target.value); }}
                                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-all font-medium text-lg dark:text-white"
                            />
                            <Input
                                label="Event Date"
                                type="date"
                                value={eventDate ? new Date(eventDate).toISOString().split('T')[0] : ''}
                                onChange={e => { setEventDate(new Date(e.target.value).toISOString()); }}
                                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-all font-medium dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Event Status</label>
                            <div className="relative">
                                <select
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 font-medium text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all appearance-none"
                                    value={eventStatus}
                                    onChange={e => { setEventStatus(e.target.value); }}
                                >
                                    <option value="setup">Setup Mode (Preparing)</option>
                                    <option value="active">Active / Ongoing (Judges can vote)</option>
                                    <option value="completed">Completed (Results Final)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
                                <strong>Setup:</strong> Admin configuration only. <strong>Active:</strong> Judges can access results. <strong>Completed:</strong> Read-only.
                            </p>
                        </div>
                    </div>

                    {/* Segments Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Segments & Criteria</h2>
                            <Button onClick={addSegment} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm">
                                <Plus size={18} /> New Segment
                            </Button>
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
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <p className="text-gray-500 font-medium">No segments defined yet.</p>
                                <Button variant="secondary" onClick={addSegment} className="mt-4">
                                    Create your first segment
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar / Validation & Actions */}
                <div className="lg:col-span-1 sticky top-8 space-y-6">

                    {/* Status Card */}
                    <div className={clsx(
                        "rounded-lg p-6 border transition-colors duration-200",
                        isWeightValid
                            ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                            : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                    )}>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Validation</h2>

                        <div className="space-y-6">
                            {/* Total Weight Indicator */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Weight</span>
                                    <span className={clsx(
                                        "text-3xl font-black tabular-nums",
                                        isWeightValid ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                                    )}>
                                        {totalWeight}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={clsx("h-2.5 rounded-full transition-all duration-500", isWeightValid ? "bg-green-500" : "bg-amber-500")}
                                        style={{ width: `${Math.min(totalWeight, 100)}%` }}
                                    ></div>
                                </div>
                                {!isWeightValid && (
                                    <div className="mt-2 text-xs text-amber-700 dark:text-amber-500 font-medium flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        <span>Total weight must be exactly 100%</span>
                                    </div>
                                )}
                                {isWeightValid && (
                                    <div className="mt-2 text-xs text-green-700 dark:text-green-500 font-medium flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        <span>Configuration valid</span>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{segments.length}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Segments</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {segments.reduce((acc, s) => acc + (s.criteria ? Object.keys(s.criteria).length : 0), 0)}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">Total Criteria</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <Button
                        onClick={saveAll}
                        size="lg"
                        className={clsx(
                            "w-full flex justify-center items-center gap-2 py-4 text-lg shadow-sm",
                            isWeightValid
                                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400"
                        )}
                        disabled={!isWeightValid || isSaving}
                    >
                        {isSaving ? "Saving..." : <><Save size={20} /> Save All Settings</>}
                    </Button>

                </div>
            </div>
        </AdminLayout>
    );
};
