const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const path = require("path");



require('dotenv').config();

const app = express();
app.use(express.json());
const atlasURI =process.env.mongoURI
mongoose.connect(atlasURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

const adjectiveSchema = new Schema({
  word: String,
});
const Adjective = mongoose.model("Adjective", adjectiveSchema);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static("public"));

async function getWordInfo(word) {
  try {
    const response = await axios.get(
      `https://ru.wiktionary.org/wiki/${encodeURIComponent(word)}`
    );
    const html = response.data;
    const $ = cheerio.load(html);

    const definition = $("ol li").first().text();
    return { definition };
  } catch (error) {
    console.error("Ошибка:", error);
    return null;
  }
}
async function parseWiktionary(word) {
  try {
      const encodedWord = encodeURIComponent(word);
      const url = `https://ru.wiktionary.org/wiki/${encodedWord}`;
      const response = await axios.get(url);

      const $ = cheerio.load(response.data);

      let stopParsing = false;
      const texts = [];

      $('p').each((index, element) => {
          if (stopParsing) return; 
          const text = $(element).text().trim(); 
          if(text.includes('Корень')){
            stopParsing = true;
        }
          if (text.includes('Тихонов') || text.includes('Ефремова')|| text.includes('Кузнецова') || text.includes('Цыганенко')) {
              stopParsing = true;
          }
          texts.push(`${text}`);
      });

      return texts; 
  } catch (error) {
      console.error('Произошла ошибка:', error);
      return []; 
  }
}


app.get("/synonyms/:word", async (req, res) => {
  try {
      const word = req.params.word;
      const yandexAPI = process.env.apiKey;
      const synonymResponse = await axios.get(
          `https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=${yandexAPI}&lang=ru-ru&text=${word}&flags=4`
      );

      let synonyms = [];
      if (synonymResponse.data.def && synonymResponse.data.def.length > 0) {
          synonyms = synonymResponse.data.def[0].tr.map((tr) => tr.text);
      }
      let wordInfo = await getWordInfo(word);
      let wordGram = await parseWiktionary(word);
      if (!wordInfo) {
          wordInfo = { definition: "", examples: [] }; 
      }

      res.json({ synonyms, wordInfo,  wordGram });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

app.post("/synonyms/:word", async (req, res) => {
  try {
      const word = req.params.word;
      const synonymResponse = await axios.get(
          `https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=dict.1.1.20240205T204711Z.6be7b5f45ad59700.2db7f211eaa2884f52d2b791a016c132a4b1353c&lang=ru-ru&text=${word}&flags=4`
      );

      let synonyms = [];
      if (synonymResponse.data.def && synonymResponse.data.def.length > 0) {
          synonyms = synonymResponse.data.def[0].tr.map((tr) => tr.text);
      }
      let wordInfo = await getWordInfo(word);
      let wordGram = await parseWiktionary(word);
      if (!wordInfo) {
          wordInfo = { definition: "", examples: [] }; 
      }

      res.json({ synonyms, wordInfo, wordGram });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});



app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public"));
});

app.get("/baza", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "alp.html"));
});

app.get("/adjectives", async (req, res) => {
  try {
    const adjectives = await Adjective.find({}).sort({ word: 1 });
    res.json(adjectives);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/adjectives/:letter", async (req, res) => {
  try {
      const letter = req.params.letter;
      const regex = new RegExp(`^${letter}`, 'i');
      const adjectives = await Adjective.find({ word: regex }).sort({ word: 1 }); 
      res.json(adjectives);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

app.post("/adjectives", async (req, res) => {
  try {
      const { word } = req.body;
      const existingWord = await Adjective.findOne({ word });
      if (existingWord) {
        res.status(200).json({ message: "Слово уже существует в базе данных." });
      } else{
        const newAdjective = new Adjective({ word });
        await newAdjective.save();
        res.status(201).json({ message: "Слово успешно добавлено." });
      }

      

  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

app.delete("/adjectives/:id", async (req, res) => {
  try {
      const id = req.params.id;
      await Adjective.findByIdAndDelete(id);
      res.json({ message: "Слово успешно удалено из базы данных." });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
