import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, ClientMessage, ServerMessage, Player } from './shared/types.js';
import { CONDITIONS, checkWin, getCandidateCount, getAIMove, validateConditions, getWinningPieces } from './shared/gameLogic.js';
import { Board } from './components/Board.js';
import { Rulebook } from './components/Rulebook.js';
import { Distribution } from './components/Distribution.js';
import { BookOpen, BarChart2, Users, Play, Plus, RefreshCw, Monitor, Cpu, Globe, Minus, Trophy, ArrowRight, Volume2, VolumeX, Music, Music2, Eye, EyeOff } from 'lucide-react';
import { soundManager } from './shared/sound.js';

type GameMode = 'menu' | 'local' | 'cpu' | 'online';

export default function App() {
  const [mode, setMode] = useState<GameMode>('menu');
  const [onlineAction, setOnlineAction] = useState<'create' | 'join' | 'setup_create' | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(7));
  const [roomId, setRoomId] = useState('');
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [isDistOpen, setIsDistOpen] = useState(false);
  const [myTrueCondition, setMyTrueCondition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResultPanel, setShowResultPanel] = useState(true);
  
  const [sfxEnabled, setSfxEnabled] = useState(soundManager.enabled);
  const [bgmEnabled, setBgmEnabled] = useState(soundManager.bgmEnabled);
  const [isHandoff, setIsHandoff] = useState(false);

  useEffect(() => {
    const initSound = () => {
      soundManager.init();
      window.removeEventListener('click', initSound);
      window.removeEventListener('touchstart', initSound);
    };
    window.addEventListener('click', initSound);
    window.addEventListener('touchstart', initSound);
    return () => {
      window.removeEventListener('click', initSound);
      window.removeEventListener('touchstart', initSound);
    };
  }, []);

  const toggleSfx = () => {
    soundManager.toggleSFX();
    setSfxEnabled(soundManager.enabled);
  };

  const toggleBgm = () => {
    soundManager.toggleBGM();
    setBgmEnabled(soundManager.bgmEnabled);
  };

  const prevTurnRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameState) return;
    
    // Turn switch sound and Handoff protocol
    if (gameState.status === 'playing' && prevTurnRef.current !== null && prevTurnRef.current !== gameState.turn) {
      soundManager.playTurnSwitch();
      
      if (mode === 'local') {
        const nextPlayer = gameState.players[gameState.turn];
        if (!nextPlayer.isAI) {
          setIsHandoff(true);
        }
      }
    }
    
    // Win/Lose sound
    if (gameState.status === 'game_finished' && prevStatusRef.current === 'playing') {
      setShowResultPanel(true);
      if (gameState.winner !== undefined) {
        const winnerId = gameState.players[gameState.winner].id;
        if (mode === 'online' && winnerId !== playerId) {
          soundManager.playLose();
        } else {
          soundManager.playWin();
        }
      }
    }
    
    prevTurnRef.current = gameState.status === 'playing' ? gameState.turn : null;
    prevStatusRef.current = gameState.status;
  }, [gameState?.turn, gameState?.status, mode, playerId]);

  const [roomSettings, setRoomSettings] = useState({
    maxPlayers: 4,
    aiFill: false,
    totalGames: 1,
    timeLimit: 0,
    aiLevel: 'Normal'
  });

  const connectWebSocket = (targetRoomId: string, isCreate: boolean = false) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socket = new WebSocket(`${protocol}//${host}`);

    socket.onopen = () => {
      console.log('Connected to server');
      if (isCreate) {
        socket.send(JSON.stringify({ type: 'create_room', roomId: targetRoomId, playerId, settings: roomSettings }));
      } else {
        socket.send(JSON.stringify({ type: 'join_room', roomId: targetRoomId, playerId }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        if (msg.type === 'room_state') {
          setGameState(msg.state);
        } else if (msg.type === 'game_started') {
          setGameState(msg.state);
          setMyTrueCondition(msg.myTrueCondition);
        } else if (msg.type === 'error') {
          setError(msg.message);
          setTimeout(() => setError(null), 3000);
        }
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    };

    socket.onclose = () => {
      console.log('Disconnected from server');
    };

    setWs(socket);
  };

  useEffect(() => {
    return () => {
      if (ws) ws.close();
    };
  }, [ws]);

  const calculateLocalScores = (state: GameState, winnerIdx: number) => {
    const N = state.players.length;
    const pieceCounts = state.players.map((p, i) => {
      let count = 0;
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (state.board[y][x] === i) count++;
        }
      }
      return { idx: i, count };
    });

    pieceCounts[winnerIdx].count = Infinity;
    pieceCounts.sort((a, b) => b.count - a.count);

    const results: { playerId: string; rank: number; points: number }[] = [];
    let currentRank = 1;
    for (let i = 0; i < N; i++) {
      if (i > 0 && pieceCounts[i].count < pieceCounts[i-1].count) {
        currentRank = i + 1;
      }
      const points = Math.max(0, N - currentRank + 1);
      const pIdx = pieceCounts[i].idx;
      
      state.players[pIdx].score += points;
      if (pIdx === winnerIdx) {
        state.players[pIdx].wins += 1;
      }

      results.push({
        playerId: state.players[pIdx].id,
        rank: currentRank,
        points: points
      });
    }
    
    state.lastGameResults = results;
  };

  const handleLocalMessage = (msg: ClientMessage) => {
    setGameState(prevState => {
      if (!prevState) return prevState;
      const state = JSON.parse(JSON.stringify(prevState)) as GameState;
      
      switch (msg.type) {
        case 'join_room': {
          if (state.status !== 'waiting' || state.players.length >= 4) return state;
          const colors = ['#ff00ff', '#00ffff', '#39ff14', '#8a2be2'];
          state.players.push({
            id: msg.playerId,
            color: colors[state.players.length],
            isAI: msg.isAI || false,
            trueCondition: -1,
            aiLevel: msg.aiLevel,
            score: 0,
            wins: 0
          });
          return state;
        }
        case 'remove_player': {
          if (state.status !== 'waiting') return state;
          state.players = state.players.filter(p => p.id !== msg.playerId);
          const colors = ['#ff00ff', '#00ffff', '#39ff14', '#8a2be2'];
          state.players.forEach((p, i) => {
            p.color = colors[i];
          });
          return state;
        }
        case 'update_settings': {
          if (state.status !== 'waiting') return state;
          state.totalGames = msg.totalGames;
          return state;
        }
        case 'start_game': {
          if (state.status !== 'waiting' || state.players.length < 2) return state;
          state.status = 'playing';
          state.currentGame = 1;
          state.players.forEach(p => { p.score = 0; p.wins = 0; });

          let trueConditions: number[] = [];
          let isValid = false;
          while (!isValid) {
            const availableConditions = [...CONDITIONS].sort(() => Math.random() - 0.5);
            trueConditions = availableConditions.slice(0, state.players.length).map(c => c.id);
            isValid = validateConditions(trueConditions, state.players.length);
          }
          
          state.players.forEach((p, i) => {
            p.trueCondition = trueConditions[i];
          });
          
          const numCandidates = getCandidateCount(state.players.length);
          const candidates = new Set(trueConditions);
          while (candidates.size < numCandidates) {
            candidates.add(CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)].id);
          }
          state.candidates = Array.from(candidates).sort(() => Math.random() - 0.5);
          return state;
        }
        case 'next_game': {
          if (state.status !== 'game_finished') return state;
          state.currentGame++;
          if (state.currentGame > state.totalGames) {
            state.status = 'match_finished';
          } else {
            state.status = 'playing';
            state.board = Array(9).fill(null).map(() => Array(9).fill(null));
            state.turn = (state.currentGame - 1) % state.players.length;
            state.winner = undefined;
            
            let trueConditions: number[] = [];
            let isValid = false;
            while (!isValid) {
              const availableConditions = [...CONDITIONS].sort(() => Math.random() - 0.5);
              trueConditions = availableConditions.slice(0, state.players.length).map(c => c.id);
              isValid = validateConditions(trueConditions, state.players.length);
            }

            state.players.forEach((p, i) => {
              p.trueCondition = trueConditions[i];
            });
            const numCandidates = getCandidateCount(state.players.length);
            const candidates = new Set(trueConditions);
            while (candidates.size < numCandidates) {
              candidates.add(CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)].id);
            }
            state.candidates = Array.from(candidates).sort(() => Math.random() - 0.5);
          }
          return state;
        }
        case 'place_piece': {
          if (state.status !== 'playing') return state;
          if (state.board[msg.y][msg.x] !== null) return state;
          
          state.board[msg.y][msg.x] = state.turn;
          
          if (checkWin(state.board, state.turn, state.players[state.turn].trueCondition)) {
            state.winner = state.turn;
            calculateLocalScores(state, state.turn);
            state.status = 'game_finished';
          } else {
            state.turn = (state.turn + 1) % state.players.length;
          }
          return state;
        }
      }
      return state;
    });
  };

  useEffect(() => {
    if ((mode === 'local' || mode === 'cpu') && gameState?.status === 'playing') {
      const currentPlayer = gameState.players[gameState.turn];
      if (currentPlayer.isAI) {
        const timer = setTimeout(() => {
          const move = getAIMove(gameState.board, gameState.turn, currentPlayer.trueCondition, currentPlayer.aiLevel || 'Normal');
          if (move) {
            handleLocalMessage({ type: 'place_piece', x: move.x, y: move.y });
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState?.turn, gameState?.status, mode]);

  const send = (msg: ClientMessage) => {
    if (mode === 'online') {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    } else {
      handleLocalMessage(msg);
    }
  };

  const initLocalMode = (selectedMode: 'local' | 'cpu') => {
    setMode(selectedMode);
    const initialGameState: GameState = {
      id: selectedMode === 'local' ? 'local-room' : 'cpu-room',
      players: [{
        id: playerId,
        color: '#ff00ff',
        isAI: false,
        trueCondition: -1,
        score: 0,
        wins: 0
      }],
      board: Array(9).fill(null).map(() => Array(9).fill(null)),
      turn: 0,
      status: 'waiting',
      candidates: [],
      totalGames: 1,
      currentGame: 1
    };
    setGameState(initialGameState);
  };

  const startCreateOnlineRoom = () => {
    setOnlineAction('create');
  };

  const confirmCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomId(newRoomId);
    connectWebSocket(newRoomId, true);
  };

  const joinOnlineRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      connectWebSocket(roomId);
    }
  };

  const addAI = (level: string) => {
    if (gameState && gameState.status === 'waiting') {
      send({ type: 'join_room', roomId: gameState.id, playerId: `ai-${Math.random().toString(36).substring(7)}`, isAI: true, aiLevel: level });
    }
  };

  const addHuman = () => {
    if (gameState && gameState.status === 'waiting') {
      send({ type: 'join_room', roomId: gameState.id, playerId: `p-${Math.random().toString(36).substring(7)}` });
    }
  };

  const removePlayer = (targetId: string) => {
    if (gameState && gameState.status === 'waiting') {
      send({ type: 'remove_player', playerId: targetId });
    }
  };

  const updateSettings = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (gameState && gameState.status === 'waiting') {
      send({ type: 'update_settings', totalGames: parseInt(e.target.value, 10) });
    }
  };

  const startGame = () => {
    send({ type: 'start_game' });
  };

  const nextGame = () => {
    send({ type: 'next_game' });
  };

  const placePiece = (x: number, y: number) => {
    soundManager.playTap();
    send({ type: 'place_piece', x, y });
  };

  const getConditionName = (id: number) => {
    return CONDITIONS.find(c => c.id === id)?.name || 'Unknown';
  };

  if (mode === 'menu' || (mode === 'online' && !gameState)) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center p-4 overflow-y-auto">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-holo-blue/10 to-neon-magenta/10 pointer-events-none" />
          
          <h1 className="text-4xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-electric-cyan to-neon-magenta neon-text">
            BLIND ARCHITECT
          </h1>
          <h2 className="text-xl font-bold mb-4 text-holo-blue tracking-widest">PARADOX GRID</h2>
          
          <a
            href="/"
            className="inline-block mb-4 text-xs text-electric-cyan underline underline-offset-4 hover:text-neon-magenta transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            このアプリを開く
          </a>
          
          <AnimatePresence mode="wait">
            {mode === 'menu' ? (
              <motion.div
                key="menu"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="space-y-4"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => initLocalMode('local')}
                  className="w-full bg-holo-blue/20 hover:bg-holo-blue/30 border border-holo-blue text-electric-cyan font-bold py-4 rounded-lg transition-all neon-border flex items-center justify-center gap-3"
                >
                  <Users size={24} />
                  ローカルプレイ
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => initLocalMode('cpu')}
                  className="w-full bg-lime-neon/20 hover:bg-lime-neon/30 border border-lime-neon text-lime-neon font-bold py-4 rounded-lg transition-all neon-border flex items-center justify-center gap-3"
                >
                  <Cpu size={24} />
                  CP対戦
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMode('online')}
                  className="w-full bg-neon-magenta/20 hover:bg-neon-magenta/30 border border-neon-magenta text-neon-magenta font-bold py-4 rounded-lg transition-all neon-border flex items-center justify-center gap-3"
                >
                  <Globe size={24} />
                  オンライン対戦
                </motion.button>
              </motion.div>
            ) : mode === 'online' && !onlineAction ? (
              <motion.div
                key="online-menu"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                className="space-y-4"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startCreateOnlineRoom}
                  className="w-full bg-holo-blue/20 hover:bg-holo-blue/30 border border-holo-blue text-electric-cyan font-bold py-4 rounded-lg transition-all neon-border flex items-center justify-center gap-3"
                >
                  <Plus size={24} />
                  ルーム作成
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOnlineAction('join')}
                  className="w-full bg-neon-magenta/20 hover:bg-neon-magenta/30 border border-neon-magenta text-neon-magenta font-bold py-4 rounded-lg transition-all neon-border flex items-center justify-center gap-3"
                >
                  <Play size={24} />
                  ルーム参加
                </motion.button>
                <button
                  onClick={() => setMode('menu')}
                  className="text-white/50 hover:text-white text-sm mt-4 transition-colors"
                >
                  ← 戻る
                </button>
              </motion.div>
            ) : mode === 'online' && onlineAction === 'create' ? (
              <motion.div
                key="online-setup-create"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                className="space-y-4 text-left"
              >
                <h3 className="text-xl font-bold text-electric-cyan mb-4 text-center">ルーム設定</h3>
                <form onSubmit={confirmCreateRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">最大プレイヤー数</label>
                    <select
                      value={roomSettings.maxPlayers}
                      onChange={(e) => setRoomSettings({...roomSettings, maxPlayers: parseInt(e.target.value)})}
                      className="w-full bg-black/50 border border-holo-blue/30 rounded px-3 py-2 text-white"
                    >
                      <option value={2}>2人</option>
                      <option value={3}>3人</option>
                      <option value={4}>4人</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">総ゲーム数</label>
                    <select
                      value={roomSettings.totalGames}
                      onChange={(e) => setRoomSettings({...roomSettings, totalGames: parseInt(e.target.value)})}
                      className="w-full bg-black/50 border border-holo-blue/30 rounded px-3 py-2 text-white"
                    >
                      <option value={1}>1ゲーム</option>
                      <option value={3}>3ゲーム</option>
                      <option value={5}>5ゲーム</option>
                      <option value={10}>10ゲーム</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="aiFill"
                      checked={roomSettings.aiFill}
                      onChange={(e) => setRoomSettings({...roomSettings, aiFill: e.target.checked})}
                      className="accent-electric-cyan"
                    />
                    <label htmlFor="aiFill" className="text-sm text-white/90">AIで不足枠を補完する</label>
                  </div>
                  {roomSettings.aiFill && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">AI難易度</label>
                      <select
                        value={roomSettings.aiLevel}
                        onChange={(e) => setRoomSettings({...roomSettings, aiLevel: e.target.value})}
                        className="w-full bg-black/50 border border-holo-blue/30 rounded px-3 py-2 text-white"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Normal">Normal</option>
                        <option value="Hard">Hard</option>
                        <option value="Expert">Expert</option>
                      </select>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full mt-4 bg-holo-blue/20 hover:bg-holo-blue/30 border border-holo-blue text-electric-cyan font-bold py-3 rounded-lg transition-all neon-border"
                  >
                    作成する
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineAction(null)}
                    className="text-white/50 hover:text-white text-sm mt-4 transition-colors block w-full text-center"
                  >
                    ← 戻る
                  </button>
                </form>
              </motion.div>
            ) : mode === 'online' && onlineAction === 'join' ? (
              <motion.div
                key="online-join"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
              >
                <form onSubmit={joinOnlineRoom} className="space-y-4">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    className="w-full bg-black/50 border border-holo-blue/30 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-electric-cyan focus:ring-1 focus:ring-electric-cyan transition-all text-center text-xl tracking-widest"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-holo-blue/20 hover:bg-holo-blue/30 border border-holo-blue text-electric-cyan font-bold py-3 rounded-lg transition-all neon-border"
                  >
                    参加する
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineAction(null)}
                    className="text-white/50 hover:text-white text-sm mt-4 transition-colors block w-full"
                  >
                    戻る
                  </button>
                </form>
              </motion.div>
            ) : mode === 'online' && onlineAction === 'create' ? (
              <motion.div
                key="online-create"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-6"
              >
                <div className="text-sm text-white/70">あなたのルームID</div>
                <div className="text-5xl font-mono text-electric-cyan tracking-widest neon-text font-black">
                  {roomId}
                </div>
                <div className="text-xs text-white/50">このIDを対戦相手に共有してください</div>
                <div className="text-sm text-lime-neon animate-pulse mt-4">接続待機中...</div>
                <button
                  onClick={() => {
                    if (ws) ws.close();
                    setOnlineAction(null);
                  }}
                  className="text-white/50 hover:text-white text-sm mt-4 transition-colors block w-full"
                >
                  キャンセル
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error && (
            <div className="mt-4 text-neon-magenta text-sm animate-pulse">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  let viewPlayerId = playerId;
  if (mode !== 'online' && gameState.status === 'playing') {
    const currentPlayer = gameState.players[gameState.turn];
    if (!currentPlayer.isAI) {
      if (isHandoff) {
        viewPlayerId = 'hidden';
      } else {
        viewPlayerId = currentPlayer.id;
      }
    }
  }

  const myIndex = gameState.players.findIndex(p => p.id === viewPlayerId);
  const isMyTurn = gameState.turn === myIndex && gameState.status === 'playing';

  const getPlayerName = (p: Player, i: number) => {
    if (p.isAI) return `CP (${p.aiLevel})`;
    if (mode === 'online') return p.id === playerId ? 'YOU' : `Player ${i + 1}`;
    return `Player ${i + 1}`;
  };

  return (
    <div className="min-h-screen bg-animated flex flex-col relative overflow-y-auto">
      {/* Particles Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 5 + 3}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="p-4 flex flex-wrap justify-between items-center z-10 glass-panel border-b border-white/10 gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-electric-cyan to-neon-magenta">
            BLIND ARCHITECT
          </h1>
          <div className="text-xs text-holo-blue font-mono flex items-center gap-2">
            {mode === 'online' ? <Globe size={12} /> : mode === 'local' ? <Users size={12} /> : <Cpu size={12} />}
            {mode === 'online' ? `ROOM: ${gameState.id}` : mode === 'local' ? 'LOCAL PLAY' : 'CPU MATCH'}
            {gameState.status !== 'waiting' && (
              <span className="text-white/50 ml-2">| GAME {gameState.currentGame} / {gameState.totalGames}</span>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="flex gap-3 mr-2 border-r border-white/10 pr-4 items-center">
            <button onClick={toggleSfx} className="text-white/70 hover:text-white transition-colors" title="Toggle Sound Effects">
              {sfxEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={toggleBgm} className="text-white/70 hover:text-white transition-colors" title="Toggle Background Music">
              {bgmEnabled ? <Music size={18} /> : <Music2 size={18} className="opacity-50" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              defaultValue="0.3"
              onChange={(e) => soundManager.setVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-electric-cyan"
              title="Volume"
            />
          </div>
          
          <button
            onClick={() => setIsDistOpen(!isDistOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan hover:bg-electric-cyan/20 transition-colors text-sm font-bold"
          >
            <BarChart2 size={16} />
            <span className="hidden sm:inline">DISTRIBUTION</span>
          </button>
          
          <button
            onClick={() => setIsRulebookOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/20 transition-colors text-sm font-bold"
          >
            <BookOpen size={16} />
            <span className="hidden sm:inline">RULEBOOK</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-6 z-10 max-w-7xl mx-auto w-full">
        
        {/* Left Sidebar: Players & Status */}
        <div className="w-full lg:w-64 flex flex-col gap-4">
          <div className="glass-panel rounded-xl p-4 relative">
            {gameState.status === 'waiting' && (
              <button
                onClick={() => {
                  setMode('menu');
                  setGameState(null);
                  setOnlineAction(null);
                  if (ws) ws.close();
                }}
                className="absolute top-4 right-4 text-white/50 hover:text-white text-sm transition-colors"
              >
                ← 戻る
              </button>
            )}
            
            <h2 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
              <Users size={16} /> PLAYERS
            </h2>
            
            {mode === 'online' && gameState.status === 'waiting' && (
              <div className="mb-4 p-3 bg-black/50 rounded-lg border border-holo-blue/30 text-center">
                <div className="text-xs text-white/50 mb-1">ROOM ID</div>
                <div className="text-2xl font-mono text-electric-cyan tracking-widest font-black mb-2">
                  {gameState.id}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(gameState.id)}
                  className="text-xs px-3 py-1 bg-holo-blue/20 hover:bg-holo-blue/30 text-holo-blue rounded transition-colors"
                >
                  コピー
                </button>
              </div>
            )}

            <div className="space-y-3">
              {gameState.players.map((p, i) => {
                const isMe = p.id === viewPlayerId;
                return (
                  <div 
                    key={p.id} 
                    className={`p-3 rounded-lg border transition-all relative ${
                      gameState.turn === i && gameState.status === 'playing'
                        ? 'border-white bg-white/10 animate-blink'
                        : 'border-white/10 bg-black/30'
                    }`}
                  >
                    {gameState.status === 'waiting' && p.id !== playerId && (
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="absolute top-2 right-2 text-white/30 hover:text-neon-magenta transition-colors"
                        title="Remove Player"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }} />
                      <span className="font-bold text-sm">
                        {getPlayerName(p, i)}
                      </span>
                    </div>
                    
                    {gameState.status !== 'waiting' && (
                      <div className="flex justify-between text-xs text-white/60 mt-1 mb-2">
                        <span>Score: <span className="text-white font-mono">{p.score}</span></span>
                        <span>Wins: <span className="text-white font-mono">{p.wins}</span></span>
                      </div>
                    )}
                    
                    {gameState.status !== 'waiting' && !isMe && viewPlayerId !== 'hidden' && (
                      <div className="text-xs mt-2 p-1.5 bg-black/50 rounded border border-white/5 text-white/80">
                        <span className="text-white/50 block mb-0.5">True Condition:</span>
                        <span style={{ color: p.color }}>{getConditionName(p.trueCondition)}</span>
                      </div>
                    )}
                    
                    {gameState.status !== 'waiting' && (isMe || viewPlayerId === 'hidden') && (
                      <div className="text-xs mt-2 p-1.5 bg-black/50 rounded border border-white/5 text-white/50 italic text-center">
                        Hidden from you
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {gameState.status === 'waiting' && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-white/50 mb-1">Match Settings:</div>
                  <select
                    value={gameState.totalGames}
                    onChange={updateSettings}
                    className="w-full bg-black/50 border border-white/20 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-electric-cyan"
                  >
                    <option value={1}>1 Game Match</option>
                    <option value={3}>3 Games Match</option>
                    <option value={5}>5 Games Match</option>
                    <option value={10}>10 Games Match</option>
                  </select>
                </div>

                {gameState.players.length < 4 && (
                  <div className="space-y-2">
                    {mode === 'local' && (
                      <button
                        onClick={addHuman}
                        className="w-full text-xs py-2 bg-holo-blue/10 hover:bg-holo-blue/20 border border-holo-blue/30 text-holo-blue rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={14} /> Add Human
                      </button>
                    )}
                    {(mode === 'local' || mode === 'cpu' || mode === 'online') && (
                      <>
                        <div className="text-xs text-white/50 mb-1 mt-2">Add CP:</div>
                        <div className="grid grid-cols-2 gap-2">
                          {['Easy', 'Normal', 'Hard', 'Expert'].map(level => (
                            <button
                              key={level}
                              onClick={() => addAI(level)}
                              className="text-xs py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors"
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {gameState.status === 'waiting' && gameState.players.length >= 2 && (
              <button
                onClick={startGame}
                className="w-full mt-4 bg-lime-neon/20 hover:bg-lime-neon/30 border border-lime-neon text-lime-neon font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Play size={16} /> START MATCH
              </button>
            )}
          </div>
        </div>

        {/* Center: Board / Results */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] relative">
          {gameState.status === 'match_finished' ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel p-8 rounded-2xl max-w-md w-full text-center"
            >
              <Trophy size={48} className="mx-auto text-lime-neon mb-4" />
              <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-lime-neon to-electric-cyan">
                MATCH FINISHED
              </h2>
              
              <div className="space-y-3 mb-8">
                {[...gameState.players]
                  .sort((a, b) => b.score - a.score || b.wins - a.wins)
                  .map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <span className={`font-black text-xl ${i === 0 ? 'text-lime-neon' : 'text-white/50'}`}>#{i + 1}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="font-bold">{getPlayerName(p, gameState.players.findIndex(op => op.id === p.id))}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold text-white">{p.score} <span className="text-xs text-white/50">pts</span></div>
                        <div className="text-xs text-white/40">{p.wins} wins</div>
                      </div>
                    </div>
                  ))}
              </div>

              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-colors flex items-center justify-center gap-2 font-bold"
              >
                <RefreshCw size={18} /> BACK TO MENU
              </button>
            </motion.div>
          ) : (
            <>
              <div className="relative w-full max-w-[min(100%,600px,60vh)] aspect-square mx-auto">
                <Board 
                  state={gameState} 
                  myPlayerId={viewPlayerId} 
                  onPlacePiece={placePiece}
                  winningPieces={gameState.status === 'game_finished' && gameState.winner !== undefined ? getWinningPieces(gameState.board, gameState.winner, gameState.players[gameState.winner].trueCondition!) : []}
                />
              </div>
              {gameState.status === 'playing' && (
                <div className="mt-6 text-center">
                  <div className={`text-lg font-bold ${isMyTurn ? 'text-lime-neon animate-pulse' : 'text-white/50'}`}>
                    {isMyTurn ? 'YOUR TURN' : 'WAITING...'}
                  </div>
                </div>
              )}
              {gameState.status === 'game_finished' && !showResultPanel && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowResultPanel(true)}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-colors font-bold flex items-center justify-center gap-2 mx-auto"
                  >
                    <EyeOff size={18} /> SHOW RESULTS
                  </button>
                </div>
              )}
            </>
          )}

          {/* Result Panel Overlay */}
          <AnimatePresence>
            {gameState.status === 'game_finished' && showResultPanel && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-2xl"
              >
                <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border-2" style={{ borderColor: gameState.winner !== undefined ? gameState.players[gameState.winner].color : '#ffffff33' }}>
                  <h2 className="text-4xl font-black mb-2" style={{ color: gameState.winner !== undefined ? gameState.players[gameState.winner].color : '#fff', textShadow: gameState.winner !== undefined ? `0 0 20px ${gameState.players[gameState.winner].color}` : 'none' }}>
                    {gameState.winner !== undefined ? (gameState.players[gameState.winner].id === viewPlayerId ? 'YOU WIN!' : `${getPlayerName(gameState.players[gameState.winner], gameState.winner)} WINS!`) : 'DRAW'}
                  </h2>
                  <div className="text-white/70 mb-6 font-bold">Game {gameState.currentGame} of {gameState.totalGames}</div>
                  
                  {gameState.winner !== undefined && (
                    <div className="mb-6 p-4 bg-black/50 rounded-xl border border-white/10">
                      <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Winning Condition</div>
                      <div className="text-lg font-bold text-lime-neon drop-shadow-[0_0_8px_rgba(0,255,0,0.8)]">
                        {CONDITIONS.find(c => c.id === gameState.players[gameState.winner!].trueCondition)?.name}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 mb-8 text-left">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Points & Conditions</div>
                    {gameState.players.map((p, idx) => {
                      const res = gameState.lastGameResults?.find(r => r.playerId === p.id);
                      return (
                        <div key={p.id} className="flex flex-col p-2 bg-black/30 rounded border border-white/5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {res && <span className="text-white/50 text-xs w-4">{res.rank}</span>}
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                              <span className="text-sm font-bold">{getPlayerName(p, idx)}</span>
                            </div>
                            {res && <span className="text-lime-neon font-mono text-sm font-bold">+{res.points}</span>}
                          </div>
                          <div className="text-white/70 text-xs pl-9">
                            {CONDITIONS.find(c => c.id === p.trueCondition)?.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={nextGame}
                      className="w-full px-6 py-3 bg-holo-blue/20 hover:bg-holo-blue/30 rounded-xl border border-holo-blue transition-colors flex items-center justify-center gap-2 font-bold text-electric-cyan neon-border"
                    >
                      {gameState.currentGame >= gameState.totalGames ? 'SHOW FINAL RESULTS' : 'NEXT GAME'} <ArrowRight size={18} />
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowResultPanel(false)}
                        className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <Eye size={16} /> VIEW BOARD
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={16} /> HOME
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar: Candidates */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          <div className="glass-panel rounded-xl p-4 flex-1">
            <h2 className="text-sm font-bold text-white/70 mb-3 flex items-center justify-between">
              <span>CANDIDATES</span>
              {gameState.status !== 'waiting' && (
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{gameState.candidates.length}</span>
              )}
            </h2>
            
            {gameState.status === 'waiting' || viewPlayerId === 'hidden' ? (
              <div className="text-sm text-white/40 text-center py-8 italic">
                {viewPlayerId === 'hidden' ? 'Hidden during handoff.' : 'Candidates will be revealed when the game starts.'}
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                {gameState.candidates.map(condId => {
                  const cond = CONDITIONS.find(c => c.id === condId);
                  if (!cond) return null;
                  
                  const owner = viewPlayerId !== 'hidden' ? gameState.players.find(p => p.id !== viewPlayerId && p.trueCondition === condId) : undefined;
                  
                  return (
                    <div 
                      key={condId} 
                      className={`p-3 rounded-lg border text-sm ${
                        owner 
                          ? 'bg-black/40 border-white/5 opacity-60'
                          : 'bg-white/5 border-white/10 hover:border-white/30 transition-colors'
                      }`}
                    >
                      <div className="font-bold mb-1 flex justify-between items-start">
                        <span className={owner ? 'text-white/50' : 'text-white'}>{cond.name}</span>
                        {owner && (
                          <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: owner.color, boxShadow: `0 0 5px ${owner.color}` }} />
                        )}
                      </div>
                      <div className="text-xs text-white/60 leading-relaxed">{cond.desc}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <Rulebook isOpen={isRulebookOpen} onClose={() => setIsRulebookOpen(false)} playerCount={gameState?.players.length || 2} />
      <Distribution isOpen={isDistOpen} onClose={() => setIsDistOpen(false)} playerCount={gameState?.players.length || 2} />
      
      {/* Handoff Overlay */}
      <AnimatePresence>
        {isHandoff && gameState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="text-2xl md:text-4xl font-black text-white mb-8 text-center tracking-widest">
              デバイスを次のプレイヤーに<br className="md:hidden" />渡してください
            </div>
            <div className="flex items-center gap-4 mb-12 bg-white/5 px-8 py-4 rounded-2xl border border-white/10">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: gameState.players[gameState.turn].color, boxShadow: `0 0 15px ${gameState.players[gameState.turn].color}` }} />
              <span className="text-2xl font-bold" style={{ color: gameState.players[gameState.turn].color }}>
                {getPlayerName(gameState.players[gameState.turn], gameState.turn)} のターン
              </span>
            </div>
            <button
              onClick={() => setIsHandoff(false)}
              className="px-10 py-5 bg-holo-blue/20 hover:bg-holo-blue/30 border border-holo-blue text-electric-cyan font-bold rounded-xl transition-all neon-border text-xl flex items-center gap-3"
            >
              準備完了（次へ） <ArrowRight size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
