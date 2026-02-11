import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { db } from '../../services/firebase';
import { Button } from '../../components/common/Button';
import { CheckCircle, Bell, Unlock, Gavel, Play, User, Wifi, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import type { UnlockRequest, Candidate, Segment, Judge, TieBreakerState } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useModal } from '../../contexts/ModalContext';

export const ControlRoom: React.FC = () => {
    const { showAlert, showConfirm } = useModal();
    const { eventId } = useParams();
    const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [tieBreaker, setTieBreaker] = useState<TieBreakerState | null>(null);

    const [segments, setSegments] = useState<Segment[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [scores, setScores] = useState<any>({});
    const [unlockRequests, setUnlockRequests] = useState<Record<string, UnlockRequest>>({});

    // Local state for tie breaker setup - REMOVED manual setup
    // const [tieCandidates, setTieCandidates] = useState<string[]>([]);

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
            // Sort segments if they have an order field, otherwise rely on array order or add one
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

    const startPageant = async () => {
        const confirmed = await showConfirm("Are you sure you want to start the pageant? This will reset the active candidate and segment to the first available ones.");
        if (confirmed) {
            const firstSegment = segments[0];
            const firstCandidate = candidates[0];
            if (firstSegment && firstCandidate) {
                updateState({
                    activeSegmentId: firstSegment.id,
                    activeCandidateId: firstCandidate.id,
                    isPaused: false
                });
            } else {
                showAlert("Please ensure there are segments and candidates created before starting.");
            }
        }
    };

    const pingJudge = (judgeId: string) => {
        set(ref(db, `events/${eventId}/pings/${judgeId}`), Date.now());
        showAlert(`Pinged judge!`);
    };



    const approveUnlock = async (reqId: string, req: UnlockRequest) => {
        const confirmed = await showConfirm('Unlock scorecard for this judge?');
        if (confirmed) {
            // Unlock the score
            await update(ref(db, `events/${eventId}/scores/${req.segmentId}/${req.candidateId}/${req.judgeId}`), {
                locked: false
            });
            // Remove request
            await remove(ref(db, `events/${eventId}/state/unlockRequests/${reqId}`));
        }
    };

    const rejectUnlock = async (reqId: string) => {
        const confirmed = await showConfirm('Reject unlock request?', { destructive: true, confirmLabel: 'Reject' });
        if (confirmed) {
            await remove(ref(db, `events/${eventId}/state/unlockRequests/${reqId}`));
        }
    };

    // Calculated Ranks & Ties
    const currentRanks = React.useMemo(() => {
        if (!activeSegmentId || !candidates.length) return [];

        // 1. Calculate Totals
        const candidateTotals = candidates.map(c => {
            const cScores = scores[c.id] || {};
            // Sum locked scores only? Or all? Usually preliminary checks use all current inputs, 
            // but for a tie breaker, we probably want to wait until judges are done.
            // For now, let's sum everything to show "potential" ties live.
            const total = Object.values(cScores).reduce((acc: number, s: any) => acc + (s.total || 0), 0);
            return { ...c, total };
        });

        // 2. Sort Descending
        candidateTotals.sort((a, b) => b.total - a.total);

        return candidateTotals;
    }, [scores, candidates, activeSegmentId]);

    const detectedTies = React.useMemo(() => {
        if (currentRanks.length < 2) return [];

        const groups: { score: number, candidates: typeof currentRanks }[] = [];

        currentRanks.forEach(c => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && Math.abs(lastGroup.score - c.total) < 0.01) { // Float tolerance
                lastGroup.candidates.push(c);
            } else {
                groups.push({ score: c.total, candidates: [c] });
            }
        });

        // Filter for groups with > 1 candidate
        return groups.filter(g => g.candidates.length > 1).map((g, index) => ({
            rank: index + 1,
            score: g.score,
            candidates: g.candidates
        }));
    }, [currentRanks]);


    const startTieBreaker = (tieCandidates: string[]) => {
        if (tieCandidates.length < 2) return;

        updateState({
            tieBreaker: {
                active: true,
                candidates: tieCandidates,
                votes: {}
            }
        });
    };

    const endTieBreaker = async () => {
        const confirmed = await showConfirm("End Tie Breaker?", { destructive: true, confirmLabel: 'End' });
        if (confirmed) {
            updateState({ tieBreaker: null });
        }
    };



    const activeCandidate = candidates.find(c => c.id === activeCandidateId);

    // Sort segments order for tabs
    const sortedSegments = [...segments]; // Assuming they come in order or we can add .sort((a,b) => a.order - b.order)

    // Filter unlock requests
    const pendingRequests = Object.entries(unlockRequests).map(([k, v]) => ({ id: k, ...v }));


    return (
        <AdminLayout
            title="Control Room"
            backPath="/admin/dashboard"
            actions={
                <div className="flex gap-2 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    <span>ID: {eventId}</span>
                </div>
            }
        >
            <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
                {/* 1. Top Section: Master Control & Segments */}
                <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
                    <Button
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-900/20"
                        onClick={startPageant}
                    >
                        <Play size={20} className="mr-2 fill-current" /> Start Pageant
                    </Button>


                    {tieBreaker?.active && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg animate-pulse shadow-lg">
                            <Gavel size={16} />
                            <span className="font-bold text-sm">Tie Breaker Active</span>
                        </div>
                    )}

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                    <div className="flex-1 overflow-x-auto pb-1 scrollbar-hide">
                        <div className="flex gap-2">
                            {sortedSegments.map(seg => (
                                <button
                                    key={seg.id}
                                    onClick={() => updateState({ activeSegmentId: seg.id })}
                                    className={clsx(
                                        "px-5 py-2.5 rounded-md text-sm font-bold transition-all whitespace-nowrap border",
                                        activeSegmentId === seg.id
                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-900/20"
                                            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                    )}
                                >
                                    {seg.name}
                                </button>
                            ))}
                            {sortedSegments.length === 0 && (
                                <span className="text-gray-400 text-sm italic py-2">No segments configured</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Middle Section: Candidate Grid (Scrollable) */}
                <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col min-h-0">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wider">Candidates Stage</h3>
                        {activeCandidate && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-2 text-sm bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full">
                                Now Showing: #{activeCandidate.number} {activeCandidate.name}
                            </span>
                        )}
                    </div>

                    <div className="p-4 overflow-y-auto">
                        {/* Tie Breaker Overlay/Area if active */}
                        {tieBreaker?.active && (
                            <div className="mb-6 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                                        <Gavel size={20} /> Tie Breaker in Progress
                                    </h3>
                                    <Button variant="danger" size="sm" onClick={endTieBreaker}>End Tie Breaker</Button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {(tieBreaker.candidates || []).map(cId => {
                                        const candidate = candidates.find(c => c.id === cId);
                                        const voteCount = Object.values(tieBreaker.votes || {}).filter(v => v === cId).length;
                                        return (
                                            <div key={cId} className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-500 uppercase font-bold">Candidate</span>
                                                    <span className="font-medium dark:text-gray-200">#{candidate?.number} {candidate?.name}</span>
                                                </div>
                                                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                                                    {voteCount}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {candidates.map(candidate => {
                                const isActive = activeCandidateId === candidate.id;
                                return (
                                    <div
                                        key={candidate.id}
                                        onClick={() => updateState({ activeCandidateId: candidate.id })}
                                        className={clsx(
                                            "relative group cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md",
                                            isActive
                                                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 ring-2 ring-indigo-200 dark:ring-indigo-900 ring-offset-2 dark:ring-offset-gray-900"
                                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                                        )}
                                    >
                                        <div className="aspect-4/3 bg-gray-100 dark:bg-gray-900 relative">
                                            {candidate.photoUrl ? (
                                                <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                                                    <User size={48} />
                                                </div>
                                            )}
                                            {isActive && (
                                                <div className="absolute inset-0 bg-indigo-900/20 flex items-center justify-center">
                                                    <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                                                        ON STAGE
                                                    </span>
                                                </div>
                                            )}
                                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm">
                                                #{candidate.number}
                                            </div>
                                        </div>
                                        <div className="p-3 text-center">
                                            <h4 className="font-bold text-gray-900 dark:text-gray-100 truncate">{candidate.name}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{candidate.details || 'Contestant'}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Section: Split View 70:30 */}
                <div className="h-1/3 flex gap-6 shrink-0 min-h-[250px]">
                    {/* Left: Judge Live View (70%) */}
                    {/* Left: Judge Live View (70%) */}
                    <div className="w-[70%] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col shadow-sm overflow-hidden">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 flex justify-between items-center">
                            <div className="flex gap-4 items-center">
                                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                    <Wifi size={16} className="text-green-500" /> Live Judge Activity
                                </h3>
                                <span className="text-xs bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400 font-mono">
                                    {judges.length} Active
                                </span>
                            </div>
                            {/* Legend */}
                            <div className="flex gap-3 text-xs">
                                <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700"></span> Pending</span>
                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Clock size={12} /> Scoring</span>
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle size={12} /> Locked</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-0 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                            <table className="w-full text-sm text-center border-collapse">
                                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left min-w-[150px] bg-gray-50 dark:bg-gray-900">Candidate</th>
                                        {judges.map(judge => (
                                            <th key={judge.id} className="px-2 py-3 font-medium min-w-[80px] bg-gray-50 dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="truncate max-w-[100px]" title={judge.name}>{judge.name}</span>
                                                    <div className="flex gap-1">
                                                        <span className={clsx("w-2 h-2 rounded-full", judge.status === 'online' ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600")} title={judge.status || 'offline'} />
                                                        <button onClick={() => pingJudge(judge.id)} className="text-gray-400 hover:text-blue-500" title="Ping"><Bell size={10} /></button>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {candidates.map(candidate => (
                                        <tr key={candidate.id} className={clsx("hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors", activeCandidateId === candidate.id && "bg-indigo-50/30 dark:bg-indigo-900/10")}>
                                            <td className="px-4 py-3 text-left border-r border-gray-100 dark:border-gray-800">
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx("font-bold text-gray-900 dark:text-gray-100", activeCandidateId === candidate.id && "text-indigo-600 dark:text-indigo-400")}>
                                                        #{candidate.number}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                                        {candidate.name}
                                                    </div>
                                                    {activeCandidateId === candidate.id && (
                                                        <span className="ml-auto text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                                            LIVE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {judges.map(judge => {
                                                const cScores = scores[candidate.id];
                                                const jScore = cScores ? cScores[judge.id] : null;

                                                let statusIcon = <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto" />; // Pending
                                                let cellClass = "";

                                                if (jScore) {
                                                    if (jScore.locked) {
                                                        statusIcon = <CheckCircle size={16} className="text-green-500 mx-auto" />;
                                                        cellClass = "bg-green-50/30 dark:bg-green-900/10";
                                                    } else if (jScore.total > 0 || (jScore.criteriaScores && Object.keys(jScore.criteriaScores).length > 0)) {
                                                        statusIcon = <Clock size={16} className="text-blue-500 mx-auto animate-pulse" />;
                                                        cellClass = "bg-blue-50/30 dark:bg-blue-900/10";
                                                    }
                                                }

                                                return (
                                                    <td key={judge.id} className={clsx("px-2 py-3 border-l border-gray-100 dark:border-gray-800", cellClass)}>
                                                        {statusIcon}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Notifications & Events (30%) */}
                    <div className="w-[30%] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col shadow-sm overflow-hidden">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <Bell size={16} className="text-orange-500" /> Notifications
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-gray-900/50">
                            {pendingRequests.length > 0 ? (
                                pendingRequests.map(req => {
                                    const judge = judges.find(j => j.id === req.judgeId);
                                    const candidate = candidates.find(c => c.id === req.candidateId);
                                    return (
                                        <div key={req.id} className="bg-white dark:bg-black border border-orange-200 dark:border-orange-900/50 rounded-lg p-3 shadow-sm relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                                            <div className="flex justify-between items-start mb-2 pl-2">
                                                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1">
                                                    <Unlock size={10} /> Unlock Request
                                                </span>
                                                <span className="text-[10px] text-gray-400">{new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 pl-2">
                                                <span className="font-bold">{judge?.name}</span> requests unlock for <span className="font-bold">Candidate #{candidate?.number}</span>
                                            </p>
                                            <div className="flex gap-2 pl-2">
                                                <Button size="xs" onClick={() => approveUnlock(req.id, req)} className="flex-1 bg-green-600 hover:bg-green-700 text-white h-7">Approve</Button>
                                                <Button size="xs" variant="danger" onClick={() => rejectUnlock(req.id)} className="flex-1 h-7">Reject</Button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-4">
                                    <Bell size={24} className="mb-2 opacity-20" />
                                    <p className="text-sm">No new notifications</p>
                                </div>
                            )}

                            {/* Tie Breaker Alerts */}
                            {detectedTies.length > 0 && !tieBreaker?.active && (
                                detectedTies.map((tie, idx) => (
                                    <div key={idx} className="bg-white dark:bg-black border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-3 shadow-sm relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                                        <div className="flex justify-between items-start mb-2 pl-2">
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                                <AlertTriangle size={12} /> Tie Detected
                                            </span>
                                            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                                                Rank #{tie.rank}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 pl-2">
                                            {tie.candidates.length} candidates tied with score <span className="font-bold">{tie.score.toFixed(2)}</span>
                                        </p>
                                        <div className="pl-2 flex flex-wrap gap-1 mb-3">
                                            {tie.candidates.map(c => (
                                                <span key={c.id} className="text-[10px] border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                                    #{c.number} {c.name}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="pl-2">
                                            <Button size="xs" onClick={() => startTieBreaker(tie.candidates.map(c => c.id))} className="w-full h-7 bg-indigo-600 hover:bg-indigo-700 text-white">
                                                <Gavel size={12} className="mr-1" /> Resolve Tie
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};
