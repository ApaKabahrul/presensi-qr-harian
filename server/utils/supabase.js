const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// ─────────────────────────────────────────────
// Ganti readJSON / writeJSON dengan query Supabase
// ─────────────────────────────────────────────

/**
 * Membaca semua data dari tabel
 * @param {string} table - Nama tabel di Supabase
 * @returns {Array} Array data
 */
async function readAll(table) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Supabase readAll(${table}): ${error.message}`);
  return data || [];
}

/**
 * Membaca satu baris berdasarkan kondisi
 * @param {string} table - Nama tabel
 * @param {string} column - Kolom untuk filter
 * @param {any} value - Nilai filter
 * @returns {Object|null}
 */
async function readOne(table, column, value) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (error) throw new Error(`Supabase readOne(${table}): ${error.message}`);
  return data;
}

/**
 * Membaca data dengan filter opsional
 * @param {string} table - Nama tabel
 * @param {Object} filters - { column: value }
 * @returns {Array}
 */
async function readWhere(table, filters = {}) {
  let query = supabase.from(table).select('*');

  for (const [col, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      query = query.eq(col, val);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase readWhere(${table}): ${error.message}`);
  return data || [];
}

/**
 * Insert satu baris
 * @param {string} table - Nama tabel
 * @param {Object} row - Data baris
 * @returns {Object|null}
 */
async function insertRow(table, row) {
  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Supabase insertRow(${table}): ${error.message}`);
  return data;
}

/**
 * Insert banyak baris
 * @param {string} table - Nama tabel
 * @param {Array} rows - Array data baris
 * @returns {Array}
 */
async function insertRows(table, rows) {
  const { data, error } = await supabase
    .from(table)
    .insert(rows)
    .select();

  if (error) throw new Error(`Supabase insertRows(${table}): ${error.message}`);
  return data || [];
}

/**
 * Update baris berdasarkan ID
 * @param {string} table - Nama tabel
 * @param {string} idColumn - Kolom primary key
 * @param {string} idValue - Nilai primary key
 * @param {Object} updates - Data yang akan diupdate
 * @returns {Object|null}
 */
async function updateRow(table, idColumn, idValue, updates) {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq(idColumn, idValue)
    .select()
    .single();

  if (error) throw new Error(`Supabase updateRow(${table}): ${error.message}`);
  return data;
}

/**
 * Delete baris berdasarkan ID
 * @param {string} table - Nama tabel
 * @param {string} idColumn - Kolom primary key
 * @param {string} idValue - Nilai primary key
 */
async function deleteRow(table, idColumn, idValue) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq(idColumn, idValue);

  if (error) throw new Error(`Supabase deleteRow(${table}): ${error.message}`);
}

/**
 * Cek apakah data sudah ada (untuk duplicate check)
 * @param {string} table
 * @param {string} column
 * @param {any} value
 * @param {string} [excludeColumn] - Kolom ID untuk exclude (update case)
 * @param {any} [excludeValue]
 * @returns {boolean}
 */
async function exists(table, column, value, excludeColumn = null, excludeValue = null) {
  let query = supabase.from(table).select('*').eq(column, value);
  if (excludeColumn && excludeValue) {
    query = query.neq(excludeColumn, excludeValue);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Supabase exists(${table}): ${error.message}`);
  return data && data.length > 0;
}

/**
 * Join tabel presensi dengan murid
 * @param {Object} filters - Filter opsional (tanggal_mulai, tanggal_selesai, status, id_murid)
 * @returns {Array}
 */
async function getPresensiWithMurid(filters = {}) {
  let query = supabase
    .from('presensi_harian')
    .select(`
      *,
      murid (nis, nama)
    `);

  if (filters.tanggal_mulai) {
    query = query.gte('tanggal', filters.tanggal_mulai);
  }
  if (filters.tanggal_selesai) {
    query = query.lte('tanggal', filters.tanggal_selesai);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.id_murid) {
    query = query.eq('id_murid', filters.id_murid);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase getPresensiWithMurid: ${error.message}`);

  // Flatten hasil join
  return (data || []).map(row => ({
    ...row,
    nis: row.murid?.nis || null,
    nama: row.murid?.nama || null,
    murid: undefined // hapus nested object
  }));
}

/**
 * Generate ID unik (sama seperti jsonHandler.generateId)
 * @param {string} prefix
 * @param {string} table
 * @param {string} idField
 * @returns {Promise<string>}
 */
async function generateId(prefix, table, idField = 'id_murid') {
  const { data, error } = await supabase
    .from(table)
    .select(idField)
    .order(idField, { ascending: false })
    .limit(1);

  if (error) throw new Error(`Supabase generateId(${table}): ${error.message}`);

  const maxId = data && data.length > 0
    ? parseInt(data[0][idField].replace(prefix, ''))
    : 0;

  const nextId = maxId + 1;
  return `${prefix}${String(nextId).padStart(3, '0')}`;
}

/**
 * Generate QR token unik (sama seperti jsonHandler)
 * @returns {string}
 */
function generateQRToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Membaca settings
 * @returns {Promise<Object>}
 */
async function readSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Supabase readSettings: ${error.message}`);
  return data || {
    nama_kelas: 'X-A',
    jam_mulai: '07:00',
    batas_terlambat: '07:15',
    jam_selesai: '08:00'
  };
}

module.exports = {
  supabase,
  readAll,
  readOne,
  readWhere,
  insertRow,
  insertRows,
  updateRow,
  deleteRow,
  exists,
  getPresensiWithMurid,
  generateId,
  generateQRToken,
  readSettings
};