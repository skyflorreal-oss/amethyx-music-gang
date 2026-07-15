// amethyx-backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// ฐานข้อมูลจำลองในหน่วยความจำ
const users = []; // เก็บข้อมูลสมาชิก [{username, password, firstName, lastName, status}]
const activeRooms = {}; // เก็บข้อมูลห้อง { roomId: { roomName, password, owner, playlist, status, videoTime, lastUpdatedAt, members: [] } }

// API: สมัครสมาชิก
app.post('/api/register', (req, res) => {
    const { username, password, firstName, lastName, status } = req.body;
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว!' });
    }
    users.push({ username, password, firstName, lastName, status });
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ!' });
});

// API: เข้าสู่ระบบ
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!' });
    }
    res.json({ success: true, user: { username: user.username, firstName: user.firstName, lastName: user.lastName, status: user.status } });
});

// API: ดึงรายชื่อห้องทั้งหมด
app.get('/api/rooms', (req, res) => {
    const roomList = Object.keys(activeRooms).map(roomId => ({
        roomId,
        roomName: activeRooms[roomId].roomName,
        owner: activeRooms[roomId].owner,
        hasPassword: !!activeRooms[roomId].password,
        memberCount: activeRooms[roomId].members ? activeRooms[roomId].members.length : 0
    }));
    res.json(roomList);
});

// Socket.io จัดการ Real-time
io.on('connection', (socket) => {
    console.log(`📡 เชื่อมต่อ: ${socket.id}`);

    // สร้างห้องใหม่
    socket.on('create_room', ({ roomName, password, owner }) => {
        const roomId = `RM-${Math.floor(1000 + Math.random() * 9000)}`;
        activeRooms[roomId] = {
            roomName: roomName || 'ห้องฟังเพลงชิลๆ',
            password: password || '',
            owner: owner,
            playlist: [],
            status: 2,
            videoTime: 0,
            lastUpdatedAt: Date.now(),
            members: []
        };
        io.emit('room_list_updated');
        socket.emit('room_created_success', roomId);
    });

    // ลบห้อง (เฉพาะเจ้าของห้อง)
    socket.on('delete_room', ({ roomId, username }) => {
        if (activeRooms[roomId] && activeRooms[roomId].owner === username) {
            delete activeRooms[roomId];
            io.to(roomId).emit('room_deleted');
            io.emit('room_list_updated');
            console.log(`🗑️ ห้อง ${roomId} ถูกลบโดยเจ้าของห้อง (${username})`);
        }
    });

    // เข้าร่วมห้อง
    socket.on('join_room', ({ roomId, user }) => {
        if (!activeRooms[roomId]) {
            socket.emit('error_message', 'ไม่พบห้องนี้ในระบบ!');
            return;
        }

        socket.join(roomId);
        
        // บันทึกสมาชิกในห้อง
        if (!activeRooms[roomId].members) activeRooms[roomId].members = [];
        // ลบอันเก่าถ้ามี แล้วเพิ่มใหม่
        activeRooms[roomId].members = activeRooms[roomId].members.filter(m => m.username !== user.username);
        activeRooms[roomId].members.push({ socketId: socket.id, ...user });

        // Broadcast จำนวนคนและรายชื่อในห้อง
        io.to(roomId).emit('update_members', activeRooms[roomId].members);
        io.emit('room_list_updated');

        // คำนวณเวลาเพลงซิงก์
        let currentServerTime = activeRooms[roomId].videoTime;
        if (activeRooms[roomId].status === 1) {
            const elapsedSeconds = (Date.now() - activeRooms[roomId].lastUpdatedAt) / 1000;
            currentServerTime += elapsedSeconds;
        }

        socket.emit('room_data', {
            roomName: activeRooms[roomId].roomName,
            playlist: activeRooms[roomId].playlist,
            status: activeRooms[roomId].status,
            videoTime: currentServerTime,
            owner: activeRooms[roomId].owner
        });
    });

    socket.on('add_to_queue', ({ roomId, videoId }) => {
        if (activeRooms[roomId]) {
            const isFirst = activeRooms[roomId].playlist.length === 0;
            activeRooms[roomId].playlist.push(videoId);
            if (isFirst) {
                activeRooms[roomId].videoTime = 0;
                activeRooms[roomId].status = 1;
                activeRooms[roomId].lastUpdatedAt = Date.now();
            }
            io.to(roomId).emit('queue_updated', activeRooms[roomId].playlist);
            if (isFirst) io.to(roomId).emit('sync_state', { status: 1, videoTime: 0 });
        }
    });

    socket.on('update_state', ({ roomId, status, videoTime }) => {
        if (activeRooms[roomId]) {
            activeRooms[roomId].status = status;
            activeRooms[roomId].videoTime = videoTime;
            activeRooms[roomId].lastUpdatedAt = Date.now();
            socket.to(roomId).emit('sync_state', { status, videoTime });
        }
    });

    socket.on('next_song', ({ roomId }) => {
        if (activeRooms[roomId] && activeRooms[roomId].playlist.length > 0) {
            activeRooms[roomId].playlist.shift();
            activeRooms[roomId].videoTime = 0;
            activeRooms[roomId].status = 1;
            activeRooms[roomId].lastUpdatedAt = Date.now();
            io.to(roomId).emit('change_song', activeRooms[roomId].playlist);
            if (activeRooms[roomId].playlist.length > 0) {
                io.to(roomId).emit('sync_state', { status: 1, videoTime: 0 });
            }
        }
    });

    socket.on('send_message', ({ roomId, user, message }) => {
        if (activeRooms[roomId]) {
            const chatData = {
                user, // { firstName, lastName, status }
                message,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            io.to(roomId).emit('receive_message', chatData);
        }
    });

    // เพิ่มตัวรับ event สำหรับ Wheel / Opinion / Vote ให้รองรับการซิงก์ข้ามเครื่อง
    socket.on('update_wheel', (items) => {
        socket.broadcast.emit('sync_wheel', items);
    });

    socket.on('spin_wheel', (data) => {
        io.emit('wheel_spinning_start', data);
    });

    socket.on('post_opinion', (opinions) => {
        socket.broadcast.emit('sync_opinions', opinions);
    });

    socket.on('update_votes', (votes) => {
        socket.broadcast.emit('sync_votes', votes);
    });

    socket.on('disconnect', () => {
        // ค้นหาและลบออกจากห้องที่อยู่
        for (const roomId in activeRooms) {
            if (activeRooms[roomId].members) {
                activeRooms[roomId].members = activeRooms[roomId].members.filter(m => m.socketId !== socket.id);
                io.to(roomId).emit('update_members', activeRooms[roomId].members);
                io.emit('room_list_updated');
            }
        }
        console.log(`❌ ตัดการเชื่อมต่อ: ${socket.id}`);
    });
});

server.listen(5000, () => {
    console.log(`🎯 AMETHYX Backend พร้อมทำงานที่พอร์ต 5000`);
});