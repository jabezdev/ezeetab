import React, { useEffect, useState, useRef } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, update, push, onDisconnect, set } from 'firebase/database';
import { Button } from '../../components/common/Button';
import { Lock, CheckCircle, Menu, MessageSquare, Unlock, AlertTriangle } from 'lucide-react';
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
    const [segment, setSegment] = useState<Segment | null>(null);

    // Selection State (Judge can browse, but defaults to active)
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [showRoster, setShowRoster] = useState(false);

    // Scoring State for Selected Candidate
    const [scores, setScores] = useState<{ [key: string]: number }>({});
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
                // We're connected (or reconnected)!

                // When I disconnect, update the status to offline
                onDisconnect(judgeStatusRef).set('offline');
                onDisconnect(judgeLastSeenRef).set(Date.now());

                // Set status to online
                set(judgeStatusRef, 'online');
            } else {
                // Client is offline (handled by onDisconnect on server side usually, 
                // but this block runs if client loses internet)
            }
        });

        // Ping Listener - could enable a toast here
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

    // Listen to Event State & Candidates
    useEffect(() => {
        if (!eventId) return;

        // State
        onValue(ref(db, `events/${eventId}/state`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setActiveCandidateId(data.activeCandidateId);
                setActiveSegmentId(data.activeSegmentId);
                setTieBreaker(data.tieBreaker || null);

                // If we haven't selected anyone yet, or if the active candidate changes 
                // and the judge hasn't explicitly navigated away (logic can be complex, 
                // for MVP let's auto-switch to active if standard flow)
                // Actually, let's auto-switch only if we are not "locked" on another candidate?
                // Request says "Judges have the roster... can click around... indicator on who is on stage".
                // So we shouldn't force switch if they are browsing.
                // But initially, yes.
            }
        });

        // Candidates
        onValue(ref(db, `events/${eventId}/candidates`), (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            list.sort((a, b) => a.number - b.number);
            setCandidates(list);
        });

    }, [eventId]);

    // Set initial selection
    useEffect(() => {
        if (activeCandidateId && !selectedCandidateId) {
            setSelectedCandidateId(activeCandidateId);
        }
    }, [activeCandidateId, selectedCandidateId]);

    // Fetch Segment Criteria
    useEffect(() => {
        if (!eventId || !activeSegmentId) {
            setSegment(null);
            return;
        }
        onValue(ref(db, `events/${eventId}/segments/${activeSegmentId}`), (snapshot) => {
            setSegment(snapshot.val());
        });
    }, [eventId, activeSegmentId]);

    // Fetch Scores for Selected Candidate
    useEffect(() => {
        if (!eventId || !activeSegmentId || !selectedCandidateId || !judgeId) return;

        // Reset local state instantly to avoid flashing previous candidate's data
        setScores({});
        setNotes('');
        setIsLocked(false);
        setUnlockRequested(false);

        const scoreRef = ref(db, `events/${eventId}/scores/${activeSegmentId}/${selectedCandidateId}/${judgeId}`);
        const unsubScore = onValue(scoreRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setScores(data.criteriaScores || {});
                setNotes(data.notes || '');
                setIsLocked(!!data.locked);
            }
        });

        // check for pending unlock request
        // We query the unlockRequests collection
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

        return () => {
            unsubScore();
            unsubReq();
        }
    }, [eventId, activeSegmentId, selectedCandidateId, judgeId]);

    const handleScoreChange = (criterionId: string, value: string, max: number) => {
        if (isLocked) return;
        let numVal = value === '' ? 0 : parseFloat(value);
        if (isNaN(numVal)) numVal = 0;
        if (numVal < 0) numVal = 0;
        if (numVal > max) numVal = max;

        const newScores = { ...scores, [criterionId]: numVal };
        setScores(newScores);
        debouncedSave(newScores, notes);
    };

    const handleNotesChange = (val: string) => {
        if (isLocked) return;
        setNotes(val);
        debouncedSave(scores, val);
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
        if (!segment?.criteria) return;
        const missing = Object.keys(segment.criteria).some(id => scores[id] === undefined);
        if (missing) {
            showAlert('Please score all criteria before submitting.');
            return;
        }

        const confirmed = await showConfirm('Lock in scores? You will not be able to edit them.', { confirmLabel: 'Lock In' });
        if (confirmed) {
            await update(ref(db, `events/${eventId}/scores/${activeSegmentId}/${selectedCandidateId}/${judgeId}`), {
                criteriaScores: scores,
                notes: notes,
                total: Object.values(scores).reduce((a: number, b: any) => a + b, 0),
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

    const activeCandidate = candidates.find(c => c.id === activeCandidateId);
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
        return <div className="p-8 text-center text-gray-500">Waiting for event to start...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col relative overflow-hidden">
            {/* Roster Drawer / Sidebar */}
            <div
                className={clsx(
                    "fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
                    showRoster ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                    <h2 className="font-bold uppercase tracking-wider">Roster</h2>
                    <button onClick={() => setShowRoster(false)} className="p-2 hover:bg-gray-800 rounded-full">
                        <Menu size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto h-full pb-20">
                    {candidates.map(c => (
                        <button
                            key={c.id}
                            onClick={() => { setSelectedCandidateId(c.id); setShowRoster(false); }}
                            className={clsx(
                                "w-full p-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors text-left",
                                selectedCandidateId === c.id && "bg-blue-50 border-l-4 border-blue-500",
                                activeCandidateId === c.id && !selectedCandidateId && "bg-yellow-50"
                            )}
                        >
                            <div>
                                <div className="text-xs text-gray-400 font-bold uppercase">#{c.number}</div>
                                <div className="font-bold text-gray-800">{c.name}</div>
                            </div>
                            {activeCandidateId === c.id && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full animate-pulse">
                                    On Stage
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Overlay for Roster */}
            {showRoster && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    onClick={() => setShowRoster(false)}
                />
            )}

            {/* Header */}
            <div className={clsx("bg-gray-900 text-white p-4 shadow-md sticky top-0 z-30 transition-colors", !online && "bg-red-800")}>
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setShowRoster(true)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                            <Menu size={24} />
                        </button>
                        <div>
                            <div className="text-xs opacity-75 uppercase tracking-wider">{segment.name}</div>
                            <div className="font-bold text-lg">{judgeName}</div>
                        </div>
                    </div>

                    <div className="text-right">
                        {activeCandidateId && activeCandidateId !== selectedCandidateId && (
                            <button
                                onClick={() => setSelectedCandidateId(activeCandidateId)}
                                className="text-xs font-bold text-yellow-400 hover:text-yellow-300 mr-2 uppercase animate-pulse"
                            >
                                Live Now: #{activeCandidate?.number}
                            </button>
                        )}
                    </div>
                </div>
                {!online && <div className="text-center text-xs font-bold bg-red-900 p-1 mt-2 rounded">OFFLINE MODE - Queued Updates</div>}
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-6 pb-32">
                {selectedCandidate ? (
                    <>
                        {/* Candidate Info Card */}
                        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center text-center relative overflow-hidden">
                            {/* Indicator if this is NOT the active candidate */}
                            {activeCandidateId !== selectedCandidateId && (
                                <div className="absolute top-0 w-full bg-gray-200 text-gray-600 text-xs font-bold py-1 uppercase tracking-widest">
                                    Reviewing
                                </div>
                            )}
                            <h1 className="text-4xl font-black text-gray-900 mb-1 mt-2">#{selectedCandidate.number}</h1>
                            <h2 className="text-2xl font-bold text-gray-700">{selectedCandidate.name}</h2>
                            <p className="text-gray-500">{selectedCandidate.details}</p>
                        </div>

                        {/* Scoring Form */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700">Scorecard</h3>
                                {isLocked && <Lock size={16} className="text-gray-400" />}
                            </div>

                            <div className="p-6 space-y-8">
                                {segment.criteria && Object.entries(segment.criteria).map(([cId, crit]: [string, any]) => (
                                    <div key={cId} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <label className="font-medium text-gray-700">{crit.name}</label>
                                            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                                Max: {crit.maxScore}
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                disabled={isLocked}
                                                value={scores[cId] === undefined ? '' : scores[cId]}
                                                onChange={(e) => handleScoreChange(cId, e.target.value, crit.maxScore)}
                                                className={clsx(
                                                    "w-full text-3xl font-bold p-4 rounded-lg border-2 text-center transition-all focus:outline-none focus:ring-4",
                                                    isLocked
                                                        ? "bg-gray-50 border-gray-200 text-gray-500"
                                                        : "border-blue-100 focus:border-blue-500 focus:ring-blue-100 text-blue-900"
                                                )}
                                                placeholder="0"
                                            />
                                        </div>
                                        {/* range indicator */}
                                        <input
                                            type="range"
                                            min="0"
                                            max={crit.maxScore}
                                            step="0.1"
                                            disabled={isLocked}
                                            value={scores[cId] || 0}
                                            onChange={(e) => handleScoreChange(cId, e.target.value, crit.maxScore)}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                ))}

                                <div className="pt-4 border-t border-gray-100">
                                    <label className="flex items-center gap-2 font-bold text-gray-500 mb-2">
                                        <MessageSquare size={16} /> Notes
                                    </label>
                                    <textarea
                                        disabled={isLocked}
                                        value={notes}
                                        onChange={(e) => handleNotesChange(e.target.value)}
                                        placeholder="Add notes..."
                                        className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 min-h-[100px] text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
                            <div className="max-w-2xl mx-auto">
                                {!isLocked ? (
                                    <Button
                                        onClick={submitScores}
                                        size="lg"
                                        className="w-full py-4 text-lg shadow-blue-300 shadow-xl"
                                    >
                                        <Lock size={20} className="mr-2" /> Lock In Scores
                                    </Button>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-center gap-2 text-green-600 font-bold bg-green-50 p-2 rounded-lg border border-green-100">
                                            <CheckCircle size={20} /> Scores Locked
                                        </div>
                                        {unlockRequested ? (
                                            <Button disabled variant="secondary" className="w-full opacity-70">
                                                <Unlock size={18} className="mr-2 animate-pulse" /> Unlock Requested...
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" onClick={requestUnlock} className="w-full">
                                                Request Unlock
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="text-6xl mb-4 font-black text-gray-200">?</div>
                        Select a candidate from the menu
                    </div>
                )}
            </div>
        </div>
    );
};

