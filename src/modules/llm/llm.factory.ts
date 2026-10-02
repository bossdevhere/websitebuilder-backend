import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import dotenv from "dotenv";

dotenv.config();

export interface LLMConfig {
  provider: string;
  modelName: string;
  temperature: number;
}

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  let defaultModel = "gpt-4o-mini";

  if (provider === "anthropic") defaultModel = "claude-3-5-sonnet-20241022";
  if (provider === "gemini") defaultModel = "gemini-1.5-flash";
  if (provider === "ollama") defaultModel = "qwen2.5-coder";

  const modelName = process.env.LLM_MODEL_NAME || defaultModel;
  const temperature = parseFloat(process.env.LLM_TEMPERATURE || "0.2");

  return { provider, modelName, temperature };
}

export function getLLMClient(): BaseChatModel {
  const config = getLLMConfig();

  switch (config.provider) {
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in environment");
      return new ChatAnthropic({
        modelName: config.modelName,
        temperature: config.temperature,
        apiKey,
      });
    }

    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment");
      return new ChatGoogleGenerativeAI({
        model: config.modelName,
        temperature: config.temperature,
        apiKey,
      });
    }

    case "ollama": {
      const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
      return new ChatOllama({
        baseUrl,
        model: config.modelName,
        temperature: config.temperature,
      });
    }

    case "openai":
    default: {
      const apiKey = process.env.OPENAI_API_KEY || "placeholder-key";
      return new ChatOpenAI({
        modelName: config.modelName,
        temperature: config.temperature,
        openAIApiKey: apiKey,
      });
    }
  }
}
