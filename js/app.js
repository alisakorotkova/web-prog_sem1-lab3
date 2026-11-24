'use strict';

const board = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const restartButton = document.querySelector('#restart-button');

const boardSize = 4;
const cellCount = boardSize * boardSize;

let cells = [];
let score = 0;
let bestScore = 0;
let gameOver = false;

const gameMessage = document.createElement('p');
gameMessage.className = 'stage-note';
gameMessage.setAttribute('role', 'status');
gameMessage.hidden = true;
board.after(gameMessage);

const directions = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down'
};

function addRandomTile() {
  const emptyIndexes = [];

  for (let index = 0; index < cellCount; index += 1) {
    if (cells[index] === 0) {
      emptyIndexes.push(index);
    }
  }

  if (emptyIndexes.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * emptyIndexes.length);
  const position = emptyIndexes[randomIndex];

  cells[position] = Math.random() < 0.9 ? 2 : 4;
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < cellCount; index += 1) {
    const cell = document.createElement('div');
    const value = cells[index];
    const row = Math.floor(index / boardSize) + 1;
    const column = index % boardSize + 1;

    cell.className = 'cell';

    if (value !== 0) {
      cell.classList.add('tile');
      cell.dataset.value = String(value);
      cell.textContent = String(value);

      if (value > 2048) {
        cell.style.backgroundColor = `hsl(${
          (Math.log2(value) * 37) % 360
        } 35% 28%)`;
        cell.style.color = '#ffffff';
        cell.style.fontSize = 'clamp(14px, 4vw, 24px)';
      }
    }

    cell.setAttribute(
      'aria-label',
      `Строка ${row}, столбец ${column}: ${value || 'пусто'}`
    );

    fragment.append(cell);
  }

  board.replaceChildren(fragment);
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);

  gameMessage.hidden = !gameOver;
  gameMessage.textContent = gameOver
    ? 'Ходов больше нет. Нажми «Новая игра», чтобы попробовать снова.'
    : '';
}

function startNewGame() {
  cells = Array(cellCount).fill(0);
  score = 0;
  gameOver = false;

  addRandomTile();
  addRandomTile();
  renderBoard();
}

function mergeLine(line) {
  let values = line.filter((value) => value !== 0);
  let points = 0;
  let merged = true;

  while (merged) {
    const nextValues = [];
    merged = false;

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];

      if (value === values[index + 1]) {
        const combinedValue = value * 2;

        nextValues.push(combinedValue);
        points += combinedValue;
        index += 1;
        merged = true;
      } else {
        nextValues.push(value);
      }
    }

    values = nextValues;
  }

  while (values.length < boardSize) {
    values.push(0);
  }

  return { values, points };
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

function hasAvailableMoves() {
  if (cells.includes(0)) {
    return true;
  }

  for (let row = 0; row < boardSize; row += 1) {
    for (let column = 0; column < boardSize; column += 1) {
      const index = row * boardSize + column;
      const value = cells[index];

      if (column < boardSize - 1 && value === cells[index + 1]) {
        return true;
      }

      if (row < boardSize - 1 && value === cells[index + boardSize]) {
        return true;
      }
    }
  }

  return false;
}

function move(direction) {
  if (gameOver) {
    return;
  }

  const nextCells = [...cells];
  let earnedPoints = 0;

  for (let lineIndex = 0; lineIndex < boardSize; lineIndex += 1) {
    const indexes = getLineIndexes(direction, lineIndex);
    const line = indexes.map((index) => cells[index]);
    const result = mergeLine(line);

    indexes.forEach((index, position) => {
      nextCells[index] = result.values[position];
    });

    earnedPoints += result.points;
  }

  const changed = nextCells.some((value, index) => value !== cells[index]);

  if (!changed) {
    return;
  }

  cells = nextCells;
  score += earnedPoints;
  bestScore = Math.max(bestScore, score);

  addRandomTile();
  gameOver = !hasAvailableMoves();
  renderBoard();
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
  move(direction);
});

restartButton.disabled = false;
restartButton.addEventListener('click', startNewGame);

startNewGame();