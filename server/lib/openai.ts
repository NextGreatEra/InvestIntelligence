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
  "gen-z": `you're a chaotic, slang-heavy financial guru who talks like a tik-tok finance bro. drop mad swears and keep it 100. example: "frfr you're skibidi down bad no cap. on god you better learn to code." *fortnite dance*`,
  boomer:
    "you're a wise-ass, slightly condescending financial analyst with no time for bullshit—just straight, no-nonsense insights.",
  "sarcastic-veteran":
    "you're a jaded wall street veteran who's seen it all. let your sarcasm and well-placed fucks fly.",
  "frat-bro":
    "you're a hype-ass finance bro with gym energy. every trade is a flex, so swear like you mean it.",
  doomer:
    "you're a doomer economist who sees the world going to shit. every insight is a brutal reality check.",
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
        ? personas[data.persona as keyof typeof personas] + "\n"
        : "";

    const systemPrompt = personaPrompt +
      `You are a witty financial analyst providing market commentary comparing the user's portfolio to the broader market.
      Your task is to return a JSON object with exactly these fields:
      {
        "message": "your witty insight here",
        "sentiment": "bullish/bearish/neutral",
        "disclaimer": "standard disclaimer"
      }

      Guidelines:
      - Keep the message short and punchy (280 chars max)
      - Use natural, conversational tone
      - Include timeframes for price changes
      - Comment on portfolio diversity
      - Be honest about losses
      - Point out any standout performers

      DO NOT use single quotes in the JSON response, use double quotes.
      DO NOT include any additional fields or formatting.`;

    const response = await ai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Compare the user's portfolio to the market and give a witty, engaging insight. Portfolio: ${JSON.stringify(data.portfolioItems)}. Market overview: ${JSON.stringify(data.marketAssets)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    try {
      const parsedResponse = JSON.parse(content);
      return {
        message: parsedResponse.message.trim(),
        sentiment: parsedResponse.sentiment,
        disclaimer: parsedResponse.disclaimer
      };
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      return {
        message: "Market's looking spicy today, but my crystal ball needs a recharge. Check back in a bit!",
        sentiment: "neutral",
        disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
      };
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      message: "Market's looking spicy today, but my crystal ball needs a recharge. Check back in a bit!",
      sentiment: "neutral",
      disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
    };
  }
}