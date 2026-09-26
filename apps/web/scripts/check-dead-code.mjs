import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8"));
const exemptions = JSON.parse(readFileSync(path.join(webRoot, "dead-code-exemptions.json"), "utf8"));

const toPosix = (value) => value.split(path.sep).join("/");
const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  "test-results",
  "playwright-report",
  ".tmp",
  ".git",
]);
const codeExtensions = /\.(?:[cm]?js|jsx|tsx?)$/;
const sourceExtensions = /\.tsx?$/;
const generatedPrefix = "src/shared/api/generated/";

const collectFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(absolutePath);
    return entry.isFile() ? [absolutePath] : [];
  });

const allFiles = collectFiles(webRoot);
const codeFiles = allFiles.filter((absolutePath) => codeExtensions.test(absolutePath));
const projectPathByAbsolute = new Map(
  codeFiles.map((absolutePath) => [absolutePath, toPosix(path.relative(webRoot, absolutePath))]),
);
const absoluteByProjectPath = new Map(
  [...projectPathByAbsolute.entries()].map(([absolutePath, projectPath]) => [projectPath, absolutePath]),
);
const projectPathSet = new Set(absoluteByProjectPath.keys());
const sourceProjectPaths = [...projectPathSet]
  .filter((projectPath) => projectPath.startsWith("src/") && sourceExtensions.test(projectPath))
  .sort();

const parsedFiles = new Map();

const scriptKindFor = (projectPath) => {
  if (projectPath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (projectPath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (projectPath.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
};

const parse = (projectPath) => {
  const cached = parsedFiles.get(projectPath);
  if (cached) return cached;
  const absolutePath = absoluteByProjectPath.get(projectPath);
  const sourceFile = ts.createSourceFile(
    projectPath,
    readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(projectPath),
  );
  parsedFiles.set(projectPath, sourceFile);
  return sourceFile;
};

const resolveLocalSpecifier = (fromProjectPath, specifier) => {
  if (!specifier.startsWith(".")) return null;
  const joined = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromProjectPath), specifier),
  );
  const candidates = [];

  if (/\.(?:[cm]?js|jsx|tsx?)$/.test(joined)) {
    if (/\.(?:[cm]?js|jsx)$/.test(joined)) {
      const stem = joined.replace(/\.(?:[cm]?js|jsx)$/, "");
      candidates.push(stem + ".ts", stem + ".tsx");
    }
    candidates.push(joined);
  } else {
    candidates.push(
      joined + ".ts",
      joined + ".tsx",
      joined + ".js",
      joined + ".jsx",
      joined + ".mjs",
      joined + ".cjs",
      joined + "/index.ts",
      joined + "/index.tsx",
      joined + "/index.js",
      joined + "/index.jsx",
    );
  }

  return candidates.find((candidate) => projectPathSet.has(candidate)) ?? null;
};

const exportNamesByFile = new Map(
  sourceProjectPaths.map((projectPath) => [projectPath, new Set()]),
);
const usedExportsByFile = new Map(
  sourceProjectPaths.map((projectPath) => [projectPath, new Set()]),
);

const addBindingNames = (name, target) => {
  if (ts.isIdentifier(name)) {
    target.add(name.text);
    return;
  }
  for (const element of name.elements ?? []) {
    if (ts.isBindingElement(element)) addBindingNames(element.name, target);
  }
};

const hasModifier = (node, kind) =>
  node.modifiers?.some((modifier) => modifier.kind === kind) === true;

const collectExports = (projectPath) => {
  if (projectPath.startsWith(generatedPrefix)) return;
  const exportedNames = exportNamesByFile.get(projectPath);
  const sourceFile = parse(projectPath);

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      exportedNames.add("default");
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) continue;
      if (ts.isNamespaceExport(statement.exportClause)) {
        exportedNames.add(statement.exportClause.name.text);
        continue;
      }
      for (const element of statement.exportClause.elements) {
        exportedNames.add(element.name.text);
      }
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      exportedNames.add("default");
      continue;
    }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      exportedNames.add(statement.name.text);
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        addBindingNames(declaration.name, exportedNames);
      }
    }
  }
};

for (const projectPath of sourceProjectPaths) collectExports(projectPath);

const markUsed = (targetPath, exportName) => {
  if (!targetPath?.startsWith("src/")) return;
  const used = usedExportsByFile.get(targetPath);
  if (used) used.add(exportName);
};

const packageNameFromSpecifier = (specifier) => {
  if (
    !specifier ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#") ||
    specifier.startsWith("node:")
  ) return null;

  if (builtinModules.includes(specifier)) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@")
    ? parts.length >= 2
      ? parts[0] + "/" + parts[1]
      : specifier
    : parts[0];
};

const referencedPackages = new Set();

const recordPackage = (specifier) => {
  const packageName = packageNameFromSpecifier(specifier);
  if (packageName) referencedPackages.add(packageName);
};

const markLocalImport = (fromProjectPath, specifier, names) => {
  const target = resolveLocalSpecifier(fromProjectPath, specifier);
  if (!target) return;
  for (const name of names) markUsed(target, name);
};

const leftmostQualifiedName = (qualifier) => {
  let current = qualifier;
  while (ts.isQualifiedName(current)) current = current.left;
  return ts.isIdentifier(current) ? current.text : null;
};

