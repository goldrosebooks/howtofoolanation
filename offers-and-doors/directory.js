(() => {
    const list = document.getElementById('od-list');
    const invitation = document.getElementById('od-invitation');
    const intro = document.getElementById('od-intro');
    const message = document.getElementById('od-message');
    const template = document.getElementById('od-template');

    function makeDoor(entry) {
        if (!entry || typeof entry.name !== 'string' || !entry.name.trim() || typeof entry.url !== 'string') return null;
        let url;
        try {
            url = new URL(entry.url);
        } catch {
            return null;
        }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
        const item = template.content.firstElementChild.cloneNode(true);
        const anchor = item.querySelector('a');
        anchor.href = url.href;
        item.querySelector('.od-plaque').textContent = entry.name.trim();
        item.querySelector('.od-inscription').textContent = typeof entry.description === 'string' && entry.description.trim()
            ? entry.description.trim() : url.hostname;
        return item;
    }

    async function loadDoors() {
        try {
            const response = await fetch('listings.json', {cache: 'no-cache'});
            if (!response.ok) throw new Error('Listings unavailable');
            const entries = await response.json();
            if (!Array.isArray(entries)) throw new Error('Invalid listings');
            const doors = entries.map(makeDoor).filter(Boolean);
            if (entries.length && !doors.length) throw new Error('Invalid listings');
            invitation.before(...doors);
            if (!doors.length) intro.textContent = 'The first partner door could be yours. Choose a name and the page you’d like visitors to open.';
        } catch {
            message.textContent = 'The directory could not load. Refresh this page to try again.';
        }
        list.removeAttribute('aria-busy');
    }
    loadDoors();
})();
