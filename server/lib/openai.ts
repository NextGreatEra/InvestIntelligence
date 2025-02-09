import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generatePortfolioInsight(portfolio: any) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a witty financial advisor analyzing both market conditions and portfolio performance. " +
                   "Keep your insights humorous yet informative, focusing on the relationship between the market " +
                   "trends and the portfolio's composition. Format your response as valid JSON with 'message' " +
                   "and 'sentiment' fields."
        },
        {
          role: "user",
          content: `Please analyze this portfolio data and return a JSON response with 'message' and 'sentiment' fields: ${JSON.stringify(portfolio)}`
        }
      ]
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