
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

// Initialize Primary Firebase App
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Initialize Secondary App for User Registration (prevents admin logout)
const secondaryApp = !firebase.apps.find(a => a.name === 'Secondary') 
  ? firebase.initializeApp(firebaseConfig, 'Secondary') 
  : firebase.app('Secondary');

export const auth = firebase.auth();
export const db = firebase.firestore();
export const registerAuth = firebase.auth(secondaryApp); // Khusus pendaftaran

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
    id: snap.id,
    ref: snap.ref,
    metadata: snap.metadata,
    exists: () => existsVal,
    data: () => snap.data ? snap.data() : undefined,
    get: (field: string) => snap.get ? snap.get(field) : undefined,
    _raw: snap
  };
};

export const collection = (dbInstance: any, path: string) => dbInstance.collection(path);
export const onSnapshot = (ref: any, onNext: any, onError?: any) => {
  return ref.onSnapshot((snap: any) => {
    if (snap.docs) {
      const wrappedDocs = snap.docs.map((d: any) => wrapSnapshot(d));
      onNext({
        docs: wrappedDocs,
        size: snap.size,
        empty: snap.empty,
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
  if (id) return dbOrColl.collection(pathOrId).doc(id);
  if (typeof dbOrColl.doc === 'function') return dbOrColl.doc(pathOrId);
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
export const setDoc = (ref: any, data: any, options?: any) => {
  if (options) return ref.set(data, options);
  return ref.set(data);
};
