// src/components/StudyFlashcards.jsx
import React, { useState, useEffect } from "react";

/**
 * Fisher–Yates shuffle helper
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

export default function StudyFlashcards({ cards, onReset }) {
  // Session subset of cards (full deck or wrong-only)
  const [cardsForSession, setCardsForSession] = useState(cards);

  // originalOrder holds IDs in initial sequence
  const [originalOrder, setOriginalOrder] = useState(
    cardsForSession.map((c) => c.id)
  );
  // currentOrder holds IDs in current display order
  const [currentOrder, setCurrentOrder] = useState(originalOrder);

  const [isShuffled, setIsShuffled] = useState(false);

  // Index into currentOrder
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [incorrectIds, setIncorrectIds] = useState(new Set());
  const [finished, setFinished] = useState(false);

  // Settings state
  const [frontFirst, setFrontFirst] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Font size input as string; default "30"
  const [fontSizeInput, setFontSizeInput] = useState("30");

  // Whenever cardsForSession changes (fresh upload or wrong-only), reset ordering
  useEffect(() => {
    const ids = cardsForSession.map((c) => c.id);
    setOriginalOrder(ids);
    setCurrentOrder(ids);
    setIsShuffled(false);
    setCurrentIndex(0);
    setShowBack(false);
    setIncorrectIds(new Set());
    setFinished(false);
    setFrontFirst(true);
    setShowSettings(false);
    // fontSizeInput remains unchanged
  }, [cardsForSession]);

  // Also when top-level "cards" prop changes (new upload), set session subset
  useEffect(() => {
    setCardsForSession(cards);
  }, [cards]);

  const total = cardsForSession.length;
  // Find current card object by ID
  const currentCardId = currentOrder[currentIndex];
  const currentCard = cardsForSession.find((c) => c.id === currentCardId) || {};

  // Compute font size in px (fallback 30)
  const fontSizePx = (() => {
    const parsed = parseInt(fontSizeInput, 10);
    return isNaN(parsed) ? 30 : parsed;
  })();

  // Count answered so far (finished => total)
  const answeredCount = finished ? total : currentIndex;
  const wrongCount = incorrectIds.size;
  const correctCount = answeredCount - wrongCount;

  // Toggle shuffle: shuffle or restore original
  function toggleShuffle() {
    if (!isShuffled) {
      const shuffled = shuffleArray(originalOrder);
      setCurrentOrder(shuffled);
      setCurrentIndex(0); // show first of shuffled
      setIsShuffled(true);
    } else {
      setCurrentOrder(originalOrder);
      setCurrentIndex(0);
      setIsShuffled(false);
    }
    setShowBack(false);
  }

  // Advance correct
  function markCorrect() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setShowBack(false);
    } else {
      setFinished(true);
    }
  }

  // Advance wrong + record
  function markWrong() {
    setIncorrectIds((prev) => {
      const nxt = new Set(prev);
      nxt.add(currentCard.id);
      return nxt;
    });
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setShowBack(false);
    } else {
      setFinished(true);
    }
  }

  // Undo (go back one, remove wrong mark)
  function undo() {
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

  // Restart full deck (preserve font size)
  function restartFullDeck() {
    const ids = cards.map((c) => c.id);
    setCardsForSession(cards);
    setOriginalOrder(ids);
    setCurrentOrder(ids);
    setIsShuffled(false);
    setCurrentIndex(0);
    setShowBack(false);
    setIncorrectIds(new Set());
    setFinished(false);
    setFrontFirst(true);
    setShowSettings(false);
    // fontSizeInput remains unchanged
  }

  // Review only wrong cards
  function reviewWrongOnly() {
    const wrongCards = cardsForSession.filter((c) => incorrectIds.has(c.id));
    if (wrongCards.length === 0) return;
    setCardsForSession(wrongCards);
  }

  // Finished summary view
  if (finished) {
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

  // Main study view
  return (
    <div className="w-full max-w-5xl space-y-6 relative">
      {/* Top row: Still Learning | Card count => studied so far | Know | Settings */}
      <div className="flex justify-between items-center text-gray-300 mb-2 px-4">
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

      {/* Settings popup */}
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

      {/* Flashcard box (95vw wide, capped at 5xl, 70vh tall) */}
      <div className="flex justify-center">
        <div
          className="w-[95vw] max-w-5xl h-[70vh] bg-gray-700 p-8 rounded-xl text-center flex items-center justify-center select-none cursor-pointer text-gray-100 overflow-auto"
          onClick={() => setShowBack((s) => !s)}
        >
          <span style={{ fontSize: `${fontSizePx}px` }}>
            {showBack
              ? currentCard.back
              : frontFirst
                ? currentCard.front
                : currentCard.back}
          </span>
        </div>
      </div>

      {/* Controls: Undo | ✕ | ✓ | Shuffle */}
      <div className="flex justify-center items-center space-x-10">
        {/* Undo on the left */}
        <button
          className="px-4 py-3 bg-gray-600 text-gray-100 rounded-full hover:bg-gray-500"
          onClick={undo}
          disabled={currentIndex === 0}
        >
          ↺
        </button>

        {/* ✕ in the middle-left */}
        <button
          className="px-6 py-3 bg-red-600 text-white text-xl rounded-lg hover:bg-red-700"
          onClick={markWrong}
        >
          ✕
        </button>

        {/* ✓ in the middle-right */}
        <button
          className="px-6 py-3 bg-green-600 text-white text-xl rounded-lg hover:bg-green-700"
          onClick={markCorrect}
        >
          ✓
        </button>

        {/* 🔀 Shuffle on the right */}
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
}
