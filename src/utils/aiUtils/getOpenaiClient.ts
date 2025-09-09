import OpenAI from "openai";

// Initialize OpenAI client
const aiUrl = process.env.AI_URL;
const aiToken = process.env.AI_TOKEN;

if (!aiUrl || !aiToken) {
  console.warn(
    "AI_URL and AI_TOKEN environment variables are required for AI features"
  );
}

const openai =
  aiUrl && aiToken
    ? new OpenAI({
        apiKey: aiToken,
        baseURL: aiUrl,
      })
    : null;

export function getOpenaiClient(): OpenAI {
  if (!openai) {
    throw new Error("OpenAI client is not configured");
  }
  return openai;
}


export const aiModel = (() => {
  const model = process.env.AI_MODEL;
  if (!model) throw new Error("AI_MODEL not set");
  return model;
})();