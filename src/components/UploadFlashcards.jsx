/* eslint-disable react/prop-types */
import React, { useState } from "react";

/* ────────────────────────────────────────────────────────── */
/* 0. New: state.json import + required-files checklist       */
/*    - “Import state.json” lets you load a previously saved  */
/*      session state BEFORE uploading CSVs.                  */
/*    - After import, we display the required CSV paths and   */
/*      validate that your next upload matches exactly.       */
/* ────────────────────────────────────────────────────────── */

export default function UploadFlashcards({
  onUpload,
  onStateImported,
  expectedPaths = [],
}) {
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState("");

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
        };
      })
      .filter(Boolean); // drop null entries
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

    // 1) Keep only “.csv”
    let csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (!csvFiles.length) {
      setError("No “.csv” files found in your selection.");
      return;
    }

    // 2) Sort the FileList by alphabetical path (or name)
    csvFiles.sort((a, b) => {
      const pa = a.webkitRelativePath || a.name;
      const pb = b.webkitRelativePath || b.name;
      return pa.localeCompare(pb, undefined, { sensitivity: "base" });
    });

    try {
      // 3) Read & parse all CSVs IN ORDER
      const allParsed = await Promise.all(
        csvFiles.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const basePath = file.webkitRelativePath || file.name;
              resolve(parseCsv(reader.result, basePath));
            };
            reader.onerror = () =>
              reject(
                new Error(
                  `Failed to read “${file.name}”: ${
                    reader.error?.message || ""
                  }`,
                ),
              );
            reader.readAsText(file);
          });
        }),
      );

      // 4) Flatten
      const allCards = allParsed.flat();

      if (!allCards.length) {
        setError(
          "All CSVs were empty or did not follow “term,definition” per line.",
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
          new Set(allCards.map((c) => c.path)),
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
              .join(" | "),
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
          : "An unknown error occurred while reading CSV files.",
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
        "State imported. Now upload the required CSV files listed below.",
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
          Upload CSVs to start studying, or <strong>import a state.json</strong>{" "}
          to resume a previous session.
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
              accept=".csv"
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
              accept=".csv"
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
              Required CSV files
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
          After you select a file or folder, we parse them in perfect
          alphabetical order and launch study mode.
        </p>
      </div>
    </div>
  );
}
