// amethyx-backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// เพิ่ม Route สำหรับหน้าแรก (แก้ปัญหา Cannot GET /)
app.get('/', (req, res) => {
    res.send('AMETHYX Backend is running successfully! 🚀');
});

const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,https://amethyx-music-gang.onrender.com,https://www.amethyx-music-gang.onrender.com,https://amethyx-music-gang-b5i9.vercel.app")
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// ฐานข้อมูลจำลองในหน่วยความจำ
const users = []; // เก็บข้อมูลสมาชิก [{username, password, firstName, lastName, status}]
const activeRooms = {}; // เก็บข้อมูลห้อง { roomId: { roomName, password, owner, playlist, status, videoTime, lastUpdatedAt, members: [] } }

// State สำหรับระบบวงล้อ / บอร์ดความคิดเห็น / โหวต (เก็บบนเซิร์ฟเวอร์เพื่อให้ผู้ที่เพิ่งเชื่อมต่อได้รับข้อมูลล่าสุด)
let serverWheelItems = ['กินชาบู', 'ดูหนังผี', 'ร้องคาราโอเกะ', 'พักผ่อนนอนหลับ', 'เล่นเกมยาวไป'];
let serverOpinions = [];
let serverVotes = [
    {
        id: 1,
        topic: 'คืนนี้จัดแนวเพลงอะไรกันดี?',
        creator: 'แซม',
        options: [
            { text: 'LO-FI / Chillhop', votes: 4, voters: ['user1', 'user2'] },
            { text: 'Hip Hop / Rap', votes: 2, voters: ['user3'] }
        ]
    }
];

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

// API: ค้นหาเพลง YouTube ด้วยคำค้นหา
const ytSearch = require('yt-search');
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ message: 'กรุณาระบุคำค้นหา' });
    }

    try {
        const result = await ytSearch(query);
        const videos = (result && result.videos) ? result.videos.slice(0, 10).map(video => ({
            videoId: video.videoId,
            title: video.title,
            channel: video.author.name || video.author || 'Unknown',
            duration: video.timestamp || video.duration.toString(),
            thumbnail: video.thumbnail
        })) : [];
        res.json(videos);
    } catch (error) {
        console.error('YT search error', error);
        res.status(500).json({ message: 'ค้นหาเพลงไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }
});

// Socket.io จัดการ Real-time
io.on('connection', (socket) => {
    console.log(`📡 เชื่อมต่อ: ${socket.id}`);

    // ฟังก์ชันส่งข้อมูลทั้งหมดให้ Client ทันทีที่ขอมาหรือเชื่อมต่อใหม่
    const sendSyncData = () => {
        socket.emit('sync_wheel', serverWheelItems);
        socket.emit('sync_opinions', serverOpinions);
        socket.emit('sync_votes', serverVotes);
    };

    // ส่งข้อมูลรอบแรกตอนต่อติด
    sendSyncData();

    // รองรับการขอซิงก์ข้อมูลซ้ำจากฝั่ง Client
    socket.on('request_initial_sync', () => {
        sendSyncData();
    });

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
            activeRooms[roomId].videoTime = currentServerTime;
            activeRooms[roomId].lastUpdatedAt = Date.now();
        }

        socket.emit('room_data', {
            roomName: activeRooms[roomId].roomName,
            playlist: activeRooms[roomId].playlist,
            status: activeRooms[roomId].status,
            videoTime: currentServerTime,
            owner: activeRooms[roomId].owner
        });
    });

    socket.on('add_to_queue', ({ roomId, video }) => {
        if (activeRooms[roomId]) {
            const isFirst = activeRooms[roomId].playlist.length === 0;
            const queueItem = {
                videoId: video.videoId,
                title: video.title,
                channel: video.channel,
                duration: video.duration,
                thumbnail: video.thumbnail
            };
            activeRooms[roomId].playlist.push(queueItem);
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
                setTimeout(() => {
                    if (!activeRooms[roomId] || activeRooms[roomId].playlist.length === 0) return;
                    activeRooms[roomId].status = 1;
                    activeRooms[roomId].videoTime = 0;
                    activeRooms[roomId].lastUpdatedAt = Date.now();
                    io.to(roomId).emit('sync_state', { status: 1, videoTime: 0 });
                }, 150);
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

    // ผู้เล่นออกจากห้องโดยไม่ปิดการเชื่อมต่อ (เช่น กดออกห้อง)
    socket.on('leave_room', ({ roomId, username }) => {
        if (activeRooms[roomId] && activeRooms[roomId].members) {
            activeRooms[roomId].members = activeRooms[roomId].members.filter(m => m.socketId !== socket.id && m.username !== username);
            io.to(roomId).emit('update_members', activeRooms[roomId].members);
            io.emit('room_list_updated');
        }
        try { socket.leave(roomId); } catch (e) {}
    });

    // เพิ่มตัวรับ event สำหรับ Wheel / Opinion / Vote และเก็บสถานะบนเซิร์ฟเวอร์
    socket.on('update_wheel', (items) => {
        serverWheelItems = items;
        io.emit('sync_wheel', serverWheelItems);
    });

    socket.on('spin_wheel', ({ winner }) => {
        io.emit('wheel_spinning_start', { winner });
    });

    socket.on('post_opinion', (opinions) => {
        serverOpinions = opinions;
        io.emit('sync_opinions', serverOpinions);
    });

    socket.on('update_votes', (votes) => {
        serverVotes = votes;
        io.emit('sync_votes', serverVotes);
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🎯 AMETHYX Backend พร้อมทำงานที่พอร์ต ${PORT}`);
});