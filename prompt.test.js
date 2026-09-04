import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, buildEnhancementPrompt, normalizeGeneratedText } from './prompt.js';

test('builds a delimited prompt with enabled constraints', () => {
    const result = buildEnhancementPrompt('*I wave.* "Hi."', DEFAULT_SETTINGS);
    assert.match(result, /Preserve the draft's Markdown conventions/);
    assert.match(result, /Preserve every spoken line/);
    assert.match(result, /Do not write actions, thoughts/);
    assert.match(result, /immediately preceding roleplay message/);
    assert.doesNotMatch(result, /first person and present tense/);
    assert.match(result, /<draft>\n\*I wave\.\* "Hi\."\n<\/draft>/);
});

test('honors disabled constraints and custom prompt', () => {
    const result = buildEnhancementPrompt('draft', {
        ...DEFAULT_SETTINGS,
        prompt: 'Make it sparkle.',
        preserveMarkdown: false,
        preserveDialogue: false,
        preventOtherCharacters: false,
        expandShortReplies: false,
        firstPersonPresent: true,
    });
    assert.ok(result.startsWith('Make it sparkle.'));
    assert.match(result, /first person and present tense/);
    assert.doesNotMatch(result, /Markdown conventions|spoken line|other character|preceding roleplay/);
});

test('unwraps a single model-added Markdown fence', () => {
    assert.equal(normalizeGeneratedText('```markdown\n*I smile.*\n```'), '*I smile.*');
    assert.equal(normalizeGeneratedText('  Plain reply  '), 'Plain reply');
});
