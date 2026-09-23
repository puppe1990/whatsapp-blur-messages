/* global blurAllUsers, clearAllUsers, clearBlur */
// Performance benchmark for the real engine: builds synthetic chats, applies
// blur/hide and samples frame times while the 500 ms re-apply monitor runs.

const BENCH_SETTINGS = {
    chatListName: true,
    chatListMessage: true,
    chatListAvatar: true,
    headerName: true,
    headerAvatar: true,
    messageText: true,
    messageImages: true
};

const BENCH_AVATAR = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function buildBenchRows(count) {
    const container = document.getElementById('benchRows');
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index++) {
        const row = document.createElement('div');
        row.className = 'bench-row';
        row.setAttribute('role', 'listitem');
        row.tabIndex = -1;

        const avatar = document.createElement('img');
        avatar.src = BENCH_AVATAR;
        avatar.width = 24;
        avatar.height = 24;

        const name = document.createElement('span');
        name.title = `Bench User ${index}`;
        name.textContent = `Bench User ${index}`;

        const preview = document.createElement('span');
        preview.textContent = `Preview message ${index} with some text`;

        row.append(avatar, name, preview);
        fragment.append(row);
    }

    container.innerHTML = '';
    container.append(fragment);
    return count;
}

function buildBenchUsers(count, type) {
    return Array.from({ length: count }, (_, index) => ({
        name: `Bench User ${index}`,
        isBlurred: true,
        blurSettings: BENCH_SETTINGS,
        blurTypeSettings: { type }
    }));
}

function sampleFrames(durationMs) {
    return new Promise((resolve) => {
        const deltas = [];
        const start = performance.now();
        let last = start;

        function frame(now) {
            deltas.push(now - last);
            last = now;

            if (now - start < durationMs) {
                requestAnimationFrame(frame);
            } else {
                resolve(deltas);
            }
        }

        requestAnimationFrame(frame);
    });
}

function countGetComputedStyleCalls() {
    const original = window.getComputedStyle;
    let calls = 0;

    window.getComputedStyle = function (...args) {
        calls++;
        return original.apply(this, args);
    };

    return {
        stop() {
            window.getComputedStyle = original;
            return calls;
        }
    };
}

function collectLongTasks() {
    const tasks = [];

    if (!('PerformanceObserver' in window)) return { tasks, stop: () => {} };

    try {
        const observer = new PerformanceObserver((list) => tasks.push(...list.getEntries()));
        observer.observe({ entryTypes: ['longtask'] });
        return { tasks, stop: () => observer.disconnect() };
    } catch (error) {
        return { tasks, stop: () => {} };
    }
}

function frameStats(deltas) {
    const sorted = [...deltas].sort((a, b) => a - b);
    const total = deltas.reduce((sum, value) => sum + value, 0);

    return {
        frames: deltas.length,
        avg: deltas.length ? total / deltas.length : 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        max: sorted[sorted.length - 1] || 0,
        janky: deltas.filter((value) => value > 50).length
    };
}

function cleanupBench() {
    clearBlur();
    clearAllUsers();
    document.getElementById('wa-blur-style')?.remove();
    document.getElementById('benchRows').innerHTML = '';
}

async function runBenchmark() {
    const output = document.getElementById('benchResult');
    const requested = parseInt(document.getElementById('benchRowCount').value, 10) || 300;
    const count = Math.max(10, Math.min(2000, requested));
    const frameWindow = window.BENCH_FRAME_WINDOW_MS || 3000;
    const lines = [`Synthetic chats: ${count}`];

    cleanupBench();
    buildBenchRows(count);

    let start = performance.now();
    blurAllUsers(buildBenchUsers(count, 'standard'));
    const standardMs = performance.now() - start;
    lines.push(`apply standard blur: ${standardMs.toFixed(1)} ms (${(standardMs / count).toFixed(3)} ms/chat)`);

    const blurredElements = document.querySelectorAll('.wa-blur-target, .wa-blur-image').length;
    const counter = countGetComputedStyleCalls();
    const longTasks = collectLongTasks();
    const deltas = await sampleFrames(frameWindow);
    const styleCalls = counter.stop();
    longTasks.stop();

    const stats = frameStats(deltas);
    lines.push(`blurred elements: ${blurredElements}`);
    lines.push(
        `monitor window (${frameWindow} ms): frames ${stats.frames}, avg ${stats.avg.toFixed(1)} ms, ` +
            `p95 ${stats.p95.toFixed(1)} ms, max ${stats.max.toFixed(1)} ms, frames > 50 ms: ${stats.janky}`
    );
    lines.push(
        `getComputedStyle calls in window: ${styleCalls} (~${((styleCalls / frameWindow) * 1000).toFixed(0)}/s)`
    );
    lines.push(
        `long tasks: ${longTasks.tasks.length}` +
            (longTasks.tasks.length
                ? ` (${longTasks.tasks.map((task) => task.duration.toFixed(0)).join(', ')} ms)`
                : '')
    );

    cleanupBench();
    start = performance.now();
    blurAllUsers(buildBenchUsers(count, 'hide'));
    const hideMs = performance.now() - start;
    lines.push(
        `apply hide: ${hideMs.toFixed(1)} ms (${(hideMs / count).toFixed(3)} ms/chat), ` +
            `collapsed rows: ${document.querySelectorAll('.wa-hidden-row').length}`
    );

    output.textContent = lines.join('\n');
    console.log('[benchmark]', lines);
    return lines;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('benchRunBtn').addEventListener('click', () => {
        // Kept on window so the automated test can await the run
        window.lastBenchmark = runBenchmark().catch((error) => {
            document.getElementById('benchResult').textContent = `Benchmark failed: ${error.message}`;
            throw error;
        });
    });
    document.getElementById('benchCleanBtn').addEventListener('click', cleanupBench);
});
