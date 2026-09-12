import { Router } from "express";
import axios from "axios";

const router = Router();

// GET /api/datamuse/synonyms?word=happy
router.get("/synonyms", async (req, res) => {
  const { word } = req.query;
  if (!word) return res.status(400).json({ error: "word query param required." });

  try {
    const { data } = await axios.get("https://api.datamuse.com/words", { params: { ml: word, max: 10 } });
    res.json({ suggestions: data.map((d) => d.word) });
  } catch (err) {
    res.status(502).json({ error: "Synonym lookup is unavailable right now." });
  }
});

// GET /api/datamuse/rhymes?word=night
router.get("/rhymes", async (req, res) => {
  const { word } = req.query;
  if (!word) return res.status(400).json({ error: "word query param required." });

  try {
    const { data } = await axios.get("https://api.datamuse.com/words", { params: { rel_rhy: word, max: 10 } });
    res.json({ suggestions: data.map((d) => d.word) });
  } catch (err) {
    res.status(502).json({ error: "Rhyme lookup is unavailable right now." });
  }
});

export default router;
