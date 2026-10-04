const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== ตั้งค่า Google Sheets ====================
// นำ URL ของ Web App ที่ได้จากการ Deploy Google Apps Script มาใส่ตรงนี้
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby2CjRAQESIf1pkqkAxkYxmwvpTyVzMYZeGhgo46uFF1ETG6Q2yTwduJPPr3iI8NU1sWA/exec";

// ตัวแปรควบคุมเวลาบันทึก (บันทึกทุกๆ 60 วินาที เพื่อไม่ให้ Google Sheet บันทึกถี่เกินไป)
let lastSheetSaveTime = 0;
const SHEET_SAVE_INTERVAL = 60000; // 60,000 มิลลิวินาที = 1 นาที

// ให้บริการไฟล์ Static จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

// สร้าง WebSocket Server รับ Path /esp
const wss = new WebSocket.Server({ server, path: '/esp' });

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[Server] Client connected from IP: ${ip}`);

  ws.on('message', (message) => {
    const dataStr = message.toString();
    console.log(`[Received]: ${dataStr}`);

    // พยายามแปลงข้อความที่ได้รับเป็น JSON เพื่อตรวจสอบประเภทข้อมูล
    try {
      const data = JSON.parse(dataStr);

      // ถ้าเป็นข้อมูลพลังงานจาก ESP32 ให้เช็คเวลาแล้วส่งต่อไปยัง Google Sheets
      if (data.type === 'ENERGY_DATA') {
        const currentTime = Date.now();
        if (currentTime - lastSheetSaveTime >= SHEET_SAVE_INTERVAL) {
          lastSheetSaveTime = currentTime;

          // ส่งข้อมูลไปยัง Google Apps Script (ใช้ fetch ในตัวของ Node.js เวอร์ชันใหม่)
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              voltage: data.voltage,
              current: data.current,
              power: data.power,
              energy: data.energy
            })
          })
          .then(res => res.text())
          .then(result => console.log("[Google Sheets] บันทึกข้อมูลสำเร็จ:", result))
          .catch(err => console.error("[Google Sheets Error]:", err.message));
        }
      }
    } catch (e) {
      // กรณีไม่ใช่ JSON (เช่นข้อความธรรมดา) ให้ข้ามส่วนบันทึก Google Sheet ไป
    }

    // ส่งข้อมูลต่อกระจายไปยัง Client ทั้งหมด (เช่น หน้าเว็บ Dashboard)
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(dataStr);
      }
    });
  });

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('[Server Error]:', err.message);
  });
});

// กำหนด '0.0.0.0' เพื่อให้ Render สแกนเจอ Port ทันทีที่สตาร์ท
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on port ${PORT}`);
});
