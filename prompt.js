// Earlier releases shipped these as the default instruction. Saved settings that
// still hold one verbatim are migrated to the current default on load.
export const LEGACY_DEFAULT_PROMPTS = Object.freeze([
    `Rewrite the draft below into a more vivid, polished roleplay reply. Improve clarity, flow, sensory detail, and emotional nuance without changing the author's intent. Return only the enhanced reply, with no commentary, labels, or quotation marks around it.`,
]);

export const DEFAULT_PROMPT = `Rewrite and enhance the draft below into a vivid, immersive, detailed, and polished roleplay response while preserving the original author's intent, characterization, tone, and narrative direction.

Point of View & Character Control:
- Write exclusively from {{user}}'s point of view, maintaining the original narrative perspective and tense.
- Focus on {{user}}'s thoughts, emotions, dialogue, physical actions, reactions, and sensory experiences.
- Never narrate {{char}}'s internal thoughts, feelings, intentions, or motivations as established facts.
- Do not control {{char}}'s dialogue, decisions, or actions unless absolutely necessary for natural scene progression or explicitly established in the original draft.
- Other characters and NPCs may be introduced, developed, and given dialogue, actions, personalities, and reactions when appropriate to enrich the scene.
- Maintain {{user}}'s established personality, mannerisms, relationships, and emotional responses.

Writing & Immersion:
- Expand the original draft with richer descriptions, natural dialogue, meaningful actions, subtle gestures, body language, and emotional depth.
- Incorporate atmospheric setting descriptions, including lighting, weather, sounds, scents, textures, surroundings, and environmental details where relevant.
- Enhance interactions through realistic conversations, expressive reactions, pauses, interruptions, and natural character behavior.
- Explore {{user}}'s internal thoughts, observations, memories, and emotional responses without excessive repetition or unnecessary exposition.
- Show emotions through behavior, dialogue, physical sensations, and subtle reactions rather than simply stating them.
- Introduce background activity, environmental interactions, and supporting characters when they contribute naturally to the scene.
- Improve pacing, transitions, sentence variety, grammar, clarity, and narrative flow.
- Use descriptive, engaging prose that feels natural, immersive, and emotionally nuanced rather than overly poetic, repetitive, or melodramatic.
- Make the response feel like a complete, living scene rather than a simple expansion of the original text.

Creative Expansion & Continuity:
- You may creatively expand conversations, actions, environmental details, and interactions beyond what is explicitly written.
- Preserve all important events, dialogue intentions, character dynamics, and established story details.
- Do not introduce major plot developments, unexpected time skips, or significant changes to the scene unless the original draft supports them.
- Ensure additional details feel organic and consistent with the setting, genre, atmosphere, and existing relationships.
- Give supporting characters distinct voices and believable reactions without allowing them to overshadow {{user}}.
- Allow scenes to develop naturally without rushing toward a conclusion.
- Leave room for {{char}} to respond and influence what happens next.

Output Requirements:
- Return only the fully rewritten and enhanced roleplay response.
- Do not include commentary, explanations, headings, labels, introductory statements, or quotation marks surrounding the response.
- Maintain exclusive focus on {{user}}'s narrative perspective.
- Write in immersive, well-developed paragraphs with naturally integrated dialogue.
- Prioritize quality, detail, emotional authenticity, and scene immersion over unnecessary length.
- Do not summarize the original draft. Transform it into a richer, more engaging roleplay scene.`;

export const DEFAULT_SETTINGS = Object.freeze({
    // 'raw': only the enhancement instructions, short character notes and recent chat
    // are sent. 'classic': the request goes through the full preset as a quiet prompt.
    mode: 'raw',
    prompt: DEFAULT_PROMPT,
    preserveMarkdown: true,
    preserveDialogue: true,
    firstPersonPresent: false,
    preventOtherCharacters: true,
    expandShortReplies: true,
    keyboardShortcut: true,
});

export function migrateSettings(saved) {
    const settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
    if (LEGACY_DEFAULT_PROMPTS.includes(String(settings.prompt).trim())) settings.prompt = DEFAULT_PROMPT;
    return settings;
}

// The quiet-generation request carries the character card and system prompt, which
// tell the model it *is* {{char}}. Without an explicit override it rewrites the
// draft as {{char}}'s next turn, so this framing is always sent, whatever the
// user's custom instruction says.
const ROLE_FRAMING = `[OUT-OF-CHARACTER TASK — pause the roleplay. For this task you are NOT {{char}} and you are not writing {{char}}'s next turn. You are an editor polishing a message that {{user}} (the human player) has drafted. The draft is {{user}}'s own turn: everything in it is said, done, thought, or felt by {{user}}. Your rewrite must remain {{user}}'s turn, written from {{user}}'s perspective, and must end in a place where {{char}} has not yet responded.]`;

