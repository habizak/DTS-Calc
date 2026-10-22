const FRAME_HEIGHT_PX = 852;
const KEYBOARD_THRESHOLD_PX = 140;

function isEditableField(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * Keep the locked app inside the visible viewport when the keyboard opens.
 * The document itself stays fixed; only .ctds-scroll moves.
 */
export function bindViewportLock(app = document.querySelector('.ctds-app')) {
    const viewport = window.visualViewport;
    if (!app || !viewport) {
        return;
    }

    const scroller = app.querySelector('.ctds-scroll');

    const syncToVisibleViewport = () => {
        const scale = viewport.scale || 1;
        const zoomed = Math.abs(scale - 1) > 0.01;
        const obscured = window.innerHeight - viewport.height;
        const offsetTop = viewport.offsetTop;
        const keyboardOpen = !zoomed && (obscured > KEYBOARD_THRESHOLD_PX || offsetTop > 1);

        if (!keyboardOpen) {
            app.style.height = '';
            app.style.maxHeight = '';
            app.style.transform = '';
            return;
        }

        const height = Math.min(Math.round(viewport.height), FRAME_HEIGHT_PX);
        app.style.height = `${height}px`;
        app.style.maxHeight = `${height}px`;
        app.style.transform = offsetTop > 1
            ? `translate3d(0, ${Math.round(offsetTop)}px, 0)`
            : '';
    };

    const revealFocusedField = () => {
        const target = document.activeElement;
        if (!isEditableField(target) || !scroller || !scroller.contains(target)) {
            return;
        }

        const scrollerRect = scroller.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (targetRect.bottom > scrollerRect.bottom - 8) {
            scroller.scrollTop += targetRect.bottom - scrollerRect.bottom + 12;
        } else if (targetRect.top < scrollerRect.top + 8) {
            scroller.scrollTop -= scrollerRect.top - targetRect.top + 12;
        }
    };

    let frame = 0;
    const schedule = () => {
        if (frame) {
            return;
        }
        frame = window.requestAnimationFrame(() => {
            frame = 0;
            syncToVisibleViewport();
            revealFocusedField();
        });
    };

    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    window.addEventListener('orientationchange', schedule);
}
