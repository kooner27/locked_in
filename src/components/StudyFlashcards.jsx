// src/components/StudyFlashcards.jsx
import React, { useState, useEffect, useRef } from "react";

/**
 * Fisher–Yates shuffle helper (returns a new array, does not mutate original)
 */
function shuffleArray(arr) {
  const a = arr.slice();
  let m = a.length,
    i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    [a[m], a[i]] = [a[i], a[m]];
  }
  return a;
}

/* ────────────────────────────────────────────────────────── */
/* New in this file:                                          */
/* - Replace localStorage “Save/Restore/Clear” with:           */
/*     • 💾 Export State  → downloads state.json               */
/*     • 🔄 Import State  → reads state.json (optional)        */
/* - Accept `initialState` prop to auto-restore once if the    */
/*   user imported a state.json on the landing page.           */
/* - We keep your session/settings logic and comments intact.  */
/* ────────────────────────────────────────────────────────── */

export default function StudyFlashcards({
  cards,
  onReset,
  initialState = null,
}) {
  // ── cardsForSession: the actual subset we are studying ──
  const [cardsForSession, setCardsForSession] = useState(cards);

  // ── originalOrder & currentOrder store card IDs in order ──
  const [originalOrder, setOriginalOrder] = useState(cards.map((c) => c.id));
  const [currentOrder, setCurrentOrder] = useState(originalOrder);

  // ── Session flags ──
  const [isShuffled, setIsShuffled] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [incorrectIds, setIncorrectIds] = useState(new Set());
  const [finished, setFinished] = useState(false);

  // ── Settings ──
  const [frontFirst, setFrontFirst] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSizeInput, setFontSizeInput] = useState("30"); // px

  // ── Scope dropdown: "__ALL_CARDS__", folder prefix, or file path ──
  const SCOPE_ALL = "__ALL_CARDS__";
  const [scope, setScope] = useState(SCOPE_ALL);

  // ── uniqueFolders & uniqueFiles for the scope dropdown ──
  const allPaths = cards.map((c) => c.path);
  const uniqueFiles = Array.from(new Set(allPaths)).sort();
  const folderSet = new Set();
  allPaths.forEach((fullPath) => {
    const parts = fullPath.split("/");
    for (let i = 1; i < parts.length; i++) {
      folderSet.add(parts.slice(0, i).join("/"));
    }
  });
  const uniqueFolders = Array.from(folderSet).sort();

  // ── isRestoringRef to bypass the “on cards upload” effect during manual restore ──
  const isRestoringRef = useRef(false);

  // ── Effect: When `cards` prop changes (new upload), reset entire session ──
  useEffect(() => {
    if (isRestoringRef.current) return; // skip if restoring

    setCardsForSession(cards);
    const ids = cards.map((c) => c.id);
    setOriginalOrder(ids);
    setCurrentOrder(ids);
    setIsShuffled(false);
    setCurrentIndex(0);
    setShowBack(false);
    setIncorrectIds(new Set());
    setFinished(false);
    setFrontFirst(true);
    setShowSettings(false);
    setScope(SCOPE_ALL);
    // keep fontSizeInput as-is
  }, [cards]);

  /* ────────────────────────────────────────────────────────── */
  /* New: One-shot auto-restore when `initialState` is provided */
  /* (App passes this when the user imported state.json earlier)*/
  /* ────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!initialState) return;

    // Normalize both sides (dedupe + sort) before comparing
    const savedPaths = Array.from(new Set(initialState.paths || [])).sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    const currentPaths = Array.from(new Set(cards.map((c) => c.path))).sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

    const pathsMatch =
      savedPaths.length === currentPaths.length &&
      savedPaths.every((p, i) => p === currentPaths[i]);

    if (!pathsMatch) {
      console.warn(
        "initialState paths do not match current upload; skipping auto-restore",
      );
      return;
    }

    restoreFromObject(initialState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  // ── Handle user changing the scope dropdown ──
  function onScopeChange(e) {
    const newScope = e.target.value;
    setScope(newScope);

    let subset;
    if (newScope === SCOPE_ALL) {
      subset = cards;
    } else if (uniqueFolders.includes(newScope)) {
      subset = cards.filter((c) => c.path.startsWith(newScope + "/"));
    } else if (uniqueFiles.includes(newScope)) {
      subset = cards.filter((c) => c.path === newScope);
    } else {
      subset = [];
    }

    // Full reset to that subset
    setCardsForSession(subset);
    const ids = subset.map((c) => c.id);
    setOriginalOrder(ids);
    setCurrentOrder(ids);
    setIsShuffled(false);
    setCurrentIndex(0);
    setShowBack(false);
    setIncorrectIds(new Set());
    setFinished(false);
    setFrontFirst(true);
    setShowSettings(false);
  }

  // ── “no cards” guard ──
  if (cardsForSession.length === 0 && !finished) {
    return (
      <div className="w-full max-w-5xl text-center text-gray-200">
        <h2 className="text-2xl font-semibold mb-4">
          No cards found for this scope.
        </h2>
        <button
          className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
          onClick={onReset}
        >
          ⤺ Upload New File
        </button>
      </div>
    );
  }

  // ── Completed view ──
  if (finished) {
    const total = cardsForSession.length;
    const wrongCount = incorrectIds.size;
    return (
      <div className="w-full max-w-5xl bg-gray-800 text-gray-100 p-8 rounded-xl shadow-xl space-y-6">
        <h2 className="text-3xl font-semibold text-center">Session Complete</h2>
        <p className="text-center">
          You got {wrongCount} / {total} wrong.
        </p>

        <div className="flex flex-col space-y-4">
          {wrongCount > 0 && (
            <button
              className="w-full py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              onClick={reviewWrongOnly}
            >
              Study {wrongCount} Wrong Card{wrongCount > 1 && "s"}
            </button>
          )}

          <button
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={restartFullDeck}
          >
            Restart Full Deck
          </button>

          <button
            className="mt-6 text-gray-400 hover:text-gray-200 text-sm block mx-auto"
            onClick={onReset}
          >
            ← Upload New File
          </button>
        </div>
      </div>
    );
  }

  // ── Main Study View ──
  const total = cardsForSession.length;
  const answeredCount = currentIndex;
  const wrongCount = incorrectIds.size;
  const correctCount = answeredCount - wrongCount;
  const parsedSize = parseInt(fontSizeInput, 10);
  const fontSizePx = isNaN(parsedSize) ? 30 : parsedSize;

  // Find the current card object
  const cardId = currentOrder[currentIndex];
  const currentCard = cardsForSession.find((c) => c.id === cardId) || {};

  // ── Compute whether to show front or back ──
  const showFront = frontFirst !== showBack;

  return (
    <div className="w-full max-w-5xl space-y-6 relative">
      {/* ── Row 1: Study scope dropdown ── */}
      <div className="bg-gray-800 p-4 rounded-t-xl flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="text-gray-200 font-medium">Study scope:</div>
        <select
          className="bg-gray-700 text-gray-100 px-3 py-2 rounded-lg focus:outline-none"
          value={scope}
          onChange={onScopeChange}
        >
          <option value={SCOPE_ALL}>All Cards</option>
          {uniqueFolders.map((folder) => (
            <option key={`FOLDER__${folder}`} value={folder}>
              Folder: {folder}/
            </option>
          ))}
          {uniqueFiles.map((file) => (
            <option key={`FILE__${file}`} value={file}>
              File: {file}
            </option>
          ))}
        </select>
      </div>

      {/* ── Row 2: Stats / Settings / Export/Import ── */}
      <div className="flex justify-between items-center text-gray-300 mb-2 px-4">
        {/* Left side: Still Learning / Studied / Know / Settings */}
        <div className="flex space-x-6">
          <span>Still Learning: {wrongCount}</span>
          <span>
            Studied: {answeredCount} / {total}
          </span>
          <span>Know: {correctCount}</span>
          <button
            className="text-gray-400 hover:text-gray-200"
            onClick={() => setShowSettings((s) => !s)}
          >
            ⚙️
          </button>
        </div>

        {/* Right side: Export / Import state.json */}
        <div className="flex space-x-2 items-center">
          <button
            className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            onClick={exportState}
          >
            💾 Export State
          </button>

          <label className="px-3 py-1 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm cursor-pointer">
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={importStateFromFile}
            />
            🔄 Import State
          </label>
        </div>
      </div>

      {/* ── Settings popup ── */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-10 w-80 bg-gray-800 p-4 rounded-xl shadow-xl space-y-4 text-gray-100">
          <label className="flex items-center justify-between">
            <span>Show definition first</span>
            <input
              type="checkbox"
              checked={!frontFirst}
              onChange={() => setFrontFirst((f) => !f)}
              className="form-checkbox h-5 w-5 text-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <span>Font Size (px)</span>
            <input
              type="number"
              min="8"
              max="72"
              step="1"
              value={fontSizeInput}
              onChange={(e) => {
                let v = e.target.value.replace(/^0+/, "");
                setFontSizeInput(v);
              }}
              className="w-16 text-center bg-gray-700 text-gray-100 rounded-lg p-1"
            />
          </label>

          <button
            className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            onClick={restartFullDeck}
          >
            Restart Session
          </button>

          <button
            className="w-full py-3 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-700 text-sm"
            onClick={() => setShowSettings(false)}
          >
            Close
          </button>
        </div>
      )}

      {/* ── Flashcard box ── */}
      <div className="flex justify-center">
        <div
          className="w-[95vw] max-w-5xl h-[70vh] bg-gray-700 p-8 rounded-xl text-center flex items-center justify-center select-none cursor-pointer text-gray-100 overflow-auto"
          onClick={() => setShowBack((s) => !s)}
        >
          <span style={{ fontSize: `${fontSizePx}px` }}>
            {showFront ? currentCard.front : currentCard.back}
          </span>
        </div>
      </div>

      {/* ── Controls: Undo | ✕ | ✓ | Shuffle ── */}
      <div className="flex justify-center items-center space-x-10">
        {/* Undo */}
        <button
          className="px-4 py-3 bg-gray-600 text-gray-100 rounded-full hover:bg-gray-500"
          onClick={undoCard}
          disabled={currentIndex === 0}
        >
          ↺
        </button>

        {/* ✕ (Wrong) */}
        <button
          className="px-6 py-3 bg-red-600 text-white text-xl rounded-lg hover:bg-red-700"
          onClick={markWrong}
        >
          ✕
        </button>

        {/* ✓ (Correct) */}
        <button
          className="px-6 py-3 bg-green-600 text-white text-xl rounded-lg hover:bg-green-700"
          onClick={markCorrect}
        >
          ✓
        </button>

        {/* 🔀 (Shuffle / Restore) */}
        <button
          className="px-4 py-3 bg-gray-600 text-gray-100 rounded-full hover:bg-gray-500"
          onClick={toggleShuffle}
          title={isShuffled ? "Restore Order" : "Shuffle Deck"}
        >
          🔀
        </button>
      </div>
    </div>
  );

  // ── Helper Functions ──
  function undoCard() {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevCardId = currentOrder[prevIndex];
      setCurrentIndex(prevIndex);
      setShowBack(false);
      setIncorrectIds((prev) => {
        const nxt = new Set(prev);
        nxt.delete(prevCardId);
        return nxt;
      });
      setFinished(false);
    }
  }

  function markWrong() {
    setIncorrectIds((prev) => {
      const nxt = new Set(prev);
      nxt.add(currentOrder[currentIndex]);
      return nxt;
    });
    advanceOrFinish();
  }

  function markCorrect() {
    advanceOrFinish();
  }

  function advanceOrFinish() {
    if (currentIndex < cardsForSession.length - 1) {
      setCurrentIndex((i) => i + 1);
      setShowBack(false);
    } else {
      setFinished(true);
    }
  }

  function toggleShuffle() {
    if (!isShuffled) {
      const shuffled = shuffleArray(cardsForSession.map((c) => c.id));
      setCurrentOrder(shuffled);
      setIsShuffled(true);
    } else {
      setCurrentOrder(cardsForSession.map((c) => c.id));
      setIsShuffled(false);
    }
    setCurrentIndex(0);
    setShowBack(false);
  }

  function reviewWrongOnly() {
    const wrongIds = cardsForSession
      .filter((c) => incorrectIds.has(c.id))
      .map((c) => c.id);
    if (wrongIds.length === 0) return;

    isRestoringRef.current = true;
    const wrongCards = cards.filter((c) => wrongIds.includes(c.id));
    setCardsForSession(wrongCards);
    setOriginalOrder(wrongIds);
    setCurrentOrder(wrongIds);
    setIsShuffled(false);
    setCurrentIndex(0);
    setShowBack(false);
    setIncorrectIds(new Set());
    setFinished(false);
    setFrontFirst(true);
    setShowSettings(false);
    isRestoringRef.current = false;
  }

  function restartFullDeck() {
    isRestoringRef.current = true;
    setScope(SCOPE_ALL);
    setCardsForSession(cards);
    const ids = cards.map((c) => c.id);
    setOriginalOrder(ids);
    setCurrentOrder(ids);
    setIsShuffled(false);
    setCurrentIndex(0);
    setShowBack(false);
    setIncorrectIds(new Set());
    setFinished(false);
    setFrontFirst(true);
    setShowSettings(false);
    isRestoringRef.current = false;
  }

  /* ────────────────────────────────────────────────────────── */
  /* Export / Import state.json                                 */
  /* ────────────────────────────────────────────────────────── */

  /* ────────────────────────────────────────────────────────── */
  /* Export the current session as state.json                   */
  /* NOTE: `paths` must be a UNIQUE, SORTED list of CSV paths   */
  /* so the landing page checklist isn't full of duplicates.    */
  /* ────────────────────────────────────────────────────────── */
  function buildStateObject() {
    // Dedup + sort the CSV paths used to build this deck
    const pathsUnique = Array.from(new Set(cards.map((c) => c.path))).sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

    return {
      paths: pathsUnique, // ✅ fixed
      sessionIds: cardsForSession.map((c) => c.id),
      originalOrder,
      currentOrder,
      currentIndex,
      incorrectIds: Array.from(incorrectIds),
      scope,
      isShuffled,
      frontFirst,
      fontSizeInput,
      finished,
    };
  }

  function exportState() {
    const toSave = buildStateObject();
    const blob = new Blob([JSON.stringify(toSave, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "state.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importStateFromFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Normalize: dedupe + sort on BOTH sides
      const savedPaths = Array.from(new Set(parsed.paths || [])).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
      const currentPaths = Array.from(new Set(cards.map((c) => c.path))).sort(
        (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
      );

      const pathsMatch =
        savedPaths.length === currentPaths.length &&
        savedPaths.every((p, i) => p === currentPaths[i]);

      if (!pathsMatch) {
        alert(
          "This state.json does not match the currently uploaded files.\nUpload the same CSV set and try again.",
        );
        return;
      }

      restoreFromObject(parsed);
      alert("State imported!");
    } catch {
      alert("Failed to parse state.json.");
    } finally {
      e.target.value = "";
    }
  }

  function restoreFromObject(parsed) {
    isRestoringRef.current = true;

    // 1. Scope & subset
    const nextScope = parsed.scope ?? SCOPE_ALL;
    setScope(nextScope);

    const subset = cards.filter((c) =>
      (parsed.sessionIds || []).includes(c.id),
    );
    setCardsForSession(subset);

    // 2. Deck + flags
    setOriginalOrder(
      parsed.originalOrder || parsed.sessionIds || subset.map((c) => c.id),
    );
    setCurrentOrder(
      parsed.currentOrder || parsed.sessionIds || subset.map((c) => c.id),
    );
    setCurrentIndex(parsed.currentIndex ?? 0);
    setIncorrectIds(new Set(parsed.incorrectIds || []));
    setIsShuffled(parsed.isShuffled ?? false);
    setFinished(parsed.finished ?? false);

    // 3. Settings
    setFrontFirst(parsed.frontFirst ?? true);
    setFontSizeInput(parsed.fontSizeInput || "30");
    setShowSettings(false);

    isRestoringRef.current = false;
  }
}
