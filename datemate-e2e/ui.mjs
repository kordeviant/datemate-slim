/**
 * DateMate E2E - Terminal UI & Styling Engine
 * Provides rich ANSI-colored formatting, persona tags, action logs, and summary tables.
 */

const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

export const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  italic: isColorSupported ? '\x1b[3m' : '',
  underline: isColorSupported ? '\x1b[4m' : '',

  // Foregrounds
  black: isColorSupported ? '\x1b[30m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',

  // Brights
  brightRed: isColorSupported ? '\x1b[91m' : '',
  brightGreen: isColorSupported ? '\x1b[92m' : '',
  brightYellow: isColorSupported ? '\x1b[93m' : '',
  brightBlue: isColorSupported ? '\x1b[94m' : '',
  brightMagenta: isColorSupported ? '\x1b[95m' : '',
  brightCyan: isColorSupported ? '\x1b[96m' : '',
  brightWhite: isColorSupported ? '\x1b[97m' : '',

  // Backgrounds
  bgRed: isColorSupported ? '\x1b[41m' : '',
  bgGreen: isColorSupported ? '\x1b[42m' : '',
  bgYellow: isColorSupported ? '\x1b[43m' : '',
  bgBlue: isColorSupported ? '\x1b[44m' : '',
  bgMagenta: isColorSupported ? '\x1b[45m' : '',
  bgCyan: isColorSupported ? '\x1b[46m' : '',
};

export const personaThemes = {
  Alice: { tag: `${colors.bold}${colors.brightMagenta}[ALICE]${colors.reset}`, icon: '👩' },
  Bob: { tag: `${colors.bold}${colors.brightCyan}[BOB]${colors.reset}`, icon: '👨' },
  Charlie: { tag: `${colors.bold}${colors.brightYellow}[CHARLIE]${colors.reset}`, icon: '🧑' },
  Admin: { tag: `${colors.bold}${colors.brightRed}[ADMIN]${colors.reset}`, icon: '🛡️' },
  System: { tag: `${colors.bold}${colors.gray}[SYSTEM]${colors.reset}`, icon: '⚙️' },
  Cleanup: { tag: `${colors.bold}${colors.green}[CLEANUP]${colors.reset}`, icon: '🧹' },
};

export class TerminalUI {
  static banner(title, subtitle) {
    const width = 70;
    const border = '═'.repeat(width);
    console.log(`\n${colors.brightCyan}${border}${colors.reset}`);
    console.log(`${colors.bold}${colors.brightWhite}  🚀 ${title}${colors.reset}`);
    if (subtitle) {
      console.log(`${colors.dim}     ${subtitle}${colors.reset}`);
    }
    console.log(`${colors.brightCyan}${border}${colors.reset}\n`);
  }

  static section(title, icon = '📂') {
    const line = '─'.repeat(Math.max(10, 64 - title.length));
    console.log(`\n${colors.bold}${colors.blue}┌── ${icon}  ${title.toUpperCase()} ${line}${colors.reset}`);
  }

  static scenarioEnd(passed, durationMs) {
    const status = passed
      ? `${colors.bold}${colors.brightGreen} PASSED ${colors.reset}`
      : `${colors.bold}${colors.brightRed} FAILED ${colors.reset}`;
    console.log(`${colors.bold}${colors.blue}└── Status: [${status}] (${durationMs}ms)${colors.reset}\n`);
  }

  static personaLog(personaName, action, detail = '', durationMs = null) {
    const theme = personaThemes[personaName] || personaThemes.System;
    const timing = durationMs !== null ? `${colors.dim} [${durationMs}ms]${colors.reset}` : '';
    console.log(`  ${theme.tag} ${theme.icon} ${colors.bold}${action}${colors.reset} ${detail}${timing}`);
  }

  static pass(msg, durationMs = null) {
    const timing = durationMs !== null ? `${colors.dim} (${durationMs}ms)${colors.reset}` : '';
    console.log(`    ${colors.brightGreen}✔${colors.reset} ${msg}${timing}`);
  }

  static fail(msg, err = null) {
    console.log(`    ${colors.brightRed}✖ ${colors.bold}${msg}${colors.reset}`);
    if (err) {
      console.log(`      ${colors.red}${err.message || err}${colors.reset}`);
      if (err.response) {
        console.log(`      ${colors.dim}Response: ${JSON.stringify(err.response, null, 2)}${colors.reset}`);
      }
    }
  }

  static warn(msg) {
    console.log(`    ${colors.yellow}⚠️  ${msg}${colors.reset}`);
  }

  static info(msg) {
    console.log(`    ${colors.cyan}ℹ  ${msg}${colors.reset}`);
  }

  static table(headers, rows) {
    const colWidths = headers.map((h, i) => {
      const maxRow = rows.reduce((max, r) => Math.max(max, String(r[i] || '').replace(/\x1b\[[0-9;]*m/g, '').length), 0);
      return Math.max(h.length, maxRow) + 2;
    });

    const pad = (str, len) => {
      const clean = String(str).replace(/\x1b\[[0-9;]*m/g, '');
      const diff = len - clean.length;
      return str + ' '.repeat(Math.max(0, diff));
    };

    const headerLine = headers.map((h, i) => pad(h, colWidths[i])).join('│ ');
    const sepLine = colWidths.map(w => '─'.repeat(w)).join('┼─');

    console.log(`\n${colors.bold}${headerLine}${colors.reset}`);
    console.log(`${colors.dim}${sepLine}${colors.reset}`);
    for (const r of rows) {
      console.log(r.map((c, i) => pad(c, colWidths[i])).join('│ '));
    }
    console.log('');
  }
}
