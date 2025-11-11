# Cara Deploy Smart Absensi dengan Docker & Docker Compose

## 1. Clone repository
```bash
git clone https://github.com/alibpn3-cpu/smart-absensi-docker.git
cd smart-absensi-docker
```

## 2. Edit file .env jika memakai Supabase atau env lain
```
PORT=6890
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

## 3. Build dan jalankan dengan Docker Compose
```bash
docker compose up --build -d
```

## 4. Akses aplikasi
Buka browser dan akses:  
`http://<ip-server>:6890`