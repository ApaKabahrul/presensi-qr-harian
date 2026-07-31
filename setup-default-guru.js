const bcrypt = require('bcrypt');
const { supabase, insertRow } = require('./server/utils/supabase');

async function setupDefaultGuru() {
  try {
    const defaultPassword = 'guru123';
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(defaultPassword, saltRounds);
    
    const defaultGuru = {
      id_guru: 'g001',
      username: 'guru',
      password_hash,
      nama_lengkap: 'Guru Pengajar'
    };

    const { data: existingGuru, error: checkErr } = await supabase
      .from('guru')
      .select('id_guru')
      .eq('id_guru', defaultGuru.id_guru)
      .maybeSingle();

    if (checkErr) {
      throw checkErr;
    }

    if (!existingGuru) {
      await insertRow('guru', defaultGuru);
      console.log('Default guru account created successfully!');
      console.log('Username: guru');
      console.log('Password: guru123');
    } else {
      console.log('Default guru account already exists, no changes made.');
    }
    
  } catch (error) {
    console.error('Error setting up default guru:', error);
  }
}

setupDefaultGuru();
