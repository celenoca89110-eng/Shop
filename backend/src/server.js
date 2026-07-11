require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[CecaShop] API démarrée sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
