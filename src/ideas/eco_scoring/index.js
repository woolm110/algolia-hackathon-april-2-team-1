async function transform(record, helper) {
  const apiKey = helper.secrets.get("OPENAI_API_KEY");

  const {
    name,
    brand,
    price,
    color,
    gender,
    available_sizes: sizes,
    hierarchical_categories,
  } = record;

  const ecoInput = {
    name,
    brand,
    price: price?.value,
    color: color?.original_name,
    gender,
    sizes,
    category: hierarchical_categories?.lvl2 || null,
  };

  const userPrompt = `
    You're evaluating a fashion product based on the image and metadata.

    Your job is to infer sustainability-related attributes that can be used to calculate an eco score for ranking products. Focus only on what can be reasonably inferred from appearance and metadata.

    For the item, return the following:

    - clothingType (e.g. t-shirt, jacket, handbag, shoes)
    - material (e.g. cotton, polyester, leather)
    - texture (e.g. soft, coarse, lightweight)
    - finish (e.g. matte, glossy, smooth)
    - designDetails (e.g. printed, embroidered, stitched, layered) — array of strings

    ### Durability & Use

    Estimate the following based on the item type and material:

    - wearLifecycle:
      - minorWear (number of wears before small signs of wear like fading)
      - moderateWear (number of wears before wear is noticeable)
      - needsReplacing (number of wears before most people would replace the item)

    - recommendedWashFrequencyInWears (integer):
      - Set to 0 if the item is not usually washed (e.g. bags, shoes, hats)
      - For washable items, estimate based on typical hygiene or fabric care (e.g. t-shirts = 1–2 wears)

    - estimatedWashesBeforeDeterioration (integer):
      - Set to 0 for non-washable items
      - For washable items, estimate based on fabric sensitivity

    - recommendedWashingTemperatureCelsius (integer):
      - Based on material — e.g. cotton = 30, synthetics = 40
      - 0 if the item is not machine-washed

    - durabilityScore (1–5):
      - Overall physical longevity considering fabric, use type, and construction

    - dyeScore (1–5):
      - Consider the colour attribute in the metadata
      - Use "1" for plain fabrics with little to no dye (e.g. white, undyed, natural tones)
      - Use "2" for solid dyed colours or minimal patterns
      - Use "3" for garments with multiple colours, prints, graphics, or intense dyeing
      - Use "4" for items with eco-friendly dyes (e.g., low-impact dyes)
      - Use "5" for undyed or minimally processed materials

    - usageTypeScore (1–5):
      - This value helps weight items differently in scoring (e.g. handbags and shoes are rarely washed but face scuffing, so they may score lower than coats or jumpers).
      - Score higher for items expected to last longer naturally due to infrequent use and wear (e.g. outerwear, jackets), and lower for fragile or often-used items (e.g. tights, t-shirts)

    ### Environmental Impact

    Estimate the following (eco impact fields):

    - materialType: one of "natural sustainable", "mixed", or "synthetic"
    - materialScore (1–5): lower is worse for environment (e.g. 1 = synthetic, 5 = natural sustainable)
    - dyeScore (1–5): 1 = energy intensive, 5 = simple or undyed
    - shippingFootprint: one of "low", "medium", or "high"
    - shippingScore (1–5): lower is worse for environment – based on likely origin, transport method, and item size/weight

    ---

    Use this metadata to improve your estimates:
    ${JSON.stringify(ecoInput)}

    Return your result strictly as a **valid JSON object**, using this structure:

    {
      "clothingType": string,
      "material": string,
      "texture": string,
      "finish": string,
      "designDetails": string[],
      "wearLifecycle": {
        "minorWear": int,
        "moderateWear": int,
        "needsReplacing": int
      },
      "recommendedWashFrequencyInWears": int,
      "estimatedWashesBeforeDeterioration": int,
      "recommendedWashingTemperatureCelsius": int,
      "durabilityScore": int,
      "usageTypeScore": int,
      "ecoImpact": {
        "materialType": string,
        "materialScore": int,
        "dyeScore": int,
        "shippingFootprint": string,
        "shippingScore": int
      }
    }

    Do not return any text outside the JSON object. The result **must be parsable by JSON.parse() in JavaScript**.
`;

  const imageUrl = record.image_urls[0];

  const openAIConfig = {
    apiKey,
    userPrompt,
    imageUrl,
    model: "gpt-4o-mini", // Be sure to use model with vision capabilities
    maxToken: 200, // Size of the response expected (Cost will vary) - See OpenAI documentation.
    temperature: 0,
  };

  const response = await askGPT(openAIConfig);
  const cleanedResponse = response
    .replace(/```json\n?/, "")
    .replace(/```$/, "");
  const parsedResponseAsJson = JSON.parse(cleanedResponse);

  record.eco_details = parsedResponseAsJson;
  record.eco_details.eco_score = getEcoScore(record.eco_details);

  return record;
}

