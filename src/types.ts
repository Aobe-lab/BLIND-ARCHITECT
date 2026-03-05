export interface RoomSettings {
  maxPlayers: number;
  aiFill: boolean;
  totalGames: number;
  timeLimit: number;
  aiLevel: string;
}

export type Player = {
  id: string;
  color: string;
  isAI: boolean;
  trueCondition: number;
  aiLevel?: string;
  score: number;
  wins: number;
};

export type Room = {
  id: string;
  players: any[]; // Internal server representation
  board: (number | null)[][];
  turn: number;
  status: 'waiting' | 'playing' | 'game_finished' | 'match_finished';
  candidates: number[];
  winner?: number;
  playerCount: number;
  totalGames: number;
  currentGame: number;
  settings?: RoomSettings;
  lastGameResults?: {
    playerId: string;
    rank: number;
    points: number;
  }[];
};

export type GameState = {
  id: string;
  players: Player[];
  board: (number | null)[][];
  turn: number;
  status: 'waiting' | 'playing' | 'game_finished' | 'match_finished';
  candidates: number[];
  winner?: number;
  totalGames: number;
  currentGame: number;
  settings?: RoomSettings;
  lastGameResults?: {
    playerId: string;
    rank: number;
    points: number;
  }[];
};

export type Move = { x: number; y: number };

export type ClientMessage =
  | { type: 'create_room'; roomId: string; playerId: string; settings: RoomSettings }
  | { type: 'join_room'; roomId: string; playerId: string; isAI?: boolean; aiLevel?: string }
  | { type: 'remove_player'; playerId: string }
  | { type: 'update_settings'; totalGames: number }
  | { type: 'start_game' }
  | { type: 'next_game' }
  | { type: 'place_piece'; x: number; y: number };

export type ServerMessage =
  | { type: 'room_state'; state: GameState }
  | { type: 'game_started'; state: GameState; myTrueCondition: number }
  | { type: 'error'; message: string };
