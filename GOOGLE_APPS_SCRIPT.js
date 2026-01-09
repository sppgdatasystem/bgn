// ============================================================
// SPPG MBG BGN INDONESIA - GOOGLE APPS SCRIPT
// Enterprise Database System for SPPG
// ============================================================
// 
// CARA PAKAI:
// 1. Buat Google Sheets baru
// 2. Extensions → Apps Script
// 3. Paste seluruh kode ini
// 4. Ganti SPREADSHEET_ID dengan ID dari URL Sheets Anda
// 5. Simpan, pilih fungsi "setup", klik Run
// 6. Deploy → New deployment → Web App
// 7. Copy URL deployment untuk Setup API di aplikasi
//
// ============================================================

// ⚠️ GANTI DENGAN DATA ANDA:
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';  // Copy dari URL Sheets Anda
var API_SECRET_KEY = 'SPPGDATA2026YUMADA';        // Kunci rahasia API

// ============================================================
// SCHEMA DATABASE - Struktur kolom untuk setiap sheet
// ============================================================
var SHEETS = {
    users: {
        columns: ['id', 'nama', 'phone', 'pin', 'noPegawai', 'jabatan', 'role', 'status', 'createdAt'],
        headers: ['ID', 'Nama Lengkap', 'No. HP', 'PIN', 'No Pegawai', 'Jabatan', 'Role', 'Status', 'Dibuat'],
        widths: [120, 180, 140, 80, 100, 180, 100, 80, 180],
        color: '#1B365D'  // Navy Blue - Primary
    },
    produksi: {
        columns: ['id', 'step', 'label', 'tanggal', 'waktu', 'user', 'fotoFile', 'fotoCount'],
        headers: ['ID', 'Step ID', 'Nama Step', 'Tanggal', 'Waktu', 'Petugas', 'File Foto', 'Jml Foto'],
        widths: [150, 120, 200, 110, 80, 150, 200, 80],
        color: '#2E7D32'  // Green - Produksi
    },
    distribusi: {
        columns: ['id', 'kloter', 'sekolah', 'jumlahBox', 'driver', 'status', 'tanggal', 'waktu', 'user', 'fotoFile'],
        headers: ['ID', 'Kloter', 'Nama Sekolah', 'Jumlah Box', 'Driver', 'Status', 'Tanggal', 'Waktu', 'Petugas', 'File Foto'],
        widths: [150, 70, 220, 90, 150, 100, 110, 80, 150, 200],
        color: '#1565C0'  // Blue - Distribusi
    },
    logistik: {
        columns: ['id', 'nama', 'berat', 'harga', 'qcStatus', 'supplier', 'tanggal', 'waktu', 'user', 'fotoFile'],
        headers: ['ID', 'Nama Bahan', 'Berat (kg)', 'Harga (Rp)', 'QC Status', 'Supplier', 'Tanggal', 'Waktu', 'Petugas', 'File Foto'],
        widths: [150, 180, 100, 130, 100, 180, 110, 80, 150, 200],
        color: '#E65100'  // Orange - Logistik
    },
    audit: {
        columns: ['id', 'aksi', 'detail', 'user', 'waktu', 'tanggal'],
        headers: ['ID', 'Aksi', 'Detail', 'User', 'Waktu', 'Tanggal'],
        widths: [150, 120, 300, 150, 100, 110],
        color: '#6A1B9A'  // Purple - Audit Log
    },
    settings: {
        columns: ['id', 'value', 'updatedAt', 'updatedBy'],
        headers: ['Setting ID', 'Nilai', 'Terakhir Update', 'Diupdate Oleh'],
        widths: [180, 250, 180, 150],
        color: '#424242'  // Grey - Settings
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function getSpreadsheet() {
    try {
        return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
        return SpreadsheetApp.getActiveSpreadsheet();
    }
}

// ============================================================
// SETUP - Buat semua sheet dengan format profesional
// ============================================================
function setup() {
    var ss = getSpreadsheet();
    if (!ss) {
        Logger.log('❌ ERROR: Tidak bisa akses spreadsheet!');
        Logger.log('Pastikan SPREADSHEET_ID sudah benar.');
        return;
    }

    Logger.log('🚀 Memulai setup SPPG Database...');
    Logger.log('');

    // Create each sheet with professional formatting
    for (var name in SHEETS) {
        var config = SHEETS[name];
        var sheet = ss.getSheetByName(name);

        if (!sheet) {
            sheet = ss.insertSheet(name);
            Logger.log('✅ Sheet "' + name + '" dibuat');
        } else {
            sheet.clear();
            Logger.log('🔄 Sheet "' + name + '" direset');
        }

        // Set headers (using nice display names)
        var headerRange = sheet.getRange(1, 1, 1, config.headers.length);
        headerRange.setValues([config.headers]);

        // Professional header styling
        headerRange
            .setBackground(config.color)
            .setFontColor('#FFFFFF')
            .setFontWeight('bold')
            .setFontSize(10)
            .setHorizontalAlignment('center')
            .setVerticalAlignment('middle');

        // Set row height for header
        sheet.setRowHeight(1, 35);

        // Set column widths
        for (var i = 0; i < config.widths.length; i++) {
            sheet.setColumnWidth(i + 1, config.widths[i]);
        }

        // Freeze header row
        sheet.setFrozenRows(1);

        // Format phone column as text for users
        if (name === 'users') {
            sheet.getRange('C:C').setNumberFormat('@');
        }

        // Format price column for logistik
        if (name === 'logistik') {
            sheet.getRange('D:D').setNumberFormat('Rp #,##0');
        }

        // Add alternating row colors for data area
        var dataRange = sheet.getRange(2, 1, 100, config.columns.length);
        var rule = SpreadsheetApp.newConditionalFormatRule()
            .whenFormulaSatisfied('=MOD(ROW(),2)=0')
            .setBackground('#F5F5F5')
            .setRanges([dataRange])
            .build();
        var rules = sheet.getConditionalFormatRules();
        rules.push(rule);
        sheet.setConditionalFormatRules(rules);

        // Store actual column names in row 2 (hidden) for API compatibility
        // Actually, we'll use a mapping approach instead
    }

    // Add default Admin user
    var usersSheet = ss.getSheetByName('users');
    var adminRow = [
        '1',                          // id
        'Admin',                      // nama
        '081234567890',              // phone
        '1234',                      // pin
        '',                          // noPegawai (empty)
        'Administrator',             // jabatan
        'admin',                     // role
        'active',                    // status
        new Date().toISOString()     // createdAt
    ];
    usersSheet.appendRow(adminRow);

    // Style the admin row
    var adminRange = usersSheet.getRange(2, 1, 1, adminRow.length);
    adminRange.setHorizontalAlignment('center');
    usersSheet.setRowHeight(2, 30);

    // Delete default Sheet1 if exists
    var sheet1 = ss.getSheetByName('Sheet1');
    if (sheet1) {
        ss.deleteSheet(sheet1);
    }

    // Rename spreadsheet
    ss.rename('SPPG Database - ' + new Date().toLocaleDateString('id-ID'));

    Logger.log('');
    Logger.log('═══════════════════════════════════════════');
    Logger.log('✅ SETUP SELESAI!');
    Logger.log('═══════════════════════════════════════════');
    Logger.log('');
    Logger.log('📱 Login Default:');
    Logger.log('   Phone: 081234567890');
    Logger.log('   PIN  : 1234');
    Logger.log('');
    Logger.log('🔐 API Key: ' + API_SECRET_KEY);
    Logger.log('');
    Logger.log('📋 Langkah selanjutnya:');
    Logger.log('   1. Deploy → New deployment → Web App');
    Logger.log('   2. Execute as: Me');
    Logger.log('   3. Who has access: Anyone');
    Logger.log('   4. Copy URL deployment');
    Logger.log('   5. Masukkan ke Setup API di aplikasi');
    Logger.log('');
}

// ============================================================
// API HANDLERS
// ============================================================

// Map display headers back to column names for API
function getColumnMapping(sheetName) {
    var config = SHEETS[sheetName];
    if (!config) return null;
    var mapping = {};
    for (var i = 0; i < config.headers.length; i++) {
        mapping[config.headers[i]] = config.columns[i];
        mapping[config.columns[i]] = config.columns[i]; // Also map original names
    }
    return mapping;
}

function doGet(e) {
    var action = e.parameter.action;
    var sheetName = e.parameter.sheet;
    var callback = e.parameter.callback;
    var result;

    try {
        if (action === 'getAll') {
            result = getAllData(sheetName);
        }
        else if (action === 'ping') {
            result = { success: true, message: 'SPPG API Ready', version: '2.0' };
        }
        // ==== PUBLIC: Get branding for login page (no auth needed) ====
        else if (action === 'getBranding') {
            result = getPublicBranding();
        }
        // ==== NEW: Get all settings for branding sync ====
        else if (action === 'getSettings') {
            result = getSettings();
        }
        // ==== NEW: Set a single setting ====
        else if (action === 'setSetting') {
            var id = e.parameter.id;
            var value = e.parameter.value;
            result = setSetting(id, value);
        }
        // ==== JSONP: Add item (works without server/CORS) ====
        else if (action === 'addItem') {
            var apiKey = e.parameter.apiKey;
            if (apiKey !== API_SECRET_KEY) {
                result = { success: false, error: 'Invalid API Key' };
            } else {
                var data = JSON.parse(decodeURIComponent(e.parameter.data));
                result = addData(sheetName, data);
            }
        }
        // ==== JSONP: Update item ====
        else if (action === 'updateItem') {
            var apiKey = e.parameter.apiKey;
            if (apiKey !== API_SECRET_KEY) {
                result = { success: false, error: 'Invalid API Key' };
            } else {
                var itemId = e.parameter.id;
                var data = JSON.parse(decodeURIComponent(e.parameter.data));
                result = updateData(sheetName, itemId, data);
            }
        }
        // ==== JSONP: Delete item ====
        else if (action === 'deleteItem') {
            var apiKey = e.parameter.apiKey;
            if (apiKey !== API_SECRET_KEY) {
                result = { success: false, error: 'Invalid API Key' };
            } else {
                var itemId = e.parameter.id;
                result = deleteData(sheetName, itemId);
            }
        }
        else {
            result = { success: false, error: 'Invalid action' };
        }
    } catch (err) {
        result = { success: false, error: err.message };
    }

    if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')')
            .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// PUBLIC BRANDING - Accessible without authentication
// ============================================================
function getPublicBranding() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('settings');

    // Default branding
    var branding = {
        appName: 'SPPG-MBG-BGN-INDONESIA',
        subtitle: 'Badan Gizi Nasional'
    };

    if (!sheet) {
        return { success: true, data: branding };
    }

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] === 'branding_appName' && row[1]) {
            branding.appName = row[1];
        }
        if (row[0] === 'branding_subtitle' && row[1]) {
            branding.subtitle = row[1];
        }
    }

    return { success: true, data: branding };
}

