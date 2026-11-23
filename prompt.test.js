import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_PROMPT,
    DEFAULT_SETTINGS,
    LEGACY_DEFAULT_PROMPTS,
    buildEnhancementPrompt,
    migrateSettings,
    normalizeGeneratedText,
} from './prompt.js';

test('builds a delimited prompt with enabled constraints', () => {
    const result = buildEnhancementPrompt('*I wave.* "Hi."', DEFAULT_SETTINGS);
    assert.match(result, /Preserve the draft's Markdown conventions/);
    assert.match(result, /Preserve every line \{\{user\}\} speaks/);
    assert.match(result, /Never write dialogue, actions, decisions, thoughts, or feelings for \{\{char\}\}/);
    assert.match(result, /Do not continue, repeat, or summarize \{\{char\}\}'s last message/);
    assert.doesNotMatch(result, /first person and present tense/);
    assert.match(result, /<draft>\n\*I wave\.\* "Hi\."\n<\/draft>/);
});

test('always frames the task as editing the user\'s turn, even with a custom prompt and all toggles off', () => {
    const result = buildEnhancementPrompt('draft', {
        ...DEFAULT_SETTINGS,
        prompt: 'Make it sparkle.',
        preserveMarkdown: false,
        preserveDialogue: false,
        preventOtherCharacters: false,
        expandShortReplies: false,
        firstPersonPresent: true,
    });
    assert.match(result, /you are NOT \{\{char\}\}/);
    assert.match(result, /Make it sparkle\./);
    assert.match(result, /first person and present tense, where "I" is \{\{user\}\}/);
    assert.match(result, /written as \{\{user\}\}\.$/);
    assert.doesNotMatch(result, /Markdown conventions|speaks in the draft|Never write dialogue|fuller reply/);
});

test('substitutes character names when provided', () => {
    const result = buildEnhancementPrompt('*I nod.*', DEFAULT_SETTINGS, { user: 'Mira', char: 'Kael' });
    assert.doesNotMatch(result, /\{\{user\}\}|\{\{char\}\}/i);
    assert.match(result, /you are NOT Kael/);
    assert.match(result, /written as Mira\.$/);
});

test('default prompt is user-POV', () => {
    assert.match(DEFAULT_PROMPT, /Write exclusively from \{\{user\}\}'s point of view/);
});

test('migrates the legacy default prompt but keeps custom prompts', () => {
    assert.equal(migrateSettings({ prompt: LEGACY_DEFAULT_PROMPTS[0] }).prompt, DEFAULT_PROMPT);
    assert.equal(migrateSettings({ prompt: 'My own prompt' }).prompt, 'My own prompt');
    assert.equal(migrateSettings(undefined).prompt, DEFAULT_PROMPT);
});

test('unwraps a single model-added Markdown fence', () => {
    assert.equal(normalizeGeneratedText('```markdown\n*I smile.*\n```'), '*I smile.*');
    assert.equal(normalizeGeneratedText('  Plain reply  '), 'Plain reply');
});
