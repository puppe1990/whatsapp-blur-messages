// WhatsApp message extractor (DOM only), exposed as WPP_EXPORT.
WPP_EXPORT = (() => {
    const MESSAGE_SELECTOR = 'div.message-in, div.message-out, [data-testid*="msg"]';

    const state = {
        messages: [],
        fingerprints: new Set(),
        maxBuffer: 5000,
        observer: null,
        rootObserver: null,
        currentMain: null,
        stats: {
            captured: 0,
            unknownAuthor: 0,
            bySource: {},
            byDirection: {},
            byKind: {}
        }
    };

    const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

    const getFingerprint = (msg) => `${msg.direction}|${msg.author}|${msg.time}|${msg.kind}|${msg.text}`;

    function incrementMetric(bucket, key) {
        const metricKey = key || 'unknown';
        bucket[metricKey] = (bucket[metricKey] || 0) + 1;
    }

    function getCurrentChatName() {
        const selectors = [
            '#main header [data-testid="conversation-info-header-chat-title"]',
            '#main header span[title][dir="auto"]',
            '#main header h2 span[dir]',
            '#main header div[title]'
        ];

        const blockedLabels = new Set(['conta comercial', 'business account']);

        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            for (const el of nodes) {
                const text = (el?.textContent || '').trim();
                if (!text) continue;
                if (blockedLabels.has(text.toLowerCase())) continue;
                return text;
            }
        }

        return '';
    }

    function detectDirection(el) {
        const carrier = el.closest('div.message-in, div.message-out') || el;
        const className = carrier.className || '';
        if (className.includes('message-out')) return 'out';
        if (className.includes('message-in')) return 'in';
        return 'unknown';
    }

    function extractText(el) {
        const selectors = [
            'span.selectable-text span',
            'span.selectable-text',
            'div.copyable-text span[dir]',
            'div.copyable-text div[dir]'
        ];

        const textParts = [];
        const seen = new Set();

        selectors.forEach((selector) => {
            const nodes = el.querySelectorAll(selector);
            nodes.forEach((node) => {
                const text = (node.innerText || '').trim();
                if (!text) return;

                // Ignore isolated time stamps like "21:32"
                if (/^\d{1,2}:\d{2}$/.test(text)) return;

                if (!seen.has(text)) {
                    seen.add(text);
                    textParts.push(text);
                }
            });
        });

        const joined = textParts.join('\n').trim();
        if (joined) return joined;

        return '';
    }

    function extractMeta(el) {
        const plainNode = el.matches('[data-pre-plain-text]')
            ? el
            : el.querySelector('[data-pre-plain-text]') ||
              el.closest('[data-pre-plain-text]') ||
              el.parentElement?.closest('[data-pre-plain-text]');
        const dataPlain = plainNode?.getAttribute('data-pre-plain-text') || plainNode?.dataset?.prePlainText || '';

        let time = '';
        let author = '';

        if (dataPlain) {
            const timeMatch = dataPlain.match(/\[(.*?)\]/);
            if (timeMatch) {
                time = timeMatch[1];
            }
            const afterBracket = dataPlain.split(']').slice(1).join(']').trim();
            author = afterBracket.replace(/:$/, '').trim();
        }

        return { time, author };
    }

    function resolveAuthor(el, direction, metaAuthor) {
        if (metaAuthor) {
            return { author: metaAuthor, authorSource: 'data-pre-plain-text' };
        }

        if (direction === 'out') {
            return { author: 'Você', authorSource: 'direction-out-fallback' };
        }

        const chatName = getCurrentChatName();
        if (chatName) {
            return { author: chatName, authorSource: 'chat-header-fallback' };
        }

        const candidate = (el.querySelector('[title], [aria-label]')?.getAttribute('title') || '').trim();
        if (candidate) {
            return { author: candidate, authorSource: 'title-fallback' };
        }

        return { author: '', authorSource: 'unknown' };
    }

    function inferMediaKind(el) {
        if (
            el.querySelector(
                '[data-icon="audio-play"], [data-icon="ptt-play"], [aria-label*="udio"], [aria-label*="voz"], [data-testid*="audio"], [data-testid*="ptt"]'
            )
        ) {
            return 'audio';
        }
        if (el.querySelector('img, [data-testid*="image"], [data-testid*="photo"]')) {
            return 'image';
        }
        if (el.querySelector('video, [data-testid*="video"]')) {
            return 'video';
        }
        if (el.querySelector('[data-icon="document"], [data-testid*="document"]')) {
            return 'document';
        }
        return 'text';
    }

    function inferAudioDuration(el, messageTime) {
        const text = (el.innerText || '').trim();
        if (!text) return '';

        const matches = text.match(/\b\d{1,2}:\d{2}\b/g) || [];
        if (!matches.length) return '';

        const normalizedMessageTime = (messageTime || '').slice(0, 5);
        const unique = [...new Set(matches)];
        const candidates = unique
            .filter((token) => token !== normalizedMessageTime)
            .map((token) => {
                const [m, s] = token.split(':').map((v) => Number(v));
                return { token, totalSec: m * 60 + s, mm: m };
            })
            .filter((entry) => Number.isFinite(entry.totalSec));

        // Avoid confusing clock time (e.g., 21:27) with audio duration.
        const plausible = candidates.filter((entry) => entry.mm < 20 && entry.totalSec <= 1800);
        if (!plausible.length) return '';

        plausible.sort((a, b) => a.totalSec - b.totalSec);
        return plausible[0].token;
    }

    function isLikelyPlaceholderImageSrc(src) {
        if (!src) return true;
        const lower = src.toLowerCase();
        if (lower.startsWith('data:image/gif;base64,r0lgodlhaqabaiaaaaaaap///')) return true;
        if (lower.startsWith('data:image/gif;base64,r0lgodlh')) return true;
        if (lower.includes('1x1')) return true;
        return false;
    }

    function extractMediaRefs(el, kind) {
        const refs = {
            imageSrc: '',
            audioSrc: ''
        };

        if (kind === 'image') {
            const imgs = Array.from(el.querySelectorAll('img[src]'));
            const best = imgs
                .map((img) => {
                    const src = (img.getAttribute('src') || '').trim();
                    const rect = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: 0, height: 0 };
                    const area = Math.max(0, rect.width * rect.height);
                    const isData = src.startsWith('data:');
                    const isBlob = src.startsWith('blob:');
                    const placeholder = isLikelyPlaceholderImageSrc(src);
                    let priority = 0;
                    if (isBlob) priority += 30;
                    if (!isData) priority += 20;
                    if (!placeholder) priority += 20;
                    priority += Math.min(20, Math.floor(area / 5000));
                    return { src, priority };
                })
                .sort((a, b) => b.priority - a.priority)[0];

            refs.imageSrc = (best?.src || '').trim();
            if (isLikelyPlaceholderImageSrc(refs.imageSrc)) {
                refs.imageSrc = '';
            }
        }

        if (kind === 'audio') {
            const audio = el.querySelector('audio[src], source[src]');
            refs.audioSrc = (audio?.getAttribute('src') || '').trim();
        }

        return refs;
    }

    function parseMessageElement(el) {
        try {
            const direction = detectDirection(el);
            let kind = inferMediaKind(el);
            const { time, author: metaAuthor } = extractMeta(el);
            const { author, authorSource } = resolveAuthor(el, direction, metaAuthor);
            let text = extractText(el);
            const mediaRefs = extractMediaRefs(el, kind);

            if (kind === 'image' && !mediaRefs.imageSrc && text) {
                kind = 'text';
            }

            if (!text) {
                if (kind === 'audio') {
                    const duration = inferAudioDuration(el, time);
                    text = duration ? `[audio ${duration}]` : '[audio]';
                } else if (kind === 'image') {
                    text = '[foto]';
                } else if (kind === 'video') {
                    text = '[video]';
                } else if (kind === 'document') {
                    text = '[documento]';
                }
            }

            if (!text) return null;

            const duration = kind === 'audio' ? inferAudioDuration(el, time) : '';

            return {
                id: uuid(),
                direction,
                author,
                authorSource,
                text,
                time,
                kind,
                media: kind === 'audio' ? { duration } : null,
                mediaRefs,
                ts: Date.now()
            };
        } catch (error) {
            console.error('[WPP_EXPORT] erro parseMessageElement', error, el);
            return null;
        }
    }

    function pushMessage(msg, source = 'unknown') {
        if (!msg) return false;

        const mergeCandidateIndex = state.messages.findIndex(
            (existing) =>
                existing.direction === msg.direction &&
                existing.author === msg.author &&
                existing.time === msg.time &&
                existing.text === msg.text
        );

        if (mergeCandidateIndex >= 0) {
            const existing = state.messages[mergeCandidateIndex];
            const existingHasImage = !!existing.mediaRefs?.imageSrc;
            const existingHasAudio = !!existing.mediaRefs?.audioSrc;
            const incomingHasImage = !!msg.mediaRefs?.imageSrc;
            const incomingHasAudio = !!msg.mediaRefs?.audioSrc;

            if ((!existingHasImage && incomingHasImage) || (!existingHasAudio && incomingHasAudio)) {
                state.messages[mergeCandidateIndex] = {
                    ...existing,
                    kind: existing.kind === 'text' ? msg.kind : existing.kind,
                    media: existing.media || msg.media,
                    mediaRefs: {
                        imageSrc: existing.mediaRefs?.imageSrc || msg.mediaRefs?.imageSrc || '',
                        audioSrc: existing.mediaRefs?.audioSrc || msg.mediaRefs?.audioSrc || ''
                    }
                };
            }
            return false;
        }

        const fingerprint = getFingerprint(msg);
        if (state.fingerprints.has(fingerprint)) {
            return false;
        }

        state.fingerprints.add(fingerprint);
        state.messages.push(msg);

        if (state.messages.length > state.maxBuffer) {
            const removed = state.messages.shift();
            if (removed) {
                state.fingerprints.delete(getFingerprint(removed));
            }
        }

        state.stats.captured += 1;
        if (!msg.author) {
            state.stats.unknownAuthor += 1;
        }
        incrementMetric(state.stats.bySource, source);
        incrementMetric(state.stats.byDirection, msg.direction);
        incrementMetric(state.stats.byKind, msg.kind);

        const preview = (msg.text || '').replace(/\s+/g, ' ').slice(0, 80);
        console.info('[WPP_EXPORT] mensagem capturada', {
            index: state.messages.length,
            source,
            direction: msg.direction,
            time: msg.time || '--:--',
            author: msg.author || 'desconhecido',
            authorSource: msg.authorSource || 'unknown',
            kind: msg.kind,
            media: msg.media,
            preview
        });

        if (!msg.author) {
            console.warn('[WPP_EXPORT] autor não identificado', {
                source,
                direction: msg.direction,
                time: msg.time || '--:--',
                kind: msg.kind,
                preview
            });
        }
        return true;
    }

    function collectInitialMessages(mainContainer) {
        const initial = mainContainer.querySelectorAll(MESSAGE_SELECTOR);
        let captured = 0;

        initial.forEach((el) => {
            const msg = parseMessageElement(el);
            if (pushMessage(msg, 'initial')) {
                captured += 1;
            }
        });
        console.log(
            '[WPP_EXPORT] mensagens iniciais no DOM:',
            initial.length,
            '| capturadas:',
            captured,
            '| autores desconhecidos:',
            state.stats.unknownAuthor
        );
    }

    function bindMessageObserver(mainContainer) {
        if (!mainContainer) return false;

        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }

        state.currentMain = mainContainer;
        collectInitialMessages(mainContainer);

        const observer = new MutationObserver((muts) => {
            muts.forEach((mut) => {
                mut.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;

                    if (node.matches(MESSAGE_SELECTOR)) {
                        const directMsg = parseMessageElement(node);
                        pushMessage(directMsg, 'mutation-direct');
                    }

                    const nestedMsgs = node.querySelectorAll?.(MESSAGE_SELECTOR) || [];
                    nestedMsgs.forEach((el) => {
                        const nestedMsg = parseMessageElement(el);
                        pushMessage(nestedMsg, 'mutation-desc');
                    });
                });
            });
        });

        observer.observe(mainContainer, { childList: true, subtree: true });
        state.observer = observer;
        console.log('[WPP_EXPORT] observer iniciado em #main');
        return true;
    }

    function bindRootObserver() {
        if (state.rootObserver) return;

        state.rootObserver = new MutationObserver(() => {
            const nextMain = document.querySelector('#main');
            if (!nextMain) return;
            if (nextMain === state.currentMain) return;

            console.log('[WPP_EXPORT] troca de conversa detectada, reconectando observer');
            bindMessageObserver(nextMain);
        });

        state.rootObserver.observe(document.body, { childList: true, subtree: true });
    }

    function start() {
        const mainContainer = document.querySelector('#main');
        if (!mainContainer) {
            console.warn('[WPP_EXPORT] #main não encontrado, abra um chat');
            bindRootObserver();
            return false;
        }

        bindMessageObserver(mainContainer);
        bindRootObserver();
        return true;
    }

    function stop() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
        if (state.rootObserver) {
            state.rootObserver.disconnect();
            state.rootObserver = null;
        }
        state.currentMain = null;
        console.log('[WPP_EXPORT] observer parado');
    }

    function clear() {
        state.messages = [];
        state.fingerprints.clear();
        state.stats = {
            captured: 0,
            unknownAuthor: 0,
            bySource: {},
            byDirection: {},
            byKind: {}
        };
        console.log('[WPP_EXPORT] buffer limpo');
    }

    function getStats() {
        return {
            ...state.stats,
            bufferSize: state.messages.length
        };
    }

    function getMessages(limit) {
        const max = Number.isFinite(limit) ? Math.max(0, Number(limit)) : null;
        return max ? state.messages.slice(-max) : [...state.messages];
    }

    function downloadFile(content, mimeType, extension) {
        const now = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `wpp-export-${now}.${extension}`;
        const blob = new Blob([content], { type: mimeType });
        return downloadBlob(blob, filename);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `wpp-export-${new Date().toISOString().replace(/[:.]/g, '-')}.bin`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return a.download;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function downloadJson() {
        const payload = JSON.stringify(state.messages, null, 2);
        const file = downloadFile(payload, 'application/json;charset=utf-8', 'json');
        console.log('[WPP_EXPORT] JSON salvo:', file);
        return file;
    }

    function downloadTxt() {
        const payload = state.messages
            .map((m) => {
                let body = m.text || '';

                if (m.kind === 'audio' && !body.toLowerCase().includes('[audio')) {
                    const duration = m.media?.duration ? ` ${m.media.duration}` : '';
                    body = `[audio${duration}] ${body}`.trim();
                }
                if (m.kind === 'image' && !body.toLowerCase().includes('[foto')) {
                    body = `[foto] ${body}`.trim();
                }

                return `[${m.time || '--:--'}] (${m.direction}) ${m.author || 'desconhecido'}: ${body}`;
            })
            .join('\n');
        const file = downloadFile(payload, 'text/plain;charset=utf-8', 'txt');
        console.log('[WPP_EXPORT] TXT salvo:', file);
        return file;
    }

    function downloadHtml() {
        const chatTitle = escapeHtml(getCurrentChatName() || 'WhatsApp Chat');
        const generatedAt = new Date().toLocaleString();
        const rows = state.messages
            .map((m) => {
                const sideClass = m.direction === 'out' ? 'out' : 'in';
                const kind = escapeHtml(m.kind || 'text');
                const author = escapeHtml(m.author || 'desconhecido');
                const time = escapeHtml(m.time || '--:--');
                const body = escapeHtml(m.text || '');
                const duration = m.media?.duration ? ` · ${escapeHtml(m.media.duration)}` : '';

                return `
                <div class="row ${sideClass}">
                    <div class="bubble ${sideClass}">
                        <div class="meta"><span class="author">${author}</span> <span class="kind">${kind}${duration}</span></div>
                        <div class="text">${body.replace(/\n/g, '<br>')}</div>
                        <div class="time">${time}</div>
                    </div>
                </div>
            `;
            })
            .join('\n');

        const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${chatTitle} - Export</title>
<style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #0b141a; font-family: "Segoe UI", Arial, sans-serif; color: #e9edef; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 20px 14px 32px; }
    .header { position: sticky; top: 0; z-index: 3; background: #202c33; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 700; }
    .sub { font-size: 12px; color: #aebac1; margin-top: 4px; }
    .chat { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; }
    .row.in { justify-content: flex-start; }
    .row.out { justify-content: flex-end; }
    .bubble { max-width: min(76ch, 88%); border-radius: 8px; padding: 8px 10px 6px; box-shadow: 0 1px 0 rgba(0,0,0,.2); }
    .bubble.in { background: #202c33; }
    .bubble.out { background: #005c4b; }
    .meta { font-size: 11px; color: #cfd6da; margin-bottom: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
    .author { font-weight: 700; }
    .kind { opacity: .92; }
    .text { white-space: normal; line-height: 1.38; font-size: 14px; word-wrap: break-word; }
    .time { text-align: right; margin-top: 6px; font-size: 11px; color: #aebac1; }
    .empty { color: #aebac1; text-align: center; padding: 24px; background: #202c33; border-radius: 8px; }
</style>
</head>
<body>
    <div class="wrap">
        <div class="header">
            <div class="title">${chatTitle}</div>
            <div class="sub">Mensagens: ${state.messages.length} · Gerado em ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="chat">
            ${rows || '<div class="empty">Nenhuma mensagem capturada.</div>'}
        </div>
    </div>
</body>
</html>`;

        const file = downloadFile(html, 'text/html;charset=utf-8', 'html');
        console.log('[WPP_EXPORT] HTML salvo:', file);
        return file;
    }

    function encodeUtf8(str) {
        return new TextEncoder().encode(str);
    }

    const CRC32_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
            let c = i;
            for (let j = 0; j < 8; j += 1) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i += 1) {
            crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function writeUint16LE(arr, value) {
        arr.push(value & 0xff, (value >>> 8) & 0xff);
    }

    function writeUint32LE(arr, value) {
        arr.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    }

    function dateToDos(date) {
        const d = date || new Date();
        const year = Math.max(1980, d.getFullYear());
        const dosTime =
            ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
        const dosDate = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
        return { dosTime, dosDate };
    }

    function buildZip(files) {
        const localParts = [];
        const centralParts = [];
        let offset = 0;
        const now = dateToDos(new Date());

        files.forEach((file) => {
            const nameBytes = encodeUtf8(file.name);
            const dataBytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
            const checksum = crc32(dataBytes);
            const size = dataBytes.length;

            const localHeader = [];
            writeUint32LE(localHeader, 0x04034b50);
            writeUint16LE(localHeader, 20);
            writeUint16LE(localHeader, 0);
            writeUint16LE(localHeader, 0);
            writeUint16LE(localHeader, now.dosTime);
            writeUint16LE(localHeader, now.dosDate);
            writeUint32LE(localHeader, checksum);
            writeUint32LE(localHeader, size);
            writeUint32LE(localHeader, size);
            writeUint16LE(localHeader, nameBytes.length);
            writeUint16LE(localHeader, 0);

            const localChunk = new Uint8Array(localHeader.length + nameBytes.length + dataBytes.length);
            localChunk.set(localHeader, 0);
            localChunk.set(nameBytes, localHeader.length);
            localChunk.set(dataBytes, localHeader.length + nameBytes.length);
            localParts.push(localChunk);

            const centralHeader = [];
            writeUint32LE(centralHeader, 0x02014b50);
            writeUint16LE(centralHeader, 20);
            writeUint16LE(centralHeader, 20);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, now.dosTime);
            writeUint16LE(centralHeader, now.dosDate);
            writeUint32LE(centralHeader, checksum);
            writeUint32LE(centralHeader, size);
            writeUint32LE(centralHeader, size);
            writeUint16LE(centralHeader, nameBytes.length);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint32LE(centralHeader, 0);
            writeUint32LE(centralHeader, offset);

            const centralChunk = new Uint8Array(centralHeader.length + nameBytes.length);
            centralChunk.set(centralHeader, 0);
            centralChunk.set(nameBytes, centralHeader.length);
            centralParts.push(centralChunk);

            offset += localChunk.length;
        });

        const centralOffset = offset;
        let centralSize = 0;
        centralParts.forEach((part) => {
            centralSize += part.length;
        });

        const end = [];
        writeUint32LE(end, 0x06054b50);
        writeUint16LE(end, 0);
        writeUint16LE(end, 0);
        writeUint16LE(end, files.length);
        writeUint16LE(end, files.length);
        writeUint32LE(end, centralSize);
        writeUint32LE(end, centralOffset);
        writeUint16LE(end, 0);
        const endChunk = new Uint8Array(end);

        const totalSize = localParts.reduce((s, p) => s + p.length, 0) + centralSize + endChunk.length;
        const zipBytes = new Uint8Array(totalSize);
        let cursor = 0;

        localParts.forEach((part) => {
            zipBytes.set(part, cursor);
            cursor += part.length;
        });
        centralParts.forEach((part) => {
            zipBytes.set(part, cursor);
            cursor += part.length;
        });
        zipBytes.set(endChunk, cursor);
        return zipBytes;
    }

    function detectExtension(blob, fallback = 'bin') {
        const type = blob?.type || '';
        if (type.includes('jpeg')) return 'jpg';
        if (type.includes('png')) return 'png';
        if (type.includes('webp')) return 'webp';
        if (type.includes('gif')) return 'gif';
        if (type.includes('mpeg')) return 'mp3';
        if (type.includes('ogg')) return 'ogg';
        if (type.includes('wav')) return 'wav';
        if (type.includes('mp4')) return 'mp4';
        return fallback;
    }

    async function srcToBlob(src) {
        if (!src) return null;
        try {
            const res = await fetch(src, { credentials: 'include' });
            if (!res.ok) return null;
            return await res.blob();
        } catch (_error) {
            return null;
        }
    }

    function buildHtmlForZip(messages) {
        const chatTitle = escapeHtml(getCurrentChatName() || 'WhatsApp Chat');
        const generatedAt = new Date().toLocaleString();
        const rows = messages
            .map((m) => {
                const sideClass = m.direction === 'out' ? 'out' : 'in';
                const kind = escapeHtml(m.kind || 'text');
                const author = escapeHtml(m.author || 'desconhecido');
                const time = escapeHtml(m.time || '--:--');
                const body = escapeHtml(m.text || '');
                const duration = m.media?.duration ? ` · ${escapeHtml(m.media.duration)}` : '';
                let mediaHtml = '';

                if (m.mediaPath && m.kind === 'image') {
                    mediaHtml = `<img class="media-img" src="${escapeHtml(m.mediaPath)}" alt="foto" />`;
                } else if (m.mediaPath && m.kind === 'audio') {
                    mediaHtml = `<audio class="media-audio" controls src="${escapeHtml(m.mediaPath)}"></audio>`;
                }

                return `
                <div class="row ${sideClass}">
                    <div class="bubble ${sideClass}">
                        <div class="meta"><span class="author">${author}</span> <span class="kind">${kind}${duration}</span></div>
                        <div class="text">${body.replace(/\n/g, '<br>')}</div>
                        ${mediaHtml}
                        <div class="time">${time}</div>
                    </div>
                </div>
            `;
            })
            .join('\n');

        return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${chatTitle} - Export</title>
<style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #0b141a; font-family: "Segoe UI", Arial, sans-serif; color: #e9edef; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 20px 14px 32px; }
    .header { position: sticky; top: 0; z-index: 3; background: #202c33; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 700; }
    .sub { font-size: 12px; color: #aebac1; margin-top: 4px; }
    .chat { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; }
    .row.in { justify-content: flex-start; }
    .row.out { justify-content: flex-end; }
    .bubble { max-width: min(76ch, 88%); border-radius: 8px; padding: 8px 10px 6px; box-shadow: 0 1px 0 rgba(0,0,0,.2); }
    .bubble.in { background: #202c33; }
    .bubble.out { background: #005c4b; }
    .meta { font-size: 11px; color: #cfd6da; margin-bottom: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
    .author { font-weight: 700; }
    .kind { opacity: .92; }
    .text { white-space: normal; line-height: 1.38; font-size: 14px; word-wrap: break-word; }
    .media-img { margin-top: 8px; max-width: 300px; width: 100%; border-radius: 8px; display: block; }
    .media-audio { margin-top: 8px; width: 100%; max-width: 320px; display: block; }
    .time { text-align: right; margin-top: 6px; font-size: 11px; color: #aebac1; }
    .empty { color: #aebac1; text-align: center; padding: 24px; background: #202c33; border-radius: 8px; }
</style>
</head>
<body>
    <div class="wrap">
        <div class="header">
            <div class="title">${chatTitle}</div>
            <div class="sub">Mensagens: ${messages.length} · Gerado em ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="chat">
            ${rows || '<div class="empty">Nenhuma mensagem capturada.</div>'}
        </div>
    </div>
</body>
</html>`;
    }

    async function downloadZip() {
        const mediaFiles = [];
        const mediaBySrc = new Map();
        const enriched = state.messages.map((msg) => ({ ...msg, mediaPath: '' }));

        for (let i = 0; i < enriched.length; i += 1) {
            const msg = enriched[i];
            const src =
                msg.kind === 'image' ? msg.mediaRefs?.imageSrc : msg.kind === 'audio' ? msg.mediaRefs?.audioSrc : '';
            if (!src) continue;

            if (!mediaBySrc.has(src)) {
                const blob = await srcToBlob(src);
                if (!blob) {
                    mediaBySrc.set(src, null);
                    continue;
                }

                const baseName = msg.kind === 'audio' ? 'audio' : 'foto';
                const ext = detectExtension(blob, msg.kind === 'audio' ? 'ogg' : 'jpg');
                const fileName = `media/${baseName}-${mediaFiles.length + 1}.${ext}`;
                mediaBySrc.set(src, fileName);
                mediaFiles.push({
                    name: fileName,
                    data: new Uint8Array(await blob.arrayBuffer())
                });
            }

            const mapped = mediaBySrc.get(src);
            if (mapped) {
                msg.mediaPath = mapped;
            }
        }

        const html = buildHtmlForZip(enriched);
        const txt = enriched
            .map((m) => `[${m.time || '--:--'}] (${m.direction}) ${m.author || 'desconhecido'}: ${m.text || ''}`)
            .join('\n');
        const json = JSON.stringify(enriched, null, 2);

        const files = [
            { name: 'chat.html', data: encodeUtf8(html) },
            { name: 'chat.txt', data: encodeUtf8(txt) },
            { name: 'chat.json', data: encodeUtf8(json) },
            ...mediaFiles
        ];

        const zipBytes = buildZip(files);
        const blob = new Blob([zipBytes], { type: 'application/zip' });
        const fileName = `wpp-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        downloadBlob(blob, fileName);
        console.log('[WPP_EXPORT] ZIP salvo:', fileName, '| arquivos:', files.length, '| mídias:', mediaFiles.length);
        return fileName;
    }

    const api = {
        get messages() {
            return state.messages;
        },
        get maxBuffer() {
            return state.maxBuffer;
        },
        set maxBuffer(value) {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
                state.maxBuffer = parsed;
            }
        },
        start,
        stop,
        clear,
        getMessages,
        getStats,
        downloadJson,
        downloadTxt,
        downloadHtml,
        downloadZip
    };

    window.WPP_EXPORT = api;
    console.log('[WPP_EXPORT] wpp-export.js carregado (DOM only)');

    // inicia automaticamente
    start();

    return api;
})();
