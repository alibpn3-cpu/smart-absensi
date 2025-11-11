// Network status detector
export class NetworkDetector {
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    window.addEventListener('online', () => this.notifyListeners(true));
    window.addEventListener('offline', () => this.notifyListeners(false));
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  addListener(callback: (isOnline: boolean) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (isOnline: boolean) => void): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => listener(isOnline));
  }

  async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) return false;
    
    try {
      const response = await fetch('/manifest.json', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const networkDetector = new NetworkDetector();
