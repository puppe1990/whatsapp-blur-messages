// Minimal chrome API stub so test.html can load the real content-script
// modules: they register a message listener and read storage at load time.
// globalThis is used because in the jsdom-based tests window !== globalThis.
function createStorageArea() {
    return {
        get: (keys, callback) => callback({}),
        remove: (keys, callback) => {
            if (callback) callback();
        },
        set: (values, callback) => {
            if (callback) callback();
        }
    };
}

globalThis.chrome = Object.assign(globalThis.chrome || {}, {
    runtime: {
        lastError: null,
        onMessage: { addListener: () => {} }
    },
    storage: {
        sync: createStorageArea(),
        local: createStorageArea()
    }
});
