/**
 * Debug script to test with different steps
 */

const { spawn } = require('child_process');

// Test with a simpler request first
const testSteps = ["open https://www.google.com"];

const requestBody = JSON.stringify({
  steps: testSteps
});

console.log('Making request to automation API...');
console.log('Request body:', requestBody);

const curl = spawn('curl', [
  '-X', 'POST',
  '-H', 'Content-Type: application/json',
  '-d', requestBody,
  'http://localhost:3000/api/automation/execute'
], { stdio: 'inherit' });

curl.on('close', (code) => {
  console.log(`\nRequest completed with exit code: ${code}`);
});

curl.on('error', (error) => {
  console.error('Error making request:', error.message);
});
