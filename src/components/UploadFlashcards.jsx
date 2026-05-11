import React, { useState } from "react";

const IMAGE_FILE_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const REMOTE_OR_EMBEDDED_RE = /^(https?:|data:image\/|blob:)/i;

export default function UploadFlashcards({
  onUpload,
  onStateImported,
  expectedPaths = [],
}) {
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState("");

  function normalizePath(path) {
    return path
      .replace(/\\/g, "/")
      .split("/")
      .reduce((parts, part) => {
        if (!part || part === ".") return parts;
        if (part === "..") return parts.slice(0, -1);
        return parts.concat(part);
      }, [])
      .join("/");
  }

  function dirname(path) {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
  }

  function buildAssetMap(files) {
    const byPath = new Map();
    const byLowerPath = new Map();
    const byName = new Map();
    const nameCounts = new Map();

    files
      .filter((file) => IMAGE_FILE_RE.test(file.name))
      .forEach((file) => {
        const path = normalizePath(file.webkitRelativePath || file.name);
        const url = URL.createObjectURL(file);
        const name = file.name.toLowerCase();

        byPath.set(path, url);
        byLowerPath.set(path.toLowerCase(), url);
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        byName.set(name, url);
      });

    return { byPath, byLowerPath, byName, nameCounts };
  }

  function resolveImageSrc(src, basePath, assetMap) {
    if (!src || typeof src !== "string") {
      return { src: "", assetPath: "" };
    }

    const trimmed = src.trim();
    if (REMOTE_OR_EMBEDDED_RE.test(trimmed)) {
      return { src: trimmed, assetPath: "" };
    }

    const candidates = [
      normalizePath(trimmed),
      normalizePath(`${dirname(basePath)}/${trimmed}`),
    ];

    for (const candidate of candidates) {
      const direct = assetMap.byPath.get(candidate);
      if (direct) return { src: direct, assetPath: candidate };

      const lower = assetMap.byLowerPath.get(candidate.toLowerCase());
      if (lower) return { src: lower, assetPath: candidate };
    }

    const fileName = normalizePath(trimmed).split("/").pop().toLowerCase();
    if (assetMap.nameCounts.get(fileName) === 1) {
      return { src: assetMap.byName.get(fileName), assetPath: fileName };
    }

    return { src: "", assetPath: "" };
  }

  function normalizeTextBlock(text) {
    const value = typeof text === "string" ? text.trim() : "";
    return value ? [{ type: "text", text: value }] : [];
  }

  function normalizeImageWidth(width) {
    if (typeof width === "number" && width > 0) return width;
    if (typeof width !== "string") return undefined;

    const value = width.trim();
    return value ? value : undefined;
  }

  function normalizeImageBlock(block, basePath, assetMap) {
    const rawSrc = block.src || block.url || block.image;
    const resolved = resolveImageSrc(rawSrc, basePath, assetMap);

    if (!rawSrc) return [];

    return [
      {
        type: "image",
        src: resolved.src,
        source: rawSrc,
        assetPath: resolved.assetPath,
        alt: block.alt || block.caption || "",
        width: normalizeImageWidth(block.width),
      },
    ];
  }

  function normalizeSide(value, basePath, assetMap) {
    if (typeof value === "string") {
      return normalizeTextBlock(value);
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => normalizeSide(item, basePath, assetMap));
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    if (Array.isArray(value.blocks)) {
      return normalizeSide(value.blocks, basePath, assetMap);
    }

    const blocks = [];
    if (value.type === "image" || value.image || value.src || value.url) {
      blocks.push(...normalizeImageBlock(value, basePath, assetMap));
    }

    if (value.type === "text" || value.text) {
      blocks.push(...normalizeTextBlock(value.text));
    }

    if (value.caption && !value.alt) {
      blocks.push(...normalizeTextBlock(value.caption));
    }

    return blocks;
  }

  function blocksToPlainText(blocks) {
    return blocks
      .map((block) => {
        if (block.type === "text") return block.text;
        if (block.type === "image")
          return block.alt || block.source || "[image]";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  /* ────────────────────────────────────────────────────────── */
  /* 1. splitCSVLine(line) → [field1, field2, …]               */
  /*    Small RFC-4180 parser:                                  */
  /*    • Comma outside quotes signals a new column             */
  /*    • \"\" inside quotes resolves to one literal quote      */
  /* ────────────────────────────────────────────────────────── */
  function splitCSVLine(line) {
    const fields = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // If we're inside quotes and the next character is also a quote,
        // treat it as an escaped quote.
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  /* strip wrapper quotes + trim whitespace */
  const stripOuterQuotes = (s) => {
    let t = s.trim();
    if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
      t = t.slice(1, -1);
    }
    return t;
  };

  /* ────────────────────────────────────────────────────────── */
  /* 2. parseCsv(text, basePath) → Array<{ id, path, rowIndex, front, back }> */
  /*    Now we also keep rowIndex so we can sort later.           */
  /* ────────────────────────────────────────────────────────── */
  function parseCsv(text, basePath) {
    return text
      .trim()
      .split(/\r?\n/) // handle Unix/macOS (\n) or Windows (\r\n)
      .map((raw, idx) => {
        const cells = splitCSVLine(raw);
        if (cells.length < 2) return null; // skip malformed lines

        const front = stripOuterQuotes(cells[0]);
        const back = stripOuterQuotes(cells[1]);

        if (!front || !back) return null;

        return {
          id: `${basePath}__${idx}`, // stable ID
          path: basePath, // used for sorting by filename
          rowIndex: idx, // original line index
          front,
          back,
          frontContent: [{ type: "text", text: front }],
          backContent: [{ type: "text", text: back }],
        };
      })
      .filter(Boolean); // drop null entries
  }

  function parseDeckJson(text, basePath, assetMap) {
    const parsed = JSON.parse(text);
    const rawCards = Array.isArray(parsed) ? parsed : parsed.cards;

    if (!Array.isArray(rawCards)) {
      throw new Error(
        `${basePath} is not a deck JSON file. Expected a top-level cards array.`
      );
    }

    return rawCards
      .map((card, idx) => {
        if (!card || typeof card !== "object") return null;

        const frontValue = card.front ?? card.term ?? card.question;
        const backValue = card.back ?? card.definition ?? card.answer;
        const frontContent = normalizeSide(frontValue, basePath, assetMap);
        const backContent = normalizeSide(backValue, basePath, assetMap);

        if (!frontContent.length || !backContent.length) return null;

        return {
          id: `${basePath}__${card.id ?? idx}`,
          path: basePath,
          rowIndex: idx,
          front: blocksToPlainText(frontContent),
          back: blocksToPlainText(backContent),
          frontContent,
          backContent,
        };
      })
      .filter(Boolean);
  }

  /* ────────────────────────────────────────────────────────── */
  /* 3. handleFiles(e): read each selected file, parse, upload */
  /*    New: if a state.json has been imported, we verify the  */
  /*    uploaded CSV paths exactly match the required list.     */
  /* ────────────────────────────────────────────────────────── */
  async function handleFiles(e) {
    setError("");
    setImportStatus("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const assetMap = buildAssetMap(files);

    // 1) Keep deck sources only. state.json is reserved for progress restore.
    let deckFiles = files.filter((file) => {
      const lower = file.name.toLowerCase();
      return (
        lower.endsWith(".csv") ||
        (lower.endsWith(".json") && lower !== "state.json")
      );
    });

    if (!deckFiles.length) {
      setError("No .csv or deck .json files found in your selection.");
      return;
    }

    // 2) Sort the FileList by alphabetical path (or name)
    deckFiles.sort((a, b) => {
      const pa = a.webkitRelativePath || a.name;
      const pb = b.webkitRelativePath || b.name;
      return pa.localeCompare(pb, undefined, { sensitivity: "base" });
    });

    try {
      // 3) Read & parse all deck files IN ORDER
      const allParsed = await Promise.all(
        deckFiles.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const basePath = file.webkitRelativePath || file.name;
              try {
                if (file.name.toLowerCase().endsWith(".json")) {
                  resolve(parseDeckJson(reader.result, basePath, assetMap));
                } else {
                  resolve(parseCsv(reader.result, basePath));
                }
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = () =>
              reject(
                new Error(
                  `Failed to read “${file.name}”: ${
                    reader.error?.message || ""
                  }`
                )
              );
            reader.readAsText(file);
          });
        })
      );

      // 4) Flatten
      const allCards = allParsed.flat();

      if (!allCards.length) {
        setError(
          "No cards found. CSVs need “term,definition” rows; deck JSON needs a cards array."
        );
        return;
      }

      // 5) FINAL SORT: ensure global alphabetical by (path, rowIndex)
      allCards.sort((a, b) => {
        if (a.path === b.path) {
          return a.rowIndex - b.rowIndex;
        }
        return a.path.localeCompare(b.path, undefined, {
          sensitivity: "base",
        });
      });

      // 5b) NEW: If we imported state.json earlier, verify exact path match.
      if (expectedPaths.length > 0) {
        const uploadedPaths = Array.from(
          new Set(allCards.map((c) => c.path))
        ).sort();
        const required = expectedPaths.slice().sort();
        const missing = required.filter((p) => !uploadedPaths.includes(p));
        const extra = uploadedPaths.filter((p) => !required.includes(p));
        if (missing.length || extra.length) {
          setError(
            [
              missing.length ? `Missing: ${missing.join(", ")}` : null,
              extra.length ? `Extra: ${extra.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" | ")
          );
          return;
        }
      }

      // 6) Hand off to StudyFlashcards
      onUpload(allCards);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while reading CSV files."
      );
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /* 0b. New: handle state.json import                          */
  /*     - Minimal validation: require a non-empty `paths` arr. */
  /*     - Bubble parsed object to parent via onStateImported.  */
  /* ────────────────────────────────────────────────────────── */
  async function handleStateImport(e) {
    setError("");
    setImportStatus("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please select a .json file.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (
        !parsed ||
        !Array.isArray(parsed.paths) ||
        parsed.paths.length === 0
      ) {
        setError("Invalid state.json: missing ‘paths’ array.");
        return;
      }

      onStateImported?.(parsed);
      setImportStatus(
        "State imported. Now upload the required CSV files listed below."
      );
    } catch (err) {
      console.error(err);
      setError("Failed to parse state.json.");
    } finally {
      // Allow re-selecting the same file
      e.target.value = "";
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /* 4. UI                                                     */
  /* ────────────────────────────────────────────────────────── */
  const hasExpected = expectedPaths && expectedPaths.length > 0;

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-100 text-center">
          Locked In
        </h1>

        <p className="text-gray-400 mb-4 text-center">
          Upload CSV or deck JSON files to start studying, or{" "}
          <strong>import a state.json</strong> to resume a previous session.
        </p>

        <div className="flex justify-center gap-4 flex-wrap mb-2">
          {/* New: Import state.json */}
          <label className="relative cursor-pointer">
            <input
              type="file"
              accept="application/json,.json"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleStateImport}
            />
            <span className="inline-block w-48 text-center px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg">
              Import state.json
            </span>
          </label>

          {/* Select File(s) */}
          <label className="relative cursor-pointer">
            <input
              type="file"
              multiple
              accept=".csv,.json,image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFiles}
            />
            <span className="inline-block w-48 text-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
              Select File(s)
            </span>
          </label>

          {/* Select Folder */}
          <label className="relative cursor-pointer">
            <input
              type="file"
              webkitdirectory=""
              multiple
              accept=".csv,.json,image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFiles}
            />
            <span className="inline-block w-48 text-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">
              Select Folder
            </span>
          </label>
        </div>

        {importStatus && (
          <p className="text-emerald-400 text-sm text-center">{importStatus}</p>
        )}
        {error && (
          <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
        )}

        {/* New: Required files list (after importing state.json) */}
        {hasExpected && (
          <div className="bg-gray-900 p-4 rounded-lg mt-4">
            <h3 className="text-gray-100 font-semibold mb-2">
              Required deck files
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              Upload exactly these paths (names and folder structure must
              match):
            </p>
            <ul className="list-disc list-inside text-gray-300 text-sm max-h-48 overflow-auto">
              {expectedPaths.map((p) => (
                <li key={p}>
                  <code>{p}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-gray-500 text-sm mt-6 text-center">
          JSON cards can use plain text, images, or mixed blocks. Relative image
          paths work when you select the image files or their folder too.
        </p>
      </div>
    </div>
  );
}
