import { WebSocket, WebSocketServer } from 'ws';
import { Room, Player, ClientMessage, ServerMessage, GameState, Move } from '../shared/types.js';
import { checkWin, getCandidateCount, CONDITIONS, getAIMove, validateConditions } from '../shared/gameLogic.js';

const rooms = new Map<string, Room>();

function calculateScores(room: Room, winnerIdx: number) {
  const N = room.players.length;
  const pieceCounts = room.players.map((p, i) => {
    let count = 0;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (room.board[y][x] === i) count++;
      }
    }
    return { idx: i, count };
  });

  pieceCounts[winnerIdx].count = Infinity;
  pieceCounts.sort((a, b) => b.count - a.count);

  const results = [];
  let currentRank = 1;
  for (let i = 0; i < N; i++) {
    if (i > 0 && pieceCounts[i].count < pieceCounts[i-1].count) {
      currentRank = i + 1;
    }
    const points = Math.max(0, N - currentRank + 1);
    const pIdx = pieceCounts[i].idx;
    
    room.players[pIdx].score += points;
    if (pIdx === winnerIdx) {
      room.players[pIdx].wins += 1;
    }

    results.push({
      playerId: room.players[pIdx].id,
      rank: currentRank,
      points: points
    });
  }
  
  room.lastGameResults = results;
}

export function handleConnection(ws: WebSocket, wss: WebSocketServer) {
  let currentRoomId: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on('message', (data) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      
      switch (msg.type) {
        case 'create_room': {
          const { roomId, playerId, settings } = msg;
          if (rooms.has(roomId)) {
            send(ws, { type: 'error', message: 'Room already exists' });
            return;
          }

          currentRoomId = roomId;
          currentPlayerId = playerId;

          const room: Room = {
            id: roomId,
            players: [],
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            turn: 0,
            status: 'waiting',
            candidates: [],
            playerCount: settings.maxPlayers,
            totalGames: settings.totalGames,
            currentGame: 1,
            settings
          };

          const colors = ['#ff00ff', '#00ffff', '#39ff14', '#8a2be2'];
          room.players.push({
            id: playerId,
            ws,
            color: colors[0],
            trueCondition: -1,
            isAI: false,
            score: 0,
            wins: 0
          });

          rooms.set(roomId, room);
          broadcast(room, { type: 'room_state', state: getPublicState(room) });
          break;
        }

        case 'join_room': {
          const { roomId, playerId, isAI, aiLevel } = msg;
          currentRoomId = roomId;
          currentPlayerId = playerId;
          
          let room = rooms.get(roomId);
          if (!room) {
            send(ws, { type: 'error', message: 'Room not found' });
            return;
          }

          if (room.status !== 'waiting') {
            send(ws, { type: 'error', message: 'Room is already playing' });
            return;
          }

          const maxPlayers = room.settings?.maxPlayers || 4;
          if (room.players.length >= maxPlayers) {
            send(ws, { type: 'error', message: 'Room is full' });
            return;
          }

          const colors = ['#ff00ff', '#00ffff', '#39ff14', '#8a2be2'];
          const color = colors[room.players.length];

          room.players.push({
            id: playerId,
            ws,
            color,
            trueCondition: -1,
            isAI: isAI || false,
            aiLevel,
            score: 0,
            wins: 0
          });

          broadcast(room, { type: 'room_state', state: getPublicState(room) });
          break;
        }

        case 'remove_player': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'waiting') return;
          
          room.players = room.players.filter(p => p.id !== msg.playerId);
          
          // Reassign colors
          const colors = ['#ff00ff', '#00ffff', '#39ff14', '#8a2be2'];
          room.players.forEach((p, i) => {
            p.color = colors[i];
          });
          
          broadcast(room, { type: 'room_state', state: getPublicState(room) });
          break;
        }

        case 'update_settings': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'waiting') return;
          
          room.totalGames = msg.totalGames;
          broadcast(room, { type: 'room_state', state: getPublicState(room) });
          break;
        }

        case 'start_game': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'waiting' || room.players.length < 2) return;

          room.playerCount = room.players.length;
          room.status = 'playing';
          room.currentGame = 1;
          room.players.forEach(p => { p.score = 0; p.wins = 0; });
          
          let trueConditions: number[] = [];
          let isValid = false;
          while (!isValid) {
            const availableConditions = [...CONDITIONS].sort(() => Math.random() - 0.5);
            trueConditions = availableConditions.slice(0, room.playerCount).map(c => c.id);
            isValid = validateConditions(trueConditions, room.playerCount);
          }
          
          room.players.forEach((p, i) => {
            p.trueCondition = trueConditions[i];
          });

          const numCandidates = getCandidateCount(room.playerCount);
          const candidates = new Set(trueConditions);
          while (candidates.size < numCandidates) {
            const randCond = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)].id;
            candidates.add(randCond);
          }
          room.candidates = Array.from(candidates).sort(() => Math.random() - 0.5);

          room.players.forEach(p => {
            if (p.ws) {
              send(p.ws, { 
                type: 'game_started', 
                state: getPublicState(room),
                myTrueCondition: p.trueCondition
              });
            }
          });
          
          checkAITurn(room);
          break;
        }

        case 'next_game': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'game_finished') return;

          room.currentGame++;
          if (room.currentGame > room.totalGames) {
            room.status = 'match_finished';
            broadcast(room, { type: 'room_state', state: getPublicState(room) });
          } else {
            room.status = 'playing';
            room.board = Array(9).fill(null).map(() => Array(9).fill(null));
            room.turn = (room.currentGame - 1) % room.players.length;
            room.winner = undefined;
            
            let trueConditions: number[] = [];
            let isValid = false;
            while (!isValid) {
              const availableConditions = [...CONDITIONS].sort(() => Math.random() - 0.5);
              trueConditions = availableConditions.slice(0, room.playerCount).map(c => c.id);
              isValid = validateConditions(trueConditions, room.playerCount);
            }
            
            room.players.forEach((p, i) => {
              p.trueCondition = trueConditions[i];
            });

            const numCandidates = getCandidateCount(room.playerCount);
            const candidates = new Set(trueConditions);
            while (candidates.size < numCandidates) {
              const randCond = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)].id;
              candidates.add(randCond);
            }
            room.candidates = Array.from(candidates).sort(() => Math.random() - 0.5);

            room.players.forEach(p => {
              if (p.ws) {
                send(p.ws, { 
                  type: 'game_started', 
                  state: getPublicState(room),
                  myTrueCondition: p.trueCondition
                });
              }
            });
            
            checkAITurn(room);
          }
          break;
        }

        case 'place_piece': {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'playing') return;

          const playerIdx = room.players.findIndex(p => p.id === currentPlayerId);
          if (playerIdx === -1 || room.turn !== playerIdx) return;

          const { x, y } = msg;
          if (x < 0 || x >= 9 || y < 0 || y >= 9 || room.board[y][x] !== null) return;

          room.board[y][x] = playerIdx;
          
          if (checkWin(room.board, playerIdx, room.players[playerIdx].trueCondition)) {
            room.winner = playerIdx;
            calculateScores(room, playerIdx);
            room.status = 'game_finished';
          } else {
            room.turn = (room.turn + 1) % room.players.length;
          }

          broadcast(room, { type: 'room_state', state: getPublicState(room) });
          
          if (room.status === 'playing') {
            checkAITurn(room);
          }
          break;
        }
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentPlayerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== currentPlayerId);
        if (room.players.length === 0) {
          rooms.delete(currentRoomId);
        } else {
          // Reassign colors if waiting
          if (room.status === 'waiting') {
            const colors = ['#ff00ff', '#00ffff', '#39ff14', '#8a2be2'];
            room.players.forEach((p, i) => {
              p.color = colors[i];
            });
          }
          broadcast(room, { type: 'room_state', state: getPublicState(room) });
        }
      }
    }
  });
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: ServerMessage) {
  const msgStr = JSON.stringify(msg);
  room.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(msgStr);
    }
  });
}