export function applyNames(text, { user, char } = {}) {
    let result = String(text);
    if (user) result = result.replace(/\{\{user\}\}/gi, user);
    if (char) result = result.replace(/\{\{char\}\}/gi, char);
    return result;
}

export function buildEnhancementPrompt(draft, settings, names = {}) {
    const rules = [
        'Treat the draft as {{user}}\'s message. Do not reply to it, answer it, or continue the story from {{char}}\'s side.',
    ];

    if (settings.preserveMarkdown) {
        rules.push('Preserve the draft\'s Markdown conventions exactly (including asterisks, quotation marks, paragraph breaks, and other formatting).');
    }
    if (settings.preserveDialogue) {
        rules.push('Preserve every line {{user}} speaks in the draft and its meaning; polish its delivery only, and do not remove dialogue.');
    }
    if (settings.firstPersonPresent) {
        rules.push('Write consistently in first person and present tense, where "I" is {{user}}.');
    }
    if (settings.preventOtherCharacters) {
        rules.push('Never write dialogue, actions, decisions, thoughts, or feelings for {{char}}. {{char}} will respond separately after this message is sent.');
    }
    if (settings.expandShortReplies) {
        rules.push('If the draft is short or sparse, expand it into a fuller reply from {{user}}. Use the latest chat messages only as grounding for setting and for what {{user}} is reacting to. Do not continue, repeat, or summarize {{char}}\'s last message, and do not invent major decisions for {{user}}.');
    }

    const instruction = String(settings.prompt || DEFAULT_PROMPT).trim();
    const prompt = `${ROLE_FRAMING}\n\n${instruction}\n\nConstraints:\n- ${rules.join('\n- ')}\n\nDRAFT BY {{user}} TO ENHANCE:\n<draft>\n${draft}\n</draft>\n\nReturn only the enhanced version of {{user}}'s message, written as {{user}}.`;
    return applyNames(prompt, names);
}

const RAW_EDITOR_ROLE = `You are a writing editor, not a roleplay participant. You are given notes about a roleplay, its most recent messages, and a draft that the human player wrote for their character, {{user}}. Your only job is to rewrite that draft as an enhanced message from {{user}}.

The chat transcript is reference material. Its messages may contain their own formatting (status boards, HTML panels, group chats, commentary, choice lists) and their own rules: those belong to {{char}}'s side of the story. Never reproduce them, never continue {{char}}'s message, and never write {{char}}'s reply.`;

const clip = (text, max) => {
    const t = String(text || '').trim();
    return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
};

/**
 * Builds a self-contained request that does not go through the roleplay preset, so preset
 * rules such as "never write {{user}}" or mandatory info boards cannot override the task.
 * history: [{ name, text }] oldest first, already stripped to plain text.
 * Returns { system, user } with {{user}}/{{char}} macros still in place.
 */
export function buildRawEnhancement({ draft, settings, charName = '', charDescription = '', userName = '', personaDescription = '', history = [], maxHistoryChars = 12000 }) {
    const lines = [];
    let budget = maxHistoryChars;
    for (let i = history.length - 1; i >= 0; i--) {
      const { name, text } = history[i];
      const line = `${name}: ${clip(text, 4000)}`;
      if (line.length > budget && lines.length) break;
      lines.unshift(line);
      budget -= line.length;
    }
    const system = `${RAW_EDITOR_ROLE}\n\n${buildEnhancementPrompt('', settings).split('\n\nDRAFT BY')[0]}`;
    const user = [
      `<player_character>\nName: ${userName || '{{user}}'}${personaDescription ? `\n${clip(personaDescription, 1500)}` : ''}\n</player_character>`,
      `<other_character>\nName: ${charName || '{{char}}'}${charDescription ? `\n${clip(charDescription, 2000)}` : ''}\n</other_character>`,
      lines.length ? `<recent_chat>\n${lines.join('\n\n')}\n</recent_chat>` : '',
      `<draft author="{{user}}">\n${draft}\n</draft>`,
      'Rewrite the draft above as {{user}}\'s enhanced message. Output only that message: no info boards, HTML, group chats, commentary, or anything written for {{char}}.',
    ].filter(Boolean).join('\n\n');
    return { system, user };
}

export function plainText(value) {
    return String(value || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function normalizeGeneratedText(value) {
    let text = String(value ?? '').trim();
    const fenced = text.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
    if (fenced) text = fenced[1].trim();
    return text;
}
