const bcrypt = require('bcrypt');
const { writeJSON } = require('./server/utils/jsonHandler');

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
    
    await writeJSON('guru.json', [defaultGuru]);
    
    console.log('Default guru account created successfully!');
    console.log('Username: guru');
    console.log('Password: guru123');
    console.log('Password hash:', password_hash);
    
  } catch (error) {
    console.error('Error setting up default guru:', error);
  }
}

setupDefaultGuru();
