// src/pages/MusicRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://amethyx-music-gang.onrender.com';

// รายชื่อ Public Piped API สำรองสำหรับค้นหาและสตรีมเสียงแบบคู่ขนาน (Parallel Race)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.yt.privacyredirect.com',
  'https://api.piped.privacy.com.de'
];

export default function MusicRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [roomOwner, setRoomOwner] = useState('');
  const [members, setMembers] = useState([]);
  
  const [queue, setQueue] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const pendingSync = useRef(null);
  const currentSongIdRef = useRef(null);
  const isSyncingRef = useRef(false);
  const chatScrollRef = useRef(null);

  const [currentAudioUrl, setCurrentAudioUrl] = useState('');
  const [songTitle, setSongTitle] = useState('กำลังโหลดเพลง...');
  const [playerError, setPlayerError] = useState(false);

  // ฟังก์ชันดึงสตรีมเสียงด้วยความเร็วสูง (Parallel Race ทุก Instances)[cite: 5]
  const fetchAudioStream = async (videoId) => {
    if (!videoId) return;
    setPlayerError(false);
    setSongTitle('กำลังประมวลผลสตรีมเสียง...');
    
    const fetchPromises = PIPED_INSTANCES.map(async (instance) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const response = await fetch(`${instance}/streams/${videoId}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        if (data && data.audioStreams && data.audioStreams.length > 0) {
          const bestAudio = data.audioStreams.reduce((prev, curr) => (prev.bitrate > curr.bitrate) ? prev : curr);
          return { url: bestAudio.url, title: data.title || `วิดีโอ ID: ${videoId}` };
        }
        throw new Error('No audio streams');
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });

    try {
      const result = await Promise.any(fetchPromises);
      setCurrentAudioUrl(result.url);
      setSongTitle(result.title);
    } catch (error) {
      console.error('ทุกเซิร์ฟเวอร์ Piped ไม่ตอบสนอง');
      setPlayerError(true);
      setSongTitle('ไม่สามารถเชื่อมต่อสตรีมเสียงได้');
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('amethyx_user');
    if (!savedUser) {
      alert('กรุณาเข้าสู่ระบบก่อนเข้าใช้งานห้อง!');
      navigate('/');
      return;
    }
    const userObj = JSON.parse(savedUser);
    setCurrentUser(userObj);

    if (window.socket) {
      socketRef.current = window.socket;
    } else {
      socketRef.current = io(SOCKET_URL, { withCredentials: true });
      window.socket = socketRef.current;
    }
    
    socketRef.current.emit('join_room', { roomId, user: userObj });
    socketRef.current.emit('request_initial_sync');

    socketRef.current.on('room_data', (data) => {
      if (data) {
        setRoomName(data.roomName);
        setRoomOwner(data.owner);
        setQueue(data.playlist || []);

        if (data.playlist && data.playlist.length > 0) {
          currentSongIdRef.current = data.playlist[0];
          fetchAudioStream(data.playlist[0]);
        }

        const syncData = { status: data.status, videoTime: data.videoTime };
        pendingSync.current = syncData;
        if (audioRef.current) {
          applySync(syncData);
          pendingSync.current = null;
        }
      }
    });

    socketRef.current.on('update_members', (updatedMembers) => {
      setMembers(updatedMembers);
    });

    socketRef.current.on('queue_updated', (updatedPlaylist) => {
      setQueue(updatedPlaylist);
    });

    socketRef.current.on('change_song', (updatedPlaylist) => {
      setQueue(updatedPlaylist);
      if (updatedPlaylist && updatedPlaylist.length > 0) {
        const newFirst = updatedPlaylist[0];
        if (newFirst !== currentSongIdRef.current) {
          currentSongIdRef.current = newFirst;
          fetchAudioStream(newFirst);
        }
      }
    });
    
    socketRef.current.on('sync_state', (syncData) => {
      if (audioRef.current) {
        applySync(syncData);
      } else {
        pendingSync.current = syncData;
      }
    });

    socketRef.current.on('receive_message', (chatData) => {
      setMessages((prev) => [...prev, chatData]);
    });

    socketRef.current.on('room_deleted', () => {
      alert('เจ้าของห้องได้ทำการลบห้องนี้แล้ว!');
      navigate('/');
    });

    socketRef.current.on('error_message', (msg) => {
      alert(msg);
      navigate('/');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_room', { roomId, username: userObj.username });
        socketRef.current.off('room_data');
        socketRef.current.off('update_members');
        socketRef.current.off('queue_updated');
        socketRef.current.off('change_song');
        socketRef.current.off('sync_state');
        socketRef.current.off('receive_message');
        socketRef.current.off('room_deleted');
        socketRef.current.off('error_message');
      }
    };
  }, [roomId, navigate]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const applySync = ({ status, videoTime }) => {
    if (!audioRef.current) return;
    isSyncingRef.current = true;

    const currentTime = audioRef.current.currentTime;
    if (typeof videoTime === 'number' && Math.abs(currentTime - videoTime) > 1.5) {
      audioRef.current.currentTime = videoTime;
    }

    if (status === 1) {
      audioRef.current.play().catch(() => {});
    } else if (status === 2) {
      audioRef.current.pause();
    }
    
    setTimeout(() => { isSyncingRef.current = false; }, 500);
  };

  const handleAudioPlay = () => {
    if (isSyncingRef.current || !audioRef.current) return;
    const videoTime = audioRef.current.currentTime;
    socketRef.current.emit('update_state', { roomId, status: 1, videoTime });
  };

  const handleAudioPause = () => {
    if (isSyncingRef.current || !audioRef.current || document.hidden) return;
    const videoTime = audioRef.current.currentTime;
    socketRef.current.emit('update_state', { roomId, status: 2, videoTime });
  };

  // ฟังก์ชันค้นหาเพลงจากชื่อที่พิมพ์ หรือรองรับลิงก์ YouTube เดิม[cite: 5]
  const handleSearchAndAdd = async () => {
    const query = inputQuery.trim();
    if (!query || isSearching) return;

    // ตรวจสอบว่าเป็นลิงก์ YouTube หรือไม่ (ถ้าใช่ ให้เพิ่มเข้าคิวตรงได้เลย)
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = query.match(regExp);
    
    if (match && match[1].length === 11) {
      socketRef.current.emit('add_to_queue', { roomId, videoId: match[1] });
      setInputQuery('');
      return;
    }

    setIsSearching(true);
    let foundVideoId = null;

    const searchPromises = PIPED_INSTANCES.map(async (instance) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=videos`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (data && data.items && data.items.length > 0) {
          const firstVideo = data.items.find(item => item.type === 'stream' || item.url?.includes('/watch?v='));
          if (firstVideo) {
            const urlParams = new URLSearchParams(firstVideo.url.split('?')[1]);
            const id = urlParams.get('v') || firstVideo.url.replace('/watch?v=', '');
            if (id && id.length === 11) return id;
          }
        }
        throw new Error('No search results');
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    });

    try {
      foundVideoId = await Promise.any(searchPromises);
    } catch (error) {
      console.error('การค้นหาล้มเหลวทุกเซิร์ฟเวอร์');
    }

    setIsSearching(false);

    if (foundVideoId) {
      socketRef.current.emit('add_to_queue', { roomId, videoId: foundVideoId });
      setInputQuery('');
    } else {
      alert('ไม่พบเพลงที่คุณค้นหา ลองใหม่อีกครั้งครับ!');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;

    socketRef.current.emit('send_message', {
      roomId,
      user: currentUser,
      message: chatInput
    });
    setChatInput('');
  };

  const handleDeleteRoom = () => {
    if (confirm('คุณต้องการลบห้องนี้ใช่หรือไม่?')) {
      socketRef.current.emit('delete_room', { roomId, username: currentUser.username });
    }
  };

  const handleSongEnd = () => socketRef.current.emit('next_song', { roomId });

  if (!currentUser) return null;

  const isOwner = currentUser.username === roomOwner;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1c] via-[#0b0612] to-black text-white p-6 font-sans antialiased">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-6 bg-white/[0.02] border border-white/5 backdrop-blur-md p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-purple-400 hover:text-purple-300 transition">
            ⬅️ ออกจากห้อง
          </button>
          <div className="h-4 w-px bg-white/10"></div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white">{roomName || 'ห้องปาร์ตี้'}</h1>
            <p className="text-xs text-gray-400">รหัสห้อง: <span className="text-purple-400 font-mono">{roomId}</span> | เจ้าของห้อง: {roomOwner}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <button onClick={handleDeleteRoom} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3.5 py-2 rounded-xl transition">
              🗑️ ลบห้องนี้
            </button>
          )}
          <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
            ● ออนไลน์ {members.length} คน
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Audio Player & Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
            <div className="aspect-video rounded-2xl overflow-hidden bg-black/40 mb-4 border border-white/5 flex flex-col items-center justify-center p-6 text-center">
              {queue.length > 0 ? (
                playerError ? (
                  <div className="text-gray-400">
                    <p className="mb-2">ไม่สามารถเล่นไฟล์เสียงนี้ได้</p>
                    <button onClick={() => fetchAudioStream(queue[0])} className="bg-purple-600 px-4 py-2 rounded text-xs">ลองโหลดใหม่</button>
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center animate-pulse">
                      <span className="text-4xl">🎵</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white truncate px-4">{songTitle}</h3>
                      <p className="text-xs text-purple-300/60 mt-1">สตรีมเสียงตรง (รองรับเพลงลิขสิทธิ์)</p>
                    </div>
                    {currentAudioUrl && (
                      <audio 
                        ref={audioRef}
                        src={currentAudioUrl}
                        controls
                        autoPlay
                        className="w-full mt-4"
                        onPlay={handleAudioPlay}
                        onPause={handleAudioPause}
                        onEnded={handleSongEnd}
                      />
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                  <span className="text-4xl animate-bounce">🎵</span>
                  <p className="text-sm">ยังไม่มีเพลงในคิว พิมพ์ค้นหาชื่อเพลงด้านล่างเพื่อเริ่มปาร์ตี้ได้เลย!</p>
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold mb-1">กำลังเล่นเสียงเพลง</h2>
            <p className="text-xs text-purple-300/60">ควบคุมเวลาและสถานะพร้อมกันทุกหน้าจอ</p>
          </div>

          {/* Queue Section & Search Bar */}
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-purple-200">คิวเพลงถัดไป ({queue.length})</h3>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="🔍 พิมพ์ชื่อเพลง หรือวางลิงก์ YouTube..." 
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchAndAdd(); }}
                className="flex-1 bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 transition text-white"
              />
              <button 
                onClick={handleSearchAndAdd} 
                disabled={isSearching}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2"
              >
                {isSearching ? 'กำลังค้นหา...' : '🎵 ค้นหาและต่อคิว'}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {queue.map((id, index) => (
                <div key={index} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3 truncate">
                    <span className="text-xs text-purple-400 font-mono font-bold">#{index + 1}</span>
                    <p className="text-sm truncate text-gray-200">วิดีโอ ID: {id}</p>
                  </div>
                  {index === 0 && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/30">กำลังเล่น</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Members & Live Chat */}
        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex flex-col h-[630px]">
          {/* Members list header */}
          <div className="mb-4 pb-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-purple-200 mb-2">👤 สมาชิกในห้อง ({members.length})</h3>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {members.map((m, idx) => (
                <span key={idx} className="text-[11px] bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <span className="font-semibold text-white">{m.firstName}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded ${m.status === 'โสด' ? 'bg-pink-500/20 text-pink-300' : 'bg-purple-500/20 text-purple-300'}`}>{m.status}</span>
                </span>
              ))}
            </div>
          </div>

          <h3 className="text-base font-bold mb-3 text-purple-200">💬 แชทประจำห้อง</h3>
          
          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center text-xs gap-1">
                <span>💬</span>
                <p>พิมพ์ทักทายเพื่อนๆ ในห้องได้เลย!</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl text-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-300">{msg.user.firstName} {msg.user.lastName}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] ${msg.user.status === 'โสด' ? 'bg-pink-500/20 text-pink-300' : 'bg-purple-500/20 text-purple-300'}`}>{msg.user.status}</span>
                    </div>
                    <span className="text-gray-500">{msg.time}</span>
                  </div>
                  <p className="text-gray-200 break-words leading-relaxed">{msg.message}</p>
                </div>
              ))
            )}
          </div>

          {/* Chat Form */}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input 
              type="text" 
              placeholder="พิมพ์ข้อความคุยกัน..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-purple-400 transition text-white"
            />
            <button type="submit" className="bg-purple-600 hover:bg-purple-500 px-4 py-2.5 rounded-xl text-xs font-semibold transition">ส่ง</button>
          </form>
        </div>

      </div>
    </div>
  );
}