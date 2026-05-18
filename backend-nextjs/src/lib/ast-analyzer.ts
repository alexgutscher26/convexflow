import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// Interfaces for our AST scan findings
interface ASTFinding {
  filePath: string;
  line: number;
  character: number;
  category: 'SECURITY' | 'QUALITY' | 'SANITIZATION';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  snippet: string;
  fixSuggestion?: string;
}

const findings: ASTFinding[] = [];
let totalFilesScanned = 0;
let totalNodesTraversed = 0;

// Helper to trace file paths recursively
function getTsFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist' && file !== '.git') {
        getTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Extract the line and character from node
function getLineInfo(sourceFile: ts.SourceFile, node: ts.Node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return { line: line + 1, character: character + 1 };
}

// Extract raw code snippet
function getSnippet(sourceFile: ts.SourceFile, node: ts.Node): string {
  return node.getText(sourceFile).slice(0, 160) + (node.getText(sourceFile).length > 160 ? '...' : '');
}

// Depth-first traversal & rule execution
function analyzeFile(filePath: string) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  totalFilesScanned++;

  // Local state to track imports within the file
  let importsSanitize = false;
  let importsJwt = false;

  // Pre-scan imports
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      if (moduleSpecifier.includes('lib/sanitize') || moduleSpecifier.includes('@/lib/sanitize')) {
        importsSanitize = true;
      }
      if (moduleSpecifier === 'jsonwebtoken' || moduleSpecifier === 'jwt') {
        importsJwt = true;
      }
    }
  });

  // Track mutation functions defined in route handlers
  let hasPostExport = false;
  let hasPutExport = false;
  let hasPatchExport = false;
  let sanitizesInputs = false;

  function visit(node: ts.Node) {
    totalNodesTraversed++;

    // Rule 1: Validate JWT audience & issuer claims
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        const prop = expr.name;
        if (ts.isIdentifier(obj) && obj.text === 'jwt' && prop.text === 'verify') {
          // Found jwt.verify(...)
          let optionsArg: ts.ObjectLiteralExpression | null = null;
          // Verify call signature: jwt.verify(token, secret, [options], [callback])
          if (node.arguments.length >= 3) {
            const thirdArg = node.arguments[2];
            if (ts.isObjectLiteralExpression(thirdArg)) {
              optionsArg = thirdArg;
            }
          } else if (node.arguments.length === 2) {
            // Check second arg if third is absent (some standard shapes)
            const secondArg = node.arguments[1];
            if (ts.isObjectLiteralExpression(secondArg)) {
              optionsArg = secondArg;
            }
          }

          let hasAudience = false;
          let hasIssuer = false;

          if (optionsArg) {
            for (const p of optionsArg.properties) {
              if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                if (p.name.text === 'audience') hasAudience = true;
                if (p.name.text === 'issuer') hasIssuer = true;
              }
            }
          }

          if (!hasAudience || !hasIssuer) {
            const { line, character } = getLineInfo(sourceFile, node);
            findings.push({
              filePath,
              line,
              character,
              category: 'SECURITY',
              severity: 'WARNING',
              message: `jwt.verify() call is missing audience/issuer validations. Standard claims ('iss' and 'aud') should be validated for defense-in-depth to protect token scopes.`,
              snippet: getSnippet(sourceFile, node),
              fixSuggestion: `jwt.verify(token, process.env.JWT_SECRET, { audience: "convexflow-client", issuer: "convexflow-auth" })`
            });
          }
        }
      }
    }

    // Rule 2: MongoDB Dynamic String Injections
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const propName = expr.name.text;
        const mongoQueryMethods = ['findOne', 'find', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments'];
        if (mongoQueryMethods.includes(propName)) {
          const queryArg = node.arguments[0];
          if (queryArg) {
            // Check if the query argument contains template literals or string additions indicating unsafe interpolation
            let isUnsafeString = false;
            
            const checkUnsafeValue = (val: ts.Node) => {
              if (ts.isTemplateExpression(val)) {
                isUnsafeString = true; // Template literals inside query objects are risky
              }
              if (ts.isBinaryExpression(val) && val.operatorToken.kind === ts.SyntaxKind.PlusToken) {
                isUnsafeString = true; // String addition matches are highly dynamic
              }
            };

            if (ts.isObjectLiteralExpression(queryArg)) {
              for (const prop of queryArg.properties) {
                // Check if query properties use raw strings or dynamic evaluation keys like $where
                if (ts.isPropertyAssignment(prop)) {
                  const keyText = prop.name.getText(sourceFile).replace(/['"]/g, '');
                  if (keyText === '$where') {
                    const { line, character } = getLineInfo(sourceFile, prop);
                    findings.push({
                      filePath,
                      line,
                      character,
                      category: 'SECURITY',
                      severity: 'CRITICAL',
                      message: `Unsafe NoSQL query pattern detected! Usage of dynamic '$where' clauses can lead to NoSQL injections and arbitrary server-side code execution. Use parameterized key-value matching instead.`,
                      snippet: getSnippet(sourceFile, prop)
                    });
                  }
                  checkUnsafeValue(prop.initializer);
                }
              }
            }

            if (isUnsafeString) {
              const { line, character } = getLineInfo(sourceFile, queryArg);
              findings.push({
                filePath,
                line,
                character,
                category: 'SECURITY',
                severity: 'CRITICAL',
                message: `Dynamic string concatenation/interpolation detected inside MongoDB query filter object! Queries should pass strictly structured objects with clean key-value variables to eliminate any NoSQL injection footprint.`,
                snippet: getSnippet(sourceFile, queryArg),
                fixSuggestion: `Use key-value parameters: { project_id: projectId } instead of template strings: { project_id: \`\${projectId}\` }`
              });
            }
          }
        }
      }
    }

    // Rule 3: Input Sanitization Coverage
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      // Find POST/PUT/PATCH route functions
      const name = ts.isFunctionDeclaration(node) && node.name ? node.name.text : '';
      const parent = node.parent;
      let isRouteHandler = false;
      
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        const varName = parent.name.text;
        if (['POST', 'PUT', 'PATCH'].includes(varName)) {
          isRouteHandler = true;
          if (varName === 'POST') hasPostExport = true;
          if (varName === 'PUT') hasPutExport = true;
          if (varName === 'PATCH') hasPatchExport = true;
        }
      }

      if (isRouteHandler) {
        // Look inside the route handler body for calls to sanitizeAndNormalizeText
        const checkForSanitize = (inner: ts.Node) => {
          if (ts.isCallExpression(inner)) {
            const callExpr = inner.expression;
            if (ts.isIdentifier(callExpr) && callExpr.text === 'sanitizeAndNormalizeText') {
              sanitizesInputs = true;
            }
          }
          ts.forEachChild(inner, checkForSanitize);
        };
        ts.forEachChild(node, checkForSanitize);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // If a file is a mutating route handler but doesn't sanitize inputs, trigger alert!
  if ((hasPostExport || hasPutExport || hasPatchExport) && filePath.includes('app/api') && !sanitizesInputs) {
    findings.push({
      filePath,
      line: 1,
      character: 1,
      category: 'SANITIZATION',
      severity: 'CRITICAL',
      message: `API Route handler contains mutative exports (POST/PUT/PATCH) but does not call 'sanitizeAndNormalizeText' for user inputs. Raw inputs must be sanitized before saving to MongoDB to protect from XSS or stored exploits.`,
      snippet: `File: ${path.basename(filePath)} exports mutative methods.`,
      fixSuggestion: `import { sanitizeAndNormalizeText } from "@/lib/sanitize";\n// sanitize inputs: const safeContent = sanitizeAndNormalizeText(rawContent);`
    });
  }
}