function getPublicState(room: Room): GameState {
  return {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      color: p.color,
      isAI: p.isAI,
      trueCondition: p.trueCondition,
      aiLevel: p.aiLevel,
      score: p.score,
      wins: p.wins
    })),
    board: room.board,
    turn: room.turn,
    status: room.status,
    candidates: room.candidates,
    winner: room.winner,
    totalGames: room.totalGames,
    currentGame: room.currentGame,
    settings: room.settings,
    lastGameResults: room.lastGameResults
  };
}

function checkAITurn(room: Room) {
  const currentPlayer = room.players[room.turn];
  if (currentPlayer.isAI) {
    setTimeout(() => {
      if (room.status !== 'playing') return;
      const move = getAIMove(room.board, room.turn, currentPlayer.trueCondition, currentPlayer.aiLevel || 'Normal');
      if (move) {
        room.board[move.y][move.x] = room.turn;
        if (checkWin(room.board, room.turn, currentPlayer.trueCondition)) {
          room.winner = room.turn;
          calculateScores(room, room.turn);
          room.status = 'game_finished';
        } else {
          room.turn = (room.turn + 1) % room.players.length;
        }
        broadcast(room, { type: 'room_state', state: getPublicState(room) });
        if (room.status === 'playing') {
          checkAITurn(room);
        }
      }
    }, 1000);
  }
}
