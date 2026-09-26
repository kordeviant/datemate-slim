import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface RulesDocResult {
  title: string;
  version: string;
  lastUpdated: string;
  rulesUrl: string;
  rawUrl: string;
  downloadUrl: string;
  content: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  /**
   * Resolves the path to the authoritative RULES.md file.
   */
  private resolveRulesFilePath(): string {
    const candidatePaths = [
      path.join(process.cwd(), 'docs', 'RULES.md'),
      path.join(__dirname, '..', 'docs', 'RULES.md'),
      path.join(__dirname, '..', '..', 'docs', 'RULES.md'),
      path.join(__dirname, 'docs', 'RULES.md'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return candidatePaths[0];
  }

  /**
   * Retrieves the raw markdown content and metadata for platform rules.
   */
  getRulesMarkdown(): { content: string; lastUpdated: string } {
    const filePath = this.resolveRulesFilePath();

    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          content,
          lastUpdated: stats.mtime.toISOString(),
        };
      }
    } catch (err: any) {
      this.logger.error(`Failed to read RULES.md: ${err.message}`);
    }

    return {
      content: '# DateMate Platform Rules & Client Validation Specification\n\nRules file temporarily unavailable.',
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Returns structured JSON data for API consumers.
   */
  getRulesJson(): RulesDocResult {
    const { content, lastUpdated } = this.getRulesMarkdown();
    return {
      title: 'DateMate Platform Rules & Client Validation Specification',
      version: '1.0.0',
      lastUpdated,
      rulesUrl: '/rules',
      rawUrl: '/rules?format=raw',
      downloadUrl: '/rules?download=1',
      content,
    };
  }

  /**
   * Generates a modern, responsive, styled HTML document for online browser viewing.
   */
  getRulesHtml(): string {
    const { content, lastUpdated } = this.getRulesMarkdown();
    const formattedDate = new Date(lastUpdated).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Safely encode markdown for embedding inside <script>
    const safeContent = content
      .replace(/<\/script>/gi, '<\\/script>')
      .replace(/<!--/g, '<\\!--');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DateMate Platform Rules & Client Validation Specification</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <style>
    :root {
      --bg-color: #0b0f19;
      --surface-color: #111827;
      --surface-card: #162032;
      --border-color: #1f293d;
      --border-subtle: #26334d;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --brand-rose: #f43f5e;
      --brand-rose-glow: rgba(244, 63, 94, 0.15);
      --brand-accent: #38bdf8;
      --success: #10b981;
      --warning: #f59e0b;
      --code-bg: #0d121f;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Navigation Bar */
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(11, 15, 25, 0.88);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border-color);
      padding: 12px 24px;
    }

    .header-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #f43f5e, #e11d48);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
      color: white;
      box-shadow: 0 0 16px var(--brand-rose-glow);
    }

    .brand-title {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.01em;
      color: var(--text-main);
    }

    .badge-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-live::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn:hover {
      background: var(--surface-card);
      border-color: var(--brand-accent);
      color: white;
    }

    .btn-primary {
      background: linear-gradient(135deg, #f43f5e, #e11d48);
      border: none;
      color: white;
    }

    .btn-primary:hover {
      opacity: 0.92;
      box-shadow: 0 0 12px var(--brand-rose-glow);
    }

    /* Layout */
    .layout-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 32px;
    }

    @media (max-width: 1024px) {
      .layout-container {
        grid-template-columns: 1fr;
      }
      .toc-sidebar {
        display: none !important;
      }
    }

    /* Sidebar Table of Contents */
    .toc-sidebar {
      position: sticky;
      top: 76px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      padding-right: 8px;
    }

    .toc-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin-bottom: 12px;
    }

    .toc-nav {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .toc-nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      padding: 6px 10px;
      border-radius: 6px;
      display: block;
      transition: all 0.15s ease;
      line-height: 1.4;
    }

    .toc-nav a:hover {
      color: var(--text-main);
      background: var(--surface-card);
      border-left: 2px solid var(--brand-rose);
    }

    /* Content Area */
    .content-area {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 40px 48px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
      min-width: 0;
    }

    @media (max-width: 640px) {
      .content-area {
        padding: 24px 16px;
      }
    }

    /* Markdown Styling */
    .content-area h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .content-area h2 {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 36px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
      scroll-margin-top: 90px;
    }

    .content-area h3 {
      font-size: 17px;
      font-weight: 600;
      color: #e2e8f0;
      margin-top: 24px;
      margin-bottom: 12px;
      scroll-margin-top: 90px;
    }

    .content-area h4 {
      font-size: 15px;
      font-weight: 600;
      color: #cbd5e1;
      margin-top: 20px;
      margin-bottom: 8px;
      scroll-margin-top: 90px;
    }

    .content-area p {
      margin-bottom: 16px;
      color: #cbd5e1;
    }

    .content-area ul, .content-area ol {
      margin-bottom: 16px;
      padding-left: 24px;
      color: #cbd5e1;
    }

    .content-area li {
      margin-bottom: 6px;
    }

    .content-area strong {
      color: #ffffff;
      font-weight: 600;
    }

    /* Tables */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      margin: 20px 0;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--code-bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      text-align: left;
    }

    th {
      background: #131c2e;
      color: #f1f5f9;
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
    }

    td {
      padding: 11px 16px;
      border-bottom: 1px solid var(--border-color);
      color: #cbd5e1;
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Code Blocks */
    pre {
      background: var(--code-bg) !important;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin: 18px 0;
      overflow-x: auto;
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 13px;
      line-height: 1.55;
      position: relative;
    }

    pre code {
      background: transparent !important;
      padding: 0 !important;
      border: none !important;
      font-family: inherit;
    }

    code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      background: rgba(244, 63, 94, 0.1);
      color: #fca5a5;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12.5px;
      border: 1px solid rgba(244, 63, 94, 0.2);
    }

    /* Blockquotes */
    blockquote {
      background: rgba(56, 189, 248, 0.07);
      border-left: 4px solid var(--brand-accent);
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0;
      color: #e2e8f0;
    }

    blockquote p {
      margin-bottom: 0;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 32px 0;
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--border-color);
      padding: 24px;
      text-align: center;
      color: var(--text-dim);
      font-size: 13px;
      margin-top: 40px;
    }

    footer a {
      color: var(--brand-accent);
      text-decoration: none;
    }

    .copy-notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: white;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
      display: none;
      z-index: 1000;
    }
  </style>
