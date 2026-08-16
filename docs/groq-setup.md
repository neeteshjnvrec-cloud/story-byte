# Groq Integration Guide for StoryByte

This guide explains how to set up Groq LLM for daily story generation in StoryByte.

---

## 🤖 What is Groq?

Groq is a fast LLM inference API that provides free tier access to powerful models. We use it to generate engaging stories daily for our users.

---

## 📋 Prerequisites

1. Groq Account (free at https://console.groq.com)
2. API Key from Groq

---

## 🔑 Step 1: Get Groq API Key

1. Go to https://console.groq.com
2. Sign up / Log in
3. Go to **API Keys** section
4. Click **"Create API Key"**
5. Copy the key (starts with `gsk_...`)

---

## ⚙️ Step 2: Configure Environment

Add to your `.env` file:

```env
GROQ_API_KEY=gsk_...your...key...here
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## 📚 Available Models

| Model | Use Case | Free Tier |
|-------|----------|-----------|
| `llama-3.3-70b-versatile` | **Recommended** - Best quality | ✅ |
| `llama-3.1-8b-instant` | Faster, lower quality | ✅ |
| `mixtral-8x7b-32768` | Long context | ✅ |

For story generation, we use **Llama 3.3 70B** for best storytelling quality.

---

## 💡 Step 3: Test the Integration

### Test Script

Create `test-groq.js`:

```javascript
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function testGeneration() {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a professional storyteller. Write engaging short stories.'
      },
      {
        role: 'user',
        content: 'Write a short romance story in 100 words.'
      }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  console.log(completion.choices[0].message.content);
}

testGeneration();
```

Run: `node test-groq.js`

---

## 🎯 Story Generation Prompts

### Romance
```
Write an engaging romance story with emotional depth and a satisfying ending.
Include dialogue and character development.
```

### Mystery
```
Write a mystery story with a twist ending.
Build suspense and include red herrings.
```

### Fantasy
```
Write a fantasy story with unique world-building and adventure.
Include magical elements and compelling characters.
```

### Drama
```
Write a drama about family relationships and life challenges.
Focus on emotional storytelling.
```

---

## 📊 Free Tier Limits

| Metric | Limit |
|--------|-------|
| Requests | 30 RPM |
| Tokens | 14,400 TPM |
| Daily | ~20K tokens |
| Monthly | ~600K tokens |

**Our Usage**: ~5 stories/day × ~2000 tokens = ~10K tokens/day ✅

---

## 🔧 Optimization Tips

### 1. Cache Generated Stories
Stories don't change once generated - cache the output.

### 2. Batch Generation
Generate 5 stories at once instead of 5 separate requests.

### 3. Use Smaller Models for Testing
Use `llama-3.1-8b-instant` for development, `70b` for production.

### 4. Rate Limiting
Implement exponential backoff for API calls.

---

## 🚨 Troubleshooting

### "Rate limit exceeded"
- Wait 60 seconds and retry
- Reduce generation frequency

### "Invalid API key"
- Check `GROQ_API_KEY` in `.env`
- Ensure no extra spaces

### "Model not found"
- Verify model name is correct
- Check Groq console for available models

### "Context length exceeded"
- Reduce story length in prompt
- Use `max_tokens` parameter

---

## 📈 Monitoring Usage

1. Go to https://console.groq.com
2. Navigate to **Usage** section
3. Monitor:
   - Total tokens used
   - Request count
   - Error rate

---

## 🔄 Alternative LLM Providers

If Groq free tier isn't enough, consider:

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **Google AI Studio** | 60 RPM | Gemini models |
| **Together.ai** | Free credits | Open source models |
| **OpenAI** | $5 credit | GPT-3.5/4 |
| **Anthropic** | Limited | Claude models |

---

## 📚 Additional Resources

- [Groq Documentation](https://groq.com/docs)
- [Groq Console](https://console.groq.com)
- [Llama 3.3 Model Card](https://llama.meta.com)

---

## ✅ Setup Checklist

- [ ] Groq account created
- [ ] API key generated
- [ ] Added to `.env`
- [ ] Test script working
- [ ] Cloud Functions updated
- [ ] Tested generation locally
- [ ] Deployed to Firebase