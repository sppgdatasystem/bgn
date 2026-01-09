// ============================================
// SPPG MBG DATABASE - V2.2 (SECURED + CLOUD SYNC)
// ============================================
// 
// LocalStorage + Google Sheets Cloud Sync
// DENGAN KEAMANAN API KEY
//
// ============================================

const Database = {
    // Versi database
    VERSION: '2.3.0',

    // Google Apps Script URL - KOSONG untuk fresh install, setup via tombol Setup API
    API_URL: localStorage.getItem('sppg_api_url') || '',

    // ⚠️ KUNCI RAHASIA API - HARUS SAMA DENGAN DI GOOGLE APPS SCRIPT!
    API_SECRET_KEY: localStorage.getItem('sppg_api_key') || '',

    // ==========================================
    // DATA STRUCTURE
    // ==========================================
    // Semua data disimpan di LocalStorage dengan prefix 'sppg_v2_'

    TABLES: ['users', 'produksi', 'distribusi', 'logistik', 'audit', 'settings'],

    // ==========================================
    // CORE FUNCTIONS
    // ==========================================

    // Get all data from a table
    getAll: (table) => {
        const key = `sppg_v2_${table}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    // Get filtered data by date
    getByDate: (table, date) => {
        const all = Database.getAll(table);
        return all.filter(item => item.tanggal === date);
    },

    // Get single item by ID
    getById: (table, id) => {
        const all = Database.getAll(table);
        return all.find(item => item.id === id);
    },

    // Check if user with phone exists (for duplicate prevention)
    getUserByPhone: (phone) => {
        const users = Database.getAll('users');
        const normalize = (p) => p ? p.toString().replace(/^0+/, '') : '';
        return users.find(u => normalize(u.phone) === normalize(phone));
    },

    // Add new item (with smart duplicate prevention for users)
    add: (table, item) => {
        const all = Database.getAll(table);

        // DUPLICATE CHECK FOR USERS (by phone number)
        if (table === 'users' && item.phone) {
            const existing = Database.getUserByPhone(item.phone);
            if (existing) {
                console.log('⚠️ User dengan phone ini sudah ada:', item.phone);
                return existing; // Return existing user, don't add duplicate
            }
        }

        // Auto-generate ID if not provided
        if (!item.id) {
            item.id = Date.now().toString();
        }

        // Add timestamp
        item.createdAt = new Date().toISOString();

        all.push(item);
        localStorage.setItem(`sppg_v2_${table}`, JSON.stringify(all));

        // Log to audit
        if (table !== 'audit') {
            Database.addAudit('add', `Menambah data ke ${table}`);
        }

        // AUTO-SYNC TO CLOUD for all tables including users
        if (table !== 'audit' && Database.isApiConfigured()) {
            Database.pushItemToCloud(table, item).then(result => {
                console.log(`☁️ Auto-sync ${table}:`, result.success ? 'OK' : result.error);
            }).catch(e => console.log('Sync error:', e));
        }

        return item;
    },

    // Update existing item
    update: (table, id, updates) => {
        const all = Database.getAll(table);
        const index = all.findIndex(item => item.id === id);

        if (index !== -1) {
            all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(`sppg_v2_${table}`, JSON.stringify(all));

            if (table !== 'audit') {
                Database.addAudit('update', `Mengupdate data di ${table}`);
            }

            // AUTO-SYNC TO CLOUD
            if (table !== 'audit' && Database.isApiConfigured()) {
                Database.updateItemOnCloud(table, all[index]).then(result => {
                    console.log(`☁️ Update sync ${table}:`, result.success ? 'OK' : result.error);
                }).catch(e => console.log('Sync error:', e));
            }

            return all[index];
        }
        return null;
    },

    // Delete item
    delete: (table, id) => {
        const all = Database.getAll(table);
        const filtered = all.filter(item => item.id !== id);
        localStorage.setItem(`sppg_v2_${table}`, JSON.stringify(filtered));

        if (table !== 'audit') {
            Database.addAudit('delete', `Menghapus data dari ${table}`);
        }

        // AUTO-SYNC TO CLOUD
        if (table !== 'audit' && Database.isApiConfigured()) {
            Database.deleteItemFromCloud(table, id).then(result => {
                console.log(`☁️ Delete sync ${table}:`, result.success ? 'OK' : result.error);
            }).catch(e => console.log('Sync error:', e));
        }

        return true;
    },

    // ==========================================
    // USER MANAGEMENT
    // ==========================================

    // Login with phone number AND PIN (SECURED)
    login: (phone, pin) => {
        const users = Database.getAll('users');

        // Normalize phone - remove leading zeros AND convert to string
        const normalize = (p) => {
            if (!p) return '';
            return p.toString().replace(/^0+/, '').trim();
        };

        const inputPhoneNorm = normalize(phone);
        const user = users.find(u => normalize(u.phone) === inputPhoneNorm);

        if (!user) {
            return { success: false, error: 'Nomor HP tidak terdaftar!' };
        }

        if (user.status !== 'active') {
            return { success: false, error: 'Akun tidak aktif!' };
        }

        // Validate PIN (fallback: jika user belum punya PIN, default '1234')
        const userPin = (user.pin || '1234').toString();
        const inputPin = (pin || '').toString();
        if (inputPin !== userPin) {
            return { success: false, error: 'PIN salah!' };
        }

        localStorage.setItem('sppg_v2_current_user', JSON.stringify(user));
        Database.addAudit('login', `${user.nama} login ke sistem`);
        return { success: true, user: user };
    },

    // Get current logged in user
    getCurrentUser: () => {
        const data = localStorage.getItem('sppg_v2_current_user');
        return data ? JSON.parse(data) : null;
    },

    // Logout
    logout: () => {
        const user = Database.getCurrentUser();
        if (user) {
            Database.addAudit('logout', `${user.nama} logout dari sistem`);
        }
        localStorage.removeItem('sppg_v2_current_user');
    },

    // ==========================================
    // AUDIT LOG
    // ==========================================

    addAudit: (action, detail) => {
        const user = Database.getCurrentUser();
        const audit = {
            id: Date.now().toString(),
            aksi: action,
            detail: detail,
            user: user ? user.nama : 'System',
            waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            tanggal: new Date().toISOString().split('T')[0]
        };

        const all = Database.getAll('audit');
        all.push(audit);
        localStorage.setItem('sppg_v2_audit', JSON.stringify(all));
    },

    // ==========================================
    // EXPORT/IMPORT (For Sync Between Devices)
    // ==========================================

    // Export all data as JSON string
    exportAll: () => {
        const data = {};
        Database.TABLES.forEach(table => {
            data[table] = Database.getAll(table);
        });
        data.exportedAt = new Date().toISOString();
        data.version = Database.VERSION;
        return JSON.stringify(data, null, 2);
    },

    // Import data from JSON string
    importAll: (jsonString) => {
        try {
            const data = JSON.parse(jsonString);

            Database.TABLES.forEach(table => {
                if (data[table]) {
                    localStorage.setItem(`sppg_v2_${table}`, JSON.stringify(data[table]));
                }
            });

            Database.addAudit('import', 'Data diimpor dari backup');
            return { success: true, message: 'Data berhasil diimpor!' };
        } catch (error) {
            return { success: false, message: 'Format data tidak valid!' };
        }
    },

    // Download data as file
    downloadBackup: () => {
        const data = Database.exportAll();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sppg_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ==========================================
    // INITIALIZATION
    // ==========================================

    init: () => {
        // Check if API URL has changed (new deployment)
        const savedUrl = localStorage.getItem('sppg_v2_api_url');
        if (savedUrl && savedUrl !== Database.API_URL) {
            console.log('🔄 API URL berubah! Reset data lokal...');
            // Clear all data for fresh sync
            Database.TABLES.forEach(table => {
                localStorage.removeItem(`sppg_v2_${table}`);
            });
            localStorage.removeItem('sppg_v2_current_user');
        }
        // Save current URL
        localStorage.setItem('sppg_v2_api_url', Database.API_URL);

        // =============================================
        // DEFAULT USERS - Bisa login tanpa API Cloud
        // Hanya 2 role: Admin + Petugas/Relawan
        // =============================================
        const existingUsers = Database.getAll('users');
        if (existingUsers.length === 0) {
            console.log('📝 Menambahkan user default...');

            const defaultUsers = [
                {
                    id: '1',
                    nama: 'Admin SPPG',
                    phone: '081234567890',
                    pin: '1234',
                    noPegawai: 'ADM001',
                    jabatan: 'Administrator',
                    role: 'admin',
                    status: 'active',
                    createdAt: new Date().toISOString()
                }
            ];

            localStorage.setItem('sppg_v2_users', JSON.stringify(defaultUsers));
            console.log('✅ 1 user default ditambahkan (Admin)!');
        }

        // =============================================
        // DEFAULT SETTINGS
        // =============================================
        const existingSettings = Database.getAll('settings');
        if (existingSettings.length === 0) {
            const defaultSettings = [
                { id: 'showNoPegawai', value: 'true', updatedAt: new Date().toISOString() }
            ];
            localStorage.setItem('sppg_v2_settings', JSON.stringify(defaultSettings));
        }

        // =============================================
        // CLEAR EXPIRED TASK LOCKS (30 min expiry)
        // =============================================
        Database.cleanExpiredLocks();

        console.log('Database V2 ready');
    },

    // ==========================================
    // TASK LOCK SYSTEM - Mencegah kerja double
    // ==========================================

    // Claim a task (lock it for current user)
    claimTask: (taskId, taskType) => {
        const user = Database.getCurrentUser();
        if (!user) return { success: false, error: 'Belum login' };

        const locks = Database.getAll('taskLocks');
        const existing = locks.find(l => l.taskId === taskId);

        if (existing && existing.userId !== user.id) {
            // Check if expired (30 min)
            const expireTime = new Date(existing.expiresAt).getTime();
            if (Date.now() < expireTime) {
                return {
                    success: false,
                    error: `Diklaim oleh ${existing.userName}`,
                    lockedBy: existing
                };
            }
            // Expired, remove old lock
            Database.releaseTask(taskId);
        }

        // Remove old lock if same user
        if (existing && existing.userId === user.id) {
            return { success: true, message: 'Sudah diklaim' };
        }

        // Create new lock
        const showNoPegawai = Database.getSetting('showNoPegawai') === 'true';
        const lock = {
            id: `lock_${Date.now()}`,
            taskId: taskId,
            taskType: taskType,
            userId: user.id,
            userName: user.nama,
            userNoPegawai: showNoPegawai ? (user.noPegawai || '') : '',
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
        };

        locks.push(lock);
        localStorage.setItem('sppg_v2_taskLocks', JSON.stringify(locks));

        return { success: true, lock: lock };
    },

    // Release a task lock
    releaseTask: (taskId) => {
        const locks = Database.getAll('taskLocks');
        const filtered = locks.filter(l => l.taskId !== taskId);
        localStorage.setItem('sppg_v2_taskLocks', JSON.stringify(filtered));
        return { success: true };
    },

    // Check if task is locked by another user
    isTaskLocked: (taskId) => {
        const user = Database.getCurrentUser();
        const locks = Database.getAll('taskLocks');
        const lock = locks.find(l => l.taskId === taskId);

        if (!lock) return { locked: false };

        // Check if expired
        if (Date.now() >= new Date(lock.expiresAt).getTime()) {
            Database.releaseTask(taskId);
            return { locked: false };
        }

        // Locked by current user = not really locked
        if (user && lock.userId === user.id) {
            return { locked: false, lockedByMe: true };
        }

        return {
            locked: true,
            lockedBy: lock.userName,
            lockedByNoPegawai: lock.userNoPegawai
        };
    },

    // Clean expired locks
    cleanExpiredLocks: () => {
        const locks = Database.getAll('taskLocks');
        const now = Date.now();
        const valid = locks.filter(l => new Date(l.expiresAt).getTime() > now);
        localStorage.setItem('sppg_v2_taskLocks', JSON.stringify(valid));
    },

    // Get a setting value
    getSetting: (settingId) => {
        const settings = Database.getAll('settings');
        const setting = settings.find(s => s.id === settingId);
        return setting ? setting.value : null;
    },

    // Set a setting value
    setSetting: (settingId, value) => {
        const settings = Database.getAll('settings');
        const index = settings.findIndex(s => s.id === settingId);

        if (index >= 0) {
            settings[index].value = value;
            settings[index].updatedAt = new Date().toISOString();
        } else {
            settings.push({
                id: settingId,
                value: value,
                updatedAt: new Date().toISOString()
            });
        }

        localStorage.setItem('sppg_v2_settings', JSON.stringify(settings));
        return { success: true };
    },

    // Clear all data (DANGER!)
    resetAll: () => {
        if (confirm('HAPUS SEMUA DATA? Ini tidak bisa dibatalkan!')) {
            Database.TABLES.forEach(table => {
                localStorage.removeItem(`sppg_v2_${table}`);
            });
            localStorage.removeItem('sppg_v2_current_user');
            Database.init();
            return true;
        }
        return false;
    },

    // ==========================================
    // SETTINGS MANAGEMENT
    // ==========================================

    // Get a single setting by ID
    getSetting: (id) => {
        const settings = Database.getAll('settings');
        const setting = settings.find(s => s.id === id);
        return setting ? setting.value : null;
    },

    // Set/Update a single setting
    setSetting: (id, value) => {
        const settings = Database.getAll('settings');
        const existingIndex = settings.findIndex(s => s.id === id);

        const settingObj = {
            id: id,
            value: value,
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            settings[existingIndex] = settingObj;
        } else {
            settings.push(settingObj);
        }

        localStorage.setItem('sppg_v2_settings', JSON.stringify(settings));
        return settingObj;
    },

    // ==========================================
    // CLOUD SYNC FUNCTIONS
    // ==========================================

    // Check if API is configured
    isApiConfigured: () => {
        return Database.API_URL && Database.API_URL.length > 10;
    },

    // Sync settings TO cloud (push branding etc)
    syncSettingsToCloud: async () => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        const settings = Database.getAll('settings');
        const brandingSettings = settings.filter(s =>
            s.id.startsWith('branding_') || s.id === 'showNoPegawai'
        );

        if (brandingSettings.length === 0) {
            return { success: true, message: 'No settings to sync' };
        }

        try {
            // Send each setting to cloud
            for (const setting of brandingSettings) {
                await fetch(`${Database.API_URL}?action=setSetting&id=${encodeURIComponent(setting.id)}&value=${encodeURIComponent(setting.value)}`);
            }
            return { success: true };
        } catch (e) {
            console.log('Settings sync error:', e);
            return { success: false, error: e.message };
        }
    },

    // Sync branding FROM cloud (pull on login)
    syncBrandingFromCloud: async () => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        try {
            const response = await fetch(`${Database.API_URL}?action=getSettings`);
            if (!response.ok) throw new Error('Network error');

            const result = await response.json();
            if (result.success && result.data) {
                // Update local settings with cloud data
                result.data.forEach(setting => {
                    Database.setSetting(setting.id, setting.value);

                    // Update localStorage for branding
                    if (setting.id === 'branding_appName') {
                        localStorage.setItem('sppg_app_name', setting.value);
                    }
                    if (setting.id === 'branding_subtitle') {
                        localStorage.setItem('sppg_subtitle', setting.value);
                    }
                });
                return { success: true, data: result.data };
            }
            return { success: false, error: 'No data' };
        } catch (e) {
            console.log('Branding sync error:', e);
            return { success: false, error: e.message };
        }
    },

    // Sync data FROM cloud (pull)
    syncFromCloud: async (table) => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        try {
            return new Promise((resolve, reject) => {
                const callbackName = `__jsonpCallback_${table}_${Date.now()}`;
                const timeout = setTimeout(() => {
                    delete window[callbackName];
                    reject({ success: false, error: 'Timeout - server lambat' });
                }, 30000);

                window[callbackName] = (data) => {
                    clearTimeout(timeout);
                    delete window[callbackName];

                    if (data.success && data.data) {
                        const cloudData = data.data;
                        localStorage.setItem(`sppg_v2_${table}`, JSON.stringify(cloudData));
                        resolve({ success: true, count: cloudData.length });
                    } else {
                        resolve(data);
                    }
                };

                const script = document.createElement('script');
                script.src = `${Database.API_URL}?action=getAll&sheet=${table}&callback=${callbackName}`;
                script.onerror = () => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    reject({ success: false, error: 'Gagal koneksi ke server' });
                };
                document.body.appendChild(script);
                script.onload = () => script.remove();
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Push single item to cloud using JSONP (works without server)
    pushItemToCloud: async (table, item) => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        try {
            // Create a copy without the large base64 foto data
            const cloudItem = { ...item };
            if (cloudItem.foto && cloudItem.foto.startsWith('data:image')) {
                delete cloudItem.foto;
            }

            return new Promise((resolve) => {
                const callbackName = `__pushCallback_${Date.now()}`;
                const timeout = setTimeout(() => {
                    delete window[callbackName];
                    resolve({ success: true, message: 'Request sent (no confirmation)' });
                }, 5000);

                window[callbackName] = (data) => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve(data);
                };

                // Encode data as URL parameter
                const encodedData = encodeURIComponent(JSON.stringify(cloudItem));
                const script = document.createElement('script');
                script.src = `${Database.API_URL}?action=addItem&sheet=${table}&data=${encodedData}&apiKey=${Database.API_SECRET_KEY}&callback=${callbackName}`;
                script.onerror = () => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve({ success: false, error: 'Network error' });
                };
                document.body.appendChild(script);
                script.onload = () => script.remove();
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Update item on cloud using JSONP (works without server)
    updateItemOnCloud: async (table, item) => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        try {
            return new Promise((resolve) => {
                const callbackName = `__updateCallback_${Date.now()}`;
                const timeout = setTimeout(() => {
                    delete window[callbackName];
                    resolve({ success: true, message: 'Request sent' });
                }, 5000);

                window[callbackName] = (data) => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve(data);
                };

                const encodedData = encodeURIComponent(JSON.stringify(item));
                const script = document.createElement('script');
                script.src = `${Database.API_URL}?action=updateItem&sheet=${table}&id=${item.id}&data=${encodedData}&apiKey=${Database.API_SECRET_KEY}&callback=${callbackName}`;
                script.onerror = () => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve({ success: false, error: 'Network error' });
                };
                document.body.appendChild(script);
                script.onload = () => script.remove();
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Delete item from cloud using JSONP (works without server)
    deleteItemFromCloud: async (table, id) => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        try {
            return new Promise((resolve) => {
                const callbackName = `__deleteCallback_${Date.now()}`;
                const timeout = setTimeout(() => {
                    delete window[callbackName];
                    resolve({ success: true, message: 'Request sent' });
                }, 5000);

                window[callbackName] = (data) => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve(data);
                };

                const script = document.createElement('script');
                script.src = `${Database.API_URL}?action=deleteItem&sheet=${table}&id=${id}&apiKey=${Database.API_SECRET_KEY}&callback=${callbackName}`;
                script.onerror = () => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve({ success: false, error: 'Network error' });
                };
                document.body.appendChild(script);
                script.onload = () => script.remove();
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Alias for deleteItemFromCloud
    deleteFromCloud: async (table, id) => {
        return Database.deleteItemFromCloud(table, id);
    },

    // Sync data TO cloud (push all)
    syncToCloud: async (table) => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        const items = Database.getAll(table);
        if (items.length === 0) {
            return { success: true, message: 'No data to sync' };
        }

        try {
            const response = await fetch(Database.API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'sync', sheet: table, items: items })
            });
            return { success: true, message: 'Data synced' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Full sync (pull all tables from cloud)
    fullSync: async () => {
        const results = {};
        for (const table of Database.TABLES) {
            try {
                results[table] = await Database.syncFromCloud(table);
            } catch (e) {
                results[table] = { success: false, error: e.message };
            }
        }
        return results;
    },

    // Test API connection
    testConnection: async () => {
        if (!Database.isApiConfigured()) {
            return { success: false, error: 'API belum dikonfigurasi' };
        }

        try {
            return new Promise((resolve) => {
                const callbackName = `__testCallback_${Date.now()}`;
                const timeout = setTimeout(() => {
                    delete window[callbackName];
                    resolve({ success: false, error: 'Timeout' });
                }, 10000);

                window[callbackName] = (data) => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    resolve(data);
                };

                const script = document.createElement('script');
                script.src = `${Database.API_URL}?action=ping&callback=${callbackName}`;
                document.body.appendChild(script);
                script.onload = () => script.remove();
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', Database.init);

// Make available globally
window.Database = Database;
