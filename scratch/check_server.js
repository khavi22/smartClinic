const axios = require('axios');

async function checkRoutes() {
    console.log("Checking server version by testing routes...");
    
    try {
        const regRes = await axios.post('http://localhost:3000/api/user/register', {}, { validateStatus: () => true });
        console.log(`POST /api/user/register: ${regRes.status}`);

        const oldRes = await axios.post('http://localhost:3000/api/user/signup', {}, { validateStatus: () => true });
        console.log(`POST /api/user/signup: ${oldRes.status}`);

        if (regRes.status === 404 && oldRes.status !== 404) {
            console.log("!!! SERVER IS RUNNING OLD CODE !!!");
        } else if (regRes.status === 404 && oldRes.status === 404) {
            console.log("!!! BOTH ROUTES 404 - Something is very wrong with the server routing !!!");
        } else {
            console.log("Server seems to be running the new code.");
        }
    } catch (err) {
        console.error("Could not connect to server:", err.message);
    }
}

checkRoutes();
