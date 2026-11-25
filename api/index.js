// Función serverless de Vercel: delega todas las rutas en la app NestJS
// compilada por `nest build` (ver vercel.json).
module.exports = require('../dist/serverless').default;
