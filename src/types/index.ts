export interface EventState {
    activeSegmentId: string | null;
    activeCandidateId: string | null;
    isPaused: boolean;
    tieBreaker?: TieBreakerState;
    unlockRequests?: Record<string, UnlockRequest>;
}

export interface TieBreakerState {
    active: boolean;
    candidates: string[]; // IDs of candidates involved in the tie
    votes?: Record<string, string>; // judgeId -> candidateId
}

export interface UnlockRequest {
    judgeId: string;
    candidateId: string;
    segmentId: string;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
}

export interface Candidate {
    id: string;
    number: number;
    name: string;
    photoUrl?: string;
    details?: string;
    totalScore?: number;
    rank?: number;
}

export interface Segment {
    id: string;
    name: string;
    weight: number;
    status: 'pending' | 'active' | 'completed';
    criteria: Record<string, Criterion>;
}

export interface Criterion {
    id: string;
    name: string;
    maxScore: number;
    weight: number;
}

export interface ScoreData {
    [criterionId: string]: number;
}

export interface JudgeScore {
    criteriaScores: ScoreData;
    total: number;
    locked: boolean;
    notes?: string;
    submittedAt?: number;
}

export interface Judge {
    id: string;
    name: string;
    accessCode: string;
    status?: 'online' | 'offline';
    lastPing?: number;
}
