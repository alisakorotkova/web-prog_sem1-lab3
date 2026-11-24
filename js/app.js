'use strict';

const board = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const restartButton = document.querySelector('#restart-button');
const undoButton = document.querySelector('#undo-button');
const leadersButton = document.querySelector('#leaders-button');

const gameOverDialog = document.querySelector('#game-over-dialog');
const finalScoreElement = document.querySelector('#final-score');
const recordForm = document.querySelector('#record-form');
const playerNameInput = document.querySelector('#player-name');
const recordMessage = document.querySelector('#record-message');
const gameOverRestart = document.querySelector('#game-over-restart');
const gameOverLeaders = document.querySelector('#game-over-leaders');

const leadersDialog = document.querySelector('#leaders-dialog');
const closeLeadersButton = document.querySelector('#close-leaders');
const leadersEmpty = document.querySelector('#leaders-empty');
const leadersTableWrapper = document.querySelector('#leaders-table-wrapper');
const leadersBody = document.querySelector('#leaders-body');

const boardSize = 4;
const cellCount = boardSize * boardSize;
const storageKey = 'christmas-2048.game.v1';
const tileElements = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

let tiles = [];
let nextId = 1;
let score = 0;
let bestScore = 0;
let gameOver = false;
let isMoving = false;
let previousState = null;
let storageMessage = '';
let leaderboard = [];
let resultSaved = false;

const directions = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down'
};

const tileLayer = document.createElement('div');
tileLayer.className = 'tile-layer';

const gameMessage = document.createElement('p');
gameMessage.className = 'stage-note';
gameMessage.setAttribute('role', 'status');
gameMessage.hidden = true;

function createBoard() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < cellCount; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('aria-hidden', 'true');
    fragment.append(cell);
  }

  fragment.append(tileLayer);
  board.replaceChildren(fragment);
  board.after(gameMessage);
}

function getTransform(index) {
  const row = Math.floor(index / boardSize);
  const column = index % boardSize;

  return `translate(
    calc(${column} * (100% + var(--gap))),
    calc(${row} * (100% + var(--gap)))
  )`;
}

function animate(element, frames, duration) {
  if (reducedMotion.matches) {
    return Promise.resolve();
  }

  const animation = element.animate(frames, {
    duration,
    easing: 'ease-out'
  });

  return animation.finished.catch(() => {});
}

function updateTileElement(tile) {
  const element = tileElements.get(tile.id);
  const row = Math.floor(tile.index / boardSize) + 1;
  const column = tile.index % boardSize + 1;

  element.dataset.value = String(tile.value);
  element.firstElementChild.textContent = String(tile.value);
  element.style.transform = getTransform(tile.index);
  element.style.backgroundColor = '';
  element.style.color = '';
  element.style.fontSize = '';

  if (tile.value > 2048) {
    const hue = (Math.log2(tile.value) * 37) % 360;

    element.style.backgroundColor = `hsl(${hue} 35% 28%)`;
    element.style.color = '#ffffff';
    element.style.fontSize = 'clamp(14px, 4vw, 24px)';
  }

  element.setAttribute(
    'aria-label',
    `Строка ${row}, столбец ${column}: ${tile.value}`
  );
}

function createTileElement(tile) {
  const element = document.createElement('div');
  const number = document.createElement('span');

  element.className = 'tile game-tile';
  element.append(number);
  tileLayer.append(element);
  tileElements.set(tile.id, element);

  updateTileElement(tile);

  return element;
}

