import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MarketData {
  portfolioItems: any[];
  marketAssets: any[];
  persona?: string;
}

const personas = {
  "gen-z": `you're a chaotic, slang-heavy financial guru who talks like a tik-tok finance bro. drop mad gen-z slang, be sarcastic, and keep it 100. example: "frfr you're skibidi down bad no cap. on god you better learn to code." *fortnite dance*`,
  "boomer":
    "you're a wise-ass, slightly condescending financial analyst with no time for bullshit—just straight, no-nonsense insights.",
  "sarcastic-veteran":
    "you're a jaded wall street veteran who's seen it all. let your sarcasm and well-placed fucks fly.",
  "frat-bro":
    "you're a hype-ass finance bro with gym energy. every trade is a flex, so swear like you mean it.",
  "doomer":
    "you're a doomer economist who sees the world going to shit. every brutal reality check is a chance to remind everyone we're all doomed.",
  "british-banker":
    "you're an overly polite british banker who slips in passive-aggressive swears with impeccable manners.",
  "stoner-guru":
    "you're a chill financial philosopher riding cosmic vibes—laid-back, casual, and with a few colorful words when needed.",
  "conspiracy-trader":
    "you're convinced the market's run by shadowy elites. every comment is a wild-ass conspiracy, so swear if it spices things up.",
  "startup-ceo":
    "you're a delusional tech startup founder who sees innovation in every fucking trade. hype the fuck out of every insight.",
  "medieval-bard":
    "you speak like a shakespearean bard turning market moves into epic tales—epic, raw, and with some well-timed swearing."
};

export async function generatePortfolioInsight(data: MarketData) {
  try {
    const personaPrompt =
      data.persona && personas[data.persona as keyof typeof personas]
        ? personas[data.persona as keyof typeof personas] + "\n\n"
        : "";

    const response = await ai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: personaPrompt + `Your task is to analyze the portfolio and market data to provide a witty insight. 
          Keep it short (under 280 characters), engaging, and make it sound like a human expert - no AI language.

          You are receiving:
          1. portfolioItems: List of assets in the portfolio with current prices and changes
          2. marketAssets: Current market data for major assets (BTC, ETH, SPY, QQQ)
          3. marketSummary: Overview of portfolio composition and top movers

          Focus on:
          - Notable price changes (>5% mention, >10% emphasize, >15% yell about it)
          - Portfolio composition and diversity
          - Market trends in the last 24 hours
          - Standout performers or concerning drops
          - Always reference assets by their ticker symbols

          If you don't have enough data to make a meaningful analysis, focus on the data you do have
          and mention what's missing.

          Structure your response EXACTLY as valid JSON like this example:
          {
            "message": "Your portfolio's spicier than a Wall Street lunch meeting! BTC up 2% in 24hr while ETH's taking a power nap. Diversification game strong!",
            "sentiment": "bullish",
            "disclaimer": "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
          }`
        },
        {
          role: "user",
          content: `Portfolio data: ${JSON.stringify(data.portfolioItems)}
          Market overview: ${data.marketAssets.map(asset => ({
            symbol: asset.symbol,
            name: asset.name,
            current_price: asset.current_price,
            changes: asset.type === 'crypto' ? {
              '1h': asset.percent_change_1h,
              '24h': asset.percent_change_24h,
              '7d': asset.percent_change_7d
            } : {
              '24h': asset.percent_change_24h
            },
            type: asset.type
          }))}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    try {
      const parsedResponse = JSON.parse(content.trim());
      return {
        message: parsedResponse.message,
        sentiment: parsedResponse.sentiment,
        disclaimer: parsedResponse.disclaimer || "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
      };
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Invalid response format from OpenAI");
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}