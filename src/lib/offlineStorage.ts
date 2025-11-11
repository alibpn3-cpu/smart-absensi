// IndexedDB wrapper for offline attendance storage
const DB_NAME = 'attendance_offline_db';
const STORE_NAME = 'pending_attendance';
const DB_VERSION = 1;

export interface OfflineAttendanceRecord {
  id: string;
  staff_uid: string;
  staff_name: string;
  date: string;
  status: 'WFH' | 'Dinas';
  reason?: string;
  check_in_time?: string;
  check_out_time?: string;
  checkin_location_lat?: number;
  checkin_location_lng?: number;
  checkin_location_address?: string;
  checkout_location_lat?: number;
  checkout_location_lng?: number;
  checkout_location_address?: string;
  selfie_checkin_base64?: string;
  selfie_checkout_base64?: string;
  action_type: 'checkin' | 'checkout';
  created_at: string;
  sync_attempts: number;
  last_sync_attempt?: string;
  sync_error?: string;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('staff_uid', 'staff_uid', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('sync_attempts', 'sync_attempts', { unique: false });
        }
      };
    });
  }

  async saveRecord(record: OfflineAttendanceRecord): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRecords(): Promise<OfflineAttendanceRecord[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordsByStaff(staff_uid: string): Promise<OfflineAttendanceRecord[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('staff_uid');
      const request = index.getAll(staff_uid);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateSyncAttempt(id: string, error?: string): Promise<void> {
    if (!this.db) await this.init();
    const records = await this.getAllRecords();
    const record = records.find(r => r.id === id);
    if (record) {
      record.sync_attempts += 1;
      record.last_sync_attempt = new Date().toISOString();
      if (error) record.sync_error = error;
      await this.saveRecord(record);
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
