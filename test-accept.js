const axios = require('axios');

async function testAccept() {
  try {
    const response = await axios.post('http://localhost:5000/api/test-accept/TEST123');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAccept();