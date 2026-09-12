import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  doc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Real-time notification hook.
 * Subscribes to the current user's notifications ordered by most recent.
 */
export function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    });
    return unsub;
  }, [user]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  }, [notifications]);

  const markRead = useCallback(async (id) => {
    await writeBatch(db)
      .update(doc(db, 'notifications', id), { read: true })
      .commit();
  }, []);

  return { notifications, unreadCount, markAllRead, markRead };
}

/**
 * Helper to write a notification document.
 * Call this after a successful like / follow action on the client.
 */
export async function sendNotification({ userId, type, actorName, storyTitle, storyId, chapterId }) {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,       // 'like' | 'follow' | 'comment'
      actorName,
      storyTitle: storyTitle ?? null,
      storyId: storyId ?? null,
      chapterId: chapterId ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // notification writes are best-effort; never block the primary action
  }
}
