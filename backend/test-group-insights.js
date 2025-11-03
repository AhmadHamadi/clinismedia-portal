const axios = require('axios');
require('dotenv').config({ path: '../.env' }); // Adjust path as needed

const backendPort = process.env.PORT || 5000;
const API_BASE_URL = process.env.VITE_API_BASE_URL || `http://localhost:${backendPort}`;

// Replace with a valid admin token from your browser's localStorage
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE'; 

async function testGroupInsights() {
  try {
    if (!ADMIN_TOKEN || ADMIN_TOKEN === 'YOUR_ADMIN_TOKEN_HERE') {
      console.error('Please replace YOUR_ADMIN_TOKEN_HERE with a valid admin token from your browser\'s localStorage.');
      console.log('\nTo get your admin token:');
      console.log('1. Go to /admin/google-business');
      console.log('2. Open browser dev tools (F12)');
      console.log('3. Go to Application tab > Local Storage');
      console.log('4. Copy the adminToken value');
      return;
    }

    console.log(`Calling ${API_BASE_URL}/api/google-business/group-insights`);
    const response = await axios.get(`${API_BASE_URL}/api/google-business/group-insights?days=7`, {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      }
    });
    
    console.log('Group Insights Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching group insights:', error.response?.data || error.message);
  }
}

testGroupInsights();