const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const routes = require('./routes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('❌ Express Error:', err.message);
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.get('/', (req, res) => {
  res.json({ message: '农场游戏后端服务已启动' });
});

(async () => {
  await db.init();
  app.listen(PORT, () => {
    console.log(`🚀 农场游戏后端服务运行在 http://localhost:${PORT}`);
  });
})();
