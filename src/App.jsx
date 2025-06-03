// src/App.jsx
import React, { useState } from "react";
import UploadFlashcards from "./components/UploadFlashcards";
import StudyFlashcards from "./components/StudyFlashcards";

export default function App() {
  const [cards, setCards] = useState([]); // holds uploaded deck

  return (
    // Default to a dark‐background root
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      {cards.length === 0 ? (
        <UploadFlashcards onUpload={(newCards) => setCards(newCards)} />
      ) : (
        <StudyFlashcards cards={cards} onReset={() => setCards([])} />
      )}
    </div>
  );
}
