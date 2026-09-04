import { DEFAULT_SETTINGS, buildEnhancementPrompt, normalizeGeneratedText } from './prompt.js';

const MODULE_NAME = 'enhance_my_reply';
const CONTEXT_TIMEOUT_MS = 30000;
let enhancing = false;
let observer = null;
let restoreQueued = false;

function getContext() {
    return globalThis.SillyTavern?.getContext?.();
}

// Cloud installs can serve the extension bundle before SillyTavern finishes
// bootstrapping, so poll rather than throwing and aborting initialization.
function waitForContext(timeout = CONTEXT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        (function poll() {
            const context = getContext();
            if (context) return resolve(context);
            if (Date.now() - started > timeout) return reject(new Error('SillyTavern context never became available.'));
            setTimeout(poll, 250);
        })();
    });
}

function getSettings() {
    const context = getContext();
    if (!context) return { ...DEFAULT_SETTINGS };
    const saved = context.extensionSettings[MODULE_NAME];
    context.extensionSettings[MODULE_NAME] = { ...DEFAULT_SETTINGS, ...(saved || {}) };
    return context.extensionSettings[MODULE_NAME];
}

function saveSetting(key, value) {
    getSettings()[key] = value;
    getContext().saveSettingsDebounced();
}

// SillyTavern moved generateQuietPrompt/generateRaw from positional arguments to
// a single options object. Passing the wrong shape does not throw -- an object
// handed to the positional form stringifies into the prompt -- so inspect the
// declaration instead of guessing or trying both.
function takesOptionsObject(fn) {
    const source = Function.prototype.toString.call(fn);
    return /\(\s*\{/.test(source.slice(0, source.indexOf(')') + 1));
}

async function generate(context, prompt) {
    if (typeof context.generateQuietPrompt === 'function') {
        const fn = context.generateQuietPrompt;
        const objectForm = takesOptionsObject(fn);
        console.debug(`[Enhance My Reply] generateQuietPrompt: ${objectForm ? 'options object' : 'positional'}`);
        return objectForm ? fn({ quietPrompt: prompt }) : fn(prompt);
    }
    if (typeof context.generateRaw === 'function') {
        const fn = context.generateRaw;
        const objectForm = takesOptionsObject(fn);
        console.debug(`[Enhance My Reply] generateRaw: ${objectForm ? 'options object' : 'positional'}`);
        return objectForm ? fn({ prompt }) : fn(prompt);
    }
    throw new Error('This SillyTavern version does not expose background generation.');
}

function setButtonState(busy) {
    const button = document.querySelector('#enhance-my-reply-button');
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('enhance-my-reply--busy', busy);
    button.setAttribute('aria-busy', String(busy));
    button.title = busy ? 'Enhancing reply…' : 'Enhance reply (Ctrl+Shift+E)';
    button.querySelector('.enhance-my-reply-label').textContent = busy ? 'Enhancing…' : 'Enhance';
}

function notify(type, message) {
    const toast = globalThis.toastr?.[type];
    if (typeof toast === 'function') toast(message, 'Enhance My Reply');
    else console[type === 'error' ? 'error' : 'info'](`[Enhance My Reply] ${message}`);
}

export async function enhanceCurrentReply() {
    if (enhancing) return;

    const textarea = document.querySelector('#send_textarea');
    const draft = textarea?.value?.trim();
    if (!textarea || !draft) {
        notify('warning', 'Write a draft before enhancing it.');
        textarea?.focus();
        return;
    }

    const context = getContext();
    if (!context) {
        notify('error', 'SillyTavern is still loading. Try again in a moment.');
        return;
    }

    enhancing = true;
    setButtonState(true);
    try {
        const enhancementPrompt = buildEnhancementPrompt(draft, getSettings());
        // Quiet generation includes the active chat/character context. The raw
        // fallback retains compatibility if an installation omits that helper.
        const enhanced = normalizeGeneratedText(await generate(context, enhancementPrompt));
        if (!enhanced) throw new Error('The model returned an empty reply.');

        textarea.dataset.enhanceMyReplyOriginal = draft;
        textarea.value = enhanced;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.focus();
        textarea.setSelectionRange(enhanced.length, enhanced.length);
        notify('success', 'Reply enhanced. Ctrl+Shift+Z restores your draft.');
    } catch (error) {
        console.error('[Enhance My Reply] Generation failed:', error);
        notify('error', error?.message || 'Could not enhance the reply.');
    } finally {
        enhancing = false;
        setButtonState(false);
    }
}

export function revertLastEnhancement() {
    const textarea = document.querySelector('#send_textarea');
    const original = textarea?.dataset?.enhanceMyReplyOriginal;
    if (!original) {
        notify('warning', 'No enhanced draft to restore.');
        return;
    }
    textarea.value = original;
    delete textarea.dataset.enhanceMyReplyOriginal;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(original.length, original.length);
    notify('info', 'Original draft restored.');
}

function createButton() {
    if (document.querySelector('#enhance-my-reply-button')) return true;
    const textarea = document.querySelector('#send_textarea');
    if (!textarea) return false;

    const button = document.createElement('button');
    button.id = 'enhance-my-reply-button';
    button.className = 'menu_button interactable';
    button.type = 'button';
    button.title = 'Enhance reply (Ctrl+Shift+E)';
    button.setAttribute('aria-label', 'Enhance reply');
    button.innerHTML = '<span aria-hidden="true">✨</span><span class="enhance-my-reply-label">Enhance</span>';
    button.addEventListener('click', enhanceCurrentReply);
    textarea.insertAdjacentElement('afterend', button);
    return true;
}

function settingRow(id, label, description) {
    return `<label class="checkbox_label enhance-my-reply-check" for="${id}">
        <input id="${id}" type="checkbox">
        <span>${label}<small>${description}</small></span>
    </label>`;
}

function createSettings() {
    if (document.querySelector('#enhance-my-reply-settings')) return;
    const host = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
    if (!host) return;

    const panel = document.createElement('div');
    panel.id = 'enhance-my-reply-settings';
    panel.className = 'enhance-my-reply-settings';
    panel.innerHTML = `<div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>✨ Enhance My Reply</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label for="enhance-my-reply-prompt">Enhancement prompt</label>
            <textarea id="enhance-my-reply-prompt" class="text_pole" rows="7"></textarea>
            ${settingRow('enhance-my-reply-markdown', 'Preserve Markdown', 'Keep action markers, emphasis, and paragraph formatting.')}
            ${settingRow('enhance-my-reply-dialogue', 'Preserve dialogue', 'Keep spoken lines and their intended meaning.')}
            ${settingRow('enhance-my-reply-pov', 'First-person, present tense', 'Ask the model to keep “I” narration in the present.')}
            ${settingRow('enhance-my-reply-boundary', 'Do not write for other characters', 'Limit additions to your character’s words and actions.')}
            ${settingRow('enhance-my-reply-expand', 'Expand short replies from chat context', 'Use the preceding roleplay message to develop brief drafts naturally.')}
            ${settingRow('enhance-my-reply-shortcut', 'Enable Ctrl+Shift+E', 'Enhance the current draft from the keyboard. Ctrl+Shift+Z restores it.')}
            <small class="enhance-my-reply-note">Uses the active chat context plus the currently selected completion API, model, preset, and generation settings. The result replaces your draft but is not sent.</small>
        </div>
    </div>`;
    host.append(panel);

    const settings = getSettings();
    const bindings = {
        'enhance-my-reply-prompt': ['prompt', 'value'],
        'enhance-my-reply-markdown': ['preserveMarkdown', 'checked'],
        'enhance-my-reply-dialogue': ['preserveDialogue', 'checked'],
        'enhance-my-reply-pov': ['firstPersonPresent', 'checked'],
        'enhance-my-reply-boundary': ['preventOtherCharacters', 'checked'],
        'enhance-my-reply-expand': ['expandShortReplies', 'checked'],
        'enhance-my-reply-shortcut': ['keyboardShortcut', 'checked'],
    };
    for (const [id, [key, property]] of Object.entries(bindings)) {
        const control = document.getElementById(id);
        control[property] = settings[key];
        control.addEventListener(property === 'value' ? 'input' : 'change', () => saveSetting(key, control[property]));
    }
}

function handleShortcut(event) {
    if (!event.ctrlKey || !event.shiftKey || event.altKey) return;
    if (event.code !== 'KeyE' && event.code !== 'KeyZ') return;
    if (!getSettings().keyboardShortcut) return;
    event.preventDefault();
    if (event.code === 'KeyE') enhanceCurrentReply();
    else revertLastEnhancement();
}

// Themes and mobile layouts rebuild the composer, so the button has to be
// restored -- but the callback fires on every streamed token, so scope the
// observer to the composer and bail immediately once the button is present.
function watchComposer() {
    observer?.disconnect();
    const target = document.querySelector('#send_form') || document.body;
    observer = new MutationObserver(() => {
        if (restoreQueued || document.querySelector('#enhance-my-reply-button')) return;
        restoreQueued = true;
        requestAnimationFrame(() => {
            restoreQueued = false;
            if (createButton() && target === document.body) watchComposer();
        });
    });
    observer.observe(target, { childList: true, subtree: true });
}

async function initialize() {
    try {
        await waitForContext();
    } catch (error) {
        console.error('[Enhance My Reply]', error);
        return;
    }
    getSettings();
    createButton();
    createSettings();
    document.addEventListener('keydown', handleShortcut);
    watchComposer();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