// ============================================================
// SETTINGS FUNCTIONS - For branding sync
// ============================================================
function getSettings() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('settings');
    if (!sheet) {
        return { success: false, error: 'Settings sheet not found' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0]) {  // Only if ID exists
            result.push({
                id: row[0],
                value: row[1],
                updatedAt: row[2],
                updatedBy: row[3]
            });
        }
    }

    return { success: true, data: result };
}

function setSetting(id, value) {
    if (!id) {
        return { success: false, error: 'Setting ID required' };
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('settings');
    if (!sheet) {
        return { success: false, error: 'Settings sheet not found' };
    }

    var data = sheet.getDataRange().getValues();
    var existingRow = -1;

    // Find existing setting
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
            existingRow = i + 1;  // 1-indexed for Sheets
            break;
        }
    }

    var timestamp = new Date().toISOString();

    if (existingRow > 0) {
        // Update existing
        sheet.getRange(existingRow, 2).setValue(value);
        sheet.getRange(existingRow, 3).setValue(timestamp);
        sheet.getRange(existingRow, 4).setValue('API');
    } else {
        // Add new
        sheet.appendRow([id, value, timestamp, 'API']);
    }

    return { success: true, id: id };
}

function doPost(e) {
    var result;
    try {
        var data = JSON.parse(e.postData.contents);

        // Check API key
        if (!data.apiKey || data.apiKey !== API_SECRET_KEY) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                error: 'UNAUTHORIZED - Invalid API Key'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Route actions
        if (data.action === 'add') {
            result = addData(data.sheet, data.data);
        }
        else if (data.action === 'update') {
            result = updateData(data.sheet, data.id, data.data);
        }
        else if (data.action === 'delete') {
            result = deleteData(data.sheet, data.id);
        }
        else if (data.action === 'sync') {
            result = syncData(data.sheet, data.items);
        }
        else if (data.action === 'resetData') {
            result = resetAllData(data.user);
        }
        else {
            result = { success: false, error: 'Invalid action' };
        }
    } catch (err) {
        result = { success: false, error: err.message };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// DATA OPERATIONS
// ============================================================

function getAllData(sheetName) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        return { success: false, error: 'Sheet not found: ' + sheetName };
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
        return { success: true, data: [] };
    }

    // Use column names from SHEETS config, not display headers
    var config = SHEETS[sheetName];
    var columns = config ? config.columns : data[0];

    var result = [];
    for (var i = 1; i < data.length; i++) {
        var obj = {};
        for (var j = 0; j < columns.length; j++) {
            obj[columns[j]] = data[i][j];
        }
        result.push(obj);
    }

    return { success: true, data: result };
}

