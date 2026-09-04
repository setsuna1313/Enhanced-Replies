# Enhance My Reply for SillyTavern

A zero-server, third-party extension for SillyTavern 1.18.0+ that adds a **✨ Enhance** button beside the message composer. It rewrites the current draft with your active chat context, completion API, model, preset, and generation settings, then puts the result back into the composer without sending it. Short drafts can be expanded naturally from the preceding roleplay response.

## Install

In SillyTavern, open **Extensions → Install Extension**, paste this repository's Git URL, and install it. Refresh SillyTavern if prompted. No core-file changes or Extras server are required.

This is the recommended route for hosted instances (Zeabur, Railway, Docker). SillyTavern clones the repository server-side, so no filesystem access is needed — only that `git` is present in the container, that `data/` is on a persistent volume, and, in multi-user mode, that you are signed in as the admin.

For manual installation, place this repository in:

```text
SillyTavern/data/<user>/extensions/Enhance-My-Reply/
```

## Use

1. Write a draft in the normal message box.
2. Select the API/model/preset you want SillyTavern to use.
3. Click **✨ Enhance**, or press **Ctrl+Shift+E** when the shortcut is enabled.
4. Review the replacement text and send it normally.

Press **Ctrl+Shift+Z** to restore your original draft after an enhancement. The original also remains untouched if generation fails, and the button is disabled while generation runs to prevent duplicate requests.

## Settings

Open SillyTavern's Extensions panel and expand **✨ Enhance My Reply**. You can edit the base instruction and independently toggle Markdown preservation, dialogue preservation, first-person/present-tense narration, the boundary against writing for other characters, context-aware expansion of short replies, and the keyboard shortcut.

## Privacy and behavior

The draft, assembled enhancement instruction, and applicable chat context are sent to the completion provider currently configured in SillyTavern. Enhancement uses SillyTavern's quiet background-generation API and does not add either the prompt or result to chat history.

## Development

Run the prompt behavior tests with:

```sh
npm test
```

`index.js` inspects the declaration of `generateQuietPrompt`/`generateRaw` to decide between SillyTavern's options-object and positional signatures, and logs its choice at debug level. Initialization waits for `SillyTavern.getContext()` rather than assuming it exists, since hosted instances can serve the bundle before the app finishes booting.

## License

MIT.
