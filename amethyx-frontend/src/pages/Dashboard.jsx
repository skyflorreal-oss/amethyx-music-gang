// src/pages/Dashboard.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // จำลองข้อมูลห้องปาร์ตี้ (เดี๋ยวเฟสถัดไปจะดึงมาจากระบบหลังบ้านจริง)
  const [rooms] = useState([
    { id: 'RM-7732', name: 'SOYA TOWN VIBES 🎧', host: 'แซม', viewers: 12 },
    { id: 'RM-9941', name: 'ห้องนั่งชิลคนนอนดึก 💜', host: 'อเล็กซ์', viewers: 5 },
  ]);

  // ฟังก์ชันสุ่ม ID ห้องเวลาสร้างห้องใหม่
  const handleCreateRoom = () => {
    const randomId = `RM-${Math.floor(1000 + Math.random() * 9000)}`;
    navigate(`/room/${randomId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#120c1f] via-[#1a103c] to-[#0a0512] text-white font-sans antialiased">
      
      {/* Dynamic Navbar */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-400 flex items-center justify-center font-bold text-black shadow-lg shadow-purple-500/30">
            A
          </div>
          <span className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-purple-200 to-white">
            AMETHYX <span className="text-purple-400 font-medium text-base tracking-normal">MUSIC GANG</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="text-sm font-medium text-purple-300 hover:text-purple-200 transition">เข้าสู่ระบบ</button>
          <button className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-purple-100 transition shadow-lg">
            สมัครสมาชิก
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-20">
        
        {/* Hero Banner */}
        <div className="text-center mb-20 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl -z-10"></div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            ฟังเพลงพร้อมเพื่อนแบบ <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-300">Real-time</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base mb-8">
            สร้างห้อง ปล่อยคิวเพลงจาก YouTube ไม่มีโฆษณาคั่น ซิงก์เสียงตรงกันทุกวินาที ปาร์ตี้ดนตรีกับแก๊งของคุณได้ฟรี
          </p>
          <button 
            onClick={handleCreateRoom}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-purple-600/20 transition-all transform hover:-translate-y-0.5"
          >
            🚀 สร้างห้องฟังเพลงใหม่
          </button>
        </div>

        {/* Live Party Grid */}
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-purple-200 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ปาร์ตี้ที่กำลังออนแอร์อยู่ตอนนี้
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div key={room.id} className="group bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-purple-500/30 hover:bg-white/[0.04] transition-all duration-300 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-1 rounded-md">
                      {room.id}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1 bg-black/30 px-2 py-1 rounded-md">
                      👤 {room.viewers} คน
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition mb-1">
                    {room.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-6">ดีเจผู้สร้าง: {room.host}</p>
                </div>
                
                <button 
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="w-full bg-white/5 hover:bg-purple-600 text-purple-200 hover:text-white border border-white/10 hover:border-transparent py-3 rounded-xl text-sm font-semibold transition-all duration-300"
                >
                  เข้าร่วมห้องนี้
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}