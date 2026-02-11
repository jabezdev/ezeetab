import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { CheckCircle, Clock, Wifi, Bell, Unlock, Gavel } from 'lucide-react';
import { calculateCandidateScore } from '../../utils/calculator';
import { AdminLayout } from '../../components/layout/AdminLayout';
import clsx from 'clsx';
import type { Segment, Candidate, Judge, UnlockRequest, TieBreakerState, Score } from '../../types';

export const ReviewView: React.FC = () => {
    // Auth & Route
    const [eventId] = useState<string | null>(() => localStorage.getItem('tabulate_eventId'));
    const [memberName, setMemberName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Data State
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null); // Local view state
    const [liveSegmentId, setLiveSegmentId] = useState<string | null>(null); // Actual live segment
    const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null); // Actual live candidate

    const [segments, setSegments] = useState<Segment[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [scores, setScores] = useState<Record<string, Record<string, Score>>>({});
    const [unlockRequests, setUnlockRequests] = useState<Record<string, UnlockRequest>>({});
    const [tieBreaker, setTieBreaker] = useState<TieBreakerState | null>(null);

    useEffect(() => {
        const storedRole = localStorage.getItem('tabulate_role');
        const storedUserId = localStorage.getItem('tabulate_userId');

        if (storedRole !== 'committee' || !eventId || !storedUserId) {
            window.location.href = '/login';
            return;
        }

        onValue(ref(db, `events/${eventId}/committee/${storedUserId}/name`), s => {
            setMemberName(s.val() || 'Committee Member');
            setLoading(false);
        });
    }, [eventId]);

    // Fetch Data
    useEffect(() => {
        if (!eventId) return;

        // Segments
        onValue(ref(db, `events/${eventId}/segments`), s => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const val = s.val() as Record<string, any> | null;
            const list = s.exists() && val ? Object.entries(val).map(([k, v]) => ({ id: k, ...v } as Segment)) : [];
            // Assuming simple sort or order field
            setSegments(list);

            // Auto-select first segment if nothing selected and no live segment yet
            setActiveSegmentId(prev => {
                if (prev) return prev;
                return list.length > 0 ? list[0].id : null;
            });
        });

        // Candidates
        onValue(ref(db, `events/${eventId}/candidates`), s => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const val = s.val() as Record<string, any> | null;
            const list = s.exists() && val ? Object.entries(val).map(([k, v]) => ({ id: k, ...v } as Candidate)) : [];
            list.sort((a, b) => a.number - b.number);
            setCandidates(list);
        });

        // Judges
        onValue(ref(db, `events/${eventId}/judges`), s => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const val = s.val() as Record<string, any> | null;
            const list = s.exists() && val ? Object.entries(val).map(([k, v]) => ({ id: k, ...v } as Judge)) : [];
            setJudges(list);
        });

        // Event State (Live indicators)
        onValue(ref(db, `events/${eventId}/state`), s => {
            const data = s.val();
            if (data) {
                setLiveSegmentId(data.activeSegmentId);
                setActiveCandidateId(data.activeCandidateId);
                setUnlockRequests(data.unlockRequests || {});
                setTieBreaker(data.tieBreaker || null);

                setActiveSegmentId(prev => prev || data.activeSegmentId);
            }
        });

    }, [eventId]);

    // Listen to scores for the VIEWED segment
    useEffect(() => {
        if (!eventId || !activeSegmentId) return;

        const scoreRef = ref(db, `events/${eventId}/scores/${activeSegmentId}`);
        onValue(scoreRef, s => {
            setScores(s.val() || {});
        });
    }, [eventId, activeSegmentId]);


    // Calculations for the Matrix
    const rankedMatrixData = useMemo(() => {
        if (!activeSegmentId) return [];

        const currentSegment = segments.find(s => s.id === activeSegmentId);
        if (!currentSegment) return [];

        const data = candidates.map(candidate => {
            const cScores = scores[candidate.id] || {};
            let total = 0;

            // Calculate total based on criteria
            if (currentSegment.criteria) {
                total = calculateCandidateScore(candidate.id, scores, currentSegment.criteria);
            }

            // Judge Specific Data for this candidate
            const judgeCells = judges.map(judge => {
                const jScore = cScores[judge.id];
                return {
                    judgeId: judge.id,
                    score: jScore, // raw score object
                };
            });

            return {
                candidate,
                total,
                judgeCells
            };
        });

        // Sort by Total Descending
        data.sort((a, b) => b.total - a.total);

        // Assign Rank with Tie Handling
        const rankedData: Array<typeof data[0] & { rank: number }> = [];

        data.forEach((item, index) => {
            let rank = index + 1;
            // Check for tie with previous
            if (index > 0 && Math.abs(item.total - data[index - 1].total) < 0.01) {
                // Same rank as previous
                rank = rankedData[index - 1].rank;
            }
            rankedData.push({ ...item, rank });
        });

        return rankedData;

    }, [candidates, scores, segments, activeSegmentId, judges]);

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    const pendingRequests = Object.entries(unlockRequests).map(([k, v]) => ({ id: k, ...v }));

    return (
        <AdminLayout
            title="Scoreboard"
            backPath="#" // Committee typically strictly bound
            hideSidebar
            actions={
                <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500">Event: {eventId}</span>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300">
                        {memberName}
                    </span>
                </div>
            }
        >
            <div className="h-[calc(100vh-140px)] flex gap-4">

                {/* LEFT: Main Scoreboard Matrix (75-80%) */}
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">

                    {/* Header Controls */}
                    <div className="p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-2 overflow-x-auto">
                        {segments.map(seg => (
                            <button
                                key={seg.id}
                                onClick={() => setActiveSegmentId(seg.id)}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all border relative",
                                    activeSegmentId === seg.id
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                                )}
                            >
                                {seg.name}
                                {liveSegmentId === seg.id && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* The Matrix Table */}
                    <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm text-center">
                                <tr>
                                    <th className="px-3 py-3 text-left font-bold text-gray-500 dark:text-gray-400 uppercase text-xs w-16">Rank</th>
                                    <th className="px-3 py-3 text-left font-bold text-gray-500 dark:text-gray-400 uppercase text-xs min-w-[200px]">Candidate</th>
                                    <th className="px-3 py-3 text-center font-bold text-gray-500 dark:text-gray-400 uppercase text-xs w-24 bg-indigo-50/50 dark:bg-indigo-900/20 border-l border-r border-indigo-100 dark:border-indigo-900">Total</th>

                                    {judges.map(judge => (
                                        <th key={judge.id} className="px-2 py-3 min-w-[100px] border-l border-gray-100 dark:border-gray-800">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-gray-700 dark:text-gray-200 truncate max-w-[90px]" title={judge.name}>{judge.name}</span>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <div className={clsx(
                                                        "w-2 h-2 rounded-full",
                                                        judge.status === 'online' ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                                    )} />
                                                    <span className="text-[10px] text-gray-400 uppercase">{judge.status || 'offline'}</span>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {rankedMatrixData.map((row) => (
                                    <tr
                                        key={row.candidate.id}
                                        className={clsx(
                                            "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                                            activeCandidateId === row.candidate.id && liveSegmentId === activeSegmentId && "bg-indigo-50/20 dark:bg-indigo-900/10"
                                        )}
                                    >
                                        <td className="px-3 py-3 font-mono font-bold text-gray-500 dark:text-gray-400 text-center">
                                            #{row.rank}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                {activeCandidateId === row.candidate.id && liveSegmentId === activeSegmentId && (
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                    </span>
                                                )}
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-base">#{row.candidate.number} {row.candidate.name}</div>
                                                    <div className="text-xs text-gray-500 truncate max-w-[180px]">{row.candidate.details}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50/10 dark:bg-indigo-900/10 border-l border-r border-indigo-50 dark:border-indigo-900/20">
                                            {row.total.toFixed(2)}
                                        </td>

                                        {row.judgeCells.map(cell => {
                                            const hasScore = !!cell.score;
                                            const isLocked = cell.score?.locked;
                                            // Determine display content
                                            let content = <span className="text-gray-300 dark:text-gray-700">-</span>;
                                            let cellClass = "";

                                            if (hasScore) {
                                                if (isLocked) {
                                                    content = (
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{cell.score.total?.toFixed(1) || '?'}</span>
                                                            <CheckCircle size={10} className="text-green-500 mt-0.5" />
                                                        </div>
                                                    );
                                                    cellClass = "bg-green-50/40 dark:bg-green-900/10";
                                                } else {
                                                    // Present but not locked (Typing...)
                                                    content = (
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-gray-400 dark:text-gray-500 text-base">{cell.score.total?.toFixed(1) || '...'}</span>
                                                            <Clock size={10} className="text-blue-500 mt-0.5 animate-pulse" />
                                                        </div>
                                                    );
                                                    cellClass = "bg-blue-50/20 dark:bg-blue-900/10";
                                                }
                                            } else {
                                                // Check if judge is online?
                                            }

                                            // Highlight if this is the active candidate currently being judged
                                            const isActiveJudging = activeCandidateId === row.candidate.id && liveSegmentId === activeSegmentId && !hasScore;
                                            if (isActiveJudging) {
                                                cellClass = "bg-yellow-50/30 dark:bg-yellow-900/10 animate-pulse";
                                                content = <span className="text-xs text-yellow-600 dark:text-yellow-500 font-bold">Judging</span>
                                            }

                                            return (
                                                <td key={cell.judgeId} className={clsx("px-2 py-3 text-center border-l border-gray-100 dark:border-gray-800 transition-colors", cellClass)}>
                                                    {content}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT: Sidebar (Notifications & Alerts) (20-25%) */}
                <div className="w-80 flex flex-col gap-4 shrink-0">

                    {/* Tie Breaker Alert */}
                    {tieBreaker?.active && (
                        <div className="bg-indigo-600 text-white p-4 rounded-lg shadow-lg animate-pulse">
                            <div className="flex items-center gap-2 mb-2">
                                <Gavel size={20} />
                                <h3 className="font-bold text-lg">Tie Breaker Active</h3>
                            </div>
                            <p className="text-indigo-100 text-sm mb-3">
                                Judges are currently voting to break a tie between:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {tieBreaker.candidates.map(cid => {
                                    const c = candidates.find(cand => cand.id === cid);
                                    return (
                                        <span key={cid} className="bg-indigo-800 px-2 py-1 rounded text-xs font-bold">
                                            #{c?.number} {c?.name}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <Bell size={16} className="text-orange-500" /> Notifications
                            </h3>
                            <span className="text-xs bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50 dark:bg-gray-900/50">
                            {pendingRequests.length > 0 ? (
                                pendingRequests.map(req => {
                                    const judge = judges.find(j => j.id === req.judgeId);
                                    const candidate = candidates.find(c => c.id === req.candidateId);
                                    return (
                                        <div key={req.id} className="bg-white dark:bg-black border border-orange-200 dark:border-orange-900/50 rounded-lg p-3 shadow-sm relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                                            <div className="flex justify-between items-start mb-1 pl-2">
                                                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1">
                                                    <Unlock size={10} /> Unlock Request
                                                </span>
                                                <span className="text-[10px] text-gray-400">{new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-sm text-gray-800 dark:text-gray-200 pl-2">
                                                <span className="font-bold">{judge?.name}</span> requests unlock for <span className="font-bold">#{candidate?.number}</span>
                                            </p>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                    <Bell size={24} className="mb-2 opacity-20" />
                                    <p className="text-xs">No pending notifications</p>
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                <h4 className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs mb-1">
                                    <Wifi size={12} /> System Status
                                </h4>
                                <div className="flex justify-between text-xs text-blue-700 dark:text-blue-400">
                                    <span>Live Segment:</span>
                                    <span className="font-bold">{segments.find(s => s.id === liveSegmentId)?.name || 'None'}</span>
                                </div>
                                <div className="flex justify-between text-xs text-blue-700 dark:text-blue-400 mt-1">
                                    <span>Active Judges:</span>
                                    <span className="font-bold">{judges.filter(j => j.status === 'online').length} / {judges.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};
