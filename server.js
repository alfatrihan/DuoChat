const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const accounts = require('./accounts');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Map of username -> Set of socket.ids
const onlineUsers = new Map();
// Map of socket.id -> username
const socketToUser = new Map();
// Map of conversationKey -> active game state
const activeGames = new Map();

function isUserOnline(username) {
  const set = onlineUsers.get((username || '').toLowerCase());
  return Boolean(set && set.size > 0);
}

function emitToUser(username, event, payload) {
  const set = onlineUsers.get((username || '').toLowerCase());
  if (set) {
    set.forEach(sid => io.to(sid).emit(event, payload));
  }
}

function pushDashboardUpdate(username) {
  const data = accounts.getUserDashboardData(username, {
    get: u => isUserOnline(u)
  });
  if (data) {
    emitToUser(username, 'dashboard:update', data);
  }
}

// --- REST API ENDPOINTS ---
app.get('/api/avatars', (req, res) => {
  res.json({ avatars: accounts.AVATARS });
});

app.post('/api/register', (req, res) => {
  const result = accounts.registerUser(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.post('/api/login', (req, res) => {
  const result = accounts.loginUser(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

// --- MINI-GAME ENGINES ---
function generateMathQuestion() {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === '+') {
    a = Math.floor(Math.random() * 45) + 12;
    b = Math.floor(Math.random() * 45) + 12;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 50) + 30;
    b = Math.floor(Math.random() * 28) + 5;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 11) + 3;
    b = Math.floor(Math.random() * 11) + 3;
    answer = a * b;
  }

  const optionsSet = new Set([answer]);
  while (optionsSet.size < 4) {
    const offset = (Math.floor(Math.random() * 9) - 4) || 2;
    const candidate = answer + offset;
    if (candidate >= 0) optionsSet.add(candidate);
  }
  const options = Array.from(optionsSet).sort(() => Math.random() - 0.5);
  return { expression: `${a} ${op} ${b}`, answer, options };
}

function createInitialGameState(gameType, host, guest) {
  const base = {
    id: 'game_' + Date.now(),
    gameType,
    players: [host, guest],
    scores: { [host]: 0, [guest]: 0 },
    status: 'active',
    winner: null,
    message: ''
  };

  if (gameType === 'rps') {
    return {
      ...base,
      round: 1,
      choices: { [host]: null, [guest]: null },
      lastRound: null,
      message: 'Pick Rock, Paper, or Scissors!'
    };
  }

  if (gameType === 'ttt') {
    return {
      ...base,
      board: Array(9).fill(null),
      symbols: { [host]: 'X', [guest]: 'O' },
      turn: host,
      winningLine: null,
      message: `${host}'s turn (X)`
    };
  }

  if (gameType === 'c4') {
    // 6 rows x 7 cols
    return {
      ...base,
      board: Array.from({ length: 6 }, () => Array(7).fill(null)),
      colors: { [host]: 'red', [guest]: 'yellow' },
      turn: host,
      winningCells: [],
      message: `${host}'s turn (Red Disc)`
    };
  }

  if (gameType === 'math') {
    const q = generateMathQuestion();
    return {
      ...base,
      round: 1,
      maxRounds: 5,
      question: q,
      answeredThisRound: false,
      lastRoundWinner: null,
      message: 'Round 1/5: First to tap the right answer scores!'
    };
  }

  return base;
}

function sanitizeGameForUser(game, viewer) {
  if (!game) return null;
  const copy = JSON.parse(JSON.stringify(game));
  // Hide opponent's unrevealed choice in Rock Paper Scissors
  if (copy.gameType === 'rps' && copy.choices) {
    const [p1, p2] = copy.players;
    const bothChosen = Boolean(copy.choices[p1] && copy.choices[p2]);
    if (!bothChosen) {
      copy.PlayersSubmitted = {
        [p1]: Boolean(copy.choices[p1]),
        [p2]: Boolean(copy.choices[p2])
      };
      Object.keys(copy.choices).forEach(u => {
        if (u !== viewer && copy.choices[u]) {
          copy.choices[u] = 'hidden';
        }
      });
    }
  }
  // Hide exact answer in Math Duel
  if (copy.gameType === 'math' && copy.question) {
    delete copy.question.answer;
  }
  return copy;
}

function broadcastGameState(convKey, game) {
  if (!game) return;
  game.players.forEach(p => {
    emitToUser(p, 'game:state', {
      partner: game.players.find(x => x !== p),
      game: sanitizeGameForUser(game, p)
    });
  });
}

function checkTTTWin(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a], line: [a, b, c] };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { symbol: 'draw', line: [] };
  }
  return null;
}

