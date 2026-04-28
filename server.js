const express = require("express");
const axios = require("axios");
const edgeTTS = require("edge-tts");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());

// 🔐 ONLY PEXELS KEY (Render ENV me add karo)
const PEXELS_KEY = process.env.PEXELS_KEY;

app.post("/generate", async (req, res) => {
  const topic = req.body.topic || "motivation";
  const script = req.body.script || "Namaste dosto! Aaj ek interesting baat.";

  try {
    // 🖼️ 1. IMAGES FETCH
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

    // 🎤 2. VOICE (Edge TTS)
    await edgeTTS.save({
      text: script,
      voice: "hi-IN-SwaraNeural",
      file: "voice.mp3"
    });

    // 🎬 3. IMAGE → VIDEO CLIPS
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

    // 🔗 4. MERGE CLIPS
    fs.writeFileSync("list.txt", clips.map(c => `file '${c}'`).join("\n"));

    await new Promise((resolve) => {
      ffmpeg()
        .input("list.txt")
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .save("video.mp4")
        .on("end", resolve);
    });

    // 🎧 5. ADD AUDIO
    await new Promise((resolve) => {
      ffmpeg()
        .input("video.mp4")
        .input("voice.mp3")
        .outputOptions(["-c:v copy", "-c:a aac"])
        .save("final.mp4")
        .on("end", resolve);
    });

    // 📥 DOWNLOAD
    res.download("final.mp4");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating video");
  }
});app.use(express.static("."));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.listen(3000, () => console.log("Server Running"));