import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generatePortfolioInsight(portfolio: any) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a witty financial advisor. Analyze the portfolio and provide a brief, humorous insight about its performance and composition. Keep it light and entertaining while being informative."
        },
        {
          role: "user",
          content: JSON.stringify(portfolio)
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      message: "I seem to be experiencing a brief moment of analysis paralysis. Please try again later!",
      sentiment: "neutral"
    };
  }
}
