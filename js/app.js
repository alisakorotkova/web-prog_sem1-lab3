'use strict';

const board = document.querySelector('#board');
const boardSize = 4;


const previewValues = [
  2, 4, 8, 0,
  16, 32, 64, 0,
  128, 256, 512, 0,
  1024, 2048, 0, 0
];

function renderPreview() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < boardSize * boardSize; index += 1) {
    const cell = document.createElement('div');
    const value = previewValues[index];
    const row = Math.floor(index / boardSize) + 1;
    const column = index % boardSize + 1;

    cell.className = 'cell';

    if (value !== 0) {
      cell.classList.add('tile');
      cell.dataset.value = String(value);
      cell.textContent = String(value);
    }

    cell.setAttribute(
      'aria-label',
      `Строка ${row}, столбец ${column}: ${value || 'пусто'}`
    );

    fragment.append(cell);
  }

  board.replaceChildren(fragment);
}

renderPreview();