function checkConnect4Win(board) {
  const rows = 6;
  const cols = 7;
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of directions) {
        const cells = [[r, c]];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === player) {
            cells.push([nr, nc]);
          } else {
            break;
          }
        }
        if (cells.length === 4) {
          return { winner: player, cells };
        }
      }
    }
  }
  const isFull = board[0].every(cell => cell !== null);
  if (isFull) return { winner: 'draw', cells: [] };
  return null;
}

// --- SOCKET.IO REAL-TIME ENGINE ---
io.on('connection', (socket) => {
  socket.on('auth:bind', ({ username }) => {
    if (!username) return;
    const clean = username.toLowerCase();
    socketToUser.set(socket.id, clean);

    if (!onlineUsers.has(clean)) {
      onlineUsers.set(clean, new Set());
    }
    onlineUsers.get(clean).add(socket.id);

    pushDashboardUpdate(clean);

    // Notify all friends that this user is now online
    const myData = accounts.getUserDashboardData(clean, { get: u => isUserOnline(u) });
    if (myData && myData.friends) {
      myData.friends.forEach(f => pushDashboardUpdate(f.username));
    }
  });

  socket.on('profile:update', (payload) => {
    const me = socketToUser.get(socket.id);
    if (!me) return;
    const res = accounts.updateProfile(me, payload || {});
    if (res.error) {
      socket.emit('toast', { type: 'error', message: res.error });
      return;
    }
    socket.emit('toast', { type: 'success', message: 'Profile & Avatar updated!' });
    pushDashboardUpdate(me);
    const myData = accounts.getUserDashboardData(me, { get: u => isUserOnline(u) });
    if (myData && myData.friends) {
      myData.friends.forEach(f => pushDashboardUpdate(f.username));
    }
  });

  socket.on('users:search', ({ query }) => {
    const me = socketToUser.get(socket.id);
    if (!me) return;
    const results = accounts.searchUsers(query, me).map(u => ({
      ...u,
      online: isUserOnline(u.username)
    }));
    socket.emit('users:searchResults', { results });
  });

  socket.on('friends:request', ({ toUsername }) => {
    const me = socketToUser.get(socket.id);
    if (!me) return;
    const res = accounts.sendFriendRequest(me, toUsername);
    if (res.error) {
      socket.emit('toast', { type: 'error', message: res.error });
      return;
    }
    if (res.status === 'accepted') {
      socket.emit('toast', { type: 'success', message: `You and @${toUsername} are now friends!` });
      emitToUser(toUsername, 'toast', { type: 'success', message: `@${me} accepted your friend request!` });
    } else {
      socket.emit('toast', { type: 'success', message: `Friend request sent to @${toUsername}!` });
      emitToUser(toUsername, 'toast', { type: 'info', message: `New friend request from @${me}!` });
    }
    pushDashboardUpdate(me);
    pushDashboardUpdate(toUsername);
  });

  socket.on('friends:respond', ({ requesterUsername, action }) => {
    const me = socketToUser.get(socket.id);
    if (!me) return;
    const res = accounts.respondToFriendRequest(me, requesterUsername, action);
    if (res.error) {
      socket.emit('toast', { type: 'error', message: res.error });
      return;
    }
    if (res.status === 'accepted') {
      socket.emit('toast', { type: 'success', message: `You and @${requesterUsername} can now chat!` });
      emitToUser(requesterUsername, 'toast', { type: 'success', message: `@${me} accepted your friend request!` });
    } else {
      socket.emit('toast', { type: 'info', message: `Declined request from @${requesterUsername}.` });
    }
    pushDashboardUpdate(me);
    pushDashboardUpdate(requesterUsername);
  });

  socket.on('chat:open', ({ partnerUsername }) => {
    const me = socketToUser.get(socket.id);
    if (!me || !partnerUsername) return;
    const partner = partnerUsername.toLowerCase();

    // Enforce strict Friend-Only privacy
    if (!accounts.areFriends(me, partner)) {
      socket.emit('toast', { type: 'error', message: 'Privacy check: You can only chat after your friend request is accepted.' });
      return;
    }

    accounts.markMessagesRead(me, partner);
    const messages = accounts.getConversationMessages(me, partner);
    socket.emit('chat:history', { partner, messages });

    pushDashboardUpdate(me);
    emitToUser(partner, 'chat:readReceipt', { reader: me });

    // Sync active mini-game if one exists for this conversation
    const convKey = accounts.getConversationKey(me, partner);
    const game = activeGames.get(convKey);
    socket.emit('game:state', {
      partner,
      game: game ? sanitizeGameForUser(game, me) : null
    });
  });

  socket.on('chat:send', ({ to, text, mood }) => {
    const me = socketToUser.get(socket.id);
    if (!me || !to || !text || !text.trim()) return;
    const partner = to.toLowerCase();

    if (!accounts.areFriends(me, partner)) {
      socket.emit('toast', { type: 'error', message: 'You must be friends to send messages.' });
      return;
    }

    const msgObj = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      from: me,
      to: partner,
      text: text.trim().slice(0, 1000),
      mood: mood || null,
      timestamp: Date.now(),
      read: false
    };

    accounts.addMessage(me, partner, msgObj);
    emitToUser(me, 'chat:message', msgObj);
    emitToUser(partner, 'chat:message', msgObj);

    pushDashboardUpdate(me);
    pushDashboardUpdate(partner);
  });

  socket.on('chat:typing', ({ to, isTyping }) => {
    const me = socketToUser.get(socket.id);
    if (!me || !to) return;
    if (!accounts.areFriends(me, to)) return;
    emitToUser(to, 'chat:typing', { from: me, isTyping: Boolean(isTyping) });
  });

  socket.on('chat:markRead', ({ partnerUsername }) => {
    const me = socketToUser.get(socket.id);
    if (!me || !partnerUsername) return;
    const updated = accounts.markMessagesRead(me, partnerUsername);
    if (updated) {
      pushDashboardUpdate(me);
      emitToUser(partnerUsername, 'chat:readReceipt', { reader: me });
    }
  });

  // --- REAL-TIME 2-PLAYER MINI-GAMES ---
  socket.on('game:start', ({ partnerUsername, gameType }) => {
    const me = socketToUser.get(socket.id);
    if (!me || !partnerUsername) return;
    const partner = partnerUsername.toLowerCase();

    if (!accounts.areFriends(me, partner)) {
      socket.emit('toast', { type: 'error', message: 'You can only play games with accepted friends.' });
      return;
    }

    const validTypes = ['rps', 'ttt', 'c4', 'math'];
    if (!validTypes.includes(gameType)) return;

    const convKey = accounts.getConversationKey(me, partner);
    const existing = activeGames.get(convKey);
    const game = createInitialGameState(gameType, me, partner);

    // Preserve session scoreboard if restarting the same game
    if (existing && existing.gameType === gameType && existing.scores) {
      game.scores = existing.scores;
    }

    activeGames.set(convKey, game);
    broadcastGameState(convKey, game);

    const gameNames = {
      rps: 'Rock Paper Scissors',
      ttt: 'Tic-Tac-Toe',
      c4: 'Connect Four',
      math: 'Quick Math Duel'
    };
    emitToUser(partner, 'toast', {
      type: 'info',
      message: `@${me} started ${gameNames[gameType]}!`
    });
  });

  socket.on('game:action', ({ partnerUsername, action }) => {
    const me = socketToUser.get(socket.id);
    if (!me || !partnerUsername || !action) return;
    const partner = partnerUsername.toLowerCase();
    const convKey = accounts.getConversationKey(me, partner);
    const game = activeGames.get(convKey);
    if (!game) return;

    // Reset / Next Round handler
    if (action.type === 'rematch') {
      const nextGame = createInitialGameState(game.gameType, me, partner);
      nextGame.scores = game.scores;
      activeGames.set(convKey, nextGame);
      broadcastGameState(convKey, nextGame);
      return;
    }

    if (action.type === 'close') {
      activeGames.delete(convKey);
      emitToUser(me, 'game:state', { partner, game: null });
      emitToUser(partner, 'game:state', { partner: me, game: null });
      return;
    }

    // 1. ROCK PAPER SCISSORS
    if (game.gameType === 'rps' && action.type === 'pick') {
      const move = action.move;
      if (!['rock', 'paper', 'scissors'].includes(move)) return;
      if (game.choices[me]) return; // already locked in

      game.choices[me] = move;
      const [p1, p2] = game.players;
      const c1 = game.choices[p1];
      const c2 = game.choices[p2];

      if (c1 && c2) {
        let roundWinner = 'draw';
        const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
        if (c1 === c2) {
          roundWinner = 'draw';
          game.message = `Both picked ${c1.toUpperCase()} — It's a Draw!`;
        } else if (beats[c1] === c2) {
          roundWinner = p1;
          game.scores[p1] = (game.scores[p1] || 0) + 1;
          game.message = `@${p1} wins Round ${game.round}! (${c1} beats ${c2})`;
        } else {
          roundWinner = p2;
          game.scores[p2] = (game.scores[p2] || 0) + 1;
          game.message = `@${p2} wins Round ${game.round}! (${c2} beats ${c1})`;
        }

        game.lastRound = {
          round: game.round,
          choices: { [p1]: c1, [p2]: c2 },
          winner: roundWinner
        };
        game.round += 1;
        game.choices = { [p1]: null, [p2]: null };
      } else {
        const waitingFor = c1 ? p2 : p1;
        game.message = `@${me} locked in! Waiting for @${waitingFor}...`;
      }

      broadcastGameState(convKey, game);
      return;
    }

    // 2. TIC-TAC-TOE
    if (game.gameType === 'ttt' && action.type === 'cell') {
      if (game.status !== 'active' || game.turn !== me) return;
      const idx = Number(action.index);
      if (isNaN(idx) || idx < 0 || idx > 8 || game.board[idx] !== null) return;

      game.board[idx] = game.symbols[me];
      const result = checkTTTWin(game.board);

      if (result) {
        game.status = 'finished';
        if (result.symbol === 'draw') {
          game.winner = 'draw';
          game.message = "It's a Draw! Well played both.";
        } else {
          game.winner = me;
          game.winningLine = result.line;
          game.scores[me] = (game.scores[me] || 0) + 1;
          game.message = `@${me} (${game.symbols[me]}) wins the round!`;
        }
      } else {
        const nextTurn = game.players.find(p => p !== me);
        game.turn = nextTurn;
        game.message = `@${nextTurn}'s turn (${game.symbols[nextTurn]})`;
      }

      broadcastGameState(convKey, game);
      return;
    }

    // 3. CONNECT FOUR
    if (game.gameType === 'c4' && action.type === 'drop') {
      if (game.status !== 'active' || game.turn !== me) return;
      const col = Number(action.col);
      if (isNaN(col) || col < 0 || col > 6) return;

      let placedRow = -1;
      for (let r = 5; r >= 0; r--) {
        if (game.board[r][col] === null) {
          game.board[r][col] = me;
          placedRow = r;
          break;
        }
      }
      if (placedRow === -1) return; // column full

      const result = checkConnect4Win(game.board);
      if (result) {
        game.status = 'finished';
        if (result.winner === 'draw') {
          game.winner = 'draw';
          game.message = 'Board is full — Draw game!';
        } else {
          game.winner = me;
          game.winningCells = result.cells;
          game.scores[me] = (game.scores[me] || 0) + 1;
          game.message = `@${me} connected FOUR and wins!`;
        }
      } else {
        const nextTurn = game.players.find(p => p !== me);
        game.turn = nextTurn;
        game.message = `@${nextTurn}'s turn (${game.colors[nextTurn].toUpperCase()})`;
      }

      broadcastGameState(convKey, game);
      return;
    }

    // 4. QUICK MATH DUEL
    if (game.gameType === 'math' && action.type === 'answer') {
      if (game.status !== 'active' || game.answeredThisRound) return;
      const val = Number(action.value);
      const correct = game.question.answer;
      const other = game.players.find(p => p !== me);

      game.answeredThisRound = true;
      if (val === correct) {
        game.scores[me] = (game.scores[me] || 0) + 1;
        game.lastRoundWinner = me;
        game.message = `Correct! @${me} answered ${correct} first! (+1 pt)`;
      } else {
        game.scores[other] = (game.scores[other] || 0) + 1;
        game.lastRoundWinner = other;
        game.message = `Oops! @${me} picked ${val} (Ans: ${correct}). Point to @${other}!`;
      }

      if (game.round >= game.maxRounds) {
        game.status = 'finished';
        const sMe = game.scores[me] || 0;
        const sOther = game.scores[other] || 0;
        if (sMe > sOther) {
          game.winner = me;
          game.message = `Math Duel Complete! @${me} wins (${sMe} - ${sOther})!`;
        } else if (sOther > sMe) {
          game.winner = other;
          game.message = `Math Duel Complete! @${other} wins (${sOther} - ${sMe})!`;
        } else {
          game.winner = 'draw';
          game.message = `Math Duel Tied (${sMe} - ${sOther})!`;
        }
        broadcastGameState(convKey, game);
      } else {
        broadcastGameState(convKey, game);
        setTimeout(() => {
          const current = activeGames.get(convKey);
          if (!current || current.id !== game.id || current.status !== 'active') return;
          current.round += 1;
          current.question = generateMathQuestion();
          current.answeredThisRound = false;
          current.message = `Round ${current.round}/${current.maxRounds}: Solve fast!`;
          broadcastGameState(convKey, current);
        }, 1600);
      }
    }
  });

  socket.on('disconnect', () => {
    const clean = socketToUser.get(socket.id);
    socketToUser.delete(socket.id);
    if (clean && onlineUsers.has(clean)) {
      const set = onlineUsers.get(clean);
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(clean);
      }
      const myData = accounts.getUserDashboardData(clean, { get: u => isUserOnline(u) });
      if (myData && myData.friends) {
        myData.friends.forEach(f => pushDashboardUpdate(f.username));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`DuoChat Messenger Server running at http://localhost:${PORT}`);
});