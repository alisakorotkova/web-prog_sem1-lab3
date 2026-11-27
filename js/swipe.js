'use strict';

let swipeStart = null;

function canSwipe() {
  return (
    !gameOver &&
    !isMoving &&
    !leadersDialog.open &&
    !gameOverDialog.open
  );
}

function clearSwipe() {
  if (swipeStart === null) {
    return;
  }

  const pointerId = swipeStart.pointerId;
  swipeStart = null;

  if (board.hasPointerCapture(pointerId)) {
    board.releasePointerCapture(pointerId);
  }
}

board.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) {
    clearSwipe();
    return;
  }

  if (
    event.pointerType === 'mouse' ||
    !canSwipe() ||
    swipeStart !== null
  ) {
    return;
  }

  swipeStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY
  };

  board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointerup', (event) => {
  if (
    swipeStart === null ||
    swipeStart.pointerId !== event.pointerId
  ) {
    return;
  }

  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;

  clearSwipe();

  if (!canSwipe()) {
    return;
  }

  const distanceX = Math.abs(deltaX);
  const distanceY = Math.abs(deltaY);

  if (Math.max(distanceX, distanceY) < 24) {
    return;
  }

  let direction;

  if (distanceX > distanceY) {
    direction = deltaX > 0 ? 'right' : 'left';
  } else {
    direction = deltaY > 0 ? 'down' : 'up';
  }

  void move(direction);
});

board.addEventListener('pointercancel', clearSwipe);

board.addEventListener('lostpointercapture', (event) => {
  if (swipeStart?.pointerId === event.pointerId) {
    swipeStart = null;
  }
});