'use strict';

const board = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const restartButton = document.querySelector('#restart-button');

const boardSize = 4;
const cellCount = boardSize * boardSize;
const tileElements = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let tiles = [];
let nextId = 1;
let score = 0;
let bestScore = 0;
let gameOver = false;
let isMoving = false;

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
    return null;
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

function updateInterface() {
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
  restartButton.disabled = isMoving;

  gameMessage.hidden = !gameOver;
  gameMessage.textContent = gameOver
    ? 'Ходов больше нет. Нажми «Новая игра», чтобы попробовать снова.'
    : '';
}

function startNewGame() {
  if (isMoving) {
    return;
  }

  tiles = [];
  score = 0;
  gameOver = false;

  tileElements.clear();
  tileLayer.replaceChildren();

  addRandomTile();
  addRandomTile();
  updateInterface();
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
  if (gameOver || isMoving) {
    return;
  }

  let step = planStep(direction);

  if (!step.changed) {
    return;
  }

  isMoving = true;
  updateInterface();

  try {
    while (step.changed) {
      await playStep(step);
      step = planStep(direction);
    }

    await addRandomTile();
    gameOver = !hasAvailableMoves();
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
    target.closest('input, textarea, select, [contenteditable]')
  ) {
    return;
  }

  event.preventDefault();

  if (!event.repeat) {
    void move(direction);
  }
});

restartButton.addEventListener('click', startNewGame);

createBoard();
startNewGame();