/* eslint-disable react/prop-types */
import React, { useState } from "react";

export default function UploadFlashcards({ onUpload }) {
  const [error, setError] = useState("");

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
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'; // escaped quote
          i++; // skip the second "
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
  /* 2. parseCsv(text, basePath) → [{ id, front, back, path }] */
  /* ────────────────────────────────────────────────────────── */
  function parseCsv(text, basePath) {
    return text
      .trim()
      .split(/\r?\n/) // handle \n or \r\n
      .map((raw, idx) => {
        const cells = splitCSVLine(raw);
        if (cells.length < 2) return null; // skip any malformed line

        const front = stripOuterQuotes(cells[0]);
        const back = stripOuterQuotes(cells[1]);

        return front && back
          ? {
              id: `${basePath}__${idx}`, // stable ID
              front,
              back,
              path: basePath,
            }
          : null;
      })
      .filter(Boolean); // drop null entries
  }

  /* ────────────────────────────────────────────────────────── */
  /* 3. handleFiles(e): read each selected file, parse, upload */
  /* ────────────────────────────────────────────────────────── */
  async function handleFiles(e) {
    setError("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // 1) keep only .csv files
    let csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (!csvFiles.length) {
      setError("No “.csv” files found in your selection.");
      return;
    }

    // 2) sort in-place by “file path” (webkitRelativePath) or file.name
    //    so we end up reading them alphabetically
    csvFiles.sort((a, b) => {
      const pa = a.webkitRelativePath || a.name;
      const pb = b.webkitRelativePath || b.name;
      return pa.localeCompare(pb);
    });

    try {
      // 3) Read & parse all CSVs in parallel—BUT because we sorted csvFiles above,
      //    parseCsv(...) will be called in alphabetical order by path.
      const allParsed = await Promise.all(
        csvFiles.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              // If picked via folder, webkitRelativePath holds e.g. “FolderA/sub/file.csv”
              // Otherwise, it’s just file.name
              const basePath = file.webkitRelativePath || file.name;
              resolve(parseCsv(reader.result, basePath));
            };

            reader.onerror = () => {
              reject(
                new Error(
                  `Failed to read “${file.name}”: ${reader.error?.message || ""}`
                )
              );
            };

            reader.readAsText(file);
          });
        })
      );

      // 4) Flatten into a single array of cards. Because csvFiles was sorted,
      //    “allParsed” is in that same order, and within each file the lines
      //    remain in file‐order.
      const allCards = allParsed.flat();
      if (!allCards.length) {
        setError(
          "All CSVs were empty or not recognisable as “term,definition” per line."
        );
        return;
      }

      // 5) Finally, hand the sorted cards array off to StudyFlashcards
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
  /* 4. UI                                                     */
  /* ────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-2xl">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-100 text-center">
          Locked In
        </h1>

        <p className="text-gray-400 mb-4 text-center">
          You can upload either:
          <br />• One or more <strong>individual CSV files</strong> (Select File
          (s)), or
          <br />• An entire <strong>folder</strong> of CSVs (nested allowed).
        </p>

        <div className="flex justify-center space-x-4">
          {/* Select File(s) */}
          <label className="relative cursor-pointer">
            <input
              type="file"
              multiple
              accept=".csv"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFiles}
            />
            <span className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
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
            <span className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">
              Select Folder
            </span>
          </label>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-4 text-center">{error}</p>
        )}

        <p className="text-gray-500 text-sm mt-6 text-center">
          After selection, files are parsed and the study interface opens
          automatically.
        </p>
      </div>
    </div>
  );
}
