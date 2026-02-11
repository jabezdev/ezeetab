import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User, signInAnonymously } from 'firebase/auth';
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
                if (currentUser.isAnonymous) {
                    // If anonymous, check localStorage for role or keep as is (waiting for code login to set it)
                    const storedRole = localStorage.getItem('tabulate_role') as UserRole;
                    if (storedRole) setRole(storedRole);
                    // Do NOT set as admin automatically
                } else {
                    // Standard auth is assumed to be admin for now in this app's context
                    setRole('admin');
                }
            } else {
                // No user, check if we have stored role/data but need to re-auth? 
                // Actually if no user, we are logged out.
                // But for a persistent judge session that might have expired? 
                // We rely on Firebase persistence. If that is gone, they need to re-login.
                setRole(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const loginAdmin = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const loginWithCode = async (code: string) => {
        // Ensure we have a firebase session (anonymous) to read DB if rules require auth
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }

        // Real implementation requires DB lookup
        const codeRef = ref(db, `codes/${code}`);
        const snapshot = await get(codeRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            localStorage.setItem('tabulate_user_data', JSON.stringify(data));
            localStorage.setItem('tabulate_role', data.role);
            localStorage.setItem('tabulate_eventId', data.eventId);

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
            // accessible even if anonymous auth failed? likely not if rules enforce it.
            // If code is invalid, maybe sign out the anonymous user to clean up? 
            // Optional/Trade-off.
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

