import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));
const entrypoints = ["app/main.tsx"];

const toPosix = (value) => value.split(path.sep).join("/");

const collectSourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolutePath);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) return [];
    return [absolutePath];
  });

const sourceFiles = collectSourceFiles(srcRoot);
const absoluteByRelativePath = new Map(
  sourceFiles.map((absolutePath) => [
    toPosix(path.relative(srcRoot, absolutePath)),
    absolutePath,
  ]),
);
const relativePaths = [...absoluteByRelativePath.keys()].sort();
const sourcePathSet = new Set(relativePaths);

const resolveLocalSpecifier = (fromPath, specifier) => {
  if (!specifier.startsWith(".")) return null;

  const joined = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromPath), specifier),
  );
  const candidates = [];

  if (/\.(?:js|jsx|ts|tsx)$/.test(joined)) {
    if (/\.jsx?$/.test(joined)) {
      const stem = joined.replace(/\.jsx?$/, "");
      candidates.push(`${stem}.ts`, `${stem}.tsx`);
    }
    candidates.push(joined);
  } else {
    candidates.push(
      `${joined}.ts`,
      `${joined}.tsx`,
      `${joined}/index.ts`,
      `${joined}/index.tsx`,
    );
  }

  return candidates.find((candidate) => sourcePathSet.has(candidate)) ?? null;
};

const importDeclarationIsTypeOnly = (node) => {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;

  const bindings = clause.namedBindings;
  return (
    bindings &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
};

const exportDeclarationIsTypeOnly = (node) => {
  if (node.isTypeOnly) return true;
  const clause = node.exportClause;
  return (
    clause &&
    ts.isNamedExports(clause) &&
    clause.elements.length > 0 &&
    clause.elements.every((element) => element.isTypeOnly)
  );
};

const collectSpecifiers = (relativePath) => {
  const absolutePath = absoluteByRelativePath.get(relativePath);
  const sourceText = readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];

  const add = (moduleSpecifier, typeOnly = false) => {
    if (ts.isStringLiteralLike(moduleSpecifier)) {
      specifiers.push({ value: moduleSpecifier.text, typeOnly });
    }
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      add(node.moduleSpecifier, importDeclarationIsTypeOnly(node));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(node.moduleSpecifier, exportDeclarationIsTypeOnly(node));
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      add(node.arguments[0], false);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      add(node.argument.literal, true);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specifiers;
};

const classify = (relativePath) => {
  if (relativePath.startsWith("app/")) return { layer: "app" };
  if (relativePath.startsWith("shared/")) return { layer: "shared" };
  if (relativePath.startsWith("types/")) return { layer: "types" };
  if (relativePath.startsWith("modules/")) {
    return {
      layer: "module",
      moduleName: relativePath.split("/")[1],
    };
  }
  return { layer: "other" };
};

const allEdges = new Map(relativePaths.map((relativePath) => [relativePath, []]));
const runtimeEdges = new Map(
  relativePaths.map((relativePath) => [relativePath, []]),
);
const violations = [];

for (const fromPath of relativePaths) {
  const from = classify(fromPath);

  for (const { value: specifier, typeOnly } of collectSpecifiers(fromPath)) {
    const targetPath = resolveLocalSpecifier(fromPath, specifier);
    if (!targetPath) continue;

    allEdges.get(fromPath).push(targetPath);
    if (!typeOnly) runtimeEdges.get(fromPath).push(targetPath);

    const target = classify(targetPath);

    if (
      from.layer === "shared" &&
      (target.layer === "app" || target.layer === "module")
    ) {
      violations.push(
        `${fromPath} -> ${targetPath}: shared may not import from ${target.layer}`,
      );
      continue;
    }

    if (from.layer === "module" && target.layer === "app") {
      violations.push(
        `${fromPath} -> ${targetPath}: modules may not import from app`,
      );
      continue;
    }

    if (
      from.layer === "module" &&
      target.layer === "module" &&
      from.moduleName !== target.moduleName
    ) {
      const publicBoundary = `modules/${target.moduleName}/public.ts`;
      if (targetPath !== publicBoundary) {
        violations.push(
          `${fromPath} -> ${targetPath}: cross-module imports must use ${publicBoundary}`,
        );
      }
    }
  }
}

const reachable = new Set();
const pending = [
  ...entrypoints,
  ...relativePaths.filter((relativePath) => relativePath.endsWith(".d.ts")),
];

while (pending.length > 0) {
  const current = pending.pop();
  if (!current || reachable.has(current) || !sourcePathSet.has(current)) continue;
  reachable.add(current);
  pending.push(...allEdges.get(current));
}

const unreachable = relativePaths.filter(
  (relativePath) => !reachable.has(relativePath),
);

let index = 0;
const indexes = new Map();
const lowLinks = new Map();
const stack = [];
const onStack = new Set();
const runtimeCycles = [];

const visitStronglyConnected = (node) => {
  indexes.set(node, index);
  lowLinks.set(node, index);
  index += 1;
  stack.push(node);
  onStack.add(node);

  for (const target of runtimeEdges.get(node)) {
    if (!indexes.has(target)) {
      visitStronglyConnected(target);
      lowLinks.set(
        node,
        Math.min(lowLinks.get(node), lowLinks.get(target)),
      );
    } else if (onStack.has(target)) {
      lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(target)));
    }
  }

  if (lowLinks.get(node) !== indexes.get(node)) return;

  const component = [];
  let current;
  do {
    current = stack.pop();
    onStack.delete(current);
    component.push(current);
  } while (current !== node);

  if (
    component.length > 1 ||
    runtimeEdges.get(node).includes(node)
  ) {
    runtimeCycles.push(component.sort());
  }
};

for (const relativePath of relativePaths) {
  if (!indexes.has(relativePath)) visitStronglyConnected(relativePath);
}

const errors = [];

if (violations.length > 0) {
  errors.push(
    "Dependency boundary violations:\n" +
      violations.map((violation) => `  - ${violation}`).join("\n"),
  );
}

if (runtimeCycles.length > 0) {
  errors.push(
    "Runtime dependency cycles:\n" +
      runtimeCycles
        .map((cycle) => `  - ${cycle.join(" -> ")}`)
        .join("\n"),
  );
}

if (unreachable.length > 0) {
  errors.push(
    "Unreachable TypeScript source files:\n" +
      unreachable.map((relativePath) => `  - ${relativePath}`).join("\n"),
  );
}

if (errors.length > 0) {
  console.error(`Frontend architecture check failed.\n\n${errors.join("\n\n")}\n`);
  process.exitCode = 1;
} else {
  const dependencyCount = [...allEdges.values()].reduce(
    (total, dependencies) => total + dependencies.length,
    0,
  );
  console.log(
    `Frontend architecture check passed: ${relativePaths.length} TypeScript files, ${dependencyCount} internal dependencies, no boundary violations, runtime cycles, or unreachable source files.`,
  );
}
