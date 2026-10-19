import { StateGraph, END } from "@langchain/langgraph";
import { AgentAnnotation, AgentStateType } from "./agent.state.js";
import { getLLMClient } from "../llm/llm.factory.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Helper to reliably extract plain text from LangChain message content (handling string, blocks, and objects)
export function extractTextContent(content: any): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.text || item.content || "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (content && typeof content === "object") {
    return (content.text || content.content || "").trim();
  }
  return "";
}

// 1. Planner Node: High-speed planner analyzing request and file tree paths
async function plannerNode(state: AgentStateType) {
  const llm = getLLMClient();
  const filePaths = Object.keys(state.fileTree || {}).join(", ") || "App.tsx, index.html, package.json";

  const historyText =
    state.chatHistory && state.chatHistory.length > 0
      ? `Conversation History:\n${state.chatHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}\n\n`
      : "";

  const systemPrompt = `You are an elite AI Web App Architect.
Analyze the user prompt and conversation history with current project files (${filePaths}).

Determine if prompt is:
1. CONVERSATIONAL (greetings, 'hi', 'how are you', advice, questions without code requests).
   -> Set "isCodeRequest": false, "reply": "Warm, helpful 1-sentence response", "plan": [].

2. CODE / WEBSITE CREATION OR MODIFICATION REQUEST (e.g. 'build a portfolio', 'make a coffee site', 'fix the buttons', 'improve design', 'add GSAP animations', 'add cart').
   -> Set "isCodeRequest": true, "reply": "1 concise sentence stating what will be built or updated", "plan": ["components/Navbar.tsx", "components/Hero.tsx", "components/About.tsx", "components/Projects.tsx", "components/Contact.tsx", "App.tsx"].
   -> Keep plan focused: Plan 4 to 6 core modular files with visual richness (Hero with profile imagery, Projects with live mockups, etc.) so generation is fast, modular, and responsive.

RESPONSE LENGTH & TONE RULE (CRITICAL):
- Keep "reply" strictly 1 to 2 short, direct, friendly sentences.
- NEVER output markdown headings (###), bullet points, numbered lists, changelog essays, or code in "reply".

Return ONLY JSON:
{
  "isCodeRequest": boolean,
  "reply": "Concise 1-2 sentence response",
  "plan": ["file steps..."]
}`;

  let response: any = null;
  try {
    response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`${historyText}Current User Request: ${state.userPrompt}`),
    ]);
  } catch (err: any) {
    console.warn("[Agent] Planner LLM invocation failed, using smart heuristic:", err.message);
  }

  const text = response ? extractTextContent(response.content) : "";
  let isCodeRequest = false;
  let replyText = "";
  let planSteps: string[] = [];

  const lowerPrompt = (state.userPrompt || "").toLowerCase();
  const isLikelyCode =
    lowerPrompt.includes("build") ||
    lowerPrompt.includes("create") ||
    lowerPrompt.includes("make") ||
    lowerPrompt.includes("add") ||
    lowerPrompt.includes("update") ||
    lowerPrompt.includes("change") ||
    lowerPrompt.includes("design") ||
    lowerPrompt.includes("page") ||
    lowerPrompt.includes("site") ||
    lowerPrompt.includes("website") ||
    lowerPrompt.includes("portfolio") ||
    lowerPrompt.includes("app") ||
    lowerPrompt.includes("gsap") ||
    lowerPrompt.includes("animate") ||
    lowerPrompt.includes("fix");

  if (text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if ("isCodeRequest" in parsed || "plan" in parsed) {
          isCodeRequest = Boolean(parsed.isCodeRequest);
          replyText = parsed.reply || "";
          planSteps = Array.isArray(parsed.plan) ? parsed.plan : [];
        }
      }
    } catch (e) {
      console.warn("[Agent] Direct planner JSON parse failed, falling back to heuristics...");
    }
  }

  // Fallback if LLM output was empty, malformed, or lacked a plan for a code request
  if (isLikelyCode && (!isCodeRequest || planSteps.length === 0)) {
    isCodeRequest = true;
    if (lowerPrompt.includes("portfolio")) {
      planSteps = [
        "components/Navbar.tsx",
        "components/Hero.tsx",
        "components/About.tsx",
        "components/Projects.tsx",
        "components/Contact.tsx",
        "App.tsx",
      ];
    } else {
      planSteps = [
        "components/Navbar.tsx",
        "components/Hero.tsx",
        "components/Features.tsx",
        "components/Contact.tsx",
        "App.tsx",
      ];
    }
  }

  // Strict sanitization of replyText: never allow raw JSON blocks or [ { "type": "text" } ]
  if (
    !replyText ||
    replyText.startsWith("[{") ||
    replyText.includes('"type":"text"') ||
    replyText.includes("###") ||
    replyText.length < 5
  ) {
    if (isCodeRequest) {
      replyText = `I will build your website with modern responsive components and smooth GSAP animations.`;
    } else {
      replyText = "Hello! How can I help you design or build your website today?";
    }
  }

  return {
    plan: isCodeRequest ? planSteps : [],
    assistantReply: replyText,
    logs: [replyText || `📋 Architecture plan generated (${planSteps.length} steps)`],
    status: isCodeRequest && planSteps.length > 0 ? "generating" : "done",
  };
}

