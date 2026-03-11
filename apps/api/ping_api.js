const http = require('http');

http.get('http://localhost:3001/api/problems?limit=5', {
    headers: {
        // Just checking what it returns without auth (will be 401, but we can verify it's reachable)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
}).on('error', (err) => console.log('Error:', err.message));
