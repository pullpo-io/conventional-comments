// --- Components of a Conventional Comment ---

export const LABELS = [
  { label: "praise", desc: "Highlight something positive.", color: "#28A745" },
  {
    label: "nitpick",
    desc: "Minor, non-blocking issues (style, naming...).",
    color: "#F59E0B",
  },
  {
    label: "suggestion",
    desc: "Suggest specific improvements.",
    color: "#3B82F6",
  },
  {
    label: "todo",
    desc: "Mark something that needs to be done.",
    color: "#E879F9",
  },
  { label: "issue", desc: "Point out a blocking problem.", color: "#EF4444" },
  { label: "question", desc: "Ask for clarification.", color: "#8B5CF6" },
  { label: "thought", desc: "Share a reflection or idea.", color: "#6B7280" },
  { label: "chore", desc: "Request a minor, non-code task.", color: "#F97316" },
];

export const DECORATIONS = [
  {
    label: "non-blocking",
    desc: "Optional change, doesn't block merge.",
    color: "#9CA3AF",
  },
  {
    label: "blocking",
    desc: "Must be addressed before merge.",
    color: "#374151",
  },
  {
    label: "if-minor",
    desc: "Address if the effort is small.",
    color: "#14B8A6",
  },
];

// --- Selectors for formatted Conventional Comments ---

export const BADGE_LINK_HOST_PATH = "pullpo.io/cc";

export const PLAIN_CC_REGEX =
  /^\s*(?:(praise|nitpick|suggestion|issue|question|thought|chore|todo)\s*(?:\((non-blocking|blocking|if-minor)\))?:)\s*/;
export const BADGE_CC_REGEX =
  /^\s*\[\!\[(?:(praise|nitpick|suggestion|issue|question|thought|chore|todo)(?:\((non-blocking|blocking|if-minor)\))?)\]\(https?:\/\/img\.shields\.io\/badge\/.*?\)\]\(https?:\/\/pullpo\.io\/cc\?.*?\)\s*/;

// --- Badge helpers ---

function getBadgeColor(type) {
  const label = LABELS.find((l) => l.label === type);
  return label ? label.color.substring(1) : "6B7280";
}

export function createBadgeMarkdown(type, decoration) {
  const labelColor = getBadgeColor(type);
  let label = type;
  let message = decoration || "";
  let decorationColor = "";

  if (decoration) {
    const decorObj = DECORATIONS.find((d) => d.label === decoration);
    if (decorObj) {
      decorationColor = decorObj.color.substring(1);
    }
  }

  let badgeUrl;
  const encode = (str) =>
    encodeURIComponent(str.replace(/-/g, "--").replace(/_/g, "__"));

  if (message) {
    if (decorationColor) {
      badgeUrl = `https://img.shields.io/badge/${encode(label)}-${encode(
        message
      )}-${decorationColor}?labelColor=${labelColor}`;
    } else {
      badgeUrl = `https://img.shields.io/badge/${encode(label)}-${encode(
        message
      )}-${labelColor}`;
    }
  } else {
    badgeUrl = `https://img.shields.io/badge/${encode(label)}-${labelColor}`;
  }

  const badge = `![${type}${decoration ? `(${decoration})` : ""}](${badgeUrl})`;
  const pullpoUrl = `https://pullpo.io/cc?l=${encodeURIComponent(type)}${
    decoration ? `&d=${encodeURIComponent(decoration)}` : ""
  }`;
  return `[${badge}](${pullpoUrl}) `;
}

export function createPlainMarkdown(type, decoration) {
  return `${type}${decoration ? `(${decoration})` : ""}: `;
}
