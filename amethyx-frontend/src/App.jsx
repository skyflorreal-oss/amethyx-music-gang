// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import MusicRoom from './pages/MusicRoom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://amethyx-music-gang.onrender.com';

const ANONYMOUS_NAMES = [
  '🥷 นินจาไร้เงา', '🐱 แมวอ้วนสะท้านฟ้า', '👻 ผีน้อยจอมกวน', 
  '🦊 จิ้งจอกเจ้าเล่ห์', '🐼 แพดดี้ผู้หิวโหย', '🤖 บอทลับเฉพาะกิจ',
  '🦄 ยูนิคอร์นสายฟ้า', '🦇 แบทแมนฝึกหัด', '👽 เอเลี่ยนเพื่อนรัก',
  '🦆 เป็ดน้อยนักซิ่ง', '🦈 ฉลามฟันหลอ', '🐢 เต่าซิ่งสายฟ้า',
  '🐻 หมีแพนด้าติดเกม', '🐰 กระต่ายตื่นตูม', '🐧 เพนกวินขี้หนาว',
  '🦝 แรคคูนจอมขโมย', '🦖 ไดโนเสาร์แบ๊ว', '🐬 โลมาสายฮา',
  '🐙 หมึกยักษ์พ่นหมึก', '🦁 สิงโตง่วงนอน', '🐯 เสือดาวติดเน็ต',
  '🦉 ฮูกน้อยตาแป๋ว', '🐨 โคอาล่าสายมึน', '🦥 สลอทสปีดเต่า',
  '🦩 ฟลามิงโก้ขาเดียว', '🐝 ผึ้งน้อยจอมขยัน', '🦋 ผีเสื้อราตรี'
];

