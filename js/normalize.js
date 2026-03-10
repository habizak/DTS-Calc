export function parseDigitsToPace(val) {
    if (!/^\d+$/.test(val)) return null;
    const digits = val.padStart(2, '0').slice(-4); // keep last up to 4
    const m = digits.slice(0, Math.max(0, digits.length - 2)) || '0';
    const s = digits.slice(-2);
    return `${String(parseInt(m) || 0).padStart(2, '0')}:${String(parseInt(s) || 0).padStart(2, '0')}`;
}

export function parseDigitsToTime(val) {
    if (!/^\d+$/.test(val)) return null;
    const digits = val.padStart(2, '0').slice(-6); // keep last up to 6
    const h = digits.slice(0, Math.max(0, digits.length - 4)) || '0';
    const m = digits.slice(-4, -2) || '0';
    const s = digits.slice(-2) || '0';
    return `${String(parseInt(h) || 0).padStart(2, '0')}:${String(parseInt(m) || 0).padStart(2, '0')}:${String(parseInt(s) || 0).padStart(2, '0')}`;
}

export function normalizeTime(timeStr) {
    const parts = timeStr.split(':').map(p => parseInt(p) || 0);

    if (parts.length === 1) {
        parts.unshift(0, 0);
    } else if (parts.length === 2) {
        parts.unshift(0);
    }

    let [h, m, s] = parts;

    if (s >= 60) {
        m += Math.floor(s / 60);
        s = s % 60;
    }
    if (m >= 60) {
        h += Math.floor(m / 60);
        m = m % 60;
    }

    h = Math.min(99, Math.max(0, h));
    m = Math.min(59, Math.max(0, m));
    s = Math.min(59, Math.max(0, s));

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function normalizeDistance(distStr) {
    distStr = (distStr || '').replace(',', '.');
    let dist = parseFloat(distStr) || 0;
    dist = Math.min(99.99, Math.max(0, dist));
    return dist.toFixed(2);
}

export function normalizePace(paceStr) {
    const parts = paceStr.split(':').map(p => parseInt(p) || 0);
    let [m, s] = parts.length === 2 ? parts : [parseInt(paceStr) || 0, 0];

    if (s >= 60) {
        m += Math.floor(s / 60);
        s = s % 60;
    }

    if (m > 20 || (m === 20 && s > 59)) {
        m = 20;
        s = 59;
    }

    m = Math.max(0, m);
    s = Math.max(0, s);

    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function normalizeVelocity(velStr) {
    velStr = (velStr || '').replace(',', '.');
    let vel = parseFloat(velStr) || 0;
    vel = Math.min(99.99, Math.max(0, vel));
    return vel.toFixed(2);
}
