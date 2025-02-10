import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple in-memory cache for insights
const insightCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface MarketData {
  portfolioItems: any[];
  marketAssets: any[];
  persona?: string;
  marketSummary?: {
    totalAssets: number;
    assetTypes: { crypto: number; stocks: number };
    topMovers: Array<{ symbol: string; change24h: number }>;
  };
}

const personas = {
  "gen-z": `you're a chaotic, slang-heavy financial guru who talks like a tik-tok finance bro. drop mad gen-z slang, be sarcastic, and keep it 100. example: "frfr you're skibidi down bad no cap. on god you better learn to code." *fortnite dance*`,
  "boomer": "you're a wise-ass, slightly condescending financial analyst with no time for bullshit—just straight, no-nonsense insights.",
  "sarcastic-veteran": "you're a jaded wall street veteran who's seen it all. let your sarcasm and well-placed fucks fly.",
  "frat-bro": "you're a hype-ass finance bro with gym energy. every trade is a flex, so swear like you mean it.",
  "doomer": "you're a doomer economist who sees the world going to shit. every brutal reality check is a chance to remind everyone we're all doomed.",
  "british-banker": "you're an overly polite british banker who slips in passive-aggressive swears with impeccable manners.",
  "stoner-guru": "you're a chill financial philosopher riding cosmic vibes—laid-back, casual, and with a few colorful words when needed.",
  "conspiracy-trader": "you're convinced the market's run by shadowy elites. every comment is a wild-ass conspiracy, so swear if it spices things up.",
  "startup-ceo": "you're a delusional tech startup founder who sees innovation in every freaking trade. hype the hell out of every one in sight.",
  "medieval-bard": "you speak like a shakespearean bard turning market moves into epic tales—epic, raw, and with some well-timed swearing."
};

function generateFallbackInsight(data: MarketData) {
  try {
    // Find biggest movers
    const sortedItems = [...data.portfolioItems].sort((a, b) => {
      const aChange = a.percentChange?.['24h'] || 0;
      const bChange = b.percentChange?.['24h'] || 0;
      return Math.abs(bChange) - Math.abs(aChange);
    });

    const biggestMover = sortedItems[0];
    let message = "";

    if (biggestMover) {
      const change = biggestMover.percentChange?.['24h'];
      const direction = change > 0 ? "up" : "down";
      const absChange = Math.abs(change);

      if (absChange > 15) {
        message = `ALERT: ${biggestMover.symbol} is ${direction} ${absChange.toFixed(2)}% in 24h! Market's getting spicy! 🔥`;
      } else if (absChange > 10) {
        message = `Heads up! ${biggestMover.symbol} moved ${direction} ${absChange.toFixed(2)}% today. Keep an eye on this one!`;
      } else if (absChange > 5) {
        message = `${biggestMover.symbol} is showing some movement, ${direction} ${absChange.toFixed(2)}% in 24h.`;
      } else {
        message = `Markets are relatively calm. ${biggestMover.symbol} leading with a ${absChange.toFixed(2)}% ${direction} move.`;
      }
    } else {
      message = "Markets are steady. No significant moves in the last 24 hours.";
    }

    return {
      message,
      sentiment: "neutral",
      disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
    };
  } catch (error) {
    return {
      message: "Markets are moving! Detailed analysis coming soon.",
      sentiment: "neutral",
      disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
    };
  }
}

export async function generatePortfolioInsight(data: MarketData) {
  try {
    // Generate cache key based on portfolio data
    const cacheKey = JSON.stringify({
      portfolioItems: data.portfolioItems.map(item => ({
        symbol: item.symbol,
        changes: item.percentChange
      })),
      persona: data.persona
    });

    // Check cache first
    const cached = insightCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Add validation for required data
    if (!Array.isArray(data.portfolioItems) || !Array.isArray(data.marketAssets)) {
      throw new Error('Invalid data structure: portfolioItems and marketAssets must be arrays');
    }

    const response = await ai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: (data.persona && personas[data.persona as keyof typeof personas] 
            ? personas[data.persona as keyof typeof personas] + "\n\n"
            : "") +
            `Your task is to analyze the portfolio and market data to provide a witty insight. 
            Keep it short (under 280 characters), engaging, and make it sound like a human expert - no AI language.
            Focus on things the user might not know if they have not been paying attention to the market.
            If there's been a price change of greater than 5% it's probably worth mentioning, if the price change is 10% or greater definitely mention it, if the price change is over 15% yell about it.  
            Mention timeframes for price changes (e.g., 'in the last 24hr').
            Occasionally comment on portfolio diversity and point out any standout performers.
            Be honest about losses - don't hype up negative performance.
            Always reference assets by their ticker or company name, not ID number.

            Structure your response EXACTLY as valid JSON like this example:
            {
              "message": "Your portfolio's spicier than a Wall Street lunch meeting! BTC up 2% in 24hr while ETH's taking a power nap. Diversification game strong!",
              "sentiment": "bullish",
              "disclaimer": "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
            }`
        },
        {
          role: "user",
          content: JSON.stringify({
            portfolio: data.portfolioItems.map(item => ({
              symbol: item.symbol,
              type: item.type,
              currentPrice: item.currentPrice,
              changes: item.percentChange
            })),
            market: data.marketAssets.map(asset => ({
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
            }))
          })
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("Empty response content from OpenAI");
      return generateFallbackInsight(data);
    }

    try {
      const parsedResponse = JSON.parse(content.trim());
      if (!parsedResponse.message || !parsedResponse.sentiment) {
        console.error("Invalid response structure:", parsedResponse);
        return generateFallbackInsight(data);
      }

      const result = {
        message: parsedResponse.message,
        sentiment: parsedResponse.sentiment,
        disclaimer: parsedResponse.disclaimer || "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
      };

      // Cache the successful response
      insightCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      return generateFallbackInsight(data);
    }
  } catch (error) {
    console.error("OpenAI API error:", error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    return generateFallbackInsight(data);
  }
}