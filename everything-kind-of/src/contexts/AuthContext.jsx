import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthor, setIsAuthor] = useState(false);

  useEffect(() => {
    let revision = 0;
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      const current = ++revision;
      setLoading(true);
      setUser(firebaseUser);
      setProfile(null);
      setIsAuthor(false);
      try {
        if (firebaseUser) {
          const token = await firebaseUser.getIdTokenResult();
          if (current !== revision) return;
          setIsAuthor(token.claims.admin === true && token.claims.author === true &&
            token.claims.email === "fluttershyyzh@gmail.com");
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (current !== revision) return;
          setProfile(snap.exists() ? snap.data() : null);
        }
      } catch (error) {
        console.error("Could not load account details", error.code);
      } finally {
        if (current === revision) setLoading(false);
      }
    });
    return () => { revision++; unsubscribe(); };
  }, []);

  async function register(email, password, displayName) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName });

    // Create the matching users/{uid} profile document
    await setDoc(doc(db, "users", newUser.uid), {
      displayName,
      email,
      role: "reader",
      bio: "",
      followersCount: 0,
      followingCount: 0,
      createdAt: serverTimestamp(),
    });

    await sendEmailVerification(newUser);
    return newUser;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function resendVerification() {
    if (auth.currentUser) return sendEmailVerification(auth.currentUser);
  }

  const value = {
    user,
    profile,
    loading,
    isAuthor,
    isEmailVerified: user?.emailVerified ?? false,
    register,
    login,
    logout,
    resetPassword,
    resendVerification,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
