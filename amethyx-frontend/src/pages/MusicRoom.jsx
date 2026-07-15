// src/pages/MusicRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import { io } from 'socket.io-client';

// 🛠️ แก้ไขตรงนี้ให้ดึงค่าจาก Vercel หรือใช้ค่าสำรองไปที่ Render ทันที
const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://amethyx-music-gang.onrender.com';
const API_URL = import.meta.env.VITE_API_URL || 'https://amethyx-music-gang.onrender.com';

export default function MusicRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [roomOwner, setRoomOwner] = useState('');
  const [members, setMembers] = useState([]);
  
  const [queue, setQueue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const pendingSync = useRef(null);
  const currentSongIdRef = useRef(null);
  const errorRetryCounts = useRef({});
  const isSyncingRef = useRef(false);
  const chatScrollRef = useRef(null);
  const [playerError, setPlayerError] = useState(false);
  const [playerErrorCode, setPlayerErrorCode] = useState(null);
  const [playerKey, setPlayerKey] = useState(0); // force remount counter
  const [showPlayer, setShowPlayer] = useState(true);

  const remountPlayer = (delay = 150) => {
    playerRef.current = null;
    setShowPlayer(false);

    setTimeout(() => {
      setPlayerError(false);
      setPlayerErrorCode(null);
      setPlayerKey((k) => k + 1);
      setShowPlayer(true);
    }, delay);
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

    // เชื่อมต่อ Socket.io (ถ้ามี instance เดิมจาก App ให้ใช้ตัวนั้นกลับมา)
    if (window.socket) {
      socketRef.current = window.socket;
    } else {
      socketRef.current = io(SOCKET_URL, { withCredentials: true });
      // store global instance for other pages
      window.socket = socketRef.current;
    }
    
    socketRef.current.emit('join_room', { roomId, user: userObj });
    // ขอข้อมูลซิงก์ล่าสุดจากเซิร์ฟเวอร์เพื่อความแน่นอน
    socketRef.current.emit('request_initial_sync');

    socketRef.current.on('room_data', (data) => {
      if (data) {
        setRoomName(data.roomName);
        setRoomOwner(data.owner);
        setQueue(data.playlist || []);

        if (data.playlist && data.playlist.length > 0) {
          currentSongIdRef.current = data.playlist[0]?.videoId;
          errorRetryCounts.current[data.playlist[0]?.videoId] = 0;
        }

        const syncData = { status: data.status, videoTime: data.videoTime };
        pendingSync.current = syncData;
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          applySync(syncData);
          pendingSync.current = null;
        }
      }
    });

    socketRef.current.on('update_members', (updatedMembers) => {
      setMembers(updatedMembers);
    });

    socketRef.current.on('queue_updated', (updatedPlaylist) => {
      setQueue(prev => {
        const prevFirst = (prev && prev.length > 0) ? prev[0]?.videoId : null;
        const newFirst = (updatedPlaylist && updatedPlaylist.length > 0) ? updatedPlaylist[0]?.videoId : null;
        if (prevFirst !== newFirst) {
          // only remount when the currently playing video changed
          remountPlayer(200);
        }
        return updatedPlaylist;
      });
    });

    socketRef.current.on('change_song', (updatedPlaylist) => {
      setQueue(prev => {
        const prevFirst = (prev && prev.length > 0) ? prev[0]?.videoId : null;
        const newFirst = (updatedPlaylist && updatedPlaylist.length > 0) ? updatedPlaylist[0]?.videoId : null;
        if (newFirst && newFirst !== currentSongIdRef.current) {
          currentSongIdRef.current = newFirst;
          errorRetryCounts.current[newFirst] = 0;
          pendingSync.current = null;
          remountPlayer(150);
        }
        return updatedPlaylist;
      });
    });
    
    socketRef.current.on('sync_state', (syncData) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        applySync(syncData);
      } else {
        pendingSync.current = syncData;
      }
    });

    socketRef.current.on('receive_message', (chatData) => {
      setMessages((prev) => [...prev, chatData]);
    });

    // (queue_updated consolidated above)

    socketRef.current.on('room_deleted', () => {
      alert('เจ้าของห้องได้ทำการลบห้องนี้แล้ว!');
      navigate('/');
    });

    socketRef.current.on('error_message', (msg) => {
      alert(msg);
      navigate('/');
    });

    // ป้องกันเพลงหยุดเวลาสลับหน้าจอหรือพับเว็บ
    const handleVisibilityChange = () => {
      if (document.hidden && playerRef.current) {
        const state = playerRef.current.getPlayerState();
        if (state === 2) {
          playerRef.current.playVideo();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socketRef.current) {
        // แจ้ง server ว่าออกจากห้อง โดยไม่ตัดการเชื่อมต่อ global socket
        socketRef.current.emit('leave_room', { roomId, username: userObj.username });

        // ลบ listeners ที่เพิ่มไว้ใน effect นี้ เพื่อป้องกัน duplicate เมื่อกลับมาอีกครั้ง
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
    if (!playerRef.current) return;
    isSyncingRef.current = true;

    if (typeof playerRef.current.getCurrentTime === 'function') {
      const currentTime = playerRef.current.getCurrentTime();
      if (typeof videoTime === 'number' && Math.abs(currentTime - videoTime) > 1.5) {
          playerRef.current.seekTo(videoTime, true);
      }

      if (status === 1) {
          playerRef.current.playVideo();
          setTimeout(() => {
            if (playerRef.current && playerRef.current.getPlayerState() !== 1) {
              playerRef.current.mute();
              playerRef.current.playVideo();
            }
          }, 300);
      } else if (status === 2) {
          playerRef.current.pauseVideo();
      }
    }
    setTimeout(() => { isSyncingRef.current = false; }, 500);
  };

  const onPlayerError = (event) => {
    console.error('YouTube player error', event.data);
    const code = event.data;
    setPlayerErrorCode(code);

    if (code === 101 || code === 150) {
      const currentVideoId = queue[0]?.videoId;
      const retries = errorRetryCounts.current[currentVideoId] || 0;

      if (retries < 1) {
        console.warn('พบข้อผิดพลาด 101/150 แต่จะลองโหลดวิดีโอใหม่อีกครั้งก่อน');
        errorRetryCounts.current[currentVideoId] = retries + 1;
        setPlayerError(false);
        setPlayerErrorCode(null);
        remountPlayer(300);
        return;
      }

      console.warn('วิดีโอนี้ไม่อนุญาตให้เล่นภายนอก หลังจากลองใหม่แล้ว ข้ามไปยังเพลงถัดไป...');
      setPlayerError(true);
      if (socketRef.current) {
        socketRef.current.emit('next_song', { roomId });
      }
      return;
    }

    if (code === 100) {
      setPlayerError(true);
      return;
    }

    // other transient errors: attempt a single remount
    setPlayerError(true);
    setTimeout(() => remountPlayer(300), 800);
  };

  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    if (pendingSync.current) {
      applySync(pendingSync.current);
      pendingSync.current = null;
    } else {
      playerRef.current.playVideo();
    }
  };

  const onPlayerStateChange = (event) => {
    if (isSyncingRef.current) return;
    const status = event.data; 
    
    // หากหน้าจอถูกพับอยู่ ไม่ส่งสถานะ Pause ไปกวนคนอื่น
    if (document.hidden && status === 2) return;

    if (status === 1 || status === 2) {
        const videoTime = event.target.getCurrentTime();
        socketRef.current.emit('update_state', { roomId, status, videoTime });
    }
  };

  const searchSongs = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    setSearchError('');
    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาดในการค้นหาเพลง');
      }
      if (!Array.isArray(data) || data.length === 0) {
        setSearchResults([]);
        setSearchError('ไม่พบเพลงที่ค้นหานี้');
      } else {
        setSearchResults(data);
      }
    } catch (error) {
      console.error(error);
      setSearchError(error.message || 'เกิดข้อผิดพลาดในการค้นหาเพลง');
    } finally {
      setIsSearching(false);
    }
  };

  const addSongToQueue = (song) => {
    if (!song || !song.videoId) return;
    socketRef.current.emit('add_to_queue', { roomId, video: song });
    setSearchTerm('');
    setSearchResults([]);
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
        
        {/* Left Side: Video Player & Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
            <div className="aspect-video rounded-2xl overflow-hidden bg-black/40 mb-4 border border-white/5">
              {queue.length > 0 ? (
                playerError ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                        <p className="mb-2">ไม่สามารถโหลดวิดีโอได้ (YouTube)</p>
                        <img src={`https://img.youtube.com/vi/${queue[0]?.videoId}/hqdefault.jpg`} alt="thumb" className="mx-auto mb-2 rounded" />
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => remountPlayer(200)} className="bg-purple-600 px-4 py-2 rounded">ลองโหลดใหม่</button>
                          <a href={`https://www.youtube.com/watch?v=${queue[0]?.videoId}`} target="_blank" rel="noreferrer" className="bg-white/5 border border-white/10 px-4 py-2 rounded text-xs">เปิดบน YouTube</a>
                        </div>
                        {playerErrorCode && <p className="text-[11px] text-gray-400 mt-2">Error code: {playerErrorCode}</p>}
                      </div>
                  </div>
                ) : (
                  showPlayer ? (
                    <YouTube 
                      key={playerKey}
                      videoId={queue[0]?.videoId} 
                      opts={{
                        width: '100%',
                        height: '100%',
                        playerVars: {
                          autoplay: 1,
                          controls: 1,
                          rel: 0,
                          enablejsapi: 1,
                          origin: window.location.origin,
                          playsinline: 1,
                        },
                        host: 'https://www.youtube.com'
                      }} 
                      className="w-full h-full"
                      containerClassName="w-full h-full pointer-events-auto"
                      onReady={onPlayerReady} 
                      onStateChange={onPlayerStateChange} 
                      onEnd={handleSongEnd}
                      onError={onPlayerError}
                    />
                  ) : null
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                  <span className="text-4xl animate-bounce">🎵</span>
                  <p className="text-sm">ยังไม่มีเพลงในคิว วางลิงก์ขวามือเพื่อเริ่มปาร์ตี้กันเลย!</p>
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold mb-1">กำลังเล่นมิวสิควิดีโอหลัก</h2>
            <p className="text-xs text-purple-300/60">ควบคุมเวลาและสถานะพร้อมกันทุกหน้าจอ</p>
          </div>

          {/* Queue Section */}
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-purple-200">คิวเพลงถัดไป ({queue.length})</h3>
            <div className="flex gap-2 mb-4">
              <form onSubmit={searchSongs} className="flex-1 flex gap-2">
                <input 
                  type="text" 
                  placeholder="พิมพ์ชื่อเพลงหรือศิลปิน แล้วกดค้นหา..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 transition text-white"
                />
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl text-sm font-semibold transition">
                  {isSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
                </button>
              </form>
            </div>
            {searchError && <div className="text-red-300 text-xs mb-3">{searchError}</div>}
            {searchResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 mb-4">
                {searchResults.map((song, index) => (
                  <div key={index} className="flex items-center justify-between bg-white/[0.04] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={song.thumbnail} alt={song.title} className="w-14 h-10 rounded-lg object-cover" />
                      <div className="truncate">
                        <p className="text-sm font-semibold truncate">{song.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{song.channel} • {song.duration}</p>
                      </div>
                    </div>
                    <button onClick={() => addSongToQueue(song)} className="bg-emerald-500/15 text-emerald-200 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition hover:bg-emerald-500/25">
                      ต่อคิว
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {queue.map((item, index) => (
                <div key={index} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-purple-400 font-mono font-bold">#{index + 1}</span>
                      <p className="text-sm truncate text-gray-200">{item.title}</p>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{item.channel} • {item.duration}</p>
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