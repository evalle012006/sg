// lib/roomDataCache.js
const cache = new Map(); // key: isNdisFunded -> { data, promise }

export function getRoomTypes(isNdisFunded) {
  const key = String(isNdisFunded);
  const entry = cache.get(key);

  if (entry?.data) return Promise.resolve(entry.data);
  if (entry?.promise) return entry.promise;

  const promise = fetch("/api/manage-room")
    .then(res => res.json())
    .then(data => {
      const processed = data
        .map(room => ({
          ...room.data,
          imageUrl: room.image_url,
          value: false,
          roomId: room.data.id
        }))
        .filter(Boolean)
        .filter(room => isNdisFunded
          ? (room.type === 'studio' || room.type === 'ocean_view')
          : true)
        .sort((a, b) => a.id - b.id);

      cache.set(key, { data: processed });
      return processed;
    })
    .catch(err => {
      cache.delete(key); // allow retry on next mount
      throw err;
    });

  cache.set(key, { promise });
  return promise;
}

export function invalidateRoomTypes() {
  cache.clear();
}