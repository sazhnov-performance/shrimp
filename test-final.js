/**
 * Test the complete navigation fix
 */

const { spawn } = require('child_process');

const testSteps = ["open google"];

const requestBody = JSON.stringify({
  steps: testSteps
});

console.log('Testing complete fix...');
console.log('Request body:', requestBody);

const curl = spawn('curl', [
  '-X', 'POST',
  '-H', 'Content-Type: application/json',
  '-d', requestBody,
  'http://localhost:3000/api/automation/execute'
], { stdio: 'inherit' });

curl.on('close', (code) => {
  console.log(`\nRequest completed with exit code: ${code}`);
  console.log('Check the dev server logs for detailed execution flow');
});

curl.on('error', (error) => {
  console.error('Error making request:', error.message);
});
