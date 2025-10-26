// src/App.jsx
import React, { useState } from "react";
import UploadFlashcards from "./components/UploadFlashcards";
import StudyFlashcards from "./components/StudyFlashcards";

/* ────────────────────────────────────────────────────────── */
/* App-level additions:                                       */
/* - pendingState: holds parsed state.json until CSVs uploaded */
/* - expectedPaths: exact list shown/validated on upload page  */
/* - initialStateForStudy: one-shot pass to Study for restore  */
/* ────────────────────────────────────────────────────────── */

export default function App() {
  const [cards, setCards] = useState([]); // holds uploaded deck
  const [pendingState, setPendingState] = useState(null); // parsed state.json waiting for CSVs
  const [expectedPaths, setExpectedPaths] = useState([]); // required CSV paths (from state.json)
  const [initialStateForStudy, setInitialStateForStudy] = useState(null); // one-shot into Study

  function handleStateImported(parsed) {
    // Keep saved order stable by sorting alphabetically (case-insensitive)
    const dedupSorted = Array.from(new Set(parsed.paths || [])).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

    // Persist the normalized version into pendingState
    setPendingState({ ...parsed, paths: dedupSorted });
    setExpectedPaths(dedupSorted);
  }

  function handleUpload(newCards) {
    if (pendingState) {
      const uploadedPaths = Array.from(
        new Set(newCards.map((c) => c.path)),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      const savedPaths = (pendingState.paths || [])
        .slice()
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

      const pathsMatch =
        uploadedPaths.length === savedPaths.length &&
        uploadedPaths.every((p, i) => p === savedPaths[i]);

      if (!pathsMatch) {
        alert(
          "Uploaded CSVs don’t match the imported state’s required files. Please upload the same set and order.",
        );
        return;
      }

      setCards(newCards);
      setInitialStateForStudy(pendingState); // triggers auto-restore in Study
      setPendingState(null);
      setExpectedPaths([]);
    } else {
      setCards(newCards);
      setInitialStateForStudy(null);
    }
  }

  function resetToUpload() {
    setCards([]);
    setPendingState(null);
    setExpectedPaths([]);
    setInitialStateForStudy(null);
  }

  return (
    // Default to a dark‐background root
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      {cards.length === 0 ? (
        <UploadFlashcards
          onUpload={handleUpload}
          onStateImported={handleStateImported}
          expectedPaths={expectedPaths}
        />
      ) : (
        <StudyFlashcards
          cards={cards}
          onReset={resetToUpload}
          initialState={initialStateForStudy}
        />
      )}
    </div>
  );
}