// Main Execution
const workspaceDir = path.resolve(__dirname, '../../');
console.log(`Starting deep AST analysis scanning on: ${workspaceDir}`);
const targetFiles = getTsFiles(path.join(workspaceDir, 'src'));

console.log(`Found ${targetFiles.length} TypeScript source files to analyze.`);
for (const file of targetFiles) {
  try {
    analyzeFile(file);
  } catch (e) {
    console.warn(`[Warning] Parsing failed for ${path.basename(file)}:`, e);
  }
}

console.log(`\nAST Scan complete! Scanned ${totalFilesScanned} files, processed ${totalNodesTraversed} AST nodes.`);
console.log(`Found ${findings.length} findings.`);

// Group findings by category and severity
const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
const warningFindings = findings.filter(f => f.severity === 'WARNING');

// Format results into a beautiful Markdown Report
const reportPath = path.resolve('C:/Users/gutsc/.gemini/antigravity/brain/c9597fd3-e911-4152-b369-a8f35a054d92/artifacts/ast_analysis_results.md');

let mdReport = `# AST Analysis Audit Report

This report presents static Abstract Syntax Tree (AST) scanning outcomes across the backend API routes and shared libraries. The scans targeted NoSQL Query Injection vectors, defense-in-depth JWT claims enforcement, and user input sanitization loops.

---

## 📊 Scan Metrics

| Metric | Count |
| --- | --- |
| **Total Files Audited** | ${totalFilesScanned} |
| **Total AST Nodes Traversed** | ${totalNodesTraversed} |
| **Critical Security Violations** | ${criticalFindings.length} |
| **Warnings / Code Quality Issues** | ${warningFindings.length} |

---

## 🔴 CRITICAL FINDINGS

`;

