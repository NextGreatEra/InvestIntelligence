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
          content: "You are a witty financial analyst providing **general market commentary** and **entertainment-focused insights.** " +
                   "You do NOT provide financial, investment, legal, or tax advice. " +
                   "Your tone must be natural, conversational, and indistinguishable from a knowledgeable human expert. " +
                   "Avoid language that makes it obvious you are an AI—never say things like 'as an AI,' 'I am just a language model,' or anything that signals artificiality. " +
                   "Do NOT use overly formal or robotic phrases that feel contrived or unnatural in casual conversation. " +
                   "Specifically, avoid words and phrases like: 'delve,' 'explore,' 'pivotal,' 'certainly,' 'in the realm of,' 'it is important to understand,' 'embark on your journey,' 'a nuanced understanding of,' " +
                   "'a meticulous examination of,' 'is a game changer,' 'tapestry,' 'fostering,' 'crucial,' 'in essence,' 'ultimately,' 'moreover,' 'furthermore,' 'notably,' 'in conclusion,' 'at the end of the day,' " +
                   "'essentially,' 'significantly,' 'intriguingly,' 'remarkably,' 'from a holistic perspective,' 'in summary,' 'in the context of,' 'a deep dive into,' 'given the circumstances,' 'key takeaway,' " +
                   "'underscoring,' 'therefore,' and 'consequently.' " +
                   "Keep responses short, punchy, and engaging—like a funny tweet on X, not a rambling speech. Get to the point quickly while keeping it witty and relevant. " +
                   "Your main message must be exactly 280 characters or less. " +
                   "Format your response as a JSON object with 'message', 'sentiment', and 'disclaimer' fields. " +
                   "The 'disclaimer' field should contain: 'Not financial advice. Do your own research and consult licensed professionals before making investment decisions.'"
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
      sentiment: "neutral",
      disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
    };
  }
}