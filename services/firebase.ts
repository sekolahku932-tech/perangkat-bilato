
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRaA4LfVijSWE8U7y0URSy8YqAi5ibDlc",
  authDomain: "perangkat-pembelajaran-bilato.firebaseapp.com",
  projectId: "perangkat-pembelajaran-bilato",
  storageBucket: "perangkat-pembelajaran-bilato.firebasestorage.app",
  messagingSenderId: "475024977370",
  appId: "1:475024977370:web:7772ef97c0fdab3f68a4e3",
  measurementId: "G-JS2Z2JSNPV"
};

const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
export const auth = firebase.auth();
export const db = firebase.firestore();

// Helper untuk mendapatkan prefix sekolah
const getPrefix = () => localStorage.getItem('selectedSchoolId') || 'global';

// Shims for v9 modular Auth functions
export const onAuthStateChanged = (authInstance: any, callback: any) => authInstance.onAuthStateChanged(callback);
export const signOut = (authInstance: any) => authInstance.signOut();
export const signInWithEmailAndPassword = (authInstance: any, email: any, pass: any) => authInstance.signInWithEmailAndPassword(email, pass);
export const createUserWithEmailAndPassword = (authInstance: any, email: any, pass: any) => authInstance.createUserWithEmailAndPassword(email, pass);

const wrapSnapshot = (snap: any) => {
  if (!snap) return snap;
  if (typeof snap.exists === 'function') return snap;
  const existsVal = !!snap.exists;
  return {
    id: snap.id, ref: snap.ref, metadata: snap.metadata,
    exists: () => existsVal,
    data: () => snap.data ? snap.data() : undefined,
    get: (field: string) => snap.get ? snap.get(field) : undefined,
    _raw: snap
  };
};

/**
 * MODIFIKASI: Secara otomatis menambahkan prefix sekolah pada nama koleksi.
 * Contoh: collection(db, "users") menjadi collection(db, "sdn1_users")
 */
export const collection = (dbInstance: any, path: string) => {
  const namespacedPath = `${getPrefix()}_${path}`;
  return dbInstance.collection(namespacedPath);
};

export const onSnapshot = (ref: any, onNext: any, onError?: any) => {
  return ref.onSnapshot((snap: any) => {
    if (snap.docs) {
      const wrappedDocs = snap.docs.map((d: any) => wrapSnapshot(d));
      onNext({
        docs: wrappedDocs,
        size: snap.size, empty: snap.empty,
        forEach: (callback: any) => wrappedDocs.forEach((d: any) => callback(d)),
        docChanges: () => snap.docChanges(),
        metadata: snap.metadata
      });
    } else {
      onNext(wrapSnapshot(snap));
    }
  }, onError);
};

export const addDoc = (ref: any, data: any) => ref.add(data);
export const updateDoc = (ref: any, data: any) => ref.update(data);
export const deleteDoc = (ref: any) => ref.delete();

export const doc = (dbOrColl: any, pathOrId: string, id?: string) => {
  if (id) {
    // Jika pathOrId adalah nama koleksi, tambahkan namespace
    const namespacedColl = `${getPrefix()}_${pathOrId}`;
    return dbOrColl.collection(namespacedColl).doc(id);
  }
  
  if (typeof dbOrColl.doc === 'function') {
    // Jika ini adalah db.doc("koleksi/id")
    const parts = pathOrId.split('/');
    if (parts.length >= 1) {
      parts[0] = `${getPrefix()}_${parts[0]}`;
    }
    return dbOrColl.doc(parts.join('/'));
  }
  
  return db.doc(pathOrId);
};

export const getDoc = async (ref: any) => {
  const snap = await ref.get();
  return wrapSnapshot(snap);
};

export const query = (ref: any, ...constraints: any[]) => {
  let q = ref;
  constraints.forEach(c => {
    if (c && c.type === 'where') q = q.where(c.field, c.op, c.value);
  });
  return q;
};

export const where = (field: string, op: any, value: any) => ({ type: 'where', field, op, value });
export const getDocs = (ref: any) => ref.get();
export const setDoc = (ref: any, data: any, options?: any) => options ? ref.set(data, options) : ref.set(data);
