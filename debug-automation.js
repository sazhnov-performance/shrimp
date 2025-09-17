/**
 * Debug script to test the automation flow
 */

const { spawn } = require('child_process');

// Make a request to the automation API
const testSteps = ["open google"];

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
  console.log('\nCheck the logs/executor.log file for debug output');
});

curl.on('error', (error) => {
  console.error('Error making request:', error.message);
});
