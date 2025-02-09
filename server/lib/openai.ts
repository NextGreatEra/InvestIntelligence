import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MarketData {
  portfolioItems: any[];
  marketAssets: any[];
}

export async function generatePortfolioInsight(data: MarketData) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a witty financial advisor analyzing both market conditions and portfolio performance. " +
                   "Analyze both the user's portfolio and the broader market conditions to provide comprehensive insights. " +
                   "Keep your insights humorous yet informative. Consider the relationships between market trends, " +
                   "portfolio composition, and major market indicators (crypto and stock indices). " +
                   "Format your response as a JSON object with 'message' and 'sentiment' fields."
        },
        {
          role: "user",
          content: `Please analyze this combined market data and provide insights. Portfolio: ${JSON.stringify(data.portfolioItems)}. Market Overview: ${JSON.stringify(data.marketAssets)}`
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