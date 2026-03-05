export const CONDITIONS = [
  { id: 1, name: "縦に4つ以上自分の駒を並べる", desc: "縦に4つ以上自分の駒を並べる" },
  { id: 2, name: "横に4つ以上自分の駒を並べる", desc: "横に4つ以上自分の駒を並べる" },
  { id: 3, name: "斜めに4つ以上自分の駒を並べる", desc: "斜めに4つ以上自分の駒を並べる" },
 
 
  { id: 9, name: "自分の駒3つで構成されるL字型を2つ以上作る", desc: "自分の駒3つで構成されるL字型を2つ以上作る" },
  { id: 10, name: "縦方向で「自色→他色→自色」の並びを1つ以上作る", desc: "縦方向で「自色→他色→自色」の並びを1つ以上作る" },
  { id: 11, name: "横方向で「自色→他色→自色」の並びを1つ以上作る", desc: "横方向で「自色→他色→自色」の並びを1つ以上作る" },
  { id: 12, name: "斜め方向で「自色→他色→自色」の並びを1つ以上作る", desc: "斜め方向で「自色→他色→自色」の並びを1つ以上作る" },
  { id: 13, name: "自分の駒で2x2の正方形を1つ以上作る", desc: "自分の駒で2x2の正方形を1つ以上作る" },
  { id: 14, name: "自分の駒で十字型（5マス）を1つ以上作る", desc: "自分の駒で十字型（5マス）を1つ以上作る" },
 

  
 


];

export function getCandidateCount(playerCount: number) {
  const rand = Math.random() * 100;
  if (playerCount === 2) {
    if (rand < 10) return 4;
    if (rand < 30) return 5;
    if (rand < 70) return 6;
    if (rand < 90) return 7;
    return 8;
  } else if (playerCount === 3) {
    if (rand < 15) return 6;
    if (rand < 40) return 7;
    if (rand < 70) return 8;
    if (rand < 90) return 9;
    return 10;
  } else {
    if (rand < 15) return 8;
    if (rand < 40) return 9;
    if (rand < 70) return 10;
    if (rand < 90) return 11;
    return 12;
  }
}

export function validateConditions(conditions: number[], playerCount: number): boolean {
  // Simulate first turn to ensure no immediate win is possible
  const emptyBoard = Array(9).fill(null).map(() => Array(9).fill(null));
  
  for (const condId of conditions) {
    let canWinFirstTurn = false;
    // Check every possible first move
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        emptyBoard[y][x] = 0; // Simulate player 0 placing a piece
        if (checkWin(emptyBoard, 0, condId)) {
          canWinFirstTurn = true;
        }
        emptyBoard[y][x] = null; // Revert
      }
    }
    if (canWinFirstTurn) return false; // Reject if any condition allows a first-turn win
  }
  
  return true;
}

