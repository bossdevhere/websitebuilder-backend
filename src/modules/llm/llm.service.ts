import { getLLMClient, getLLMConfig } from "./llm.factory.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export class LLMService {
  static getActiveConfig() {
    return getLLMConfig();
  }

  static async generateCompletion(prompt: string, systemPrompt?: string) {
    const config = getLLMConfig();
    const client = getLLMClient();

    const messages = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(new HumanMessage(prompt));

    const response = await client.invoke(messages);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    return {
      provider: config.provider,
      modelName: config.modelName,
      response: content,
      timestamp: new Date().toISOString(),
    };
  }
}
