// Persistent device ID for anti-joki attendance audit.
// Stored in localStorage. If user clears storage, a new ID is generated
// and the next attendance will be auto-flagged as `new_device` (intentional).

const STORAGE_KEY = 'attendance_device_id';

function uuidv4(): string {
  // Browser-safe UUID v4
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return (crypto as any).randomUUID();
    } catch {
      // fall through
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable — return a transient id
    return uuidv4();
  }
}
