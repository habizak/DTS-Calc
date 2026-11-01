import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLE = /<style id="app-css">[\s\S]*?<\/style>/;

export function inlineCss(html, css) {
    if (!STYLE.test(html)) {
        throw new Error('index.html is missing <style id="app-css">');
    }
    return html.replace(STYLE, `<style id="app-css">\n${css}\n</style>`);
}

function isDirectRun() {
    const entry = process.argv[1];
    return !!entry && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
    const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8').replace(/\s+$/, '');
    const htmlPath = new URL('../index.html', import.meta.url);
    const html = readFileSync(htmlPath, 'utf8');
    const next = inlineCss(html, css);
    if (next !== html) writeFileSync(htmlPath, next);
}