function addRandomTile() {
  const occupiedIndexes = new Set(tiles.map((tile) => tile.index));
  const emptyIndexes = [];

  for (let index = 0; index < cellCount; index += 1) {
    if (!occupiedIndexes.has(index)) {
      emptyIndexes.push(index);
    }
  }

  if (emptyIndexes.length === 0) {
    return Promise.resolve();
  }

  const randomIndex = Math.floor(Math.random() * emptyIndexes.length);

  const tile = {
    id: nextId,
    value: Math.random() < 0.9 ? 2 : 4,
    index: emptyIndexes[randomIndex]
  };

  nextId += 1;
  tiles.push(tile);

  const element = createTileElement(tile);

  return animate(
    element.firstElementChild,
    [
      { opacity: 0, transform: 'scale(0.5)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    140
  );
}

function getSnapshot() {
  const values = Array(cellCount).fill(0);

  for (const tile of tiles) {
    values[tile.index] = tile.value;
  }

  return { values, score };
}

function isValidSnapshot(snapshot) {
  if (
    !snapshot ||
    !Number.isSafeInteger(snapshot.score) ||
    snapshot.score < 0 ||
    !Array.isArray(snapshot.values) ||
    snapshot.values.length !== cellCount
  ) {
    return false;
  }

  const validValues = snapshot.values.every((value) => {
    return value === 0 || (
      Number.isSafeInteger(value) &&
      value >= 2 &&
      Number.isInteger(Math.log2(value))
    );
  });

  return validValues && snapshot.values.some((value) => value !== 0);
}

function restoreSnapshot(snapshot) {
  tiles = [];
  tileElements.clear();
  tileLayer.replaceChildren();
  score = snapshot.score;

  snapshot.values.forEach((value, index) => {
    if (value === 0) {
      return;
    }

    const tile = {
      id: nextId,
      value,
      index
    };

    nextId += 1;
    tiles.push(tile);
    createTileElement(tile);
  });

  gameOver = !hasAvailableMoves();
}

function isValidRecord(record) {
  return (
    record !== null &&
    typeof record === 'object' &&
    typeof record.name === 'string' &&
    record.name.trim().length > 0 &&
    record.name.length <= 24 &&
    Number.isSafeInteger(record.score) &&
    record.score >= 0 &&
    typeof record.date === 'string' &&
    Number.isFinite(Date.parse(record.date))
  );
}

function sortRecords(records) {
  return [...records].sort((first, second) => {
    return second.score - first.score ||
      Date.parse(first.date) - Date.parse(second.date);
  });
}

function saveGame() {
  const data = {
    version: 1,
    current: getSnapshot(),
    previous: previousState,
    bestScore,
    leaderboard,
    resultSaved
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    storageMessage = '';
    return true;
  } catch {
    storageMessage =
      'Браузер не смог сохранить данные. После обновления прогресс может потеряться.';
    return false;
  }
}

function loadGame() {
  try {
    const saved = localStorage.getItem(storageKey);

    if (saved === null) {
      return false;
    }

    const data = JSON.parse(saved);

    if (!data || data.version !== 1) {
      storageMessage =
        'Не удалось прочитать сохранение. Начата новая партия.';
      return false;
    }

    leaderboard = Array.isArray(data.leaderboard)
      ? sortRecords(data.leaderboard.filter(isValidRecord)).slice(0, 10)
      : [];

    const savedBest = Number.isSafeInteger(data.bestScore)
      ? data.bestScore
      : 0;

    bestScore = Math.max(
      0,
      savedBest,
      ...leaderboard.map((record) => record.score)
    );

    if (!isValidSnapshot(data.current)) {
      storageMessage =
        'Сохранённое поле повреждено. Начата новая партия.';
      return false;
    }

    restoreSnapshot(data.current);

    previousState = !gameOver && isValidSnapshot(data.previous)
      ? data.previous
      : null;

    bestScore = Math.max(bestScore, score, previousState?.score ?? 0);
    resultSaved = gameOver && data.resultSaved === true;

    return true;
  } catch {
    storageMessage =
      'Не удалось восстановить игру. Начата новая партия.';
    return false;
  }
}

function updateGameOverDialog() {
  finalScoreElement.textContent = String(score);
  recordForm.hidden = resultSaved;

  if (resultSaved) {
    recordMessage.hidden = false;
    recordMessage.classList.remove('is-error');
    recordMessage.textContent = 'Ваш рекорд сохранён';
  }

  if (!gameOverDialog.open) {
    gameOverDialog.showModal();
  }
}

function updateInterface() {
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);

  restartButton.disabled = isMoving;
  leadersButton.disabled = isMoving;
  undoButton.disabled = isMoving || gameOver || previousState === null;

  gameMessage.hidden = !storageMessage;
  gameMessage.textContent = storageMessage;

  if (gameOver && !isMoving && !leadersDialog.open) {
    updateGameOverDialog();
  }
}

function startNewGame() {
  if (isMoving) {
    return;
  }

  tiles = [];
  score = 0;
  gameOver = false;
  previousState = null;
  resultSaved = false;

  gameOverDialog.close();
  leadersDialog.close();

  recordForm.reset();
  playerNameInput.setCustomValidity('');
  recordForm.hidden = false;
  recordMessage.hidden = true;
  recordMessage.textContent = '';
  recordMessage.classList.remove('is-error');

  tileElements.clear();
  tileLayer.replaceChildren();

  addRandomTile();
  addRandomTile();

  saveGame();
  updateInterface();
}

function undoMove() {
  if (
    isMoving ||
    gameOver ||
    leadersDialog.open ||
    previousState === null
  ) {
    return;
  }

  const snapshot = previousState;
  previousState = null;

  restoreSnapshot(snapshot);
  saveGame();
  updateInterface();

  restartButton.focus();
}

function renderLeaderboard() {
  leadersBody.replaceChildren();

  leadersEmpty.hidden = leaderboard.length > 0;
  leadersTableWrapper.hidden = leaderboard.length === 0;

  for (const record of leaderboard) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const scoreCell = document.createElement('td');
    const dateCell = document.createElement('td');
    const time = document.createElement('time');

    nameCell.textContent = record.name;
    scoreCell.textContent = String(record.score);
    time.dateTime = record.date;
    time.textContent = dateFormatter.format(new Date(record.date));

    dateCell.append(time);
    row.append(nameCell, scoreCell, dateCell);
    leadersBody.append(row);
  }
}