function addData(sheetName, item) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        return { success: false, error: 'Sheet not found' };
    }

    var config = SHEETS[sheetName];
    var columns = config ? config.columns : null;

    if (!columns) {
        return { success: false, error: 'Invalid sheet config' };
    }

    // Duplicate check for users
    if (sheetName === 'users' && item.phone) {
        var data = sheet.getDataRange().getValues();
        var phoneCol = columns.indexOf('phone');
        var normalize = function (p) {
            return p ? p.toString().replace(/^0+/, '') : '';
        };
        var inputPhone = normalize(item.phone);

        for (var i = 1; i < data.length; i++) {
            if (normalize(data[i][phoneCol]) === inputPhone) {
                return {
                    success: false,
                    error: 'User dengan phone ini sudah ada',
                    duplicate: true
                };
            }
        }
    }

    // Build row from column config
    var row = [];
    for (var i = 0; i < columns.length; i++) {
        row.push(item[columns[i]] || '');
    }
    sheet.appendRow(row);

    // Style new row
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, columns.length).setHorizontalAlignment('center');
    sheet.setRowHeight(lastRow, 28);

    return { success: true, id: item.id };
}

function updateData(sheetName, id, item) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        return { success: false, error: 'Sheet not found' };
    }

    var config = SHEETS[sheetName];
    var columns = config ? config.columns : null;
    var data = sheet.getDataRange().getValues();
    var idCol = columns.indexOf('id');

    for (var i = 1; i < data.length; i++) {
        if (data[i][idCol].toString() === id.toString()) {
            var row = [];
            for (var j = 0; j < columns.length; j++) {
                row.push(item[columns[j]] !== undefined ? item[columns[j]] : data[i][j]);
            }
            sheet.getRange(i + 1, 1, 1, columns.length).setValues([row]);
            return { success: true };
        }
    }

    return { success: false, error: 'Record not found' };
}

