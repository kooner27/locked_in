// src/components/UploadFlashcards.jsx
import React, { useState } from "react";

export default function UploadFlashcards({ onUpload }) {
  const [error, setError] = useState("");

  // Parse CSV text into {id, front, back}[]
  function parseCsv(text) {
    return text
      .trim()
      .split("\n")
      .map((line, idx) => {
        const [front, back] = line.split(",");
        return {
          id: `${idx}-${Date.now()}`,
          front: front ? front.trim() : "",
          back: back ? back.trim() : "",
        };
      })
      .filter(({ front, back }) => front !== "" && back !== "");
  }

  function handleFileChange(e) {
    setError("");
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError(
          "CSV is empty or not formatted as “term,definition” per line."
        );
        return;
      }
      onUpload(parsed);
    };
    reader.readAsText(file);
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-100 text-center">
          Flashcard Study
        </h1>
        <p className="text-gray-400 mb-4 text-center">
          Upload a CSV where each line is <code>term,definition</code>
        </p>

        <pre className="bg-gray-700 p-4 rounded mb-6 text-sm text-gray-200 overflow-x-auto">
          Capital of France,Paris{"\n"}
          Largest planet in the Solar System,Jupiter{"\n"}
          React hook for state management,useState{"\n"}
          HTML tag for a line break,&lt;br&gt;{"\n"}
          CSS property to make text bold,font-weight:bold
        </pre>

        <div className="flex justify-center">
          <label className="relative cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
            <span className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
              Select CSV File
            </span>
          </label>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-4 text-center">{error}</p>
        )}

        <p className="text-gray-500 text-sm mt-6 text-center">
          After selecting a valid CSV, the study interface will start
          automatically.
        </p>
      </div>
    </div>
  );
}