function Home() {
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ฟอร์ม Auth
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [status, setStatus] = useState('โสด');
  const [authError, setAuthError] = useState('');

  // ฟอร์มสร้างห้อง
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');

  // --- 3 ระบบใหม่ ---
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'wheel' | 'opinion' | 'vote'
  const [showIdentity, setShowIdentity] = useState(true);
  const [myAnonName, setMyAnonName] = useState('');

  // State ระบบวงล้อสุ่ม (Real-time synced)
  const [wheelItems, setWheelItems] = useState(['กินชาบู', 'ดูหนังผี', 'ร้องคาราโอเกะ', 'พักผ่อนนอนหลับ', 'เล่นเกมยาวไป']);
  const [wheelInput, setWheelInput] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState(null);

  // State ระบบบอร์ดความคิดเห็น (ล้างอัตโนมัติทุก 24 ชม.)
  const [opinions, setOpinions] = useState([]);
  const [opinionInput, setOpinionInput] = useState('');

  // State ระบบโหวต (Real-time synced)
  const [votes, setVotes] = useState([
    {
      id: 1,
      topic: 'คืนนี้จัดแนวเพลงอะไรกันดี?',
      creator: 'แซม',
      options: [
        { text: 'LO-FI / Chillhop', votes: 4, voters: ['user1', 'user2'] },
        { text: 'Hip Hop / Rap', votes: 2, voters: ['user3'] }
      ]
    }
  ]);
  const [newVoteTopic, setNewVoteTopic] = useState('');
  const [newVoteOptions, setNewVoteOptions] = useState(['', '']);

  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('amethyx_user');
    if (savedUser) {
      try {
        if (savedUser.startsWith('{') || savedUser.startsWith('[')) {
          setUser(JSON.parse(savedUser));
        } else {
          setUser({ username: savedUser, firstName: savedUser });
        }
      } catch (e) {
        setUser({ username: savedUser, firstName: savedUser });
      }
    }
    fetchRooms();

    const randomAnon = ANONYMOUS_NAMES[Math.floor(Math.random() * ANONYMOUS_NAMES.length)];
    setMyAnonName(randomAnon);
  }, []);

  // --- SOCKET.IO REAL-TIME LISTENERS ---
  useEffect(() => {
    const socket = window.socket;
    if (!socket) return;

    // เมื่อเชื่อมต่อสำเร็จ ให้ขอข้อมูลล่าสุดจากเซิร์ฟเวอร์ทันที ป้องกันข้อมูลไม่ตรงกัน
    socket.emit('request_initial_sync');

    socket.on('sync_wheel', (items) => {
      setWheelItems(items);
    });

    socket.on('wheel_spinning_start', ({ winner }) => {
      setSpinning(true);
      setWheelResult(null);
      setTimeout(() => {
        setWheelResult(winner);
        setSpinning(false);
      }, 1500);
    });

    socket.on('sync_opinions', (serverOpinions) => {
      setOpinions(serverOpinions);
    });

    socket.on('sync_votes', (serverVotes) => {
      setVotes(serverVotes);
    });

    return () => {
      socket.off('sync_wheel');
      socket.off('wheel_spinning_start');
      socket.off('sync_opinions');
      socket.off('sync_votes');
    };
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/rooms`);
      setRooms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/login`, { username, password });
      if (res.data.success) {
        setUser(res.data.user);
        localStorage.setItem('amethyx_user', JSON.stringify(res.data.user));
        setShowAuthModal(false);
        setAuthError('');
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/register`, { username, password, firstName, lastName, status });
      if (res.data.success) {
        alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        setIsLoginTab(true);
        setAuthError('');
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('amethyx_user');
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    window.socket?.emit('create_room', { roomName, password: roomPassword, owner: user.username });
    setShowCreateModal(false);
    setRoomName('');
    setRoomPassword('');
  };

  // --- ฟังก์ชันของ 3 ระบบใหม่ (ส่งข้อมูลผ่าน Socket.io) ---
  const addWheelItem = () => {
    if (!user) { setShowAuthModal(true); return; }
    if (!wheelInput.trim()) return;
    const updated = [...wheelItems, wheelInput.trim()];
    setWheelItems(updated);
    window.socket?.emit('update_wheel', updated);
    setWheelInput('');
  };

  const removeWheelItem = (idx) => {
    if (!user) { setShowAuthModal(true); return; }
    const updated = wheelItems.filter((_, i) => i !== idx);
    setWheelItems(updated);
    window.socket?.emit('update_wheel', updated);
  };

  const spinWheel = () => {
    if (!user) { setShowAuthModal(true); return; }
    if (wheelItems.length === 0) return alert('กรุณาเพิ่มรายการในวงล้ออย่างน้อย 1 รายการ');
    
    // สุ่มผลลัพธ์แล้วส่งให้ทุกคนเห็นพร้อมกัน
    const winner = wheelItems[Math.floor(Math.random() * wheelItems.length)];
    window.socket?.emit('spin_wheel', { winner });
  };

  const handlePostOpinion = (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!opinionInput.trim()) return;

    const authorName = showIdentity && user 
      ? (user.firstName || user.username || 'สมาชิก') 
      : myAnonName;

    const newOp = {
      id: Date.now(),
      author: authorName,
      message: opinionInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedOpinions = [newOp, ...opinions];
    setOpinions(updatedOpinions);
    window.socket?.emit('post_opinion', updatedOpinions);
    setOpinionInput('');
  };

  const handleCreateVote = (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!newVoteTopic.trim()) return alert('กรุณาใส่หัวข้อโหวต');
    const validOpts = newVoteOptions.filter(o => o.trim() !== '');
    if (validOpts.length < 2) return alert('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ');

    const creatorName = showIdentity && user ? (user.firstName || user.username) : myAnonName;
    const newVote = {
      id: Date.now(),
      topic: newVoteTopic,
      options: validOpts.map(opt => ({ text: opt, votes: 0, voters: [] })),
      creator: creatorName
    };

    const updatedVotes = [newVote, ...votes];
    setVotes(updatedVotes);
    window.socket?.emit('update_votes', updatedVotes);
    setNewVoteTopic('');
    setNewVoteOptions(['', '']);
  };

  const handleCastVote = (voteId, optionIndex) => {
    if (!user) { setShowAuthModal(true); return; }
    const voterId = showIdentity && user ? (user.username || user.firstName) : myAnonName;
    
    const updatedVotes = votes.map(v => {
      if (v.id === voteId) {
        const alreadyVoted = v.options.some(o => o.voters.includes(voterId));
        if (alreadyVoted) {
          alert('คุณได้โหวตในหัวข้อนี้ไปแล้ว!');
          return v;
        }
        const newOpts = v.options.map((opt, idx) => {
          if (idx === optionIndex) {
            return { ...opt, votes: opt.votes + 1, voters: [...opt.voters, voterId] };
          }
          return opt;
        });
        return { ...v, options: newOpts };
      }
      return v;
    });

    setVotes(updatedVotes);
    window.socket?.emit('update_votes', updatedVotes);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1c] via-[#0b0612] to-black text-white font-sans antialiased p-6">
      
      {/* Top Bar */}
      <header className="max-w-6xl mx-auto flex justify-between items-center bg-white/[0.02] border border-white/5 backdrop-blur-md p-4 rounded-2xl mb-12 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-purple-300">
            A
          </div>
          <span className="font-extrabold tracking-wider text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AMETHYX MUSIC GANG
          </span>
        </div>

        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-purple-200">{user.firstName || user.username}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${user.status === 'โสด' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : 'bg-purple-500/10 text-purple-400 border-purple-500/30'}`}>
                  ● {user.status || 'ออนไลน์'}
                </span>
              </div>
              <button onClick={handleLogout} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-2 rounded-xl transition">
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-purple-600/20">
              เข้าสู่ระบบ / สมัครสมาชิก
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center space-y-6 mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          ฟังเพลงพร้อมเพื่อนแบบ <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Real-time</span>
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
          สร้างห้อง ปล่อยคิวเพลงจาก YouTube ไม่มีโฆษณาคั่น ซิงก์เสียงตรงกันทุกวินาที ปาร์ตี้ดนตรีกับแก๊งของคุณได้ฟรี
        </p>
      </div>

      {/* Category Navigation Tabs */}
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <button 
          onClick={() => setActiveTab('rooms')} 
          className={`p-4 rounded-2xl border text-center transition flex flex-col items-center gap-2 ${activeTab === 'rooms' ? 'bg-purple-600/30 border-purple-500 text-white shadow-lg' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
        >
          <span className="text-2xl">🎵</span>
          <span className="text-sm font-bold">ห้องฟังเพลงปาร์ตี้</span>
        </button>
        <button 
          onClick={() => {
            if (!user) { setShowAuthModal(true); return; }
            setActiveTab('wheel');
          }} 
          className={`p-4 rounded-2xl border text-center transition flex flex-col items-center gap-2 ${activeTab === 'wheel' ? 'bg-purple-600/30 border-purple-500 text-white shadow-lg' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
        >
          <span className="text-2xl">🎡</span>
          <span className="text-sm font-bold">1. หมุนวงล้อสุ่ม {!user && '🔒'}</span>
        </button>
        <button 
          onClick={() => {
            if (!user) { setShowAuthModal(true); return; }
            setActiveTab('opinion');
          }} 
          className={`p-4 rounded-2xl border text-center transition flex flex-col items-center gap-2 ${activeTab === 'opinion' ? 'bg-purple-600/30 border-purple-500 text-white shadow-lg' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
        >
          <span className="text-2xl">📝</span>
          <span className="text-sm font-bold">2. บอร์ดความคิดเห็น {!user && '🔒'}</span>
        </button>
        <button 
          onClick={() => {
            if (!user) { setShowAuthModal(true); return; }
            setActiveTab('vote');
          }} 
          className={`p-4 rounded-2xl border text-center transition flex flex-col items-center gap-2 ${activeTab === 'vote' ? 'bg-purple-600/30 border-purple-500 text-white shadow-lg' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
        >
          <span className="text-2xl">🗳️</span>
          <span className="text-sm font-bold">3. ระบบโหวต {!user && '🔒'}</span>
        </button>
      </div>

      {/* --- TAB CONTENTS --- */}
      <div className="max-w-6xl mx-auto">
        
        {/* TAB 1: ROOMS */}
        {activeTab === 'rooms' && (
          <div className="space-y-8">
            <div className="text-center">
              <button 
                onClick={() => {
                  if (!user) setShowAuthModal(true);
                  else setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-8 py-3.5 rounded-2xl font-bold text-sm transition shadow-xl shadow-purple-600/30"
              >
                🚀 สร้างห้องฟังเพลงใหม่
              </button>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-6 text-purple-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ปาร์ตี้ที่กำลังออนแอร์อยู่ตอนนี้
              </h2>

              {rooms.length === 0 ? (
                <div className="text-center py-16 bg-white/[0.01] border border-white/5 rounded-3xl text-gray-500 text-sm">
                  ยังไม่มีห้องเปิดใช้งานในขณะนี้ ลองกดสร้างห้องแรกกันเลย!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rooms.map((room) => (
                    <div key={room.roomId} className="bg-white/[0.02] border border-white/5 backdrop-blur-xl p-6 rounded-3xl shadow-xl flex flex-col justify-between hover:border-purple-500/30 transition group">
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs bg-purple-500/10 text-purple-300 font-mono px-3 py-1 rounded-lg border border-purple-500/20">
                            {room.roomId}
                          </span>
                          <span className="text-xs bg-white/5 text-gray-300 px-3 py-1 rounded-lg flex items-center gap-1.5 font-mono">
                            👤 {room.memberCount} คน
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1 truncate">{room.roomName}</h3>
                        <p className="text-xs text-gray-400 mb-6">เจ้าของห้อง: <span className="text-purple-300">{room.owner}</span> {room.hasPassword && '🔒'}</p>
                      </div>
                      <button 
                        onClick={() => {
                          if (!user) setShowAuthModal(true);
                          else navigate(`/room/${room.roomId}`);
                        }}
                        className="w-full bg-white/[0.05] hover:bg-purple-600 border border-white/10 hover:border-transparent py-3 rounded-xl text-xs font-semibold transition text-center"
                      >
                        เข้าร่วมห้องนี้
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SPIN WHEEL (Real-time synced) */}
        {activeTab === 'wheel' && user && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl text-center space-y-4 shadow-xl">
              <h2 className="text-xl font-bold text-purple-200">🎡 วงล้อมหาสสนุก (Real-time)</h2>
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-8 min-h-[120px] flex flex-col items-center justify-center">
                {spinning ? (
                  <p className="text-purple-400 text-base animate-pulse font-bold">🌀 กำลังหมุนวงล้อพร้อมกัน...</p>
                ) : wheelResult ? (
                  <div className="space-y-1 animate-bounce">
                    <p className="text-xs text-gray-400">🎉 ผลลัพธ์จากการสุ่มคือ:</p>
                    <p className="text-2xl font-bold text-pink-300">{wheelResult}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">กดปุ่มด้านล่างเพื่อหมุนวงล้อให้ทุกคนเห็นพร้อมกัน!</p>
                )}
              </div>
              <button 
                onClick={spinWheel} 
                disabled={spinning}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-sm font-bold py-3 rounded-xl shadow-lg transition"
              >
                {spinning ? 'กำลังหมุน...' : '🎯 สุ่มวงล้อ (ทุกคนเห็นพร้อมกัน)!'}
              </button>
            </div>

            <div className="bg-white/[0.03] border border-white/5 p-5 rounded-2xl space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-purple-200">⚙️ จัดการรายการในวงล้อ ({wheelItems.length})</h3>
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="พิมพ์เพิ่มหัวข้อลงวงล้อ..." value={wheelInput} onChange={(e) => setWheelInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                />
                <button onClick={addWheelItem} className="bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl text-xs font-semibold">เพิ่ม</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {wheelItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 text-xs">
                    <span className="text-gray-200">{item}</span>
                    <button onClick={() => removeWheelItem(idx)} className="text-red-400 hover:text-red-300 text-xs">ลบ</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OPINION BOARD (Real-time & Auto-reset 24 hours) */}
        {activeTab === 'opinion' && user && (
          <div className="max-w-2xl mx-auto space-y-6 flex flex-col h-[520px]">
            <div className="flex justify-between items-center bg-white/[0.03] border border-white/10 p-4 rounded-2xl backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-lg">
                  {showIdentity ? '👁️' : '🥷'}
                </div>
                <div>
                  <p className="text-xs text-gray-400">สถานะตัวตน (รีเซ็ตแชททุก 24 ชม.):</p>
                  <p className="text-sm font-bold text-purple-200">
                    {showIdentity ? `${user.firstName || user.username} (ตัวตนจริง)` : `${myAnonName} (นามแฝงลับ)`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowIdentity(!showIdentity)}
                className={`text-xs px-4 py-2 rounded-xl font-semibold transition border ${showIdentity ? 'bg-purple-600/30 border-purple-500/40 text-purple-200' : 'bg-pink-600/30 border-pink-500/40 text-pink-200'}`}
              >
                {showIdentity ? '🥷 ซ่อนตัวตน' : '👁️ แสดงตัวตน'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {opinions.length === 0 ? (
                <p className="text-center text-gray-500 text-xs py-12">ยังไม่มีความคิดเห็น หรือข้อความถูกรีเซ็ตใหม่ในรอบ 24 ชั่วโมง</p>
              ) : (
                opinions.map((op) => (
                  <div key={op.id} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl text-xs space-y-1.5 shadow-lg">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-pink-300">{op.author}</span>
                      <span className="text-gray-500">{op.time}</span>
                    </div>
                    <p className="text-gray-200 break-words leading-relaxed text-sm">{op.message}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handlePostOpinion} className="flex gap-2">
              <input 
                type="text" 
                placeholder={showIdentity ? "พิมพ์แสดงความคิดเห็นของคุณ..." : `พิมพ์ในนาม ${myAnonName}...`} 
                value={opinionInput}
                onChange={(e) => setOpinionInput(e.target.value)}
                className="flex-1 bg-black/40 border border-purple-500/20 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-purple-400 transition text-white"
              />
              <button type="submit" className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl text-xs font-semibold transition">โพสต์</button>
            </form>
          </div>
        )}

        {/* TAB 4: VOTING SYSTEM (Real-time synced) */}
        {activeTab === 'vote' && user && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white/[0.03] border border-white/5 p-5 rounded-2xl space-y-3 shadow-xl">
              <h3 className="text-sm font-bold text-purple-200">➕ สร้างหัวข้อโหวตใหม่ ( Real-time )</h3>
              <form onSubmit={handleCreateVote} className="space-y-3">
                <input 
                  type="text" placeholder="หัวข้อโหวต (เช่น เย็นนี้กินอะไรดี?)" value={newVoteTopic} onChange={(e) => setNewVoteTopic(e.target.value)}
                  className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                />
                {newVoteOptions.map((opt, i) => (
                  <input 
                    key={i} type="text" placeholder={`ตัวเลือกที่ ${i+1}`} value={opt} 
                    onChange={(e) => {
                      const updated = [...newVoteOptions];
                      updated[i] = e.target.value;
                      setNewVoteOptions(updated);
                    }}
                    className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                  />
                ))}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewVoteOptions([...newVoteOptions, ''])} className="bg-white/5 hover:bg-white/10 text-xs px-4 py-2 rounded-xl">เพิ่มตัวเลือก</button>
                  <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-500 text-xs font-semibold py-2 rounded-xl">เปิดโหวต</button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-purple-200">📊 รายการโหวตทั้งหมด ({votes.length})</h3>
              {votes.length === 0 ? (
                <p className="text-center text-gray-500 text-xs py-8">ยังไม่มีการสร้างโหวตในขณะนี้</p>
              ) : (
                votes.map((v) => {
                  const totalVotes = v.options.reduce((sum, o) => sum + o.votes, 0);
                  return (
                    <div key={v.id} className="bg-white/[0.03] border border-white/5 p-5 rounded-2xl space-y-3 shadow-xl">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-white">{v.topic}</p>
                        <span className="text-[10px] text-gray-400">สร้างโดย: {v.creator}</span>
                      </div>
                      <div className="space-y-2">
                        {v.options.map((opt, oIdx) => {
                          const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                          const voterId = showIdentity && user ? (user.username || user.firstName) : myAnonName;
                          const hasVotedThis = opt.voters.includes(voterId);
                          return (
                            <button 
                              key={oIdx}
                              onClick={() => handleCastVote(v.id, oIdx)}
                              className={`w-full text-left relative overflow-hidden bg-black/40 border p-3 rounded-xl text-xs transition ${hasVotedThis ? 'border-purple-500 bg-purple-950/20' : 'border-white/5 hover:border-purple-500/40'}`}
                            >
                              <div className="absolute left-0 top-0 bottom-0 bg-purple-600/20 transition-all duration-300" style={{ width: `${percent}%` }}></div>
                              <div className="relative flex justify-between items-center z-10">
                                <span className="text-gray-200 font-medium">{opt.text} {hasVotedThis && '✓ (คุณโหวตแล้ว)'}</span>
                                <span className="text-xs text-purple-300 font-mono">{opt.votes} เสียง ({percent}%)</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#120c1f] border border-white/10 w-full max-w-md p-8 rounded-3xl shadow-2xl relative">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white">✕</button>
            
            <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
              <button onClick={() => { setIsLoginTab(true); setAuthError(''); }} className={`text-sm font-bold pb-2 transition ${isLoginTab ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>เข้าสู่ระบบ</button>
              <button onClick={() => { setIsLoginTab(false); setAuthError(''); }} className={`text-sm font-bold pb-2 transition {!isLoginTab ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>สมัครสมาชิก</button>
            </div>

            {authError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-4">{authError}</div>}

            {isLoginTab ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ชื่อผู้ใช้ (Username)</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">รหัสผ่าน (Password)</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 text-white" />
                </div>
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl text-sm font-semibold transition mt-2">เข้าสู่ระบบ</button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">ชื่อจริง</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">นามสกุล</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">สถานะหัวใจ</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 text-white">
                    <option value="โสด">🟢 โสด</option>
                    <option value="มีแฟนแล้ว">❤️ มีแฟนแล้ว</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ชื่อผู้ใช้ (Username)</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.year = e.target.value)} onChange={e => setUsername(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">รหัสผ่าน (Password)</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 text-white" />
                </div>
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl text-xs font-semibold transition mt-2">สมัครสมาชิก</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#120c1f] border border-white/10 w-full max-w-md p-8 rounded-3xl shadow-2xl relative">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white">✕</button>
            <h3 className="text-lg font-bold mb-4 text-purple-200">🎵 สร้างห้องปาร์ตี้เพลงใหม่</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">ชื่อห้องปาร์ตี้</label>
                <input type="text" placeholder="เช่น นั่งชิลคนนอนดึก 💜" value={roomName} onChange={e => setRoomName(e.target.value)} required className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">รหัสผ่านห้อง (เว้นว่างไว้ถ้าไม่ต้องใช้)</label>
                <input type="password" placeholder="ตั้งรหัสผ่านห้อง (ถ้ามี)" value={roomPassword} onChange={e => setRoomPassword(e.target.value)} className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 text-white" />
              </div>
              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl text-sm font-semibold transition">สร้างและเข้าห้อง</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  useEffect(() => {
    const socket = io(API_URL, {
      withCredentials: true
    });
    window.socket = socket;
    return () => socket.disconnect();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<MusicRoom />} />
      </Routes>
    </Router>
  );
}