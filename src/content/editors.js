// --- Editor handles ---
//
// The extension drives two very different kinds of comment inputs:
//
//   * a plain `<textarea>` (GitHub, and GitLab's "markdown" editing mode)
//   * a ProseMirror/Tiptap `contenteditable` (GitLab's "rich text" editing mode)
//
// Both are wrapped behind the same handle interface so the toolbar code does not
// have to know which one it is talking to:
//
//   mountToolbar(toolbar)              place the toolbar next to the input
//   readPrefix()                       { label, decoration, prettified } | null
//   writePrefix(markdown, prettified)  replace the current CC prefix
//   clearPrefix()                      remove the current CC prefix
//   focus()

import {
  BADGE_LINK_HOST_PATH,
  PLAIN_CC_REGEX,
  BADGE_CC_REGEX,
} from "./conventional-comments.js";

export const RICH_TEXT_SELECTORS = [
  '[data-testid="content_editor_editablebox"] div.ProseMirror[contenteditable="true"]',
  "div.md-content-editor-wrapper div.ProseMirror[contenteditable='true']",
];

// Anchor wrapping a prettified badge; the href is built by `createBadgeMarkdown`.
const BADGE_ANCHOR_SELECTOR = `a[href*="${BADGE_LINK_HOST_PATH}"]`;

const CONTENT_EDITOR_SELECTOR = '[data-testid="content-editor"]';
const CONTENT_EDITOR_HEADER_SELECTOR = '[data-testid="content-editor-header"]';

const RICH_TEXT_WRITE_TIMEOUT_MS = 5000;

export function isRichTextElement(element) {
  return element instanceof HTMLElement && element.isContentEditable;
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// --- Textarea handle ---

class TextareaHandle {
  constructor(textarea) {
    this.element = textarea;
    this.isRichText = false;
  }

  mountToolbar(toolbar) {
    const anchor = this.getMountPoint();
    anchor.parentNode?.insertBefore(toolbar, anchor);
  }

  getMountPoint() {
    const githubWrapper = this.element.closest(
      '[class*="MarkdownInput-module__textArea"], [class*="TextInputBaseWrapper"]'
    );
    const hasGithubMarkdownClass = Array.from(this.element.classList).some(
      (name) => name.startsWith("prc-Textarea-TextArea-")
    );

    // GitHub's new editor wraps the textarea in a flex container; mount above it.
    if (
      (hasGithubMarkdownClass || githubWrapper) &&
      githubWrapper?.parentNode
    ) {
      return githubWrapper;
    }
    return this.element;
  }

  readPrefix() {
    const value = this.element.value;

    const plainMatch = value.match(PLAIN_CC_REGEX);
    if (plainMatch) {
      return {
        label: plainMatch[1],
        decoration: plainMatch[2],
        prettified: false,
      };
    }

    const badgeMatch = value.match(BADGE_CC_REGEX);
    if (badgeMatch) {
      return {
        label: badgeMatch[1],
        decoration: badgeMatch[2],
        prettified: true,
      };
    }

    return null;
  }

  writePrefix(markdown, prettified) {
    const textarea = this.element;
    const currentValue = textarea.value;
    const originalSelectionStart = textarea.selectionStart;
    const originalSelectionEnd = textarea.selectionEnd;

    const match =
      currentValue.match(PLAIN_CC_REGEX) ?? currentValue.match(BADGE_CC_REGEX);
    const initialPrefix = match ? match[0] : "";
    const subject = currentValue.substring(initialPrefix.length);

    // Badges sit on their own line; plain labels stay inline with the comment.
    const newPrefix = prettified ? `${markdown}\n` : markdown;
    const newValue = prettified
      ? newPrefix + subject.trimStart()
      : newPrefix + subject;

    const offset = newPrefix.length - initialPrefix.length;

    textarea.value = newValue;
    textarea.selectionStart = Math.max(0, originalSelectionStart + offset);
    textarea.selectionEnd = Math.max(0, originalSelectionEnd + offset);

    this.notify();
    this.focus();
  }

  clearPrefix() {
    const textarea = this.element;
    const currentValue = textarea.value;
    const match =
      currentValue.match(PLAIN_CC_REGEX) ?? currentValue.match(BADGE_CC_REGEX);
    if (!match) return;

    const removed = match[0].length;
    const selectionStart = Math.max(0, textarea.selectionStart - removed);
    const selectionEnd = Math.max(0, textarea.selectionEnd - removed);

    textarea.value = currentValue.substring(removed);
    textarea.selectionStart = selectionStart;
    textarea.selectionEnd = selectionEnd;

    this.notify();
  }

  notify() {
    this.element.dispatchEvent(new Event("input", { bubbles: true }));
    this.element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  focus() {
    this.element.focus();
  }
}

// --- Rich text (ProseMirror) handle ---

function isBlank(node) {
  return node.nodeType === Node.TEXT_NODE && !node.textContent.trim();
}

function isSeparator(node) {
  return isBlank(node) || node.nodeName === "BR";
}

// Elements ProseMirror injects purely for rendering; they carry no content.
function isArtifact(node) {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node.classList.contains("ProseMirror-trailingBreak") ||
      node.classList.contains("ProseMirror-separator"))
  );
}

