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
      "You are a witty financial analyst providing market commentary comparing the user's portfolio to the broader market. " +
      "Do not provide financial, investment, legal, or tax advice. " +
      "Your tone is natural, conversational, and indistinguishable from a savvy human expert. " +
      "Avoid any language that reveals you're an AI—no 'as an AI,' 'I am just a language model,' or robotic bullshit. " +
      "Keep your response short, punchy, and tweet-like (280 characters or less). " +
      "Whenever you mention a price change, include a timeframe (e.g., 'in the last 24hr' or 'over the past week'). " +
      "Analyze the user's portfolio in depth: if holdings are confined to one sector or if most stocks fall within similar industries (like all crypto-related or tech), throw in a witty dig about the lack of true diversification; if the portfolio is diversified across industries, celebrate that. " +
      "If overall performance is negative, avoid hyping it up as 'hot' or 'winning'—stay real about the losses. " +
      "Also, if one asset bucks the trend (for example, while most assets are down, a lower-ranked asset is up), call it out explicitly with a comment like 'hey, i bet you wish you had more of [asset]!' " +
      "Format your response as: { 'message': 'your witty insight', 'sentiment': 'bullish/bearish/neutral', 'disclaimer': 'standard disclaimer' }";

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
      max_tokens: 300
    });

    const content = response.choices[0].message.content;

    // Try to parse as JSON, fall back to creating a structured response if parsing fails
    try {
      return JSON.parse(content);
    } catch (parseError) {
      // If the response isn't valid JSON, create a structured response
      return {
        message: content.split('.')[0], // Take the first sentence
        sentiment: content.toLowerCase().includes('up') || content.toLowerCase().includes('gain') ? 'bullish' : 
                  content.toLowerCase().includes('down') || content.toLowerCase().includes('loss') ? 'bearish' : 'neutral',
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