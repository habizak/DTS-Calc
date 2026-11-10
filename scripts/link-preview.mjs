import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Link-preview copy. The build writes these strings into index.html. */
export const LINK_PREVIEW = {
    title: 'DTS-Calc: a simple running calculator',
    description: 'Work out how long a run will take, or the pace you need. No clutter.',
    imageAlt: 'The DTS-Calc icon, two pixel arrows pointing opposite ways, in white on red.',
    siteName: 'DTS-Calc',
    url: 'https://dts-calc.vercel.app',
    image: 'https://dts-calc.vercel.app/og.png',
};

export function linkPreviewTags(copy = LINK_PREVIEW) {
    const tags = [
        ['name', 'description', copy.description],
        ['property', 'og:title', copy.title],
        ['property', 'og:description', copy.description],
        ['property', 'og:url', copy.url],
        ['property', 'og:site_name', copy.siteName],
        ['property', 'og:type', 'website'],
        ['property', 'og:image', copy.image],
        ['property', 'og:image:width', '1200'],
        ['property', 'og:image:height', '630'],
        ['property', 'og:image:alt', copy.imageAlt],
        ['name', 'twitter:card', 'summary_large_image'],
        ['name', 'twitter:title', copy.title],
        ['name', 'twitter:description', copy.description],
        ['name', 'twitter:image', copy.image],
        ['name', 'twitter:image:alt', copy.imageAlt],
    ];
    return tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${value}">`).join('\n    ');
}

const REGION = /<title>DTS-Calc<\/title>\n(?:    <meta (?:name|property)="(?:description|og:|twitter:)[^"]*" content="[^"]*">\n)*/;

export function applyLinkPreview(html, copy = LINK_PREVIEW) {
    if (!REGION.test(html)) {
        throw new Error('index.html is missing <title>DTS-Calc</title>');
    }
    return html.replace(REGION, `<title>DTS-Calc</title>\n    ${linkPreviewTags(copy)}\n`);
}

function isDirectRun() {
    const entry = process.argv[1];
    return !!entry && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
    const htmlPath = new URL('../index.html', import.meta.url);
    const html = readFileSync(htmlPath, 'utf8');
    const next = applyLinkPreview(html);
    if (next !== html) writeFileSync(htmlPath, next);
}