// First block-level child of the ProseMirror document, where a prefix would live.
function getFirstBlock(root) {
  return root.firstElementChild;
}

function parseBadgeAnchor(anchor) {
  try {
    const url = new URL(anchor.href, window.location.origin);
    return {
      label: url.searchParams.get("l"),
      decoration: url.searchParams.get("d"),
    };
  } catch {
    return { label: null, decoration: null };
  }
}

// Walks the text nodes of `block` and returns the DOM position `offset` chars in.
function positionAtTextOffset(block, offset) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let consumed = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent.length;
    if (consumed + length >= offset) {
      return { node, offset: offset - consumed };
    }
    consumed += length;
  }

  return null;
}

class RichTextHandle {
  constructor(element) {
    this.element = element;
    this.isRichText = true;
    // Writes are asynchronous (ProseMirror has to observe our DOM selection
    // before it acts on it), so serialize them to survive rapid clicking.
    this.pending = Promise.resolve();
  }

  mountToolbar(toolbar) {
    // GitLab draws the "Write a comment…" placeholder as an absolutely
    // positioned sibling of the editable box, so its top edge is wherever the
    // editor header ends. Anything inserted between the two is rendered
    // underneath it; appending to the header keeps both readable.
    const header = this.element
      .closest(CONTENT_EDITOR_SELECTOR)
      ?.querySelector(`:scope > ${CONTENT_EDITOR_HEADER_SELECTOR}`);

    if (header) {
      header.appendChild(toolbar);
      return;
    }

    // The ProseMirror node must not gain children of ours, so fall back to
    // mounting above its wrapper.
    const anchor = this.element.parentElement ?? this.element;
    anchor.parentNode?.insertBefore(toolbar, anchor);
  }

  // Describes the CC prefix currently rendered in the editor, if any.
  //
  //   range           just the prefix
  //   rangeToDelete   the prefix plus the separator that follows it
  //   hasSeparator    whether whitespace already follows the prefix
  findPrefix() {
    const block = getFirstBlock(this.element);
    if (!block) return null;

    const first = Array.from(block.childNodes).find(
      (node) => !isBlank(node) && !isArtifact(node)
    );

    if (first?.nodeType === Node.ELEMENT_NODE) {
      const anchor = first.matches?.(BADGE_ANCHOR_SELECTOR)
        ? first
        : first.querySelector?.(BADGE_ANCHOR_SELECTOR);

      if (anchor) {
        const range = document.createRange();
        range.setStartBefore(block.firstChild);
        range.setEndAfter(first);

        const rangeToDelete = range.cloneRange();
        let hasSeparator = false;
        for (
          let sibling = first.nextSibling;
          sibling;
          sibling = sibling.nextSibling
        ) {
          if (isArtifact(sibling)) continue;
          if (isSeparator(sibling)) {
            rangeToDelete.setEndAfter(sibling);
            hasSeparator = true;
            continue;
          }
          // The space we add after a badge belongs to the prefix, not the body.
          const leading = sibling.textContent?.match(/^\s+/);
          if (leading && sibling.nodeType === Node.TEXT_NODE) {
            rangeToDelete.setEnd(sibling, leading[0].length);
          }
          hasSeparator ||= Boolean(leading);
          break;
        }

        return {
          range,
          rangeToDelete,
          hasSeparator,
          prettified: true,
          anchor,
          ...parseBadgeAnchor(anchor),
        };
      }
    }

    const match = block.textContent.match(PLAIN_CC_REGEX);
    if (match) {
      const start = positionAtTextOffset(block, 0);
      const end = positionAtTextOffset(block, match[0].length);
      if (!start || !end) return null;

      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);

      return {
        range,
        rangeToDelete: range.cloneRange(),
        hasSeparator: true,
        prettified: false,
        anchor: null,
        label: match[1],
        decoration: match[2],
      };
    }

