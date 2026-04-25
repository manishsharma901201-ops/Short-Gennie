// 🧠 SCRIPT GENERATE (Together AI)
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

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
