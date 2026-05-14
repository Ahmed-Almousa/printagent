import { initDatabase, initCompanyDb, closeAll } from './config/database.js';

console.log('Initializing databases...');
await initDatabase();
await initCompanyDb('printing');
await initCompanyDb('advertising');
await closeAll();
console.log('Done! Databases created.');
