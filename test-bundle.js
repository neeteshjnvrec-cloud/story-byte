// Test to verify Metro resolves App.js correctly
import App from './App.js';

if (!App) {
  console.error('ERROR: App.js not resolved correctly');
  process.exit(1);
}

console.log('SUCCESS: App.js resolved correctly');