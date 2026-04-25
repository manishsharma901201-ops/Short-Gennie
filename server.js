const express = require("express");
const axios = require("axios");
const edgeTTS = require("edge-tts");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());

// 🔐 ENV VARIABLES
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const PEXELS_KEY = process.env.PEXELS_KEY;

app.post("/generate", async (req, res) => {
  const topic = req.body.topic || "motivation";

  try {
    // 🧠 1. SCRIPT GENERATE (Together AI)
    let script = "Namaste dosto!";

    try {
      const ai = await axios.post(
        "https://api.together.xyz/v1/chat/completions",
        {
          model: "mistralai/Mistral-7B-Instruct-v0.1",
          messages: [
            {
              role: "user",
              content: `Create a 25 second viral Hindi YouTube Shorts script on ${topic}`
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${TOGETHER_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      script = ai.data.choices[0].message.content;

    } catch (e) {
      console.log("AI fallback used");
    }

    // 🖼️ 2. IMAGE FETCH
    const imgRes = await axios.get(
      `https://api.pexels.com/v1/search?query=${topic}&per_page=5`,
      { headers: { Authorization: PEXELS_KEY } }
    );

    let imageFiles = [];

    for (let i = 0; i < 5; i++) {
      const url = imgRes.data.photos[i].src.portrait;
      const file = `img${i}.jpg`;
      imageFiles.push(file);

      const writer = fs.createWriteStream(file);
      const response = await axios({ url, method: "GET", responseType: "stream" });
      response.data.pipe(writer);
      await new Promise(r => writer.on("finish", r));
    }

    // 🎤 3. VOICE
    await edgeTTS.save({
      text: script,
      voice: "hi-IN-SwaraNeural",
      file: "voice.mp3"
    });

    // 🎬 4. CLIPS
    let clips = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const output = `clip${i}.mp4`;
      clips.push(output);

      await new Promise((resolve) => {
        ffmpeg()
          .input(imageFiles[i])
          .loop(5)
          .videoFilters([
            "zoompan=z='min(zoom+0.002,1.3)':d=125",
            "eq=brightness=-0.05",
            "drawtext=text='Namaste 🙏':fontsize=50:fontcolor=white:x=(w-text_w)/2:y=100"
          ])
          .outputOptions(["-t 5", "-pix_fmt yuv420p"])
          .save(output)
          .on("end", resolve);
      });
    }

    // 🔗 MERGE
    fs.writeFileSync("list.txt", clips.map(c => `file '${c}'`).join("\n"));

    await new Promise((resolve) => {
      ffmpeg()
        .input("list.txt")
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .save("video.mp4")
        .on("end", resolve);
    });

    // 🎧 AUDIO ADD
    await new Promise((resolve) => {
      ffmpeg()
        .input("video.mp4")
        .input("voice.mp3")
        .outputOptions(["-c:v copy", "-c:a aac"])
        .save("final.mp4")
        .on("end", resolve);
    });

    res.download("final.mp4");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating video");
  }
});

app.listen(3000, () => console.log("Server Running"));
