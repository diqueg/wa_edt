const svc = require('./src/db/session');
console.log(Object.keys(svc));
console.log('markSessionMessage', typeof svc.markSessionMessage);
console.log('markMessageProcessing', typeof svc.markMessageProcessing);