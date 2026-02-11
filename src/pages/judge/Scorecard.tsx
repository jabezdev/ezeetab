import React, { useEffect, useState, useRef } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, update, push, onDisconnect, set } from 'firebase/database';
import { Button } from '../../components/common/Button';
import { Lock, CheckCircle, MessageSquare, Unlock, AlertTriangle, User, Star } from 'lucide-react';
import clsx from 'clsx';
import type { Candidate, Segment, TieBreakerState } from '../../types';
import { useModal } from '../../contexts/ModalContext';

export const Scorecard: React.FC = () => {
    const { showAlert, showConfirm } = useModal();
    // Auth State
    const [judgeId] = useState<string | null>(() => localStorage.getItem('tabulate_userId'));
    const [eventId] = useState<string | null>(() => localStorage.getItem('tabulate_eventId'));
    const [judgeName, setJudgeName] = useState<string>('');

    // Event State
    const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [tieBreaker, setTieBreaker] = useState<TieBreakerState | null>(null);

    // Data
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);

    // Scores State (All scores for this judge in the active segment)
    const [judgeScores, setJudgeScores] = useState<Record<string, any>>({}); // candidateId -> scoreData

    // Selection State
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

    // Scoring State for Selected Candidate
    const [currentScores, setCurrentScores] = useState<{ [key: string]: number }>({});
    const [notes, setNotes] = useState<string>('');
    const [isLocked, setIsLocked] = useState(false);
    const [unlockRequested, setUnlockRequested] = useState(false);

    // Tie Breaker State
    const [selectedTieCandidate, setSelectedTieCandidate] = useState<string | null>(null);

    const [online, setOnline] = useState(navigator.onLine);

    // Refs for auto-save debounce
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const storedRole = localStorage.getItem('tabulate_role');
        if (storedRole !== 'judge' || !eventId || !judgeId) {
            window.location.href = '/login';
            return;
        }

        onValue(ref(db, `events/${eventId}/judges/${judgeId}/name`), s => {
            setJudgeName(s.val() || 'Judge');
        });

        // Presence System
        const connectedRef = ref(db, '.info/connected');
        const judgeStatusRef = ref(db, `events/${eventId}/judges/${judgeId}/status`);
        const judgeLastSeenRef = ref(db, `events/${eventId}/judges/${judgeId}/lastSeen`);

        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(judgeStatusRef).set('offline');
                onDisconnect(judgeLastSeenRef).set(Date.now());
                set(judgeStatusRef, 'online');
            }
        });

        // Ping Listener
        onValue(ref(db, `events/${eventId}/pings/${judgeId}`), s => {
            if (s.exists() && Date.now() - s.val() < 10000) {
                showAlert("Admin is requesting your attention!", { title: 'Attention' });
            }
        });

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [eventId, judgeId]);

    // Listen to Event State & Candidates & Segments
    useEffect(() => {
        if (!eventId) return;

        // State
        onValue(ref(db, `events/${eventId}/state`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // If active candidate changes, we DON'T force switch selection if user is clicking around
                // But we update the "On Stage" indicator
                setActiveCandidateId(data.activeCandidateId);

                // If segment changes, we might need to reset view
                if (data.activeSegmentId !== activeSegmentId) {
                    setActiveSegmentId(data.activeSegmentId);
                }

                setTieBreaker(data.tieBreaker || null);
            }
        });

        // Candidates
        onValue(ref(db, `events/${eventId}/candidates`), (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            list.sort((a, b) => a.number - b.number);
            setCandidates(list);
        });

        // Segments
        onValue(ref(db, `events/${eventId}/segments`), (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            list.sort((a, b) => (a.order || 0) - (b.order || 0));
            setSegments(list);
        });

    }, [eventId]);

    // Fetch all scores for the active segment to show completion status in grid
    useEffect(() => {
        if (!eventId || !activeSegmentId || !judgeId) {
            setJudgeScores({});
            return;
        }

        const segmentScoresRef = ref(db, `events/${eventId}/scores/${activeSegmentId}`);
        const unsub = onValue(segmentScoresRef, (snapshot) => {
            const data = snapshot.val(); // { candidateId: { judgeId: { ... } } }
            const myScores: Record<string, any> = {};

            if (data) {
                Object.entries(data).forEach(([cId, judgesData]: [string, any]) => {
                    if (judgesData[judgeId]) {
                        myScores[cId] = judgesData[judgeId];
                    }
                });
            }
            setJudgeScores(myScores);
        });

        return () => unsub();
    }, [eventId, activeSegmentId, judgeId]);

    // Initial Selection: if nothing selected, select active
    useEffect(() => {
        if (activeCandidateId && !selectedCandidateId) {
            setSelectedCandidateId(activeCandidateId);
        }
    }, [activeCandidateId, selectedCandidateId]);

    // When selection changes or segment changes, update local scoring state
    useEffect(() => {
        if (!eventId || !activeSegmentId || !selectedCandidateId || !judgeId) return;

        // If we have the data in judgeScores, use it seamlessly
        const existingData = judgeScores[selectedCandidateId];

        if (existingData) {
            setCurrentScores(existingData.criteriaScores || {});
            setNotes(existingData.notes || '');
            setIsLocked(!!existingData.locked);
        } else {
            setCurrentScores({});
            setNotes('');
            setIsLocked(false);
        }

        // Check for pending unlock request
        const reqRef = ref(db, `events/${eventId}/state/unlockRequests`);
        const unsubReq = onValue(reqRef, (snapshot) => {
            const reqs = snapshot.val();
            if (reqs) {
                const found = Object.values(reqs).find((r: any) =>
                    r.judgeId === judgeId &&
                    r.candidateId === selectedCandidateId &&
                    r.segmentId === activeSegmentId &&
                    r.status === 'pending'
                );
                setUnlockRequested(!!found);
            } else {
                setUnlockRequested(false);
            }
        });

        return () => unsubReq();
    }, [eventId, activeSegmentId, selectedCandidateId, judgeId, judgeScores]);

    // --- Scoring Logic ---
    const handleScoreChange = (criterionId: string, value: string, max: number) => {
        if (isLocked) return;
        let numVal = value === '' ? 0 : parseFloat(value);
        if (isNaN(numVal)) numVal = 0;
        if (numVal < 0) numVal = 0;
        if (numVal > max) numVal = max;

        const newScores = { ...currentScores, [criterionId]: numVal };
        setCurrentScores(newScores);
        debouncedSave(newScores, notes);
    };

    const handleNotesChange = (val: string) => {
        if (isLocked) return;
        setNotes(val);
        debouncedSave(currentScores, val);
    }

    const debouncedSave = (s: any, n: string) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            if (judgeId && eventId && activeSegmentId && selectedCandidateId) {
                update(ref(db, `events/${eventId}/scores/${activeSegmentId}/${selectedCandidateId}/${judgeId}`), {
                    criteriaScores: s,
                    notes: n,
                    total: Object.values(s).reduce((a: number, b: any) => a + b, 0),
                    locked: false
                });
            }
        }, 500);
    };

    const submitScores = async () => {
        const segment = segments.find(s => s.id === activeSegmentId);
        if (!segment?.criteria) return;

        const missing = Object.keys(segment.criteria).some(id => currentScores[id] === undefined);
        if (missing) {
            showAlert('Please score all criteria before submitting.');
            return;
        }

        const confirmed = await showConfirm('Lock in scores? You will not be able to edit them.', { confirmLabel: 'Lock In' });
        if (confirmed) {
            await update(ref(db, `events/${eventId}/scores/${activeSegmentId}/${selectedCandidateId}/${judgeId}`), {
                criteriaScores: currentScores,
                notes: notes,
                total: Object.values(currentScores).reduce((a: number, b: any) => a + b, 0),
                locked: true,
                submittedAt: Date.now()
            });
            setIsLocked(true);
        }
    };

    const requestUnlock = async () => {
        const confirmed = await showConfirm('Request admin to unlock this score?');
        if (confirmed) {
            await push(ref(db, `events/${eventId}/state/unlockRequests`), {
                judgeId,
                candidateId: selectedCandidateId,
                segmentId: activeSegmentId,
                timestamp: Date.now(),
                status: 'pending'
            });
            setUnlockRequested(true);
        }
    };

    const submitTieVote = async () => {
        if (!selectedTieCandidate || !tieBreaker) return;
        const confirmed = await showConfirm(`Vote for candidate #${candidates.find(c => c.id === selectedTieCandidate)?.number}?`, { confirmLabel: 'Vote' });
        if (confirmed) {
            await update(ref(db, `events/${eventId}/state/tieBreaker/votes`), {
                [judgeId!]: selectedTieCandidate
            });
            showAlert("Vote submitted!", { title: 'Success' });
        }
    };

    // --- Helpers ---
    const segment = segments.find(s => s.id === activeSegmentId);
    const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);

    // Tie Breaker View
    if (tieBreaker?.active) {
        const tieCandidates = candidates.filter(c => tieBreaker.candidates?.includes(c.id));
        return (
            <div className="min-h-screen bg-indigo-900 text-white flex flex-col items-center justify-center p-6">
                <AlertTriangle size={64} className="mb-6 text-yellow-400 animate-pulse" />
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">Tie Breaker</h1>
                <p className="mb-8 text-indigo-200">Please select the winner from the tied candidates.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                    {tieCandidates.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedTieCandidate(c.id)}
                            className={clsx(
                                "p-8 rounded-xl border-4 transition-all flex flex-col items-center gap-4",
                                selectedTieCandidate === c.id
                                    ? "bg-white text-indigo-900 border-yellow-400 transform scale-105 shadow-2xl"
                                    : "bg-indigo-800 border-indigo-700 hover:bg-indigo-700 text-white"
                            )}
                        >
                            <div className="text-6xl font-black">#{c.number}</div>
                            <div className="text-2xl font-bold">{c.name}</div>
                        </button>
                    ))}
                </div>

                <Button
                    size="lg"
                    className="mt-12 px-12 py-4 text-xl font-bold bg-yellow-400 text-yellow-900 hover:bg-yellow-300"
                    disabled={!selectedTieCandidate}
                    onClick={submitTieVote}
                >
                    Submit Vote
                </Button>
            </div>
        );
    }

    if (!activeSegmentId || !segment || !candidates.length) {
        return <div className="h-screen flex items-center justify-center text-gray-500 font-bold bg-gray-50">Waiting for event to start...</div>;
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
            {/* Top Bar: Segments */}
            <div className="bg-gray-900 text-white shadow-md z-20 flex-shrink-0">
                <div className="flex items-center">
                    <div className="px-6 py-4 border-r border-gray-800 flex items-center gap-3">
                        <div className="bg-indigo-600 rounded-lg p-2">
                            <Star size={20} className="text-white fill-current" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Judge</div>
                            <div className="font-bold leading-none">{judgeName}</div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto flex items-center no-scrollbar">
                        {segments.map(s => {
                            const isActive = s.id === activeSegmentId;
                            return (
                                <div
                                    key={s.id}
                                    className={clsx(
                                        "px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-r border-gray-800",
                                        isActive ? "bg-indigo-900 text-white" : "text-gray-500 bg-gray-900"
                                    )}
                                >
                                    {isActive && <span className="mr-2 text-indigo-400">●</span>}
                                    {s.name}
                                </div>
                            );
                        })}
                    </div>

                    {!online && (
                        <div className="px-4 py-2 bg-red-600 text-white text-xs font-bold animate-pulse">
                            OFFLINE
                        </div>
                    )}
                </div>
            </div>

            {/* Main Layout: 3 Columns */}
            <div className="flex-1 flex overflow-hidden">

                {/* COL 1: Roster Grid (40%) */}
                <div className="w-[40%] bg-gray-100 border-r border-gray-200 overflow-y-auto p-4 z-10">
                    <div className="grid grid-cols-3 gap-3">
                        {candidates.map(c => {
                            const isSelected = selectedCandidateId === c.id;
                            const isOnStage = activeCandidateId === c.id;
                            const hasScore = judgeScores[c.id];
                            const isLocked = hasScore?.locked;

                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCandidateId(c.id)}
                                    className={clsx(
                                        "relative group rounded-lg overflow-hidden shadow-sm transition-all text-left flex flex-col bg-white",
                                        isSelected
                                            ? "ring-2 ring-indigo-500 z-10 scale-[1.02] shadow-md"
                                            : "hover:shadow hover:scale-[1.02]",
                                        isLocked
                                            ? "border border-green-200"
                                            : "border border-gray-200"
                                    )}
                                >
                                    {/* Image Thumbnail */}
                                    <div className="aspect-square bg-gray-200 relative overflow-hidden">
                                        {c.photoUrl ? (
                                            <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                                                <User size={32} />
                                            </div>
                                        )}

                                        {/* Number Badge */}
                                        <div className="absolute top-1 left-1">
                                            <span className="bg-gray-900/80 text-white px-1.5 py-0.5 rounded text-[10px] font-black">
                                                #{c.number}
                                            </span>
                                        </div>

                                        {isOnStage && (
                                            <div className="absolute top-1 right-1">
                                                <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse shadow-sm">
                                                    Live
                                                </span>
                                            </div>
                                        )}

                                        {isLocked && (
                                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                                <div className="bg-green-500 text-white rounded-full p-1 shadow-sm">
                                                    <CheckCircle size={16} strokeWidth={3} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="p-2">
                                        <div className="font-bold text-gray-900 text-xs truncate leading-tight">{c.name}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* COL 2: Image & Details (40%) */}
                <div className="w-[40%] bg-white border-r border-gray-200 relative flex flex-col">
                    {selectedCandidate ? (
                        <>
                            {/* Candidate Image Top */}
                            <div className="flex-1 bg-gray-100 relative overflow-hidden group">
                                {selectedCandidate.photoUrl ? (
                                    <img src={selectedCandidate.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={96} /></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent opacity-80" />

                                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                                    <h1 className="text-7xl font-black tracking-tighter mb-2">#{selectedCandidate.number}</h1>
                                    <h2 className="text-4xl font-bold leading-tight">{selectedCandidate.name}</h2>
                                </div>
                            </div>

                            {/* Scrollable Details Bottom */}
                            <div className="h-1/3 p-8 bg-white overflow-y-auto">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b pb-2">Candidate Profile</h3>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    {selectedCandidate.details}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-300 flex-col gap-4">
                            <User size={64} className="opacity-50" />
                            <p>Select Candidate</p>
                        </div>
                    )}
                </div>

                {/* COL 3: Criteria & Scoring (20%) */}
                <div className="w-[20%] bg-gray-50 flex flex-col overflow-hidden shadow-inner font-mono z-20">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="pb-4 border-b border-gray-200">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Scoring</h3>
                            <div className="font-bold text-indigo-600">{segment.name}</div>
                        </div>

                        {selectedCandidate ? (
                            <div className="space-y-6">
                                {segment.criteria && Object.entries(segment.criteria).map(([cId, crit]: [string, any]) => (
                                    <div key={cId} className="space-y-1">
                                        <div className="flex justify-between items-end text-sm">
                                            <label className="font-bold text-gray-700 leading-tight block w-2/3">{crit.name}</label>
                                            <span className="text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">/{crit.maxScore}</span>
                                        </div>
                                        <input
                                            type="number"
                                            disabled={isLocked}
                                            value={currentScores[cId] === undefined ? '' : currentScores[cId]}
                                            onChange={(e) => handleScoreChange(cId, e.target.value, crit.maxScore)}
                                            className={clsx(
                                                "w-full text-2xl font-black bg-white border outline-none transition-all p-3 rounded-lg text-right shadow-sm",
                                                isLocked
                                                    ? "border-gray-200 text-gray-400 bg-gray-50"
                                                    : "border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-indigo-900"
                                            )}
                                            placeholder="0"
                                        />
                                    </div>
                                ))}

                                <div className="pt-4 border-t border-gray-200">
                                    <textarea
                                        disabled={isLocked}
                                        value={notes}
                                        onChange={(e) => handleNotesChange(e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all resize-none text-xs min-h-[80px]"
                                        placeholder="Notes..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 text-sm py-12 italic">
                                Select a candidate to view criteria
                            </div>
                        )}
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        {selectedCandidate && (
                            <>
                                {!isLocked ? (
                                    <Button
                                        onClick={submitScores}
                                        size="lg"
                                        className="w-full py-3 text-sm font-bold shadow-lg shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                                    >
                                        <Lock size={16} className="mr-2" /> Lock In
                                    </Button>
                                ) : (
                                    <div className="space-y-2 w-full">
                                        <div className="text-center p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 font-bold flex items-center justify-center gap-2 text-xs">
                                            <CheckCircle size={14} />
                                            <span>Locked</span>
                                        </div>
                                        {unlockRequested ? (
                                            <Button disabled variant="secondary" className="w-full opacity-70 text-xs py-2">
                                                <Unlock size={12} className="mr-1 animate-pulse" /> Pending...
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" onClick={requestUnlock} className="w-full text-xs text-gray-400 hover:text-gray-600 py-2">
                                                Request Unlock
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