export function checkWin(board: (number | null)[][], playerIdx: number, conditionId: number): boolean {
  const getP = (x: number, y: number) => board[y]?.[x] === playerIdx;
  const getOther = (x: number, y: number) => board[y]?.[x] !== null && board[y]?.[x] !== playerIdx;

  let count = 0;
  switch (conditionId) {
    case 1: // vertical 4+
      for (let x = 0; x < 9; x++) {
        let streak = 0;
        for (let y = 0; y < 9; y++) {
          if (getP(x, y)) { streak++; if (streak >= 4) return true; }
          else streak = 0;
        }
      }
      return false;
    case 2: // horizontal 4+
      for (let y = 0; y < 9; y++) {
        let streak = 0;
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) { streak++; if (streak >= 4) return true; }
          else streak = 0;
        }
      }
      return false;
    case 3: // diagonal 4+
      for (let y = 0; y <= 5; y++) {
        for (let x = 0; x <= 5; x++) {
          if (getP(x, y) && getP(x+1, y+1) && getP(x+2, y+2) && getP(x+3, y+3)) return true;
        }
      }
      for (let y = 0; y <= 5; y++) {
        for (let x = 3; x < 9; x++) {
          if (getP(x, y) && getP(x-1, y+1) && getP(x-2, y+2) && getP(x-3, y+3)) return true;
        }
      }
      return false;
    case 7: // two columns 5+
      const colCounts = Array(9).fill(0);
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 9; y++) {
          if (getP(x, y)) colCounts[x]++;
        }
      }
      colCounts.sort((a, b) => b - a);
      return colCounts[0] + colCounts[1] >= 5;
    case 8: // adjacent pairs 3+
      let pairs = 0;
      const used = Array(9).fill(0).map(() => Array(9).fill(false));
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y) && !used[y][x]) {
            if (x < 8 && getP(x+1, y) && !used[y][x+1]) {
              used[y][x] = true; used[y][x+1] = true; pairs++;
            } else if (y < 8 && getP(x, y+1) && !used[y+1][x]) {
              used[y][x] = true; used[y+1][x] = true; pairs++;
            }
          }
        }
      }
      return pairs >= 3;
    case 9: // L-shape 2+
      let lCount = 0;
      const lUsed = Array(9).fill(0).map(() => Array(9).fill(false));
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const p00 = getP(x,y)&&!lUsed[y][x], p10 = getP(x+1,y)&&!lUsed[y][x+1], p01 = getP(x,y+1)&&!lUsed[y+1][x], p11 = getP(x+1,y+1)&&!lUsed[y+1][x+1];
          if (p00 && p10 && p01) { lUsed[y][x]=lUsed[y][x+1]=lUsed[y+1][x]=true; lCount++; }
          else if (p10 && p01 && p11) { lUsed[y][x+1]=lUsed[y+1][x]=lUsed[y+1][x+1]=true; lCount++; }
          else if (p00 && p01 && p11) { lUsed[y][x]=lUsed[y+1][x]=lUsed[y+1][x+1]=true; lCount++; }
          else if (p00 && p10 && p11) { lUsed[y][x]=lUsed[y][x+1]=lUsed[y+1][x+1]=true; lCount++; }
        }
      }
      return lCount >= 2;
    case 10: // vSandwich
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y <= 6; y++) {
          if (getP(x, y) && getOther(x, y+1) && getP(x, y+2)) return true;
        }
      }
      return false;
    case 11: // hSandwich
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x <= 6; x++) {
          if (getP(x, y) && getOther(x+1, y) && getP(x+2, y)) return true;
        }
      }
      return false;
    case 12: // dSandwich
      for (let y = 0; y <= 6; y++) {
        for (let x = 0; x <= 6; x++) {
          if (getP(x, y) && getOther(x+1, y+1) && getP(x+2, y+2)) return true;
        }
        for (let x = 2; x < 9; x++) {
          if (getP(x, y) && getOther(x-1, y+1) && getP(x-2, y+2)) return true;
        }
      }
      return false;
    case 13: // square2x2
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (getP(x,y) && getP(x+1,y) && getP(x,y+1) && getP(x+1,y+1)) return true;
        }
      }
      return false;
    case 14: // cross
      for (let y = 1; y < 8; y++) {
        for (let x = 1; x < 8; x++) {
          if (getP(x,y) && getP(x-1,y) && getP(x+1,y) && getP(x,y-1) && getP(x,y+1)) return true;
        }
      }
      return false;
    case 15: // scattered 5+
      count = 0;
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) {
            const hasAdj = (x>0&&getP(x-1,y)) || (x<8&&getP(x+1,y)) || (y>0&&getP(x,y-1)) || (y<8&&getP(x,y+1));
            if (!hasAdj) count++;
          }
        }
      }
      return count >= 5;
    case 16: // 3 Columns
      const cols = new Set<number>();
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) cols.add(x);
        }
      }
      return cols.size >= 3;
    case 17: // 2 Pairs
      let pairCount = 0;
      const pairUsed = Array(9).fill(0).map(() => Array(9).fill(false));
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y) && !pairUsed[y][x]) {
            if (x < 8 && getP(x+1, y) && !pairUsed[y][x+1]) {
              pairUsed[y][x] = true; pairUsed[y][x+1] = true; pairCount++;
            } else if (y < 8 && getP(x, y+1) && !pairUsed[y+1][x]) {
              pairUsed[y][x] = true; pairUsed[y+1][x] = true; pairCount++;
            }
          }
        }
      }
      return pairCount >= 2;
    case 18: // 2 Blocks
      const blocks = new Map<string, number>();
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) {
            const bx = Math.floor(x / 3);
            const by = Math.floor(y / 3);
            const key = `${bx},${by}`;
            blocks.set(key, (blocks.get(key) || 0) + 1);
          }
        }
      }
      let validBlocks = 0;
      for (const c of blocks.values()) {
        if (c >= 2) validBlocks++;
      }
      return validBlocks >= 2;
  }
  return false;
}

