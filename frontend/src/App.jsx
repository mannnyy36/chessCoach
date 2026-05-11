import { useState, useEffect } from "react";
import "./App.css";
import { Chessboard } from "react-chessboard";

function App() {
  const [board, setBoard] = useState("start");
  const [turn, setTurn] = useState("white");
  const [status, setStatus] = useState("ok");
  const [moves, setMoves] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [chatMessages, setChatMessages] = useState([
    { sender: "ai", text: "Hey there! I'm your chess coach. Ask me about any move or idea!" }
  ]);
  const [userInput, setUserInput] = useState("");

  // Load initial board
  useEffect(() => {
    async function getBoard() {
      try {
        const response = await fetch("http://localhost:8000/board");
        const data = await response.json();
        setBoard(data.board);
        setTurn(data.turn);
        setMoves(data.moves || []);
      } catch (error) {
        console.error("Failed to fetch board:", error);
      }
    }
    getBoard();
  }, []);

  // Handle piece movement
  async function handlePieceDrop(sourceSquare, targetSquare, piece) {
    const move = `${sourceSquare}${targetSquare}`;
    console.log("Attempting move:", move);
    setAiThinking(true);

    try {
      const response = await fetch("http://localhost:8000/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error("Illegal or invalid move:", err.detail);
        return false;
      }

      const data = await response.json();
      setBoard(data.board);
      setTurn(data.turn);
      setStatus(data.status);
      setMoves(data.moves || []);

      // ✅ If game ended, trigger AI analysis automatically
      if (data.status === "checkmate" || data.status === "stalemate") {
        const analyzeResponse = await fetch("http://localhost:8000/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moves: data.moves }),
        });

        if (analyzeResponse.ok) {
          const analysis = await analyzeResponse.json();
          setChatMessages((prev) => [
            ...prev,
            { sender: "ai", text: "Game over! Here's my analysis:" },
            { sender: "ai", text: analysis.analysis },
          ]);
        }
      }

      return true;
    } catch (error) {
      console.error("Error sending move:", error);
      return false;
    } finally {
      setAiThinking(false);
    }
  }

  // Start a new game
  async function handleNewGame() {
    try {
      const response = await fetch("http://localhost:8000/new-game");
      if (!response.ok) {
        const err = await response.json();
        console.log("Unable to load new game.", err.detail);
        return false;
      }

      const data = await response.json();
      setBoard(data.board);
      setTurn(data.turn);
      setMoves(data.moves || []);
      setChatMessages([
        { sender: "ai", text: "New game started! Try a different opening this time." },
      ]);
      console.log("New game started", data.turn, "to move.");
    } catch (error) {
      console.error("Error getting new game", error);
    }
  }

  // Change AI difficulty
  async function handleDifficultyChange(event) {
    const newLevel = event.target.value;
    setDifficulty(newLevel);

    try {
      const response = await fetch(`http://localhost:8000/set-difficulty/${newLevel}`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        console.log(data.message);
      }
    } catch (error) {
      console.error("Error setting difficulty:", error);
    }
  }

  // Handle chat message send
async function handleSendMessage() {
  if (!userInput.trim()) return;

  const newMessage = { sender: "user", text: userInput };
  setChatMessages((prev) => [...prev, newMessage]);
  const userText = userInput;
  setUserInput("");

  try {
    const response = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userText }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Chat request failed");
    }

    const data = await response.json();
    const aiReply = { sender: "ai", text: data.reply };

    setChatMessages((prev) => [...prev, aiReply]);
  } catch (error) {
    console.error("Error chatting:", error);
    setChatMessages((prev) => [
      ...prev,
      { sender: "ai", text: "Sorry, I had trouble understanding that." },
    ]);
  }
}

  // Format move history
  const formattedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    const whiteMove = moves[i];
    const blackMove = moves[i + 1] || "";
    formattedMoves.push({ moveNum: i / 2 + 1, whiteMove, blackMove });
  }

  // 🧱 UI
  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h1>♟ Chess Game</h1>

      {/* Turn + Status */}
      <p style={{ fontSize: "18px", marginBottom: "10px" }}>
        Turn: <strong>{turn.charAt(0).toUpperCase() + turn.slice(1)}</strong>
      </p>

      <p
        style={{
          fontSize: "16px",
          color:
            status === "checkmate"
              ? "red"
              : status === "stalemate"
              ? "gray"
              : status === "check"
              ? "orange"
              : "black",
          fontWeight: "bold",
        }}
      >
        {status === "ok"
          ? "Game ongoing"
          : status === "checkmate"
          ? "Checkmate!"
          : status === "stalemate"
          ? "Stalemate!"
          : "Check!"}
      </p>

      {aiThinking && (
        <p style={{ color: "orange", fontWeight: "bold" }}>🤖 AI is thinking...</p>
      )}

      {/* Difficulty Dropdown */}
      <div style={{ marginBottom: "10px" }}>
        <label htmlFor="difficulty" style={{ marginRight: "8px", fontWeight: "bold" }}>
          AI Difficulty:
        </label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={handleDifficultyChange}
          style={{
            padding: "6px 10px",
            fontSize: "14px",
            borderRadius: "5px",
            backgroundColor: "#1e1e1e",
            color: "white",
            border: "1px solid #555",
          }}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      {/* Layout */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: "40px",
          marginTop: "20px",
        }}
      >
        {/* Chessboard */}
        <Chessboard
          position={board || "start"}
          onPieceDrop={handlePieceDrop}
          boardWidth={500}
        />

        {/* Move History */}
        <div
          style={{
            width: "220px",
            textAlign: "left",
            backgroundColor: "#1e1e1e",
            color: "#ffffff",
            border: "2px solid #333",
            borderRadius: "8px",
            padding: "12px",
            height: "500px",
            overflowY: "auto",
            boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          }}
        >
          <h3 style={{ textAlign: "center", color: "#00ff90" }}>Move History</h3>
          {formattedMoves.length === 0 ? (
            <p style={{ textAlign: "center", color: "#ccc" }}>No moves yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #555" }}>
                  <th>#</th>
                  <th>White</th>
                  <th>Black</th>
                </tr>
              </thead>
              <tbody>
                {formattedMoves.map((m) => (
                  <tr key={m.moveNum}>
                    <td>{m.moveNum}</td>
                    <td>{m.whiteMove}</td>
                    <td>{m.blackMove}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Chat Panel */}
        <div
          style={{
            width: "300px",
            backgroundColor: "#1e1e1e",
            color: "#ffffff",
            border: "2px solid #333",
            borderRadius: "8px",
            padding: "12px",
            height: "500px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              overflowY: "auto",
              flexGrow: 1,
              marginBottom: "10px",
              paddingRight: "5px",
            }}
          >
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                style={{
                  textAlign: msg.sender === "ai" ? "left" : "right",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: msg.sender === "ai" ? "#333" : "#00ff90",
                    color: msg.sender === "ai" ? "#fff" : "#000",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    maxWidth: "80%",
                  }}
                >
                  {msg.text}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask something..."
              style={{
                flexGrow: 1,
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #555",
                backgroundColor: "#111",
                color: "#fff",
              }}
            />
            <button
              onClick={handleSendMessage}
              style={{
                backgroundColor: "#00ff90",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* New Game Button */}
      <button
        onClick={handleNewGame}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        New Game
      </button>
    </div>
  );
}

export default App;
