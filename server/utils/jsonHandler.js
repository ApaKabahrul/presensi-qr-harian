const fs = require('fs');
const path = require('path');
const lockfile = require('lockfile');

const DATA_DIR = path.join(__dirname, '../../data');

// Pastikan folder data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Membaca file JSON
 * @param {string} filename - Nama file JSON
 * @returns {Array|Object} Data dari file JSON
 */
async function readJSON(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(DATA_DIR, filename);
    const lockPath = `${filePath}.lock`;

    lockfile.check(lockPath, (err, exists) => {
      if (err) reject(new Error(`Error checking lock for ${filename}: ${err.message}`));
      
      lockfile.lock(lockPath, { stale: 10000, retries: { retries: 10, factor: 1, minTimeout: 1 * 1000, maxTimeout: 10 * 1000, randomize: true }, lifecycle: {} }, (err, released) => {
        if (err) reject(new Error(`Error locking ${filename}: ${err.message}`));
        
        try {
          if (!fs.existsSync(filePath)) {
            lockfile.unlock(lockPath, () => {});
            resolve([]);
            return;
          }

          const data = fs.readFileSync(filePath, 'utf8');
          const parsed = data ? JSON.parse(data) : [];
          
          lockfile.unlock(lockPath, () => {
            resolve(parsed);
          });
        } catch (error) {
          lockfile.unlock(lockPath, () => {});
          reject(new Error(`Error reading ${filename}: ${error.message}`));
        }
      });
    });
  });
}

/**
 * Menulis file JSON
 * @param {string} filename - Nama file JSON
 * @param {Array|Object} data - Data yang akan ditulis
 */
async function writeJSON(filename, data) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(DATA_DIR, filename);
    const lockPath = `${filePath}.lock`;

    lockfile.check(lockPath, (err, exists) => {
      if (err) reject(new Error(`Error checking lock for ${filename}: ${err.message}`));
      
      lockfile.lock(lockPath, { stale: 10000, retries: { retries: 10, factor: 1, minTimeout: 1 * 1000, maxTimeout: 10 * 1000, randomize: true }, lifecycle: {} }, (err, released) => {
        if (err) reject(new Error(`Error locking ${filename}: ${err.message}`));
        
        try {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
          
          lockfile.unlock(lockPath, () => {
            resolve();
          });
        } catch (error) {
          lockfile.unlock(lockPath, () => {});
          reject(new Error(`Error writing ${filename}: ${error.message}`));
        }
      });
    });
  });
}

/**
 * Membaca settings
 * @returns {Object} Data settings
 */
async function readSettings() {
  try {
    return await readJSON('settings.json');
  } catch (error) {
    // Return default settings jika file tidak ada
    return {
      nama_kelas: "X-A",
      jam_mulai: "07:00",
      batas_terlambat: "07:15",
      jam_selesai: "08:00"
    };
  }
}

/**
 * Generate ID unik
 * @param {string} prefix - Prefix untuk ID
 * @param {Array} existingData - Data existing untuk cek ID terakhir
 * @param {string} idField - Nama field ID
 * @returns {string} ID unik
 */
function generateId(prefix, existingData = [], idField = 'id_murid') {
  const maxId = existingData.reduce((max, item) => {
    const idNum = parseInt(item[idField].replace(prefix, ''));
    return idNum > max ? idNum : max;
  }, 0);
  
  const nextId = maxId + 1;
  return `${prefix}${String(nextId).padStart(3, '0')}`;
}

/**
 * Generate token unik untuk QR
 * @returns {string} Token unik
 */
function generateQRToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  readJSON,
  writeJSON,
  readSettings,
  generateId,
  generateQRToken
};
