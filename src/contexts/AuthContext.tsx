import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { ref, get } from 'firebase/database';

type UserRole = 'admin' | 'judge' | 'committee' | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    loading: boolean;
    loginAdmin: (email: string, pass: string) => Promise<void>;
    loginWithCode: (code: string) => Promise<any>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Assume admin if authenticated via standard Firebase Auth for now
                // In a real app, we'd check a user profile in DB
                setRole('admin');
            } else {
                // Check for session storage or local storage for judges/committee 
                // since they might not be "authenticated" in the traditional Firebase sense 
                // if we are using custom auth or anonymous auth with claims.
                // For MVP, if not admin, maybe we reset role.
                const storedRole = localStorage.getItem('tabulate_role') as UserRole;
                if (storedRole) setRole(storedRole);
                else setRole(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const loginAdmin = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const loginWithCode = async (code: string) => {
        // Real implementation requires DB lookup
        const codeRef = ref(db, `codes/${code}`);
        const snapshot = await get(codeRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            localStorage.setItem('tabulate_user_data', JSON.stringify(data));
            localStorage.setItem('tabulate_role', data.role);
            localStorage.setItem('tabulate_eventId', data.eventId);

            // The code object might have 'id' or we might rely on the code itself as ID if not present?
            // Usually invalid without an ID. We should ensure 'id' is in the code object.
            // If not, use the code as ID? No, the code object in DB should point to a judgeId.
            // Let's assume data has { eventId, role, id? }. 
            // If the code is for a judge, we need the judgeId.
            // Based on previous generation: `codes/${code}` -> { eventId, role } (maybe missing ID?)

            // Re-visiting Committee/Judges creation:
            // await update(ref(db, `codes/${code}`), { eventId, role: 'committee' });
            // It seems we missed adding the 'userId' or 'memberId' to the code map!

            // CRITICAL FIX: We need to update the creation logic too, but for now let's hope we can recover or fix `loginWithCode` to look up the user if needed.
            // Actually, if we look at `Judges.tsx` or `Committee.tsx` in previous turns:
            // await update(ref(db, `codes/${newCode}`), { eventId, role: 'committee' });
            // The ID wasn't stored in the code map! This is a bug.

            // Workaround: If ID is missing in code map, we have to find the user in the event who has this code.
            // This is slow (scan). 

            let userId = data.id;
            if (!userId) {
                // Fallback: Search in event's judges/committee
                const path = data.role === 'judge' ? 'judges' : 'committee';
                const usersRef = ref(db, `events/${data.eventId}/${path}`);
                const usersSnap = await get(usersRef);
                if (usersSnap.exists()) {
                    usersSnap.forEach((child) => {
                        if (child.val().accessCode === code) {
                            userId = child.key;
                        }
                    });
                }
            }

            if (userId) {
                localStorage.setItem('tabulate_userId', userId);
            }

            setRole(data.role as UserRole);
            return data.role; // Return role for redirect
        } else {
            throw new Error('Invalid Access Code');
        }
    };

    const logout = async () => {
        await signOut(auth);
        localStorage.removeItem('tabulate_role');
        localStorage.removeItem('tabulate_user_data');
        localStorage.removeItem('tabulate_eventId');
        localStorage.removeItem('tabulate_userId');
        setRole(null);
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, loginAdmin, loginWithCode, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
