const fetch = require('node-fetch');

async function testLogin() {
  try {
    const email = 'grkyklos-@hotmail.gr';
    const password = 'admin123';

    console.log('Testing login with:');
    console.log('Email:', email);
    console.log('Password:', password);

    const response = await fetch('http://localhost:5000/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    console.log('\nResponse status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Login successful!');
    } else {
      console.log('\n❌ Login failed:', data.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogin();

