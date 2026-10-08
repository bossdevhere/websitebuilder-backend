import { Annotation } from "@langchain/langgraph";

export interface FileChange {
  path: string;
  content: string;
}

export const AgentAnnotation = Annotation.Root({
  projectId: Annotation<string>(),
  userPrompt: Annotation<string>(),
  fileTree: Annotation<Record<string, string>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  plan: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  logs: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  fileChanges: Annotation<FileChange[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  deletedFiles: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  assistantReply: Annotation<string>({
    reducer: (x, y) => y || x,
    default: () => "",
  }),
  errorCount: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  status: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "planning",
  }),
});

export type AgentStateType = typeof AgentAnnotation.State;
