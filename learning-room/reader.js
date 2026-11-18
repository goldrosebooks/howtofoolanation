'use strict';

const yearPicker = document.getElementById('election-year');
const photo = document.getElementById('card-image');
const fullSizeLink = document.getElementById('full-size');
const previous = document.getElementById('previous-card');
const next = document.getElementById('next-card');
const count = document.getElementById('card-count');
const announcement = document.getElementById('card-announcement');
const options = Array.from(yearPicker.options);
const notes = Array.from(document.querySelectorAll('[data-card-year]'));
let current = 0;

function showCard(index, updateAddress = true) {
    const choice = options[index];
    if (!choice) return;

    notes[current].hidden = true;
    current = index;
    notes[current].hidden = false;
    yearPicker.selectedIndex = index;
    if (photo.getAttribute('src') !== choice.dataset.image) {
        photo.src = choice.dataset.image;
    }
    photo.alt = choice.dataset.alt;
    fullSizeLink.href = choice.dataset.image;
    previous.disabled = index === 0;
    next.disabled = index === options.length - 1;
    count.textContent = `Card ${index + 1} of ${options.length}`;
    announcement.textContent = `, ${choice.textContent}`;

    if (updateAddress) {
        // Going back should return to the room in one step, even after many cards.
        history.replaceState(null, '', `#${choice.value}`);
    }
    if (options[index + 1]) {
        const upcoming = new Image();
        upcoming.src = options[index + 1].dataset.image;
    }
}

function showLinkedCard() {
    const year = location.hash.slice(1);
    const index = options.findIndex(option => option.value === year);
    showCard(index < 0 ? 0 : index, false);
}

previous.addEventListener('click', () => showCard(current - 1));
next.addEventListener('click', () => showCard(current + 1));
yearPicker.addEventListener('change', () => showCard(yearPicker.selectedIndex));
window.addEventListener('hashchange', showLinkedCard);

document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.target.closest('select, input, textarea, [contenteditable="true"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    showCard(current + (event.key === 'ArrowRight' ? 1 : -1));
});

let touchStart = null;
photo.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? event.touches[0] : null;
}, { passive: true });
photo.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
photo.addEventListener('touchend', event => {
    if (!touchStart || event.touches.length || event.changedTouches.length !== 1) return;
    const end = event.changedTouches[0];
    const across = end.clientX - touchStart.clientX;
    const down = end.clientY - touchStart.clientY;
    touchStart = null;
    if (Math.abs(across) >= 45 && Math.abs(across) > 1.5 * Math.abs(down)) {
        showCard(current + (across < 0 ? 1 : -1));
    }
}, { passive: true });

showLinkedCard();
document.getElementById('deck-controls').hidden = false;