function openLeaderboard() {
  if (isMoving || leadersDialog.open) {
    return;
  }

  renderLeaderboard();
  gameOverDialog.close();
  leadersDialog.showModal();
}

function saveResult(event) {
  event.preventDefault();

  if (!gameOver || resultSaved) {
    return;
  }

  const name = playerNameInput.value.trim();

  if (!name) {
    playerNameInput.setCustomValidity('Введи имя.');
    playerNameInput.reportValidity();
    return;
  }

  const oldLeaderboard = leaderboard;

  const record = {
    name,
    score,
    date: new Date().toISOString()
  };

  leaderboard = sortRecords([...leaderboard, record]).slice(0, 10);
  resultSaved = true;

  if (!saveGame()) {
    leaderboard = oldLeaderboard;
    resultSaved = false;

    recordMessage.hidden = false;
    recordMessage.classList.add('is-error');
    recordMessage.textContent =
      'Не удалось сохранить результат. Попробуй ещё раз.';

    updateInterface();
    return;
  }

  updateInterface();
  gameOverRestart.focus();
}

function getLineIndexes(direction, lineIndex) {
  const indexes = [];

  for (let offset = 0; offset < boardSize; offset += 1) {
    switch (direction) {
      case 'left':
        indexes.push(lineIndex * boardSize + offset);
        break;

      case 'right':
        indexes.push(lineIndex * boardSize + boardSize - 1 - offset);
        break;

      case 'up':
        indexes.push(offset * boardSize + lineIndex);
        break;

      case 'down':
        indexes.push((boardSize - 1 - offset) * boardSize + lineIndex);
        break;
    }
  }

  return indexes;
}

function planStep(direction) {
  const positions = new Map(tiles.map((tile) => [tile.index, tile]));
  const movements = [];
  const merges = [];

  for (let lineIndex = 0; lineIndex < boardSize; lineIndex += 1) {
    const indexes = getLineIndexes(direction, lineIndex);
    const line = indexes.map((index) => positions.get(index)).filter(Boolean);
    let destination = 0;

    for (let position = 0; position < line.length; position += 1) {
      const first = line[position];
      const second = line[position + 1];
      const targetIndex = indexes[destination];

      movements.push({ tile: first, targetIndex });

      if (second && first.value === second.value) {
        movements.push({ tile: second, targetIndex });
        merges.push({ first, second });
        position += 1;
      }

      destination += 1;
    }
  }

  const changed = movements.some(
    ({ tile, targetIndex }) => tile.index !== targetIndex
  );

  return { movements, merges, changed };
}