if (criticalFindings.length === 0) {
  mdReport += `> [!NOTE]\n> No critical security or injection vulnerabilities were detected by the AST scanner! All active database queries and input parameters comply with high safety requirements.\n\n`;
} else {
  criticalFindings.forEach((f, idx) => {
    mdReport += `### ${idx + 1}. [${f.category}] In ${path.basename(f.filePath)}:${f.line}\n\n`;
    mdReport += `* **File Path**: [${path.basename(f.filePath)}](file:///${f.filePath.replace(/\\/g, '/')})\n`;
    mdReport += `* **Line**: ${f.line} | **Character**: ${f.character}\n`;
    mdReport += `* **Description**: ${f.message}\n\n`;
    mdReport += `#### Code Segment:\n\`\`\`typescript\n${f.snippet}\n\`\`\`\n\n`;
    if (f.fixSuggestion) {
      mdReport += `#### Suggested Remediation:\n\`\`\`diff\n+ ${f.fixSuggestion}\n\`\`\`\n\n`;
    }
    mdReport += `---\n\n`;
  });
}

mdReport += `## 🟡 WARNINGS & COMPLIANCE ISSUES\n\n`;

if (warningFindings.length === 0) {
  mdReport += `> [!NOTE]\n> No warning or compliance failures were detected. All scanned endpoints are in active alignment with security best practices.\n\n`;
} else {
  warningFindings.forEach((f, idx) => {
    mdReport += `### ${idx + 1}. [${f.category}] In ${path.basename(f.filePath)}:${f.line}\n\n`;
    mdReport += `* **File Path**: [${path.basename(f.filePath)}](file:///${f.filePath.replace(/\\/g, '/')})\n`;
    mdReport += `* **Line**: ${f.line} | **Character**: ${f.character}\n`;
    mdReport += `* **Description**: ${f.message}\n\n`;
    mdReport += `#### Code Segment:\n\`\`\`typescript\n${f.snippet}\n\`\`\`\n\n`;
    if (f.fixSuggestion) {
      mdReport += `#### Suggested Remediation:\n\`\`\`diff\n+ ${f.fixSuggestion}\n\`\`\`\n\n`;
    }
    mdReport += `---\n\n`;
  });
}

mdReport += `## 💡 Best Practice Architecture Summary

1. **MongoDB Query Parameterization**: All MongoDB queries must pass static filters (e.g. \`{ id: userId }\`) instead of string interpolation (e.g. \`{ id: \`\${userId}\` }\`). The AST engine correctly flags templates inside queries to avoid NoSQL injection footprint.
2. **Double Sanitization**: Ensure that \`sanitizeAndNormalizeText\` is called immediately upon receiving user-submitted text fields (like \`title\` or \`content\`) inside route controllers to strictly block stored XSS vectors.
3. **Audited Token Verification**: When verifying JSON Web Tokens, always declare the optional config parameter, validating the \`audience\` and \`issuer\` claims to lock token scopes between clients and authorities.
`;

fs.writeFileSync(reportPath, mdReport);
console.log(`Markdown AST analysis report written successfully to: ${reportPath}`);
