const express = require("express");
const axios = require("axios");
const router = express.Router();

const COHERE_API_KEY = process.env.COHERE_API_KEY || "your-api-key";

// Get embeddings from Cohere
const getEmbeddings = async (texts) => {
  const response = await axios.post(
    "https://api.cohere.ai/v1/embed",
    {
      texts,
      model: "embed-english-v3.0",
      input_type: "clustering",
    },
    {
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.embeddings;
};

// Cosine similarity
const cosineSimilarity = (a, b) => {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
};

// Group similar items by text embeddings
const groupSimilarItems = (items, embeddings, threshold = 0.85) => {
  const groups = []
  const used = new Array(items.length).fill(false)

  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue

    const currentGroup = [items[i]]
    used[i] = true

    for (let j = i + 1; j < items.length; j++) {
      if (used[j]) continue
      const similarity = cosineSimilarity(embeddings[i], embeddings[j])
      if (similarity >= threshold) {
        currentGroup.push(items[j])
        used[j] = true
      }
    }

    const totalPrice = currentGroup.reduce((sum, item) => sum + item.price, 0)
    const numberOfPieces = currentGroup.length
    const averagePrice = totalPrice / numberOfPieces

    groups.push({
      name: currentGroup[0].text, // or pick most common name if needed
      numberOfPieces,
      totalPrice,
      averagePrice: Number(averagePrice.toFixed(2)),
      items: currentGroup,
    })
  }

  return groups
}


// POST /group-items
router.post("/group-items", async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty array of items with text and price" });
  }

  const texts = items.map((item) => item.text);

  try {
    const embeddings = await getEmbeddings(texts);
    const grouped = groupSimilarItems(items, embeddings);
    res.json({ groups: grouped });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Failed to group items" });
  }
});

module.exports = router;
 