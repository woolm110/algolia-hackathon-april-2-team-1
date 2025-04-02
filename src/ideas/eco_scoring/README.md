# Calculating an "eco score" based on a records image and metadata

### Use cases

- Sustainability Tracking: Allows customers to see the environmental impact of products, making it easier for them to choose eco-friendly options.
- Eco-Friendly Product Ranking: Ranks products based on their sustainability scores, helping customers make informed, eco-conscious purchasing decisions.
- Surface Durability & Eco-Friendliness to Customers: Enables customers to easily access key sustainability data like durability and eco-friendliness, guiding them to products that last longer and have a lower environmental footprint.
- Bucket Washing Temperature as a Filter: Group products based on their recommended washing temperature and allow customers to filter by temperature preferences. For example, eco-conscious customers can filter for products that require a low washing temperature, which reduces energy consumption.
- Material Extraction & Filtering: Extracts material types (e.g. cotton, recycled fibers, synthetic materials) and surfaces them as filters. Customers can easily search for products made from natural, sustainable, or recycled materials, allowing for more informed and ethical shopping choices.
- Improved Shopping Experience: Offers a tailored shopping experience that highlights sustainability, making it easier for customers to make choices aligned with their values.
- Support Eco-Conscious Choices: Makes it simple for customers to shop based on sustainability criteria, offering them the tools to purchase items that support a greener planet.

### Technology Used

- Algolia Transformation
- Open AI with image recognition

### How it works

- Each record passes through the Algolia transformation function. A prompt is devised to instruct OpenAI to enhance the record with eco-related data. The process works in two ways:

  - **Metadata Analysis**: The record data (such as material and color) is analysed, alongside potential product type.
  - **Image Analysis**: The image is assessed to further validate the metadata and extract additional information.

- Based on this, the following attributes are outputted:

```json
"eco_details": {
  "clothingType": "sneakers",
  "material": "multicolored fabric and synthetic materials",
  "texture": "soft",
  "finish": "matte",
  "designDetails": [
    "printed",
    "layered"
  ],
  "wearLifecycle": {
    "minorWear": 10,
    "moderateWear": 20,
    "needsReplacing": 50
  },
  "recommendedWashFrequencyInWears": 5,
  "estimatedWashesBeforeDeterioration": 15,
  "recommendedWashingTemperatureCelsius": 30,
  "durabilityScore": 3,
  "usageTypeScore": 4,
  "ecoImpact": {
    "materialType": "mixed",
    "materialScore": 2,
    "dyeScore": 3,
    "shippingFootprint": "medium",
    "shippingScore": 3
  }
}

- *Eco Score Calculation*: The data from the attributes above is then used to calculate an “eco score” value. This score can influence custom product rankings based on sustainability.
- *Filtering & Personalization*: The attributes also allow users to filter products based on eco-related data. When combined with a personalized strategy that takes these factors into account, users can start to see more tailored, eco-friendly products based on their shopping habits.
```
