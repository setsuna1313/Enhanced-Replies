export const DEFAULT_PROMPT = `Rewrite the draft below into a more vivid, polished roleplay reply. Improve clarity, flow, sensory detail, and emotional nuance without changing the author's intent. Return only the enhanced reply, with no commentary, labels, or quotation marks around it.`;

export const DEFAULT_SETTINGS = Object.freeze({
    prompt: DEFAULT_PROMPT,
    preserveMarkdown: true,
    preserveDialogue: true,
    firstPersonPresent: false,
    preventOtherCharacters: true,
    expandShortReplies: true,
    keyboardShortcut: true,
});

export function buildEnhancementPrompt(draft, settings) {
    const rules = [];

    if (settings.preserveMarkdown) {
        rules.push('Preserve the draft\'s Markdown conventions exactly (including asterisks, quotation marks, paragraph breaks, and other formatting).');
    }
    if (settings.preserveDialogue) {
        rules.push('Preserve every spoken line and its meaning; polish its delivery only, and do not remove dialogue.');
    }
    if (settings.firstPersonPresent) {
        rules.push('Write consistently in first person and present tense.');
    }
    if (settings.preventOtherCharacters) {
        rules.push('Do not write actions, thoughts, feelings, or new dialogue for any other character. Only expand the reply writer\'s own words and actions.');
    }
    if (settings.expandShortReplies) {
        rules.push('If the draft is short or sparse, expand it into a fuller roleplay reply using relevant details, actions, atmosphere, and emotional cues from the immediately preceding roleplay message and conversation context. Treat that context only as grounding: preserve the draft writer\'s intent, do not invent major decisions, and do not merely summarize or repeat the previous message.');
    }

    const instruction = String(settings.prompt || DEFAULT_PROMPT).trim();
    const constraints = rules.length ? `\n\nConstraints:\n- ${rules.join('\n- ')}` : '';
    return `${instruction}${constraints}\n\nDRAFT TO ENHANCE:\n<draft>\n${draft}\n</draft>\n\nReturn only the enhanced reply.`;
}

export function normalizeGeneratedText(value) {
    let text = String(value ?? '').trim();
    const fenced = text.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
    if (fenced) text = fenced[1].trim();
    return text;
}
