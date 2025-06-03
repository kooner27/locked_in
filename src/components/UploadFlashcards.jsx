import React, { useState } from "react";

export default function UploadFlashcards({ onUpload }) {
  const [error, setError] = useState("");

  /**
   * parseCsv(text, basePath) → Array<{ id, front, back, path }>
   *
   * Splits CSV text by newline; each line must be “term,definition”.
   * basePath is either:
   *   • file.webkitRelativePath (e.g. "FolderA/sub/file.csv") when picking a folder,
   *   • or file.name (e.g. "terms.csv") when picking individual file(s).
   *
   * NOTE: IDs are stable: `${basePath}__${idx}`.
   */
  function parseCsv(text, basePath) {
    return text
      .trim()
      .split("\n")
      .map((line, idx) => {
        const [front, back] = line.split(",");
        return {
          id: `${basePath}__${idx}`, // stable ID
          front: front ? front.trim() : "",
          back: back ? back.trim() : "",
          path: basePath,
        };
      })
      .filter(({ front, back }) => front !== "" && back !== "");
  }

  /**
   * handleFiles(e)
   *
   * Called when the user picks either:
   *   • “Select File(s)” → e.target.files is a FileList of chosen files,
   *   • “Select Folder”   → e.target.files is every file under that folder (nested).
   *
   * We keep only .csv files, read each via FileReader, parse via parseCsv(...),
   * flatten, then call onUpload(allCards).
   */
  async function handleFiles(e) {
    setError("");
    console.log("handleFiles triggered with", e.target.files);

    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter for .csv only
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) {
      setError("No “.csv” files found in your selection.");
      return;
    }

    try {
      // Read & parse all CSVs in parallel
      const allParsed = await Promise.all(
        csvFiles.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              // If picked via folder, webkitRelativePath holds something like "FolderA/sub/file.csv"
              // Otherwise, webkitRelativePath is "", so fallback to file.name
              const basePath = file.webkitRelativePath || file.name;
              const parsed = parseCsv(reader.result, basePath);
              resolve(parsed);
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

      // Flatten into a single array
      const allCards = allParsed.flat();
      if (allCards.length === 0) {
        setError(
          "All CSVs were empty or not in “term,definition” format (one per line)."
        );
        return;
      }

      // Pass parsed cards up
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

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-100 text-center">
          Locked In
        </h1>

        <p className="text-gray-400 mb-4 text-center">
          You can upload either:
          <br />• One or more <strong>individual CSV files</strong> (pick via
          Select File(s)), or
          <br />• An entire <strong>folder</strong> of CSVs (nested subfolders
          allowed).
        </p>

        <div className="flex justify-center space-x-4">
          {/* ========== Select File(s) ========== */}
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

          {/* ========== Select Folder ========== */}
          <label className="relative cursor-pointer">
            {/*
              In React/JSX, using `webkitdirectory=""` ensures React emits
              `<input webkitdirectory>` in the final HTML. Browsers that
              support folder selection (Chrome/Edge/Firefox) honor it.
            */}
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
          Once you make a selection, we’ll parse all CSVs and automatically
          launch the study interface.
        </p>

        {/* ====== Instructions Section ====== */}
        <div className="mt-6 text-gray-400 text-sm text-center space-y-2">
          <p>
            After entering study mode, you’ll see three buttons in the
            top‐right: &ldquo;<strong>💾 Save State</strong>&rdquo;, &ldquo;
            <strong>🔄 Restore State</strong>&rdquo;, and &ldquo;
            <strong>🗑️ Clear State</strong>&rdquo;.
          </p>
          <p>
            • Click <strong>💾 Save State</strong> to save your progress in this
            browser.
          </p>
          <p>
            • Later, re‐upload the <strong>same</strong> CSV files or folder,
            then click <strong>🔄 Restore State</strong> to pick up where you
            left off.
          </p>
          <p>
            • Click <strong>🗑️ Clear State</strong> to delete any saved progress
            and start fresh.
          </p>
        </div>
      </div>
    </div>
  );
}
