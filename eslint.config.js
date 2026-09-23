import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**', 'whatsapp-blur-*.js']
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.webextensions
            }
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    },
    {
        // Shared mutable state of the content-script modules (declared in content-state.js).
        // Registered here so every module can read/write it without per-file global comments.
        files: [
            'content.js',
            'blur-styles.js',
            'whatsapp-dom.js',
            'blur-controller.js',
            'blur-contact.js',
            'user-scanner.js',
            'user-bulk-actions.js',
            'wpp-export.js'
        ],
        languageOptions: {
            globals: {
                isBlurEnabled: 'writable',
                currentSettings: 'writable',
                blurObserver: 'writable',
                lastBlurredElements: 'writable',
                currentChatContext: 'writable',
                managedUsers: 'writable',
                WPP_EXPORT: 'writable'
            }
        }
    },
    {
        files: ['tests/**/*.js', '*.config.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        }
    },
    prettierConfig
];
