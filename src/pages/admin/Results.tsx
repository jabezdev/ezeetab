import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../services/firebase';
import { calculateLeaderboard } from '../../utils/calculator';
import { Trophy, Download } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { AdminLayout } from '../../components/layout/AdminLayout';

export const Results: React.FC = () => {
    const { eventId } = useParams();
    const [segments, setSegments] = useState<any[]>([]);
    const [selectedSegment, setSelectedSegment] = useState<string>('');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [scores, setScores] = useState<any>({});
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    useEffect(() => {
        // Fetch all necessary data
        const eventRef = ref(db, `events/${eventId}`);
        onValue(eventRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const segs = data.segments ? Object.entries(data.segments).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            const cands = data.candidates ? Object.entries(data.candidates).map(([k, v]: [string, any]) => ({ id: k, ...v })) : [];
            // Sort Cands by Number
            cands.sort((a, b) => a.number - b.number);

            setSegments(segs);
            setCandidates(cands);

            // Default select first segment
            if (!selectedSegment && segs.length > 0) {
                setSelectedSegment(segs[0].id);
            }
        });
    }, [eventId, selectedSegment]);

    useEffect(() => {
        if (!selectedSegment) return;

        const scoresRef = ref(db, `events/${eventId}/scores/${selectedSegment}`);
        onValue(scoresRef, (snapshot) => {
            const data = snapshot.val() || {};
            setScores(data);
        });
    }, [eventId, selectedSegment]);

    useEffect(() => {
        if (!selectedSegment || segments.length === 0) return;

        const currentSegment = segments.find(s => s.id === selectedSegment);
        if (currentSegment) {
            const results = calculateLeaderboard(candidates, selectedSegment, scores, currentSegment.criteria);
            setLeaderboard(results);
        }

    }, [scores, candidates, selectedSegment, segments]);

    const handleExport = () => {
        // Simple CSV Export
        const headers = ['Rank', 'Number', 'Name', 'Total Score'];
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + leaderboard.map(r => `${r.rank},${r.number},"${r.name}",${r.totalScore}`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `results_${selectedSegment}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    return (
        <AdminLayout
            title={
                <span className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" /> Results & Leaderboard
                </span>
            }
            backPath="/admin/dashboard"
            actions={
                <div className="flex gap-3">
                    <select
                        className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 text-sm"
                        value={selectedSegment}
                        onChange={(e) => setSelectedSegment(e.target.value)}
                    >
                        {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
                        <Download size={18} /> Export CSV
                    </Button>
                </div>
            }
        >
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-950/50 p-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="grid grid-cols-12 gap-4 font-bold uppercase tracking-wider text-xs text-gray-500 dark:text-gray-400">
                        <div className="col-span-1 text-center">Rank</div>
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-8">Candidate</div>
                        <div className="col-span-2 text-right">Total Score</div>
                    </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {leaderboard.map((entry, idx) => (
                        <div key={entry.id} className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${idx < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                            <div className="col-span-1 flex justify-center">
                                <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${entry.rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                                    entry.rank === 2 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                                        entry.rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'
                                    }`}>
                                    {entry.rank}
                                </span>
                            </div>
                            <div className="col-span-1 text-center font-mono font-medium text-gray-500 dark:text-gray-400">
                                {entry.number}
                            </div>
                            <div className="col-span-8">
                                <div className="font-bold text-gray-900 dark:text-white">{entry.name}</div>
                                {entry.details && <div className="text-xs text-gray-500 dark:text-gray-400">{entry.details}</div>}
                            </div>
                            <div className="col-span-2 text-right font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                                {entry.totalScore.toFixed(2)}
                            </div>
                        </div>
                    ))}
                    {leaderboard.length === 0 && (
                        <div className="p-12 text-center text-gray-400 dark:text-gray-600 text-sm">
                            No scores available for this segment yet.
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};
