/**
 * Calculator Utility for Tabulation logic
 */

export interface ScoreData {
    [criterionId: string]: number;
}

export interface CandidateScore {
    candidateId: string;
    scores: {
        [judgeId: string]: ScoreData;
    };
    totalScore: number;
    rank: number;
}

import type { JudgeScore } from '../types';

export const calculateCandidateScore = (
    _candidateId: string,
    judgeScores: { [judgeId: string]: ScoreData | JudgeScore } | undefined,
    criteria: { [id: string]: { weight?: number, maxScore: number } }
): number => {
    if (!judgeScores || !criteria) return 0;

    let totalWeightedScore = 0;
    const judgeCount = Object.keys(judgeScores).length;

    if (judgeCount === 0) return 0;

    // Iterate through each judge's scores
    Object.values(judgeScores).forEach(scoreData => {
        let judgeTotal = 0;
        let currentJudgeScore = 0;

        Object.entries(criteria).forEach(([cId, criterion]) => {
            // Handle both legacy (direct map) and new (inside criteriaScores) structures
            const criteriaScores = (scoreData as any).criteriaScores || scoreData;
            const rawScore = criteriaScores[cId] || 0;

            if (criterion.weight) {
                // Percentage based
                const percentage = (rawScore / criterion.maxScore) * criterion.weight;
                currentJudgeScore += percentage;
            } else {
                // Simple sum
                currentJudgeScore += rawScore;
            }
        });

        judgeTotal = currentJudgeScore;
        totalWeightedScore += judgeTotal;
    });

    // Average across judges
    return Number((totalWeightedScore / judgeCount).toFixed(2));
};

export const calculateLeaderboard = (
    candidates: any[],
    _activeSegmentId: string,
    scores: { [candidateId: string]: { [judgeId: string]: ScoreData } },
    criteria: any
) => {
    const results = candidates.map(candidate => {
        const cScores = scores?.[candidate.id] || {};
        const total = calculateCandidateScore(candidate.id, cScores, criteria);
        return {
            ...candidate,
            totalScore: total
        };
    });

    // Sort by desc totalScore
    results.sort((a, b) => b.totalScore - a.totalScore);

    // Assign Ranks
    let rank = 1;
    for (let i = 0; i < results.length; i++) {
        if (i > 0 && results[i].totalScore < results[i - 1].totalScore) {
            rank = i + 1;
        }
        results[i].rank = rank;
    }

    return results;
};
