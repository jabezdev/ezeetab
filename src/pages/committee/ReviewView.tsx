import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { calculateCandidateScore } from '../../utils/calculator';
import { Button } from '../../components/common/Button';
import clsx from 'clsx';

export const ReviewView: React.FC = () => {
    // Auth
    const [eventId, setEventId] = useState<string | null>(null);
    const [memberName, setMemberName] = useState<string>('');

    // Data
    const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
    const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
    const [candidate, setCandidate] = useState<any>(null);
    const [segment, setSegment] = useState<any>(null);
    const [judges, setJudges] = useState<any[]>([]);
    const [scores, setScores] = useState<any>({});

    // Status
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedRole = localStorage.getItem('tabulate_role');
        const storedEventId = localStorage.getItem('tabulate_eventId');
        const storedUserId = localStorage.getItem('tabulate_userId');

        if (storedRole !== 'committee' || !storedEventId || !storedUserId) {
            window.location.href = '/login';
            return;
        }

        setEventId(storedEventId);

        onValue(ref(db, `events/${storedEventId}/committee/${storedUserId}/name`), s => {
            setMemberName(s.val() || 'Committee Member');
        });

        setLoading(false);
    }, []);

    // Listeners
    useEffect(() => {
        if (!eventId) return;

        // State
        onValue(ref(db, `events/${eventId}/state`), s => {
            const data = s.val();
            if (data) {
                setActiveCandidateId(data.activeCandidateId);
                setActiveSegmentId(data.activeSegmentId);
            }
        });

        // Judges
        onValue(ref(db, `events/${eventId}/judges`), s => {
            const list = s.exists() ? Object.entries(s.val()).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            setJudges(list);
        });

    }, [eventId]);

    // Derived Data Listeners
    useEffect(() => {
        if (!eventId || !activeSegmentId) {
            setSegment(null);
            return;
        }
        onValue(ref(db, `events/${eventId}/segments/${activeSegmentId}`), s => setSegment(s.val()));
    }, [eventId, activeSegmentId]);

    useEffect(() => {
        if (!eventId || !activeCandidateId) {
            setCandidate(null);
            return;
        }
        onValue(ref(db, `events/${eventId}/candidates/${activeCandidateId}`), s => setCandidate(s.val()));
    }, [eventId, activeCandidateId]);

    useEffect(() => {
        if (!eventId || !activeSegmentId || !activeCandidateId) return;

        // Listen to all judge scores for this candidate/segment
        // Structure: scores/{seg}/{cand}/{judgeId}
        const scoreRef = ref(db, `events/${eventId}/scores/${activeSegmentId}/${activeCandidateId}`);
        onValue(scoreRef, s => setScores(s.val() || {}));
    }, [eventId, activeSegmentId, activeCandidateId]);

    const calculateTotal = () => {
        if (!scores || !segment?.criteria) return 0;
        return calculateCandidateScore(activeCandidateId!, scores, segment.criteria);
    };

    if (loading) return <div>Loading...</div>;

    if (!activeCandidateId || !activeSegmentId || !candidate || !segment) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500">
                <AlertTriangle size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-bold">Waiting for Authority...</h2>
                <p>Logged in as {memberName}</p>
            </div>
        );
    }

    const currentTotal = calculateTotal();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Certification Review</h1>
                    <p className="text-sm text-gray-500">{segment.name}</p>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-gray-400 uppercase">Live Total</div>
                    <div className="text-2xl font-mono font-bold text-blue-600">{currentTotal.toFixed(2)}</div>
                </div>
            </div>

            <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
                {/* Candidate Highlight */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex items-center gap-6 border border-blue-100">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                        {candidate.number}
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">{candidate.name}</h2>
                        <p className="text-gray-500">{candidate.details}</p>
                    </div>
                </div>

                {/* Judge Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {judges.map(judge => {
                        const judgeScore = scores[judge.id];
                        const hasScore = !!judgeScore;
                        const isLocked = judgeScore?.locked;

                        // Calculate individual judge total
                        let judgeTotal = 0;
                        if (hasScore && segment.criteria) {
                            // Simplified calc for display
                            Object.keys(segment.criteria).forEach(cid => {
                                judgeTotal += (judgeScore[cid] || 0);
                            });
                        }

                        return (
                            <div key={judge.id} className={clsx(
                                "rounded-lg border p-4 transition-all",
                                isLocked ? "bg-white border-green-200 shadow-sm" :
                                    hasScore ? "bg-white border-yellow-200" : "bg-gray-50 border-gray-200 opacity-75"
                            )}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="font-bold text-gray-700">{judge.name}</div>
                                    {isLocked ? (
                                        <CheckCircle size={20} className="text-green-500" />
                                    ) : hasScore ? (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Scoring...</span>
                                    ) : (
                                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded">Waiting</span>
                                    )}
                                </div>

                                {hasScore && segment.criteria ? (
                                    <div className="space-y-2">
                                        {Object.entries(segment.criteria).map(([cid, crit]: [string, any]) => (
                                            <div key={cid} className="flex justify-between text-sm">
                                                <span className="text-gray-500">{crit.name}</span>
                                                <span className="font-mono font-bold">
                                                    {judgeScore[cid] || 0} <span className="text-gray-300 text-xs">/ {crit.maxScore}</span>
                                                </span>
                                            </div>
                                        ))}
                                        <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-bold">
                                            <span>Subtotal</span>
                                            <span>{judgeTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-300 text-sm italic">
                                        No data yet
                                    </div>
                                )}

                                {isLocked && (
                                    <div className="mt-4 pt-2 border-t border-gray-100">
                                        <Button size="sm" variant="ghost" className="w-full text-red-500 text-xs hover:bg-red-50">
                                            Request Unlock (Admin)
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