async function playStep(step) {
  const animations = step.movements.map(({ tile, targetIndex }) => {
    const element = tileElements.get(tile.id);
    const from = getTransform(tile.index);
    const to = getTransform(targetIndex);

    element.style.transform = to;

    if (tile.index === targetIndex) {
      return Promise.resolve();
    }

    return animate(element, [{ transform: from }, { transform: to }], 140);
  });

  await Promise.all(animations);

  for (const { tile, targetIndex } of step.movements) {
    tile.index = targetIndex;
  }

  const removedIds = new Set();
  const mergeAnimations = [];

  for (const { first, second } of step.merges) {
    first.value *= 2;
    score += first.value;

    removedIds.add(second.id);
    tileElements.get(second.id).remove();
    tileElements.delete(second.id);

    updateTileElement(first);

    const number = tileElements.get(first.id).firstElementChild;

    mergeAnimations.push(
      animate(
        number,
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.16)', offset: 0.5 },
          { transform: 'scale(1)' }
        ],
        130
      )
    );
  }

  tiles = tiles.filter((tile) => !removedIds.has(tile.id));

  for (const tile of tiles) {
    updateTileElement(tile);
  }

  bestScore = Math.max(bestScore, score);
  updateInterface();

  await Promise.all(mergeAnimations);
}

function hasAvailableMoves() {
  if (tiles.length < cellCount) {
    return true;
  }

  const values = Array(cellCount).fill(0);

  for (const tile of tiles) {
    values[tile.index] = tile.value;
  }

  for (let row = 0; row < boardSize; row += 1) {
    for (let column = 0; column < boardSize; column += 1) {
      const index = row * boardSize + column;

      if (
        column < boardSize - 1 &&
        values[index] === values[index + 1]
      ) {
        return true;
      }

      if (
        row < boardSize - 1 &&
        values[index] === values[index + boardSize]
      ) {
        return true;
      }
    }
  }

  return false;
}

async function move(direction) {
  if (
    gameOver ||
    isMoving ||
    leadersDialog.open ||
    gameOverDialog.open
  ) {
    return;
  }

  let step = planStep(direction);

  if (!step.changed) {
    return;
  }

  previousState = getSnapshot();
  isMoving = true;
  updateInterface();

  try {
    while (step.changed) {
      await playStep(step);
      step = planStep(direction);
    }

    await addRandomTile();
    gameOver = !hasAvailableMoves();

    if (gameOver) {
      previousState = null;
    }

    saveGame();
  } finally {
    isMoving = false;
    updateInterface();
  }
}

document.addEventListener('keydown', (event) => {
  const direction = directions[event.key];
  const target = event.target;

  if (
    !direction ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    leadersDialog.open ||
    gameOverDialog.open ||
    target.closest('input, textarea, select, [contenteditable]')
  ) {
    return;
  }

  event.preventDefault();

  if (!event.repeat) {
    void move(direction);
  }
});

playerNameInput.addEventListener('input', () => {
  playerNameInput.setCustomValidity('');
});

recordForm.addEventListener('submit', saveResult);

restartButton.addEventListener('click', startNewGame);
undoButton.addEventListener('click', undoMove);
leadersButton.addEventListener('click', openLeaderboard);
gameOverLeaders.addEventListener('click', openLeaderboard);
gameOverRestart.addEventListener('click', startNewGame);

closeLeadersButton.addEventListener('click', () => {
  leadersDialog.close();
});

leadersDialog.addEventListener('click', (event) => {
  if (event.target !== leadersDialog) {
    return;
  }

  const bounds = leadersDialog.getBoundingClientRect();

  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedOutside) {
    leadersDialog.close();
  }
});

leadersDialog.addEventListener('close', () => {
  updateInterface();
});

gameOverDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
});

createBoard();

if (loadGame()) {
  updateInterface();
} else {
  const loadMessage = storageMessage;
  startNewGame();

  if (loadMessage && !storageMessage) {
    storageMessage = loadMessage;
    updateInterface();
  }
}