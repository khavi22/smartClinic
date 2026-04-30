const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Assuming the server is running here

async function testRoutes() {
    console.log('Testing Admin Staff Management Routes...');
    
    // Note: This requires a valid admin token, which we can't easily get here
    // But we can check if the routes exist and return 401/403 instead of 404
    
    try {
        const activeRes = await axios.get(`${BASE_URL}/api/admin/active-staff?clinicId=test`);
        console.log('Active Staff Route:', activeRes.status);
    } catch (error) {
        console.log('Active Staff Route (Expected Error):', error.response?.status || error.message);
    }

    try {
        const removeRes = await axios.post(`${BASE_URL}/api/admin/remove-staff`, { staffUid: 'test' });
        console.log('Remove Staff Route:', removeRes.status);
    } catch (error) {
        console.log('Remove Staff Route (Expected Error):', error.response?.status || error.message);
    }
}

testRoutes();