for (const projectPath of projectPathSet) {
  const sourceFile = parse(projectPath);

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      recordPackage(specifier);
      const clause = node.importClause;
      if (clause) {
        if (clause.name) markLocalImport(projectPath, specifier, ["default"]);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          markLocalImport(projectPath, specifier, ["*"]);
        } else if (bindings && ts.isNamedImports(bindings)) {
          markLocalImport(
            projectPath,
            specifier,
            bindings.elements.map((element) => (element.propertyName ?? element.name).text),
          );
        }
      }
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      recordPackage(specifier);
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) {
        markLocalImport(projectPath, specifier, ["*"]);
      } else {
        markLocalImport(
          projectPath,
          specifier,
          node.exportClause.elements.map((element) => (element.propertyName ?? element.name).text),
        );
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      recordPackage(specifier);
      markLocalImport(projectPath, specifier, ["*"]);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      recordPackage(node.arguments[0].text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      const specifier = node.argument.literal.text;
      recordPackage(specifier);
      const importedName = node.qualifier ? leftmostQualifiedName(node.qualifier) : "*";
      markLocalImport(projectPath, specifier, [importedName ?? "*"]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

for (const absolutePath of allFiles.filter((file) => file.endsWith(".css"))) {
  const content = readFileSync(absolutePath, "utf8");
  for (const match of content.matchAll(/@import\s+["']([^"']+)["']/g)) {
    recordPackage(match[1]);
  }
}

const declaredDependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};

const escapeRegExp = (value) =>
  value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");

for (const packageName of Object.keys(declaredDependencies)) {
  if (packageName.startsWith("@types/")) {
    referencedPackages.add(packageName);
    continue;
  }

  const quotedPackage = new RegExp(
    "[\"']" + escapeRegExp(packageName) + "(?:/[^\"']*)?[\"']",
  );
  if (
    codeFiles.some((absolutePath) =>
      quotedPackage.test(readFileSync(absolutePath, "utf8")),
    )
  ) {
    referencedPackages.add(packageName);
  }
}

const postcssText = readFileSync(path.join(webRoot, "postcss.config.cjs"), "utf8");
if (/\bautoprefixer\b/.test(postcssText)) referencedPackages.add("autoprefixer");

const commandPackages = new Map([
  ["eslint", "eslint"],
  ["openapi-typescript", "openapi-typescript"],
  ["playwright", "@playwright/test"],
  ["tsc", "typescript"],
  ["vite", "vite"],
  ["vitest", "vitest"],
]);

for (const script of Object.values(packageJson.scripts ?? {})) {
  const commandWords = new Set(
    String(script)
      .split(/[^@/a-zA-Z0-9._-]+/)
      .filter(Boolean),
  );
  for (const [command, packageName] of commandPackages) {
    if (commandWords.has(command)) referencedPackages.add(packageName);
  }
}

const exportExemptions = exemptions.exports ?? {};
const dependencyExemptions = exemptions.dependencies ?? {};

const unusedExports = [];
for (const [projectPath, exportedNames] of exportNamesByFile) {
  const used = usedExportsByFile.get(projectPath);
  if (used?.has("*")) continue;
  const exemptNames = new Set(Object.keys(exportExemptions[projectPath] ?? {}));
  for (const exportName of exportedNames) {
    if (!used?.has(exportName) && !exemptNames.has(exportName)) {
      unusedExports.push(projectPath + " :: " + exportName);
    }
  }
}

const declaredNames = new Set(Object.keys(declaredDependencies));
const missingDependencies = [...referencedPackages]
  .filter((packageName) => !declaredNames.has(packageName))
  .sort();

const unusedDependencies = Object.keys(declaredDependencies)
  .filter(
    (packageName) =>
      !referencedPackages.has(packageName) &&
      !Object.hasOwn(dependencyExemptions, packageName),
  )
  .sort();

const staleExportExemptions = [];
for (const [projectPath, names] of Object.entries(exportExemptions)) {
  const exportedNames = exportNamesByFile.get(projectPath) ?? new Set();
  for (const exportName of Object.keys(names)) {
    if (!exportedNames.has(exportName)) {
      staleExportExemptions.push(projectPath + " :: " + exportName);
    }
  }
}

const staleDependencyExemptions = Object.keys(dependencyExemptions)
  .filter((packageName) => !declaredNames.has(packageName))
  .sort();

const errors = [];

if (unusedExports.length > 0) {
  errors.push("Unused exports:\n" + unusedExports.map((value) => "  - " + value).join("\n"));
}
if (missingDependencies.length > 0) {
  errors.push(
    "Imported packages missing from package.json:\n" +
      missingDependencies.map((value) => "  - " + value).join("\n"),
  );
}
if (unusedDependencies.length > 0) {
  errors.push(
    "Declared packages without a detected use or explicit exemption:\n" +
      unusedDependencies.map((value) => "  - " + value).join("\n"),
  );
}
if (staleExportExemptions.length > 0) {
  errors.push(
    "Stale export exemptions:\n" +
      staleExportExemptions.map((value) => "  - " + value).join("\n"),
  );
}
if (staleDependencyExemptions.length > 0) {
  errors.push(
    "Stale dependency exemptions:\n" +
      staleDependencyExemptions.map((value) => "  - " + value).join("\n"),
  );
}

if (errors.length > 0) {
  console.error(
    "Frontend dead-code/dependency check failed.\n\n" +
      errors.join("\n\n") +
      "\n\nAdd an exemption only when the non-static use is intentional, and include a concrete reason in dead-code-exemptions.json.\n",
  );
  process.exitCode = 1;
} else {
  const exportCount = [...exportNamesByFile.values()].reduce(
    (total, names) => total + names.size,
    0,
  );
  console.log(
    "Frontend dead-code/dependency check passed: " +
      sourceProjectPaths.length +
      " source files, " +
      exportCount +
      " exports, " +
      declaredNames.size +
      " direct packages, no unused exports, missing direct dependencies, stale exemptions, or unexplained direct packages.",
  );
}
