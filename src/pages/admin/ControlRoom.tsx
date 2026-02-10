import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { ChevronRight, CheckCircle, AlertCircle, Bell, Unlock, Gavel } from 'lucide-react';
import clsx from 'clsx';
import type { UnlockRequest, Candidate, Segment, Judge, TieBreakerState } from '../../types';

export const ControlRoom: React.FC = () => {
    const { eventId } = useParams();
    const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [tieBreaker, setTieBreaker] = useState<TieBreakerState | null>(null);

    const [segments, setSegments] = useState<Segment[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [scores, setScores] = useState<any>({});
    const [unlockRequests, setUnlockRequests] = useState<Record<string, UnlockRequest>>({});

    // Local state for tie breaker setup
    const [tieCandidates, setTieCandidates] = useState<string[]>([]);

    useEffect(() => {
        if (!eventId) return;

        // Listen to Event State
        const stateRef = ref(db, `events/${eventId}/state`);
        onValue(stateRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setActiveCandidateId(data.activeCandidateId);
                setActiveSegmentId(data.activeSegmentId);
                setTieBreaker(data.tieBreaker || null);
                setUnlockRequests(data.unlockRequests || {});
            }
        });

        // Fetch Data
        onValue(ref(db, `events/${eventId}/segments`), s => {
            const list = s.exists() ? Object.entries(s.val()).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            setSegments(list);
        });
        onValue(ref(db, `events/${eventId}/candidates`), s => {
            const list = s.exists() ? Object.entries(s.val()).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            list.sort((a, b) => a.number - b.number);
            setCandidates(list);
        });
        onValue(ref(db, `events/${eventId}/judges`), s => {
            setJudges(s.exists() ? Object.entries(s.val()).map(([k, v]: [string, any]) => ({ id: k, ...v })) : []);
        });
    }, [eventId]);

    // Listen to scores
    useEffect(() => {
        if (!eventId || !activeSegmentId) return;
        const scoresRef = ref(db, `events/${eventId}/scores/${activeSegmentId}`);
        return onValue(scoresRef, (snapshot) => {
            setScores(snapshot.val() || {});
        });
    }, [eventId, activeSegmentId]);

    const updateState = (updates: any) => {
        update(ref(db, `events/${eventId}/state`), updates);
    };

    const nextCandidate = () => {
        if (!candidates.length) return;
        const currentIndex = candidates.findIndex(c => c.id === activeCandidateId);
        const nextIndex = (currentIndex + 1) % candidates.length;
        updateState({ activeCandidateId: candidates[nextIndex].id });
    };

    const prevCandidate = () => {
        if (!candidates.length) return;
        const currentIndex = candidates.findIndex(c => c.id === activeCandidateId);
        const prevIndex = (currentIndex - 1 + candidates.length) % candidates.length;
        updateState({ activeCandidateId: candidates[prevIndex].id });
    };

    const pingJudge = (judgeId: string) => {
        set(ref(db, `events/${eventId}/pings/${judgeId}`), Date.now());
    };

    const approveUnlock = async (reqId: string, req: UnlockRequest) => {
        if (confirm('Unlock scorecard for this judge?')) {
            // Unlock the score
            await update(ref(db, `events/${eventId}/scores/${req.segmentId}/${req.candidateId}/${req.judgeId}`), {
                locked: false
            });
            // Remove request
            await remove(ref(db, `events/${eventId}/state/unlockRequests/${reqId}`));
        }
    };

    const rejectUnlock = async (reqId: string) => {
        if (confirm('Reject unlock request?')) {
            await remove(ref(db, `events/${eventId}/state/unlockRequests/${reqId}`));
        }
    };

    const toggleTieCandidate = (cId: string) => {
        setTieCandidates(prev => prev.includes(cId) ? prev.filter(id => id !== cId) : [...prev, cId]);
    };

    const startTieBreaker = () => {
        if (tieCandidates.length < 2) return alert("Select at least 2 candidates");
        updateState({
            tieBreaker: {
                active: true,
                candidates: tieCandidates,
                votes: {}
            }
        });
        setTieCandidates([]); // Clear local selection
    };

    const endTieBreaker = () => {
        if (confirm("End Tie Breaker?")) {
            updateState({ tieBreaker: null });
        }
    };

    const getJudgeStatus = (judgeId: string) => {
        if (!activeCandidateId || !activeSegmentId) return 'waiting';
        const candidateScores = scores[activeCandidateId];
        if (candidateScores && candidateScores[judgeId]) {
            if (candidateScores[judgeId].locked) return 'submitted';
            return 'scoring';
        }
        return 'waiting';
    };

    const activeCandidate = candidates.find(c => c.id === activeCandidateId);

    // Filter unlock requests to show valid ones
    const pendingRequests = Object.entries(unlockRequests).map(([k, v]) => ({ id: k, ...v }));

    return (
        <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel: Controls */}
            <div className="lg:col-span-2 space-y-6">

                {/* Tie Breaker Module */}
                <div className={clsx("p-6 rounded-xl shadow-sm border", tieBreaker?.active ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-200")}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center gap-2">
                            <Gavel size={18} className={tieBreaker?.active ? "text-indigo-600" : "text-gray-400"} />
                            Tie Breaker Control
                        </h3>
                        {tieBreaker?.active && (
                            <Button variant="danger" size="sm" onClick={endTieBreaker}>End Tie Breaker</Button>
                        )}
                    </div>

                    {!tieBreaker?.active ? (
                        <div className="space-y-4">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {candidates.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => toggleTieCandidate(c.id)}
                                        className={clsx(
                                            "flex-shrink-0 px-3 py-2 rounded border text-sm font-medium transition-colors",
                                            tieCandidates.includes(c.id)
                                                ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        #{c.number} {c.name}
                                    </button>
                                ))}
                            </div>
                            <Button onClick={startTieBreaker} disabled={tieCandidates.length < 2} className="w-full">
                                Start Tie Breaker ({tieCandidates.length})
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 mb-2">Live Votes</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {(tieBreaker.candidates || []).map(cId => {
                                    const candidate = candidates.find(c => c.id === cId);
                                    const voteCount = Object.values(tieBreaker.votes || {}).filter(v => v === cId).length;
                                    return (
                                        <div key={cId} className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                                            <span className="font-medium">#{candidate?.number} {candidate?.name}</span>
                                            <span className="font-black text-xl text-indigo-600">{voteCount}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 text-xs text-gray-500">
                                Total Votes: {Object.keys(tieBreaker.votes || {}).length} / {judges.length}
                            </div>
                        </div>
                    )}
                </div>

                {/* Segment Selector */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Segment</label>
                        {activeSegmentId && <span className="text-xs font-mono text-gray-400">ID: {activeSegmentId}</span>}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {segments.map(seg => (
                            <button
                                key={seg.id}
                                onClick={() => updateState({ activeSegmentId: seg.id })}
                                className={clsx(
                                    "px-4 py-2 rounded-lg font-medium transition-all text-sm",
                                    activeSegmentId === seg.id
                                        ? "bg-blue-600 text-white shadow-md transform scale-105"
                                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
                                )}
                            >
                                {seg.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Candidate Control */}
                <div className="bg-white p-8 rounded-xl shadow-lg border border-blue-50 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                    <label className="block text-xs font-bold text-gray-400 uppercase mb-6 tracking-widest">Now Judging</label>

                    {activeCandidate ? (
                        <div className="mb-10 animate-in fade-in zoom-in duration-300">
                            <div className="text-8xl font-black text-gray-900 mb-2 tracking-tighter tabular-nums">
                                {activeCandidate.number}
                            </div>
                            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                {activeCandidate.name}
                            </div>
                            {activeCandidate.details && (
                                <div className="text-gray-500 mt-2 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full text-sm">
                                    {activeCandidate.details}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-16 flex flex-col items-center justify-center text-gray-300">
                            <AlertCircle size={48} className="mb-4 opacity-50" />
                            <span className="text-xl font-medium">Stage is Empty</span>
                        </div>
                    )}

                    <div className="flex justify-center gap-4 border-t border-gray-100 pt-8">
                        <Button variant="secondary" onClick={prevCandidate} disabled={!activeCandidate}>Previous</Button>
                        <Button size="lg" onClick={nextCandidate} className="px-8 shadow-blue-200 shadow-lg">
                            Next Candidate <ChevronRight className="ml-2" size={20} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Judge Status */}
            <div className="space-y-6">
                {/* Unlock Requests */}
                {pendingRequests.length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm animate-pulse-slow">
                        <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                            <Unlock size={18} /> Unlock Requests ({pendingRequests.length})
                        </h3>
                        <div className="space-y-2">
                            {pendingRequests.map(req => {
                                const judge = judges.find(j => j.id === req.judgeId);
                                const candidate = candidates.find(c => c.id === req.candidateId);
                                return (
                                    <div key={req.id} className="bg-white p-3 rounded shadow-sm text-sm">
                                        <div className="font-medium text-gray-800">
                                            {judge?.name} for #{candidate?.number}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <Button size="sm" onClick={() => approveUnlock(req.id, req)} className="bg-green-600 hover:bg-green-700 text-white text-xs py-1">Approve</Button>
                                            <Button size="sm" variant="danger" onClick={() => rejectUnlock(req.id)} className="text-xs py-1">Reject</Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="bg-white p-0 rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Judge Status</h3>
                        <span className="text-xs font-bold bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-500">
                            {judges.length} Judges
                        </span>
                    </div>

                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                        {judges.map(judge => {
                            const status = getJudgeStatus(judge.id);
                            return (
                                <div key={judge.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${status === 'submitted' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <span className="font-medium text-gray-700 text-sm w-24 truncate" title={judge.name}>{judge.name}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {status === 'submitted' ? (
                                            <span className="flex items-center text-green-600 text-xs font-bold uppercase bg-green-50 px-2 py-1 rounded">
                                                <CheckCircle size={12} className="mr-1" /> Done
                                            </span>
                                        ) : status === 'scoring' ? (
                                            <span className="flex items-center text-blue-600 text-xs font-bold uppercase animate-pulse">
                                                Scoring
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs font-medium uppercase">
                                                Wait
                                            </span>
                                        )}

                                        <button
                                            onClick={() => pingJudge(judge.id)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                            title="Ping Judge"
                                        >
                                            <Bell size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {judges.length === 0 && (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                Configure judges in the "Judges" tab.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
