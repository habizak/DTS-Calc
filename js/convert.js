export function convertUnits(fromSystem, toSystem, { distanceInput, speedInput, paceInput, normalizePace }) {
    const CF = 1.609344;

    if (distanceInput.value) {
        let d = parseFloat(distanceInput.value) || 0;
        if (fromSystem === 'METRIC' && toSystem === 'IMPERIAL') d /= CF;
        else if (fromSystem === 'IMPERIAL' && toSystem === 'METRIC') d *= CF;
        distanceInput.value = Math.min(99.99, d).toFixed(2);
    }

    if (speedInput.value) {
        let v = parseFloat(speedInput.value) || 0;
        if (fromSystem === 'METRIC' && toSystem === 'IMPERIAL') v /= CF;
        else if (fromSystem === 'IMPERIAL' && toSystem === 'METRIC') v *= CF;
        speedInput.value = Math.min(99.99, v).toFixed(2);
    }

    if (paceInput.value) {
        const [mm, ss] = paceInput.value.split(':').map(n => parseInt(n) || 0);
        let total = mm * 60 + ss;
        if (fromSystem === 'METRIC' && toSystem === 'IMPERIAL') total *= CF;
        else if (fromSystem === 'IMPERIAL' && toSystem === 'METRIC') total /= CF;
        paceInput.value = normalizePace(`${Math.floor(total / 60)}:${Math.round(total % 60)}`);
    }
}