</head>
<body>

  <header>
    <div class="header-inner">
      <div class="brand">
        <div class="brand-logo">DM</div>
        <div>
          <div class="brand-title">DateMate Platform Rules</div>
          <div style="font-size: 11px; color: var(--text-dim);">Client Validation & Protocol Specification</div>
        </div>
        <span class="badge-live">Live Synchronized</span>
      </div>

      <div class="header-actions">
        <button class="btn" onclick="copyRawMarkdown()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy Markdown
        </button>
        <a class="btn" href="/rules?download=1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download .md
        </a>
        <a class="btn" href="/docs" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Swagger API
        </a>
      </div>
    </div>
  </header>

  <div class="layout-container">
    <aside class="toc-sidebar">
      <div class="toc-title">Table of Contents</div>
      <nav>
        <ul class="toc-nav" id="toc-list">
          <li><a href="#1-media--image-upload-rules">1. Media & Image Rules</a></li>
          <li><a href="#2-username-rules">2. Username Rules</a></li>
          <li><a href="#3-full-name-rules">3. Full Name Rules</a></li>
          <li><a href="#4-date-of-birth--age-restrictions">4. Date of Birth & Age</a></li>
          <li><a href="#5-languages-rules">5. Languages Rules</a></li>
          <li><a href="#6-demographics--attributes">6. Demographics & Attributes</a></li>
          <li><a href="#7-dating-preferences--lifestyle">7. Dating Preferences</a></li>
          <li><a href="#8-personality--astrological-sign">8. Personality & Star Sign</a></li>
          <li><a href="#9-profile-completion--verification">9. Profile Completion</a></li>
          <li><a href="#10-account--security-rules">10. Account & Security</a></li>
          <li><a href="#11-client-payload-schema-reference">11. Schema Reference</a></li>
          <li><a href="#12-http-response-envelope--error-codes">12. Error Codes Envelope</a></li>
        </ul>
      </nav>
      <div style="margin-top: 24px; padding: 14px; background: var(--surface-card); border-radius: 8px; font-size: 12px; border: 1px solid var(--border-color);">
        <div style="color: var(--text-dim); margin-bottom: 4px;">Last Backend Update</div>
        <div style="font-weight: 600; color: #f1f5f9;">${formattedDate}</div>
        <div style="color: var(--text-muted); margin-top: 4px;">Synchronized with backend validation engines</div>
      </div>
    </aside>

    <main class="content-area" id="markdown-target">
      <noscript>
        <pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre>
      </noscript>
    </main>
  </div>

  <footer>
    <div style="max-width: 1400px; margin: 0 auto;">
      DateMate Core Backend &bull; Authoritative Rules Specification &bull; <a href="/docs">Swagger Documentation</a> &bull; <a href="/health">Health Endpoint</a>
    </div>
  </footer>

  <div class="copy-notification" id="copy-toast">Markdown copied to clipboard!</div>

  <!-- Raw markdown payload -->
  <script type="text/markdown" id="raw-markdown-data">${safeContent}</script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", () => {
      const raw = document.getElementById("raw-markdown-data").textContent;
      const target = document.getElementById("markdown-target");

      if (window.marked) {
        // Configure renderer for custom table wrappers
        const renderer = new marked.Renderer();
        renderer.table = function(header, body) {
          return '<div class="table-wrapper"><table><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
        };

        marked.setOptions({
          renderer: renderer,
          gfm: true,
          breaks: false,
          highlight: function(code, lang) {
            if (lang && window.hljs && hljs.getLanguage(lang)) {
              try {
                return hljs.highlight(code, { language: lang }).value;
              } catch (e) {}
            }
            return window.hljs ? hljs.highlightAuto(code).value : code;
          }
        });

        target.innerHTML = marked.parse(raw);

        // Highlight any remaining code blocks
        if (window.hljs) {
          document.querySelectorAll('pre code').forEach((el) => {
            hljs.highlightElement(el);
          });
        }
      }
    });

    function copyRawMarkdown() {
      const raw = document.getElementById("raw-markdown-data").textContent;
      navigator.clipboard.writeText(raw).then(() => {
        const toast = document.getElementById("copy-toast");
        toast.style.display = "block";
        setTimeout(() => {
          toast.style.display = "none";
        }, 2200);
      });
    }
  </script>
</body>
</html>`;
  }
}