const getEcoScore = (eco) => {
  const {
    wearLifecycle,
    recommendedWashFrequencyInWears,
    estimatedWashesBeforeDeterioration,
    recommendedWashingTemperatureCelsius,
    durabilityScore,
    usageTypeScore,
    ecoImpact,
  } = eco;

  // Calculate individual scores
  const lifecycleScore = Math.min(
    (wearLifecycle.minorWear +
      wearLifecycle.moderateWear +
      wearLifecycle.needsReplacing) /
      3,
    25
  );
  const durability = Math.min(durabilityScore * 2.5, 25);
  const washFreq = Math.min(recommendedWashFrequencyInWears, 10);
  const tempScore = recommendedWashingTemperatureCelsius <= 30 ? 10 : 5;
  const washDeterioration = Math.min(
    estimatedWashesBeforeDeterioration / 2,
    10
  );
  const washingScore = ((washFreq + tempScore + washDeterioration) / 30) * 25;
  const materialImpact = Math.min(
    (3 - ecoImpact.materialScore) * 6 + (3 - ecoImpact.dyeScore) * 6,
    25
  );
  const shipping = (3 - ecoImpact.shippingScore) * 5;
  const usageAdjustment = (usageTypeScore / 10) * 10;

  // Raw scores and weights for each category
  const categories = [
    { score: durability, weight: 25 },
    { score: washingScore, weight: 25 },
    { score: materialImpact, weight: 25 },
    { score: shipping, weight: 15 },
    { score: usageAdjustment, weight: 10 },
  ];

  // Calculate the total weighted score
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0); // Total weight of all categories
  const totalScore = categories.reduce((sum, c) => sum + c.score * c.weight, 0); // Total weighted score

  // Prior belief (average across dataset)
  const averageAll = 65; // This is the prior average score, you can adjust this based on your data

  // Bayesian average formula
  const v = totalScore; // Observed value (total weighted score)
  const m = totalWeight; // Weight (confidence in the data)
  const C = averageAll; // The global average (prior belief)

  const bayesianScore = (v + m * C) / (m + 1); // Bayesian average formula

  // Normalize to score between 0-100
  const ecoScore = Math.max(0, Math.min(bayesianScore, 100));

  const bucketedScore = Math.floor(ecoScore / 5) * 5;

  return bucketedScore;
};

async function askGPT(config) {
  const apiUrl = "https://api.openai.com/v1/chat/completions";

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: config.userPrompt,
        },
        {
          type: "image_url",
          image_url: {
            url: config.imageUrl,
          },
        },
      ],
    },
  ];

  const requestBody = {
    model: config.model,
    messages,
    max_tokens: config.maxToken,
  };

  let reply = "";
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error("API error: " + errorData.error?.message);
    }

    const data = await response.json();
    reply = data.choices[0]?.message?.content;
  } catch (error) {
    console.error("Error calling ChatGPT API:", error);
  } finally {
    return reply;
  }
}
