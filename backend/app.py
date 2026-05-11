from groq import Groq
from fastapi import FastAPI, HTTPException
import chess
import chess.engine
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import atexit
import os
from dotenv import load_dotenv

load_dotenv()
# Initialize app + OpenAI client
app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Global state
board = chess.Board()
moves = []
engine = chess.engine.SimpleEngine.popen_uci("/opt/homebrew/bin/stockfish")

origins = ["http://localhost:5173"]

difficulty_settings = {
    "easy": {"skill": 1, "time": 0.05},
    "medium": {"skill": 10, "time": 0.2},
    "hard": {"skill": 20, "time": 0.6},
}
current_difficulty = "medium"

class Move(BaseModel):
    move: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/new-game")
def new_game():
    global board, moves
    board = chess.Board()
    moves = []
    return {
        "status": "new game started",
        "board": board.fen(),
        "turn": "white" if board.turn else "black",
        "moves": moves
    }

@app.get("/board")
def get_board():
    return {
        "board": board.fen(),
        "turn": "white" if board.turn else "black",
        "moves": moves
    }

@app.post("/set-difficulty/{level}")
def set_difficulty(level: str):
    global current_difficulty
    if level not in difficulty_settings:
        raise HTTPException(status_code=400, detail="Invalid difficulty level")
    current_difficulty = level
    return {"message": f"Difficulty set to {level}"}

@app.post("/move")
def make_move(move: Move):
    global board, moves
    try:
        board_move = chess.Move.from_uci(move.move)
    except:
        raise HTTPException(status_code=400, detail="Invalid move format")

    if board_move not in board.legal_moves:
        raise HTTPException(status_code=404, detail="Illegal move")

    san_move = board.san(board_move)
    board.push(board_move)
    moves.append(san_move)

    if not board.is_game_over():
        diff = difficulty_settings[current_difficulty]
        engine.configure({"Skill Level": diff["skill"]})
        result = engine.play(board, chess.engine.Limit(time=diff["time"]))
        ai_san = board.san(result.move)
        board.push(result.move)
        moves.append(ai_san)

    # Determine status
    if board.is_checkmate():
        status = "checkmate"
    elif board.is_stalemate():
        status = "stalemate"
    elif board.is_check():
        status = "check"
    else:
        status = "ok"

    return {
        "board": board.fen(),
        "turn": "white" if board.turn else "black",
        "status": status,
        "moves": moves
    }

@app.post("/analyze-game")
async def analyze_game():
    global moves
    prompt = f"The game ended with this move sequence:\n{', '.join(moves)}\nProvide a short, constructive analysis of both players' strategies and key mistakes."

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a chess coach analyzing games."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
        )
        return {"analysis": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/chat")
async def chat_with_ai(message: dict):
    """Chat endpoint to discuss moves and strategy with the AI coach."""
    user_message = message.get("text", "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty message")

    # Build prompt context (recent moves + user question)
    context = f"Recent moves: {', '.join(moves[-10:])}\nUser asked: {user_message}"

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a chess coach. Explain clearly and concisely."},
                {"role": "user", "content": context}
            ],
            max_tokens=200,
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@atexit.register
def close_engine():
    engine.quit()
