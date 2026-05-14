import { initCompanyDb } from './config/database.js';

console.log('Initializing company databases...');
const db1 = initCompanyDb('printing');
const db2 = initCompanyDb('advertising');
db1.close();
db2.close();
console.log('Done! Company databases created.');
