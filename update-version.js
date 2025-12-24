const fs = require('fs');
const version = Date.now().toString(); // Timestamp'i versiyon yapıyoruz

const envFile = `
export const environment = {
    production: true,
    name: 'deploy',
    apiUrl: 'https://api.industricode.com/api',
    appVersion: '${version}'
};`;

fs.writeFileSync('./src/environments/environment.prod.ts', envFile);
console.log('Build versiyonu güncellendi: ' + version);