export function getWinningPieces(board: (number | null)[][], playerIdx: number, conditionId: number): {x: number, y: number}[] {
  const getP = (x: number, y: number) => board[y]?.[x] === playerIdx;
  const getOther = (x: number, y: number) => board[y]?.[x] !== null && board[y]?.[x] !== playerIdx;
  const pieces: {x: number, y: number}[] = [];

  switch (conditionId) {
    case 1: // vertical 4+
      for (let x = 0; x < 9; x++) {
        let streak: {x: number, y: number}[] = [];
        for (let y = 0; y < 9; y++) {
          if (getP(x, y)) { streak.push({x, y}); if (streak.length >= 4) return streak; }
          else streak = [];
        }
      }
      break;
    case 2: // horizontal 4+
      for (let y = 0; y < 9; y++) {
        let streak: {x: number, y: number}[] = [];
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) { streak.push({x, y}); if (streak.length >= 4) return streak; }
          else streak = [];
        }
      }
      break;
    case 3: // diagonal 4+
      for (let y = 0; y <= 5; y++) {
        for (let x = 0; x <= 5; x++) {
          if (getP(x, y) && getP(x+1, y+1) && getP(x+2, y+2) && getP(x+3, y+3)) {
            return [{x,y}, {x:x+1,y:y+1}, {x:x+2,y:y+2}, {x:x+3,y:y+3}];
          }
        }
      }
      for (let y = 0; y <= 5; y++) {
        for (let x = 3; x < 9; x++) {
          if (getP(x, y) && getP(x-1, y+1) && getP(x-2, y+2) && getP(x-3, y+3)) {
            return [{x,y}, {x:x-1,y:y+1}, {x:x-2,y:y+2}, {x:x-3,y:y+3}];
          }
        }
      }
      break;
    case 7: // two columns 5+
      const colCounts = Array(9).fill(0).map((_, i) => ({ col: i, count: 0, pieces: [] as {x:number, y:number}[] }));
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 9; y++) {
          if (getP(x, y)) {
            colCounts[x].count++;
            colCounts[x].pieces.push({x, y});
          }
        }
      }
      colCounts.sort((a, b) => b.count - a.count);
      if (colCounts[0].count + colCounts[1].count >= 5) {
        return [...colCounts[0].pieces, ...colCounts[1].pieces];
      }
      break;
    case 8: // adjacent pairs 3+
      const used = Array(9).fill(0).map(() => Array(9).fill(false));
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y) && !used[y][x]) {
            if (x < 8 && getP(x+1, y) && !used[y][x+1]) {
              used[y][x] = true; used[y][x+1] = true;
              pieces.push({x, y}, {x:x+1, y});
            } else if (y < 8 && getP(x, y+1) && !used[y+1][x]) {
              used[y][x] = true; used[y+1][x] = true;
              pieces.push({x, y}, {x, y:y+1});
            }
          }
        }
      }
      if (pieces.length >= 6) return pieces.slice(0, 6);
      break;
    case 9: // L-shape 2+
      const lUsed = Array(9).fill(0).map(() => Array(9).fill(false));
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const p00 = getP(x,y)&&!lUsed[y][x], p10 = getP(x+1,y)&&!lUsed[y][x+1], p01 = getP(x,y+1)&&!lUsed[y+1][x], p11 = getP(x+1,y+1)&&!lUsed[y+1][x+1];
          if (p00 && p10 && p01) { lUsed[y][x]=lUsed[y][x+1]=lUsed[y+1][x]=true; pieces.push({x,y},{x:x+1,y},{x,y:y+1}); }
          else if (p10 && p01 && p11) { lUsed[y][x+1]=lUsed[y+1][x]=lUsed[y+1][x+1]=true; pieces.push({x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}); }
          else if (p00 && p01 && p11) { lUsed[y][x]=lUsed[y+1][x]=lUsed[y+1][x+1]=true; pieces.push({x,y},{x,y:y+1},{x:x+1,y:y+1}); }
          else if (p00 && p10 && p11) { lUsed[y][x]=lUsed[y][x+1]=lUsed[y+1][x+1]=true; pieces.push({x,y},{x:x+1,y},{x:x+1,y:y+1}); }
        }
      }
      if (pieces.length >= 6) return pieces.slice(0, 6);
      break;
    case 10: // vSandwich
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y <= 6; y++) {
          if (getP(x, y) && getOther(x, y+1) && getP(x, y+2)) return [{x,y}, {x,y:y+2}];
        }
      }
      break;
    case 11: // hSandwich
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x <= 6; x++) {
          if (getP(x, y) && getOther(x+1, y) && getP(x+2, y)) return [{x,y}, {x:x+2,y}];
        }
      }
      break;
    case 12: // dSandwich
      for (let y = 0; y <= 6; y++) {
        for (let x = 0; x <= 6; x++) {
          if (getP(x, y) && getOther(x+1, y+1) && getP(x+2, y+2)) return [{x,y}, {x:x+2,y:y+2}];
        }
        for (let x = 2; x < 9; x++) {
          if (getP(x, y) && getOther(x-1, y+1) && getP(x-2, y+2)) return [{x,y}, {x:x-2,y:y+2}];
        }
      }
      break;
    case 13: // square2x2
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (getP(x,y) && getP(x+1,y) && getP(x,y+1) && getP(x+1,y+1)) return [{x,y}, {x:x+1,y}, {x,y:y+1}, {x:x+1,y:y+1}];
        }
      }
      break;
    case 14: // cross
      for (let y = 1; y < 8; y++) {
        for (let x = 1; x < 8; x++) {
          if (getP(x,y) && getP(x-1,y) && getP(x+1,y) && getP(x,y-1) && getP(x,y+1)) return [{x,y}, {x:x-1,y}, {x:x+1,y}, {x,y:y-1}, {x,y:y+1}];
        }
      }
      break;
    case 15: // scattered 5+
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) {
            const hasAdj = (x>0&&getP(x-1,y)) || (x<8&&getP(x+1,y)) || (y>0&&getP(x,y-1)) || (y<8&&getP(x,y+1));
            if (!hasAdj) pieces.push({x, y});
          }
        }
      }
      if (pieces.length >= 5) return pieces;
      break;
    case 16: // 3 Columns
      const cols = new Map<number, {x:number, y:number}[]>();
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) {
            if (!cols.has(x)) cols.set(x, []);
            cols.get(x)!.push({x, y});
          }
        }
      }
      if (cols.size >= 3) {
        const res: {x: number, y: number}[] = [];
        let i = 0;
        for (const colPieces of cols.values()) {
          if (i < 3) res.push(...colPieces);
          i++;
        }
        return res;
      }
      break;
    case 17: // 2 Pairs
      const pairUsed = Array(9).fill(0).map(() => Array(9).fill(false));
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y) && !pairUsed[y][x]) {
            if (x < 8 && getP(x+1, y) && !pairUsed[y][x+1]) {
              pairUsed[y][x] = true; pairUsed[y][x+1] = true;
              pieces.push({x, y}, {x:x+1, y});
            } else if (y < 8 && getP(x, y+1) && !pairUsed[y+1][x]) {
              pairUsed[y][x] = true; pairUsed[y+1][x] = true;
              pieces.push({x, y}, {x, y:y+1});
            }
          }
        }
      }
      if (pieces.length >= 4) return pieces.slice(0, 4);
      break;
    case 18: // 2 Blocks
      const blocks = new Map<string, {x:number, y:number}[]>();
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (getP(x, y)) {
            const bx = Math.floor(x / 3);
            const by = Math.floor(y / 3);
            const key = `${bx},${by}`;
            if (!blocks.has(key)) blocks.set(key, []);
            blocks.get(key)!.push({x, y});
          }
        }
      }
      let validBlocks = 0;
      for (const bPieces of blocks.values()) {
        if (bPieces.length >= 2) {
          validBlocks++;
          pieces.push(...bPieces);
        }
      }
      if (validBlocks >= 2) return pieces;
      break;
  }
  return [];
}

