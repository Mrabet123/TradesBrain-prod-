import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { profileExists } from '../services/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // profileComplete: the signed-in user has a public.users row (finished the
  //   trade + KYC profile). Google / phone-OTP sign-ups start false.
  // profileChecked: the first profile lookup after sign-in has resolved.
  // profileSetupPending: the email sign-up flow (OtpVerify) is mid-creation —
  //   the gate waits instead of flashing the complete-profile screen.
  profileComplete: boolean;
  profileChecked: boolean;
  profileSetupPending: boolean;
  refreshProfileStatus: () => Promise<void>;
  setProfileSetupPending: (pending: boolean) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  profileComplete: false,
  profileChecked: false,
  profileSetupPending: false,
  refreshProfileStatus: async () => {},
  setProfileSetupPending: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileSetupPending, setProfileSetupPending] = useState(false);

  const refreshProfileStatus = useCallback(async () => {
    const exists = await profileExists();
    setProfileComplete(exists);
    setProfileChecked(true);
    if (exists) setProfileSetupPending(false);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const exists = await profileExists();
        if (!active) return;
        setProfileComplete(exists);
      }
      setProfileChecked(true);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setProfileChecked(false);
        const exists = await profileExists();
        setProfileComplete(exists);
        setProfileChecked(true);
        if (exists) setProfileSetupPending(false);
      } else {
        setProfileComplete(false);
        setProfileChecked(true);
        setProfileSetupPending(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfileComplete(false);
    setProfileSetupPending(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        profileComplete,
        profileChecked,
        profileSetupPending,
        refreshProfileStatus,
        setProfileSetupPending,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
export default AuthContext;
