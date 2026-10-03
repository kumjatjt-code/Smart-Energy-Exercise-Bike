const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// ให้บริการไฟล์ Static สำหรับหน้า Dashboard (ถ้ามีโฟลเดอร์ public)
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Smart Power WebSocket Server is Running!');
});

const server = http.createServer(app);

// สร้าง WebSocket Server รับ Path /esp
const wss = new WebSocket.Server({ server, path: '/esp' });

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[Server] คลื่นลูกใหม่เชื่อมต่อเข้ามาจาก IP: ${ip}`);

  ws.on('message', (message) => {
    const dataStr = message.toString();
    console.log(`[Received]: ${dataStr}`);

    // ส่งข้อมูลต่อกระจายไปยัง Client ทั้งหมด (เช่น หน้าเว็บ Dashboard)
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(dataStr);
      }
    });
  });

  ws.on('close', () => {
    console.log('[Server] การเชื่อมต่อถูกตัด');
  });

  ws.on('error', (err) => {
    console.error('[Server Error]:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] กำลังทำงานที่พอร์ต ${PORT}`);
});
2. โค้ดฝั่ง ES