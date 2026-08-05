import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { addDoc, collection, doc, getFirestore, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAQG14FWfSkT2Aow9eGUcJC90jyQXWfr5U',
  authDomain: 'busanbadaon.firebaseapp.com',
  projectId: 'busanbadaon',
  storageBucket: 'busanbadaon.firebasestorage.app',
  messagingSenderId: '522628713393',
  appId: '1:522628713393:web:126c6a1b37a0d69c4acb90',
  measurementId: 'G-HFDG35L46K'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let commentsUnsubscribe = null;
let activeCommentCourseId = null;

function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

async function startFirebaseCommunity() {
  try {
    await signInAnonymously(auth);
    onSnapshot(query(collection(db, 'courses'), orderBy('uses', 'desc'), limit(3)), (snapshot) => {
      const courses = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), uses: Number(item.data().uses || 0) }));
      emit('firebase-courses', courses);
    }, (error) => console.warn('[Firebase courses]', error.code));
  } catch (error) { console.warn('[Firebase auth]', error.code); }
}

window.firebaseCommunity = {
  async recordCourse(course) {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'courses', course.id), {
        title: course.title,
        detail: course.detail,
        uses: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) { console.warn('[Firebase course write]', error.code); }
  },
  watchComments(courseId) {
    if (activeCommentCourseId === courseId) return;
    activeCommentCourseId = courseId;
    commentsUnsubscribe?.();
    commentsUnsubscribe = onSnapshot(query(collection(db, 'courses', courseId, 'comments'), orderBy('createdAt', 'desc'), limit(20)), (snapshot) => {
      emit('firebase-comments', { courseId, items: snapshot.docs.map((item) => item.data()) });
    }, (error) => console.warn('[Firebase comments]', error.code));
  },
  async addComment(courseId, comment) {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'courses', courseId, 'comments'), {
        name: String(comment.name).slice(0, 16),
        rating: Math.max(1, Math.min(5, Number(comment.rating))),
        text: String(comment.text).slice(0, 180),
        uid: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) { console.warn('[Firebase comment write]', error.code); }
  }
};

startFirebaseCommunity();
