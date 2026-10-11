import Dexie from 'dexie';

export const db = new Dexie('SakuArabDB');
db.version(1).stores({
  bookmarks: 'id, track, updatedAt',
  progress: 'id, track, dueAt, lastReviewed',
  history: '++seq, id, track, viewedAt',
  meta: 'key'
});

export async function readMeta(key, fallback = null) {
  const entry = await db.meta.get(key);
  return entry ? entry.value : fallback;
}
export async function writeMeta(key, value) {
  await db.meta.put({ key, value });
}