export function getAIMove(
  board: (number | null)[][],
  playerIdx: number,
  trueCondition: number,
  level: string
): { x: number; y: number } | null {
  const SIZE = 9;
  const valid: {x:number,y:number}[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (board[y][x] === null) valid.push({x, y});
  if (valid.length === 0) return null;

  // Easy: ランダム
  if (level === 'Easy') {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // 自分がこのマスに置いたとき勝利するか
  const winsNow = (x: number, y: number, pIdx: number, cond: number): boolean => {
    board[y][x] = pIdx;
    const w = checkWin(board, pIdx, cond);
    board[y][x] = null;
    return w;
  };

  // Normal: 即勝利手があれば打つ。なければ自分の勝利条件に近づく手を選ぶ
  if (level === 'Normal') {
    for (const m of valid) if (winsNow(m.x, m.y, playerIdx, trueCondition)) return m;

    let best = valid[0], bestScore = -1;
    for (const m of valid) {
      board[m.y][m.x] = playerIdx;
      let score = 0;
      for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if(board[y][x]===playerIdx) score++;
      board[m.y][m.x] = null;
      score += Math.random() * 0.9;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // Hard: 即勝利 → 相手の即勝利を妨害 → 自分の進捗最大
  if (level === 'Hard') {
    for (const m of valid) if (winsNow(m.x, m.y, playerIdx, trueCondition)) return m;

    const blocking = new Set<string>();
    for (const m of valid) {
      for (const opp of [0,1,2,3].filter(i => i !== playerIdx)) {
        for (const cond of CONDITIONS) {
          if (winsNow(m.x, m.y, opp, cond.id)) blocking.add(`${m.x},${m.y}`);
        }
      }
    }

    if (blocking.size > 0) {
      const candidates = valid.filter(m => blocking.has(`${m.x},${m.y}`));
      let best = candidates[0], bestScore = -1;
      for (const m of candidates) {
        board[m.y][m.x] = playerIdx;
        let score = 0;
        for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if(board[y][x]===playerIdx) score++;
        board[m.y][m.x] = null;
        if (score > bestScore) { bestScore = score; best = m; }
      }
      return best;
    }

    let best = valid[0], bestScore = -1;
    for (const m of valid) {
      board[m.y][m.x] = playerIdx;
      let score = 0;
      for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if(board[y][x]===playerIdx) score++;
      board[m.y][m.x] = null;
      score += Math.random() * 0.5;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // Expert: 即勝利 → 相手脅威を重み付き評価 → 自分の進捗と妨害を同時最適化
  if (level === 'Expert') {
    for (const m of valid) if (winsNow(m.x, m.y, playerIdx, trueCondition)) return m;

    const scores = new Map<string, number>();
    for (const m of valid) scores.set(`${m.x},${m.y}`, 0);

    for (const m of valid) {
      const key = `${m.x},${m.y}`;
      let score = 0;

      // 自分の進捗
      board[m.y][m.x] = playerIdx;
      for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if(board[y][x]===playerIdx) score += 2;
      board[m.y][m.x] = null;

      // 相手の即勝利を阻止（最優先）
      for (const opp of [0,1,2,3].filter(i => i !== playerIdx)) {
        for (const cond of CONDITIONS) {
          if (winsNow(m.x, m.y, opp, cond.id)) score += 800;
        }
      }

      // 相手の進捗を遅らせる
      for (const opp of [0,1,2,3].filter(i => i !== playerIdx)) {
        board[m.y][m.x] = opp;
        let oppScore = 0;
        for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if(board[y][x]===opp) oppScore++;
        board[m.y][m.x] = null;
        score += oppScore * 0.8;
      }

      // 中央寄り優遇
      score += (2.5 - Math.abs(m.x - 2.5)) * 0.3;
      score += (2.5 - Math.abs(m.y - 2.5)) * 0.3;

      // 同スコア時の多様性
      score += Math.random() * 0.5;

      scores.set(key, score);
    }

    let best = valid[0], bestScore = -Infinity;
    for (const m of valid) {
      const s = scores.get(`${m.x},${m.y}`) ?? 0;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  return valid[Math.floor(Math.random() * valid.length)];
}