    return null;
  }

  readPrefix() {
    const found = this.findPrefix();
    if (!found) return null;

    return {
      label: found.label,
      decoration: found.decoration,
      prettified: found.prettified,
    };
  }

  writePrefix(markdown, prettified) {
    return this.enqueue(async () => {
      const previous = await this.selectPrefix();

      if (prettified) {
        // GitLab replaces the selection itself when handling the paste.
        this.pasteMarkdown(markdown);
        await this.awaitBadge(previous?.anchor ?? null);
      } else {
        // Deleting through ProseMirror first keeps atoms (a badge image) from
        // being half-removed by the browser's own text insertion.
        if (previous) this.pressBackspace();
        // Plain prefixes are literal text: typing them preserves the trailing
        // space that a markdown round-trip would otherwise strip.
        document.execCommand("insertText", false, markdown);
      }

      this.focus();
    });
  }

  clearPrefix() {
    return this.enqueue(async () => {
      if (await this.selectPrefix()) this.pressBackspace();
      this.focus();
    });
  }

  enqueue(task) {
    this.pending = this.pending.then(task, task);
    return this.pending;
  }

  // Focuses the editor and selects the existing prefix (collapsing the caret at
  // the start of the document when there is none). Returns the prefix it found.
  async selectPrefix() {
    this.element.focus();

    const found = this.findPrefix();
    this.setSelection(found?.rangeToDelete ?? this.startOfDocument());
    await nextTask();

    return found;
  }

  startOfDocument() {
    const range = document.createRange();
    range.setStart(getFirstBlock(this.element) ?? this.element, 0);
    range.collapse(true);
    return range;
  }

  setSelection(range) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // ProseMirror only reads the DOM selection when it sees `selectionchange`,
    // which browsers fire asynchronously; nudge it so the next write is in sync.
    document.dispatchEvent(new Event("selectionchange"));
  }

  // GitLab's `copyPaste` content-editor extension turns pasted `text/x-gfm` into
  // real nodes (an image inside a link), which is what a badge needs to render.
  pasteMarkdown(markdown) {
    const data = new DataTransfer();
    // GitLab bails out early when `text/plain` is empty, so provide both formats.
    data.setData("text/plain", markdown);
    data.setData("text/x-gfm", markdown);

    this.element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  // ProseMirror maps Backspace to `deleteSelection`, which removes atoms (the
  // badge image) far more reliably than mutating the contenteditable ourselves.
  pressBackspace() {
    this.element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        code: "Backspace",
        keyCode: 8,
        which: 8,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  // Pasting markdown is resolved asynchronously by GitLab: the selection is only
  // dropped a microtask later, and the badge itself lands after a round trip to
  // the markdown renderer. Waiting for merely *a* badge would therefore match the
  // one still on screen and move the caret out of the selection GitLab is about
  // to delete, leaving the old badge behind — so wait for a different node.
  async awaitBadge(previousAnchor) {
    const deadline = Date.now() + RICH_TEXT_WRITE_TIMEOUT_MS;

    const isNewBadge = (found) =>
      found?.prettified && found.anchor !== previousAnchor;

    let found = this.findPrefix();
    while (!isNewBadge(found) && Date.now() < deadline) {
      await nextTask();
      found = this.findPrefix();
    }
    if (!isNewBadge(found)) return;

    const caret = found.range.cloneRange();
    caret.collapse(false);
    this.setSelection(caret);
    await nextTask();

    // The markdown renderer trims the trailing space of the badge prefix.
    if (!found.hasSeparator) document.execCommand("insertText", false, " ");
  }

  focus() {
    this.element.focus();
  }
}

export function createEditorHandle(element) {
  return isRichTextElement(element)
    ? new RichTextHandle(element)
    : new TextareaHandle(element);
}
