const main = document.querySelector('main');
const originalPicker = main.querySelector('#election-year');
const currentPage = new URL(location.href);
const roomURL = new URL('index.html', currentPage);

async function readPage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Deck page is unavailable.');
    // A template keeps all images and scripts inert while reading card data.
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    return template.content;
}

function readCards(page) {
    const notes = new Map(Array.from(page.querySelectorAll('section[data-card-year]'),
        section => [section.dataset.cardYear, section]));
    const cards = Array.from(page.querySelectorAll('#election-year option'), option => ({
        year: option.value,
        label: option.textContent.trim(),
        image: option.dataset.image,
        alt: option.dataset.alt,
        note: notes.get(option.value)
    }));
    if (!cards.length) throw new Error('This deck has no cards.');
    return cards;
}

function listenForSwipe(image, step) {
    let start = null;
    image.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) {
            start = null;
            return;
        }
        start = {id: event.pointerId, x: event.clientX, y: event.clientY};
        image.setPointerCapture(event.pointerId);
    });
    image.addEventListener('pointerup', event => {
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        start = null;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
    image.addEventListener('lostpointercapture', () => { start = null; });
    image.addEventListener('pointercancel', () => { start = null; });
    image.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
    });
}

async function startRoom() {
    const catalogue = originalPicker ? await readPage(roomURL) : document;
    const room = catalogue.querySelector('#study-workspace').content.firstElementChild.cloneNode(true);
    const panelTemplate = catalogue.querySelector('#study-panel');
    const chooser = room.querySelector('.study-chooser');
    const list = room.querySelector('.study-deck-list');
    const grid = room.querySelector('.study-grid');
    const openAll = room.querySelector('.study-open-all');
    const status = room.querySelector('.study-status');
    const decks = new Map();
    const open = new Map();
    const remembered = new Map();
    let lastUsed = null;
    let initialDeck = null;

    for (const tile of catalogue.querySelectorAll('.lr-decks a.lr-tile')) {
        const url = new URL(tile.getAttribute('href'), roomURL);
        if (url.origin !== location.origin) continue;
        const id = url.pathname.split('/').pop().replace(/\.html$/, '');
        const name = tile.querySelector('h2, h3').textContent.trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'study-choice';
        button.setAttribute('aria-label', name);
        button.setAttribute('aria-pressed', 'false');
        const cover = tile.querySelector('img').cloneNode(false);
        cover.src = new URL(cover.getAttribute('src'), roomURL).href;
        const label = document.createElement('span');
        label.className = 'study-choice-text';
        label.textContent = name;
        const description = document.createElement('span');
        description.className = 'study-choice-desc';
        description.textContent = tile.querySelector('p')?.textContent || '';
        label.append(description);
        const mark = document.createElement('span');
        mark.className = 'study-choice-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '+';
        button.append(cover, label, mark);
        list.append(button);
        const deck = {id, name, url, button, mark, data: null};
        if (originalPicker && url.pathname === currentPage.pathname) {
            initialDeck = id;
            deck.data = Promise.resolve(readCards(main));
        }
        decks.set(id, deck);
        button.addEventListener('click', () => {
            if (open.has(id)) closeDeck(id);
            else openDeck(id, remembered.get(id) || activeYear());
            updateSelection();
            saveAddress();
        });
    }
    if (!decks.size || (originalPicker && !initialDeck)) throw new Error('The deck list is unavailable.');

    const longList = decks.size > 6;
    chooser.querySelector('summary').hidden = !longList;
    chooser.classList.toggle('is-long', longList);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            const panel = open.get(entry.target.dataset.deck);
            if (panel?.element === entry.target) loadPanel(panel);
        }
    }, {rootMargin: '400px'}) : null;

    function activeYear() {
        return open.get(lastUsed)?.year || open.values().next().value?.year;
    }

    function saveAddress() {
        const entries = Array.from(open, ([id, panel]) => id + (panel.year ? ':' + panel.year : ''));
        const hash = open.size === 1 && open.has(initialDeck) && open.get(initialDeck).year
            ? open.get(initialDeck).year
            : 'decks=' + entries.join(',');
        if (location.hash.slice(1) !== hash) history.replaceState(null, '', '#' + hash);
    }

    function updateSelection() {
        room.classList.toggle('is-empty', !open.size);
        openAll.hidden = open.size === decks.size;
        chooser.querySelector('.study-selection-count').textContent = '(' + open.size + ' open)';
        for (const [id, deck] of decks) {
            deck.button.setAttribute('aria-pressed', String(open.has(id)));
            deck.mark.textContent = open.has(id) ? '✓' : '+';
        }
        updateMatchButtons();
    }

    function updateMatchButtons() {
        const years = new Set(Array.from(open.values(), panel => panel.year).filter(Boolean));
        for (const panel of open.values()) {
            panel.match.hidden = !panel.cards || years.size < 2;
            if (!panel.match.hidden) panel.match.textContent = 'Match other decks to ' + panel.year;
        }
    }

    function closeDeck(id) {
        const panel = open.get(id);
        if (panel.year) remembered.set(id, panel.year);
        observer?.unobserve(panel.element);
        panel.element.remove();
        open.delete(id);
        if (lastUsed === id) lastUsed = null;
    }

    function openDeck(id, year) {
        const deck = decks.get(id);
        if (!deck || open.has(id)) return;
        const element = panelTemplate.content.firstElementChild.cloneNode(true);
        element.dataset.deck = id;
        const title = element.querySelector('h2');
        title.id = 'study-' + id;
        title.textContent = deck.name;
        element.setAttribute('aria-labelledby', title.id);
        const closeButton = element.querySelector('.study-close');
        closeButton.setAttribute('aria-label', 'Close ' + deck.name);
        closeButton.addEventListener('click', () => {
            closeDeck(id);
            updateSelection();
            saveAddress();
            if (longList) chooser.open = true;
            deck.button.focus();
        });
        const panel = {
            deck, element, year, cards: null, image: element.querySelector('.study-image'),
            picker: element.querySelector('.study-year'), match: element.querySelector('.study-match')
        };
        panel.picker.setAttribute('aria-label', 'Jump to year in ' + deck.name);
        panel.picker.addEventListener('change', () => turnTo(panel, panel.picker.selectedIndex));
        const step = delta => turnTo(panel, panel.picker.selectedIndex + delta);
        for (const [selector, delta, label] of [['.study-prev', -1, 'Previous'], ['.study-next', 1, 'Next']]) {
            const button = element.querySelector(selector);
            button.setAttribute('aria-label', label + ' card in ' + deck.name);
            button.addEventListener('click', () => step(delta));
        }
        listenForSwipe(panel.image, step);
        panel.match.addEventListener('click', () => matchOthers(panel));
        element.querySelector('.study-retry').addEventListener('click', () => loadPanel(panel));
        open.set(id, panel);
        grid.append(element);
        if (observer) observer.observe(element);
        else loadPanel(panel);
    }

    async function loadPanel(panel) {
        const {deck, element} = panel;
        const pending = element.querySelector('.study-pending');
        const retry = pending.querySelector('button');
        retry.hidden = true;
        pending.querySelector('p').textContent = 'Loading cards…';
        try {
            if (!deck.data) {
                deck.data = readPage(deck.url).then(readCards).catch(error => {
                    deck.data = null;
                    throw error;
                });
            }
            const cards = await deck.data;
            if (open.get(deck.id) !== panel) return;
            panel.cards = cards;
            panel.picker.replaceChildren(...cards.map(card => new Option(card.label, card.year)));
            const index = cards.findIndex(card => card.year === panel.year);
            drawCard(panel, Math.max(0, index));
            pending.hidden = true;
            element.querySelector('.study-content').hidden = false;
            updateMatchButtons();
        } catch {
            if (open.get(deck.id) !== panel) return;
            pending.querySelector('p').textContent = 'This deck couldn’t load.';
            retry.hidden = false;
        }
    }

    function drawCard(panel, index) {
        const {deck, element, cards} = panel;
        const card = cards[index];
        panel.year = card.year;
        remembered.set(deck.id, card.year);
        panel.picker.selectedIndex = index;
        const imageURL = new URL(card.image, deck.url).href;
        panel.image.alt = card.alt || card.label;
        panel.image.src = imageURL;
        element.querySelector('.study-full').href = imageURL;
        element.querySelector('.study-prev').disabled = index === 0;
        element.querySelector('.study-next').disabled = index === cards.length - 1;
        element.querySelector('.study-card-status').textContent = card.label + ', card ' + (index + 1) + ' of ' + cards.length;
        element.querySelector('.study-text').hidden = !card.note;
        if (card.note) {
            const note = card.note.cloneNode(true);
            note.hidden = false;
            const heading = note.querySelector('h2');
            if (heading) {
                heading.id = deck.id + '-year-' + card.year;
                note.setAttribute('aria-labelledby', heading.id);
            }
            element.querySelector('.lr-transcript').replaceChildren(note);
        }
    }

    function turnTo(panel, index) {
        if (!panel.cards?.[index] || panel.cards[index].year === panel.year) return;
        drawCard(panel, index);
        lastUsed = panel.deck.id;
        updateMatchButtons();
        saveAddress();
    }

    function matchOthers(source) {
        const skipped = [];
        for (const panel of open.values()) {
            if (panel === source || panel.year === source.year) continue;
            if (!panel.cards) {
                panel.year = source.year;
                continue;
            }
            const index = panel.cards.findIndex(card => card.year === source.year);
            if (index >= 0) drawCard(panel, index);
            else skipped.push(panel.deck.name);
        }
        lastUsed = source.deck.id;
        updateMatchButtons();
        saveAddress();
        status.textContent = skipped.length ? 'No card for ' + source.year + ' in ' + skipped.join(', ') + '.'
            : 'Open decks matched to ' + source.year + '.';
        source.image.focus({preventScroll: true});
    }

    function restoreAddress() {
        for (const id of Array.from(open.keys())) closeDeck(id);
        const hash = location.hash.slice(1);
        if (hash.startsWith('decks=')) {
            for (const entry of hash.slice(6).split(',')) {
                const [id, year] = entry.split(':');
                if (decks.has(id)) openDeck(id, year);
            }
        } else if (initialDeck || /^\d{4}$/.test(hash)) {
            openDeck(initialDeck || decks.keys().next().value, /^\d{4}$/.test(hash) ? hash : null);
        }
        chooser.open = !longList || !open.size;
        updateSelection();
    }

    openAll.addEventListener('click', () => {
        const year = activeYear();
        for (const id of decks.keys()) openDeck(id, remembered.get(id) || year);
        if (longList) chooser.open = false;
        updateSelection();
        saveAddress();
        grid.querySelector('.study-close')?.focus({preventScroll: true});
    });

    main.replaceChildren(room);
    restoreAddress();
    window.addEventListener('hashchange', restoreAddress);
}

startRoom().catch(() => {
    // Standalone decks still work if the catalogue cannot be fetched.
    if (originalPicker && main.contains(originalPicker)) import('./reader.js');
});
