import React from 'react';
import { motion } from 'motion/react';
import { GameState } from '../shared/types.js';

interface BoardProps {
  state: GameState;
  myPlayerId: string;
  onPlacePiece: (x: number, y: number) => void;
  winningPieces?: {x: number, y: number}[];
}

export function Board({ state, myPlayerId, onPlacePiece, winningPieces = [] }: BoardProps) {
  const myIndex = state.players.findIndex((p) => p.id === myPlayerId);
  const isMyTurn = state.turn === myIndex && state.status === 'playing';

  const isWinningPiece = (x: number, y: number) => {
    return winningPieces.some(p => p.x === x && p.y === y);
  };

  return (
    <div className="relative w-full h-full aspect-square mx-auto">
      <div className="absolute inset-0 holo-grid rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.1)] border border-holo-blue/30">
        <div className="grid grid-cols-9 grid-rows-9 w-full h-full">
          {state.board.map((row, y) =>
            row.map((cell, x) => {
              const winning = isWinningPiece(x, y);
              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative border-r border-b border-holo-blue/20 flex items-center justify-center
                    ${isMyTurn && cell === null ? 'hover:bg-holo-blue/10 cursor-pointer transition-colors' : ''}
                    ${winning ? 'bg-white/20' : ''}
                  `}
                  onClick={() => {
                    if (isMyTurn && cell === null) {
                      onPlacePiece(x, y);
                    }
                  }}
                >
                  {cell !== null && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className={`w-[70%] h-[70%] rounded-full shadow-[0_0_15px_currentColor] ${winning ? 'animate-pulse scale-110' : ''}`}
                      style={{
                        backgroundColor: state.players[cell].color,
                        color: state.players[cell].color,
                        boxShadow: winning ? `0 0 30px ${state.players[cell].color}` : undefined
                      }}
                    >
                      <div className="ripple" style={{ color: state.players[cell].color }} />
                    </motion.div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