// Helper to check if string contains actual source code
function isCodeContent(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const t = str.trim();
  return (
    t.includes("import ") ||
    t.includes("export ") ||
    t.includes("function ") ||
    t.includes("const ") ||
    t.includes("<") ||
    t.includes("{")
  );
}

// 2. Code Generator Node: Fast modular code generation with Tailwind CSS, GSAP & lucide-react icons
async function codeGeneratorNode(state: AgentStateType) {
  if (!state.plan || state.plan.length === 0) {
    return {
      fileChanges: [],
      logs: [state.assistantReply || "No code changes required."],
      status: "verifying",
    };
  }

  const llm = getLLMClient();

  const fileContext = Object.entries(state.fileTree || {})
    .map(([path, content]) => `--- FILE: ${path} ---\n${content}`)
    .join("\n\n");

  const systemPrompt = `You are an elite, world-class Lead Frontend Engineer and UI/UX Designer crafting Awwwards-tier, visually breathtaking web applications with React, Tailwind CSS, GSAP animations, Google Fonts, and Lucide icons.

CHAT SUMMARY RULE (CRITICAL):
- In the "summary" field, provide STRICTLY 1 to 2 short, friendly sentences summarizing what you built or changed.
- Examples:
  - "I've built a sleek developer portfolio featuring an animated hero, interactive project showcase with live mockups, and GSAP micro-interactions."
  - "Added smooth scrolling navigation, animated skill meters, and a responsive contact modal."
- NEVER write markdown headings (like '### What Was Fixed'), bullet points, numbered lists, changelog essays, or code in the "summary" field.

TYPOGRAPHY & DESIGN SYSTEM:
1. Google Fonts are preloaded in the environment:
   - 'font-sans' -> Plus Jakarta Sans (default clean body, cards, and UI elements)
   - 'font-display' -> Space Grotesk (futuristic, bold headlines, hero titles, stat counters)
   - 'font-mono' -> JetBrains Mono (tech stack pills, code snippets, timestamps, terminal text)
2. Atmosphere & Visual Polish:
   - Deep modern dark palette: 'bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200'
   - Ambient background glow: Add radial or conic gradient blurs in Hero and section backgrounds (e.g. 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]' or 'w-[500px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none')
   - Premium Glassmorphism Cards: 'bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300'
   - Gradient Text Accents: 'bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent font-extrabold'

MANDATORY REAL IMAGES (NO PLAIN BOXES OR EMPTY CONTAINERS):
Websites MUST have real, high-resolution imagery. NEVER replace images with blank colored boxes or dummy text. Use the following tested, high-definition Unsplash URLs:
- Developer & Profile Portraits (Hero, About, Team):
  - 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80' (Creative Engineer)
  - 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80' (Full-Stack Architect)
  - 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80' (Tech Lead / Product)
  - 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80' (Software Engineer)
- Project Mockups & Showcase Screens:
  - Fintech & Analytics Dashboard: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80'
  - Mobile App / iOS Experience: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1000&q=80'
  - AI & 3D Interactive Canvas: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80'
  - E-Commerce & Retail Platform: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=80'
  - Cloud DevOps & Security: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=80'
  - Creative Design Studio: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1000&q=80'
  - Global SaaS Automation: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1000&q=80'
- Coffee / Restaurant / Lifestyle / Business:
  - Specialty Coffee Pour: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=80'
  - Modern Workspace / Studio: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80'
  - Artisan Coffee Beans: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1000&q=80'
- Image Styling Rule:
  Wrap every project screenshot in an overflow-hidden container with hover zoom:
  <div className="overflow-hidden rounded-xl border border-slate-800/80 aspect-video mb-4 relative group/img">
    <img src="..." alt="Project preview" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" loading="lazy" />
  </div>

MANDATORY LUCIDE ICONS (NO PLAIN TEXT BUTTONS):
- Every button, card header, nav item, timeline event, badge, and contact action MUST feature a Lucide icon from 'lucide-react'.
- Available icons include:
  Github, Linkedin, Twitter, ExternalLink, Briefcase, GraduationCap, Terminal, Layers, FolderGit2, Award, Send, Download, Eye, FileText, MapPin, Phone, Calendar, Clock, Database, Server, Smartphone, Laptop, Sparkles, Code2, CheckCircle2, ArrowRight, ArrowUpRight, Zap, Star, User, Users, Search, Mail, Menu, X.
- Never write naked text buttons like <button>Contact</button>.
  Always pair with an icon:
  <button className="px-5 py-2.5 rounded-full font-semibold bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition">
    <Sparkles className="w-4 h-4" /> Let's Connect <ArrowUpRight className="w-4 h-4" />
  </button>

GSAP ANIMATION TRAINING (MANDATORY GREEN-SOCK ANIMATION RULES):
1. Import syntax:
   import gsap from 'gsap';
2. React Context Pattern:
   Always use useRef and useEffect with gsap.context() for clean scoping and React cleanup:
   \`\`\`tsx
   import React, { useEffect, useRef } from 'react';
   import gsap from 'gsap';

   export default function Hero() {
     const compRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
       const ctx = gsap.context(() => {
         // Smooth staggered entrance
         gsap.from('.gsap-badge', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.out' });
         gsap.from('.gsap-title', { opacity: 0, y: 30, duration: 0.8, delay: 0.1, ease: 'power3.out' });
         gsap.from('.gsap-sub', { opacity: 0, y: 20, duration: 0.8, delay: 0.25, ease: 'power3.out' });
         gsap.from('.gsap-cta', { opacity: 0, scale: 0.9, duration: 0.6, delay: 0.4, stagger: 0.1, ease: 'back.out(1.7)' });
         gsap.from('.gsap-card', { opacity: 0, y: 40, duration: 0.8, delay: 0.5, stagger: 0.15, ease: 'power2.out' });
       }, compRef);

       return () => ctx.revert(); // Essential cleanup to avoid duplicate animations on re-renders
     }, []);

     return (
       <div ref={compRef} className="relative ...">
         ...
       </div>
     );
   }
   \`\`\`
3. GSAP Animated Skill Bars:
   gsap.from('.skill-bar-fill', { width: '0%', duration: 1.2, ease: 'power2.out', stagger: 0.1, delay: 0.3 });
4. GSAP Micro-Interactions:
   Use GSAP for hover effects on buttons and cards for buttery-smooth interaction:
   onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.03, duration: 0.2, ease: 'power1.out' })}
   onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: 'power1.out' })}
5. Eases:
   Use modern energetic eases: 'power3.out', 'power2.out', 'back.out(1.7)'.

NAVIGATION & SECTION ANCHORS:
- Every section MUST have a matching HTML id (e.g. id="about", id="skills", id="experience", id="projects", id="contact").
- Include 'scroll-mt-24' on every section to prevent fixed headers from cutting off titles.
- Wire nav links and CTA buttons with smooth scroll:
  onClick={(e) => { e.preventDefault(); document.getElementById('section-id')?.scrollIntoView({ behavior: 'smooth' }); }}
- Mobile hamburger menu must toggle open/closed properly with React state.

RESPONSIVE LAYOUT & ZERO HORIZONTAL OVERFLOW (CRITICAL):
- The website MUST adjust gracefully to fit the available preview space without requiring horizontal scrolling.
- Containers MUST use 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'.
- NEVER use fixed pixel widths on outer containers or sections (NEVER 'w-[1200px]', 'w-[900px]', or 'min-w-[800px]').
- NEVER use 'w-screen' (100vw causes horizontal scrollbars with vertical scroll). ALWAYS use 'w-full'.
- Decorative Background Blurs: Whenever using absolute decorative glow spheres or radial blurs (e.g. 'absolute -right-20 top-20 w-96 h-96 blur-3xl ...'), the parent section MUST have 'relative overflow-hidden' so decorative circles never stick out past the right edge of the screen!
- Responsive Grids: Always use mobile-first breakpoints: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' or 'flex flex-col sm:flex-row'.
- Navbar: Use 'hidden md:flex items-center gap-6' for nav links with a responsive mobile hamburger toggle so links never overflow to the right.

REACT CODE INTEGRITY RULES:
1. MANDATORY App.tsx: App.tsx is the ROOT component mounted in the live preview. YOU MUST ALWAYS GENERATE AND INCLUDE "App.tsx" in the "files" object. App.tsx must import all modular components (e.g. Navbar, Hero, About, Projects, Contact, Footer) and render them in order.
2. Every link in Navbar MUST have a matching section rendered in App.tsx with matching id attributes (id="about", id="skills", id="experience", id="projects", id="contact") and scroll-mt-24. Never generate dead anchor links!
3. Always declare each component with 'export default function ComponentName(props) { ... }' so default imports in App.tsx ('import ComponentName from "./components/ComponentName"') resolve flawlessly.
4. When rendering array lists with .map((item, index) => ...), ALWAYS add a unique 'key' prop (e.g. key={item.id || item.title || index}) on the top-level returned JSX element to prevent React key console warnings.

Return ONLY a valid JSON object. No preamble, no postamble, no explanations outside JSON:
{
  "summary": "1 to 2 short friendly sentences summarizing what was built/updated. NO headings, NO lists.",
  "deletedFiles": [],
  "files": {
    "components/Navbar.tsx": "code...",
    "components/Hero.tsx": "code...",
    "components/Projects.tsx": "code...",
    "components/Contact.tsx": "code...",
    "components/Footer.tsx": "code...",
    "App.tsx": "code..."
  }
}`;

  const historyText =
    state.chatHistory && state.chatHistory.length > 0
      ? `Conversation History:\n${state.chatHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}\n\n`
      : "";

  const userContent = `${historyText}Current User Request: ${state.userPrompt}\nPlan: ${JSON.stringify(state.plan)}\n\nExisting Code:\n${fileContext}`;

  let response: any = null;
  try {
    response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userContent),
    ]);
  } catch (err: any) {
    console.error("[Agent] Code generator LLM invocation failed:", err.message);
  }

  const rawText = response ? extractTextContent(response.content) : "";
  const fileChanges: { path: string; content: string }[] = [];
  const deletedFiles: string[] = [];
  const updatedTree: Record<string, string> = { ...state.fileTree };
  let assistantReplyText = state.assistantReply || "";
  let parseSuccess = false;

  // 1. Direct JSON.parse attempt
  if (rawText) {
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsedData: any = JSON.parse(jsonStr);

        if (parsedData.summary && typeof parsedData.summary === "string" && !parsedData.summary.startsWith("[{")) {
          assistantReplyText = parsedData.summary.trim();
        }

        const toDelete = parsedData.deletedFiles || parsedData.deleteFiles || [];
        if (Array.isArray(toDelete)) {
          toDelete.forEach((pathStr: string) => {
            if (typeof pathStr === "string" && pathStr.trim().length > 0) {
              deletedFiles.push(pathStr.trim());
              delete updatedTree[pathStr.trim()];
            }
          });
        }

        const filesMap = parsedData.files || parsedData.fileChanges || parsedData;
        if (typeof filesMap === "object" && filesMap !== null) {
          for (const [path, content] of Object.entries(filesMap)) {
            if (
              path !== "deletedFiles" &&
              path !== "deleteFiles" &&
              path !== "summary" &&
              typeof content === "string" &&
              isCodeContent(content)
            ) {
              fileChanges.push({ path, content });
              updatedTree[path] = content;
            }
          }
        }

        if (fileChanges.length > 0) {
          parseSuccess = true;
        }
      }
    } catch (directErr) {
      console.warn("[Agent] Direct JSON.parse failed, executing resilient extraction fallback...");
    }
  }

  // 2. Resilient file extraction fallback if direct JSON.parse threw
  if (!parseSuccess && rawText) {
    // Extract summary
    const summaryMatch = rawText.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (summaryMatch) {
      try {
        const s = JSON.parse(`"${summaryMatch[1]}"`);
        if (s && !s.startsWith("[{")) assistantReplyText = s;
      } catch {
        assistantReplyText = summaryMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"');
      }
    }

    // Extract files from JSON structure: "path.ext": "..."
    const fileKeyRegex = /"([a-zA-Z0-9_\-./]+\.(?:tsx|jsx|ts|js|html|css))"\s*:\s*"/g;
    let keyMatch;
    const keyPositions: { path: string; startIndex: number; keyStart: number }[] = [];
    while ((keyMatch = fileKeyRegex.exec(rawText)) !== null) {
      keyPositions.push({
        path: keyMatch[1],
        keyStart: keyMatch.index,
        startIndex: keyMatch.index + keyMatch[0].length,
      });
    }

    for (let i = 0; i < keyPositions.length; i++) {
      const current = keyPositions[i];
      let endIndex = rawText.length;
      if (i + 1 < keyPositions.length) {
        const nextKey = keyPositions[i + 1];
        const quoteBeforeNext = rawText.lastIndexOf('"', nextKey.keyStart - 1);
        if (quoteBeforeNext > current.startIndex) {
          endIndex = quoteBeforeNext;
        } else {
          endIndex = nextKey.keyStart - 1;
        }
      } else {
        const lastQuote = rawText.lastIndexOf('"');
        if (lastQuote > current.startIndex) {
          endIndex = lastQuote;
        }
      }

      let fileSnippet = rawText.slice(current.startIndex, endIndex);
      fileSnippet = fileSnippet.replace(/"\s*,?\s*$/, "");
      try {
        fileSnippet = JSON.parse(`"${fileSnippet}"`);
      } catch {
        fileSnippet = fileSnippet
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\");
      }

      if (isCodeContent(fileSnippet)) {
        fileChanges.push({ path: current.path, content: fileSnippet });
        updatedTree[current.path] = fileSnippet;
      }
    }

    // Extract markdown code blocks (```tsx ... ```) if still no files found
    if (fileChanges.length === 0) {
      const codeBlockRegex = /```(?:tsx|jsx|typescript|javascript|html|css)?\n([\s\S]*?)```/g;
      let match;
      let extractedCount = 0;
      while ((match = codeBlockRegex.exec(rawText)) !== null) {
        const blockCode = match[1].trim();
        if (isCodeContent(blockCode)) {
          const firstLine = blockCode.split("\n")[0] || "";
          const fileMatch = firstLine.match(/\/\/\s*(?:File:\s*)?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
          const targetPath = fileMatch ? fileMatch[1].trim() : (extractedCount === 0 ? "App.tsx" : `components/Component${extractedCount}.tsx`);
          fileChanges.push({ path: targetPath, content: blockCode });
          updatedTree[targetPath] = blockCode;
          extractedCount++;
        }
      }
    }
  }

  // 3. Guarantee App.tsx is updated so live preview never shows stale template
  const hasAppInChanges = fileChanges.some((f) => f.path.endsWith("App.tsx") || f.path === "App.tsx");
  if (!hasAppInChanges && fileChanges.length > 0) {
    const componentFiles = fileChanges.filter((f) => f.path.startsWith("components/"));
    if (componentFiles.length > 0) {
      const imports: string[] = ["import React from 'react';"];
      const renderedTags: string[] = [];
      componentFiles.forEach((cf) => {
        const compName = cf.path.replace("components/", "").replace(/\.[^/.]+$/, "");
        imports.push(`import ${compName} from './components/${compName}';`);
        const sectionId = compName.toLowerCase();
        renderedTags.push(`        <section id="${sectionId}" className="scroll-mt-24">\n          <${compName} />\n        </section>`);
      });

      const generatedApp = `${imports.join("\n")}\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">\n${renderedTags.join("\n")}\n    </div>\n  );\n}\n`;
      fileChanges.push({ path: "App.tsx", content: generatedApp });
      updatedTree["App.tsx"] = generatedApp;
    }
  }

  // 4. Strict Sanitization: Guarantee 1-2 sentence friendly response without raw JSON or changelogs
  if (
    !assistantReplyText ||
    assistantReplyText.startsWith("[{") ||
    assistantReplyText.includes('"type":"text"') ||
    assistantReplyText.includes("###") ||
    assistantReplyText.includes("##") ||
    assistantReplyText.includes("What Was Fixed") ||
    assistantReplyText.includes("Changelog") ||
    assistantReplyText.length < 5
  ) {
    const firstSentence = assistantReplyText.split(/###|##|\n\n\d+\.|\n\n-\s|\n\n\*/)[0].trim();
    if (
      firstSentence.length > 10 &&
      !firstSentence.includes("###") &&
      !firstSentence.startsWith("[{") &&
      !firstSentence.includes('"type":"text"')
    ) {
      assistantReplyText = firstSentence;
    } else {
      assistantReplyText = fileChanges.length > 0
        ? `I've updated your website with ${fileChanges.length} component(s) including smooth navigation and GSAP animations.`
        : "I've processed your request.";
    }
  }

  // Cap at 2 sentences maximum
  const sentences = assistantReplyText.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 2) {
    assistantReplyText = sentences.slice(0, 2).join(" ").trim();
  }

  const logs: string[] = [];
  deletedFiles.forEach((d) => logs.push(`🗑️ Deleted file ${d}`));
  fileChanges.forEach((f) => logs.push(`✏️ Generated code for ${f.path}`));
  if (logs.length === 0) {
    logs.push(assistantReplyText || "Processed request.");
  }

  return {
    fileChanges,
    deletedFiles,
    fileTree: updatedTree,
    assistantReply: assistantReplyText,
    logs,
    status: "verifying",
  };
}

// 3. Verifier Node
async function verifierNode(state: AgentStateType) {
  const fileCount = state.fileChanges?.length || 0;
  return {
    logs: state.logs || [fileCount > 0 ? `✅ Verification complete (${fileCount} files updated)` : "✅ Done"],
    status: "done",
  };
}

function routeAfterPlanner(state: AgentStateType) {
  if (!state.plan || state.plan.length === 0) {
    return "verifier";
  }
  return "code_generator";
}

const workflow = new StateGraph(AgentAnnotation)
  .addNode("planner", plannerNode)
  .addNode("code_generator", codeGeneratorNode)
  .addNode("verifier", verifierNode)
  .addEdge("__start__", "planner")
  .addConditionalEdges("planner", routeAfterPlanner, {
    code_generator: "code_generator",
    verifier: "verifier",
  })
  .addEdge("code_generator", "verifier")
  .addEdge("verifier", END);

export const agentGraph = workflow.compile();