function deleteData(sheetName, id) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        return { success: false, error: 'Sheet not found' };
    }

    var config = SHEETS[sheetName];
    var columns = config ? config.columns : null;
    var data = sheet.getDataRange().getValues();
    var idCol = columns.indexOf('id');

    for (var i = 1; i < data.length; i++) {
        if (data[i][idCol].toString() === id.toString()) {
            sheet.deleteRow(i + 1);
            return { success: true };
        }
    }

    return { success: false, error: 'Record not found' };
}

function syncData(sheetName, items) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || !items) {
        return { success: false, error: 'Invalid request' };
    }

    var config = SHEETS[sheetName];
    var columns = config ? config.columns : null;
    var data = sheet.getDataRange().getValues();
    var idCol = columns.indexOf('id');

    var existingIds = {};
    for (var i = 1; i < data.length; i++) {
        existingIds[data[i][idCol].toString()] = true;
    }

    var added = 0;
    for (var j = 0; j < items.length; j++) {
        if (!existingIds[items[j].id.toString()]) {
            var row = [];
            for (var k = 0; k < columns.length; k++) {
                row.push(items[j][columns[k]] || '');
            }
            sheet.appendRow(row);
            added++;
        }
    }

    return { success: true, message: added + ' records added' };
}

function resetAllData(userName) {
    var ss = getSpreadsheet();
    var sheetsToReset = ['produksi', 'distribusi', 'logistik'];
    var resetCount = 0;

    for (var i = 0; i < sheetsToReset.length; i++) {
        var sheetName = sheetsToReset[i];
        var sheet = ss.getSheetByName(sheetName);
        if (sheet) {
            var lastRow = sheet.getLastRow();
            if (lastRow > 1) {
                sheet.deleteRows(2, lastRow - 1);
                resetCount++;
            }
        }
    }

    // Log to audit
    var auditSheet = ss.getSheetByName('audit');
    if (auditSheet) {
        var now = new Date();
        auditSheet.appendRow([
            Date.now().toString(),
            'RESET_DATA',
            'Reset semua data: produksi, distribusi, logistik',
            userName || 'System',
            now.toLocaleTimeString('id-ID'),
            now.toLocaleDateString('id-ID')
        ]);
    }

    return {
        success: true,
        message: 'Data berhasil direset (' + resetCount + ' sheets)'
    };
}
