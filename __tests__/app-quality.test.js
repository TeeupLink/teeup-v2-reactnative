const fs = require('fs');
const path = require('path');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const { __setMockParams } = require('expo-router');

const { tokens } = require('../src/styles/style');

const projectRoot = path.join(__dirname, '..');
const appDir = path.join(projectRoot, 'app');
const scanRoots = [appDir, path.join(projectRoot, 'src')];
const validExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const moduleCache = new Map();
const exportCache = new Map();

// ===== Text utilities =====
// Strip comments (and optionally strings) to avoid false-positive matches.
const stripComments = (input, { stripStrings }) => {
  let output = '';
  let state = 'normal';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (state === 'normal') {
      if (ch === '/' && next === '/') {
        state = 'line';
        output += '  ';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        output += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'single';
        output += stripStrings ? ' ' : ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        state = 'double';
        output += stripStrings ? ' ' : ch;
        i += 1;
        continue;
      }
      if (ch === '`') {
        state = 'template';
        output += stripStrings ? ' ' : ch;
        i += 1;
        continue;
      }
      output += ch;
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (ch === '\n') {
        state = 'normal';
        output += '\n';
      } else {
        output += ' ';
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'normal';
        output += '  ';
        i += 2;
      } else {
        output += ch === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    const isSingle = state === 'single';
    const isDouble = state === 'double';
    const isTemplate = state === 'template';

    if (isSingle || isDouble || isTemplate) {
      if (ch === '\\') {
        if (stripStrings) {
          output += '  ';
        } else {
          output += ch;
          if (next) output += next;
        }
        i += 2;
        continue;
      }

      if ((isSingle && ch === "'") || (isDouble && ch === '"') || (isTemplate && ch === '`')) {
        state = 'normal';
        output += stripStrings ? ' ' : ch;
        i += 1;
        continue;
      }

      output += stripStrings ? (ch === '\n' ? '\n' : ' ') : ch;
      i += 1;
      continue;
    }
  }

  return output;
};

// Throw a summary-only error to keep test output compact.
const throwSummary = (title, errors) => {
  if (!errors.length) return;
  const message = `${title}\n${errors.join('\n')}`;
  const error = new Error(message);
  error.stack = message;
  throw error;
};

// ===== File system helpers =====
// Recursively collect files under a directory.
const collectFiles = (dir, { extensions } = {}) => {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.reduce((files, entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return files.concat(collectFiles(fullPath, { extensions }));
    }
    if (entry.isFile()) {
      if (!extensions || extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
    return files;
  }, []);
};

// ===== Import parsing =====
// Parse default/named/namespace imports from a specifier string.
const parseImportSpecifiers = (spec) => {
  const result = { defaultImport: null, namedImports: [], namespaceImport: null, typeOnly: false };
  const trimmed = spec.trim();
  if (!trimmed) return result;
  if (trimmed.startsWith('type ')) {
    result.typeOnly = true;
    return result;
  }

  const namespaceMatch = trimmed.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);
  if (namespaceMatch) {
    result.namespaceImport = namespaceMatch[1];
  }

  const namedMatch = trimmed.match(/{([\s\S]*?)}/);
  if (namedMatch) {
    const namedList = namedMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    namedList.forEach((part) => {
      if (part.startsWith('type ')) return;
      const cleaned = part.replace(/^type\s+/, '');
      const [imported, local] = cleaned.split(/\s+as\s+/).map((item) => item.trim());
      if (imported) {
        result.namedImports.push({ imported, local: local || imported });
      }
    });
  }

  const [defaultPart] = trimmed.split(',');
  if (defaultPart && !defaultPart.trim().startsWith('{') && !defaultPart.trim().startsWith('*')) {
    const defaultImport = defaultPart.trim();
    if (defaultImport) {
      result.defaultImport = defaultImport.replace(/^type\s+/, '');
    }
  }

  return result;
};

// Match static import statements.
const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

// Resolve local module paths for relative or alias imports.
const resolveModulePath = (fromFile, source) => {
  let basePath;
  if (source.startsWith('@/')) {
    basePath = path.join(projectRoot, 'src', source.slice(2));
  } else if (source.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), source);
  } else {
    return { modulePath: null, isLocal: false };
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return { modulePath: basePath, isLocal: true };
  }

  for (const ext of validExtensions) {
    const candidate = `${basePath}${ext}`;
    if (fs.existsSync(candidate)) return { modulePath: candidate, isLocal: true };
  }

  // Metro 는 .native/.web 접미사를 자동으로 골라 준다.
  // homeBannerSlides.native.js 처럼 플랫폼별 파일만 있는 모듈이 있다.
  for (const platform of ['.native', '.web', '.ios', '.android']) {
    for (const ext of validExtensions) {
      const candidate = `${basePath}${platform}${ext}`;
      if (fs.existsSync(candidate)) return { modulePath: candidate, isLocal: true };
    }
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of validExtensions) {
      const candidate = path.join(basePath, `index${ext}`);
      if (fs.existsSync(candidate)) return { modulePath: candidate, isLocal: true };
    }
  }

  return { modulePath: null, isLocal: true };
};

// Require a module with caching and error capture.
const loadModule = (modulePath, errors, context) => {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }
  try {
    const mod = require(modulePath);
    moduleCache.set(modulePath, mod);
    return mod;
  } catch (error) {
    errors.push(`${context}: failed to load ${modulePath} (${error.message})`);
    moduleCache.set(modulePath, null);
    return null;
  }
};

// ===== Export parsing =====
// Parse export specifiers (including aliases).
const parseExportSpecifiers = (list) => {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^type\s+/, '');
      const [imported, local] = cleaned.split(/\s+as\s+/).map((item) => item.trim());
      return { imported, local: local || imported };
    })
    .filter((item) => item.imported);
};

// Collect named/default exports without executing the module.
const getExportInfo = (filePath, stack = new Set()) => {
  if (exportCache.has(filePath)) {
    return exportCache.get(filePath);
  }

  if (stack.has(filePath)) {
    const circular = { hasDefault: false, named: new Set() };
    exportCache.set(filePath, circular);
    return circular;
  }

  stack.add(filePath);
  const info = { hasDefault: false, named: new Set() };
  const raw = fs.readFileSync(filePath, 'utf8');
  const content = stripComments(raw, { stripStrings: false });

  if (/export\s+default\b/.test(content)) {
    info.hasDefault = true;
  }

  // export async function / export function* 도 잡는다.
  const declRegex = /export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g;
  for (const match of content.matchAll(declRegex)) {
    info.named.add(match[1]);
  }

  const exportListRegex = /export\s*{\s*([^}]+)\s*}(?:\s*from\s*['"]([^'"]+)['"])?/g;
  for (const match of content.matchAll(exportListRegex)) {
    const list = match[1];
    const source = match[2];
    const specifiers = parseExportSpecifiers(list);

    if (source) {
      const { modulePath, isLocal } = resolveModulePath(filePath, source);
      let sourceInfo = null;
      if (isLocal && modulePath) {
        sourceInfo = getExportInfo(modulePath, stack);
      }
      specifiers.forEach(({ imported, local }) => {
        if (imported === 'default') {
          if (local === 'default') {
            info.hasDefault = true;
          }
          info.named.add(local);
          return;
        }
        info.named.add(local);
        if (sourceInfo && !sourceInfo.named.has(imported) && !(imported === 'default' && sourceInfo.hasDefault)) {
          info.named.delete(local);
        }
      });
    } else {
      specifiers.forEach(({ imported, local }) => {
        if (imported === 'default') {
          if (local === 'default') {
            info.hasDefault = true;
          }
          info.named.add(local);
          return;
        }
        info.named.add(local);
      });
    }
  }

  exportCache.set(filePath, info);
  return info;
};

// ===== API reference helpers =====
// Build a map of *Api exports -> method names.
const buildApiMap = () => {
  const libDir = path.join(projectRoot, 'src', 'lib');
  if (!fs.existsSync(libDir)) return new Map();
  const entries = fs.readdirSync(libDir);
  const apiMap = new Map();

  entries.forEach((entry) => {
    if (!entry.endsWith('.js')) return;
    const modulePath = path.join(libDir, entry);
    const mod = loadModule(modulePath, [], modulePath);
    if (!mod) return;
    Object.entries(mod).forEach(([exportName, value]) => {
      if (!exportName.endsWith('Api')) return;
      if (!value || typeof value !== 'object') return;
      apiMap.set(exportName, new Set(Object.keys(value)));
    });
  });

  return apiMap;
};

// ===== Render-tree helpers =====
// Detect JSON nodes produced by react-test-renderer.
const isRenderNode = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.type === 'string' &&
  Object.prototype.hasOwnProperty.call(value, 'props');

// Provide a readable label for render nodes.
const getNodeLabel = (node) => {
  if (!isRenderNode(node)) return 'node';
  const typeName = node.type;
  const props = node.props || {};
  const id = props.testID || props.accessibilityLabel || props.accessibilityHint;
  if (typeof id === 'string' && id.trim()) {
    return `${typeName}#${id}`;
  }
  return typeName;
};

// Build a stable path string for error reporting.
const joinPath = (base, segment) => (base ? `${base}/${segment}` : segment);

// Collect undefined values in render output (props/children).
const collectUndefinedValues = (value, pathLabel, errors, seen) => {
  if (value === undefined) {
    errors.push(pathLabel);
    return;
  }
  if (value === null) return;
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return;
  if (valueType === 'function') return;
  if (valueType !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item === undefined) return;
      const segment = isRenderNode(item) ? `${getNodeLabel(item)}[${index}]` : `[${index}]`;
      collectUndefinedValues(item, joinPath(pathLabel, segment), errors, seen);
    });
    return;
  }

  if (isRenderNode(value)) {
    const nodePath = joinPath(pathLabel, getNodeLabel(value));
    const props = value.props || {};
    Object.entries(props).forEach(([key, item]) => {
      const nextPath = `${nodePath}.props.${key}`;
      if (item === undefined) {
        errors.push(nextPath);
        return;
      }
      collectUndefinedValues(item, nextPath, errors, seen);
    });

    if (Array.isArray(value.children)) {
      value.children.forEach((child, index) => {
        if (child === undefined) return;
        const segment = isRenderNode(child) ? `${getNodeLabel(child)}[${index}]` : `[${index}]`;
        collectUndefinedValues(child, `${nodePath}.children/${segment}`, errors, seen);
      });
    } else if (value.children !== undefined) {
      collectUndefinedValues(value.children, `${nodePath}.children`, errors, seen);
    }
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    const nextPath = pathLabel ? `${pathLabel}.${key}` : key;
    if (item === undefined) {
      errors.push(nextPath);
      return;
    }
    collectUndefinedValues(item, nextPath, errors, seen);
  });
};

// ===== Screen discovery helpers =====
// Only treat non-layout files as screens.
const isScreenFile = (filePath) => {
  const ext = path.extname(filePath);
  if (!validExtensions.has(ext)) return false;
  const base = path.basename(filePath);
  if (base.startsWith('_layout.')) return false;
  return true;
};

// Extract default params for dynamic routes.
const extractParams = (relativePath) => {
  const matches = relativePath.match(/\[([^\]]+)\]/g) || [];
  return matches.reduce((params, match) => {
    const key = match.slice(1, -1);
    if (!key) return params;
    if (key.startsWith('...')) {
      params[key.slice(3)] = '1';
      return params;
    }
    params[key] = '1';
    return params;
  }, {});
};

// ===== Dynamic access helpers =====
// Match literal bracket access like obj['key'] or obj["key"].
const bracketAccessRegex =
  /\b([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*)\s*(?:\?\.)?\[\s*(?:'([^']*)'|"([^"]*)"|`([^`]*?)`|(\d+))\s*\]/g;

// Resolve a dotted path from imported bindings.
const resolveValueForPath = (pathSegments, importMap) => {
  const rootName = pathSegments[0];
  if (!importMap.has(rootName)) return { resolved: false };
  let value = importMap.get(rootName);
  for (const segment of pathSegments.slice(1)) {
    if (value && (typeof value === 'object' || typeof value === 'function') && segment in value) {
      value = value[segment];
    } else {
      return { resolved: false, missing: segment };
    }
  }
  return { resolved: true, value };
};

// Screen render smoke tests with param defaults and undefined checks.
describe('render all screens', () => {
  const screenFiles = collectFiles(appDir).filter(isScreenFile);

  if (!screenFiles.length) {
    throw new Error('No screen files found in app/.');
  }

  screenFiles.forEach((filePath) => {
    const relativePath = path.relative(appDir, filePath);
    it(`renders ${relativePath}`, () => {
      __setMockParams(extractParams(relativePath));

      const mod = require(filePath);
      const Component = mod?.default || mod;
      if (!Component) {
        throw new Error(`No default export found in ${relativePath}`);
      }

      const tree = TestRenderer.create(React.createElement(Component));
      const output = tree.toJSON();
      if (output) {
        const undefinedErrors = [];
        collectUndefinedValues(output, 'root', undefinedErrors, new WeakSet());
        if (undefinedErrors.length) {
          throw new Error(
            `Undefined values found in ${relativePath}:\n${undefinedErrors.join('\n')}`,
          );
        }
      }
      tree.unmount();
    });
  });
});

// Theme token key usage must match tokens map.
describe('theme token keys', () => {
  it('references existing tokens keys', () => {
    const errors = [];
    const tokenUsageRegex = /\btokens\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g;

    scanRoots.forEach((rootDir) => {
      const files = collectFiles(rootDir, { extensions: validExtensions });
      files.forEach((filePath) => {
        const content = stripComments(fs.readFileSync(filePath, 'utf8'), { stripStrings: true });
        const relativePath = path.relative(projectRoot, filePath);

        for (const match of content.matchAll(tokenUsageRegex)) {
          const group = match[1];
          const key = match[2];

          if (!(group in tokens)) {
            errors.push(`${relativePath}: tokens.${group}.${key}`);
            continue;
          }

          const section = tokens[group];
          if (!section || typeof section !== 'object') {
            errors.push(`${relativePath}: tokens.${group}.${key}`);
            continue;
          }

          if (!(key in section)) {
            errors.push(`${relativePath}: tokens.${group}.${key}`);
          }
        }
      });
    });

    if (errors.length) {
      throwSummary('Invalid token keys found:', errors);
    }
  });
});

// Import/export and API reference checks to catch typos.
describe('reference checks', () => {
  it('uses only existing api methods', () => {
    const apiMap = buildApiMap();
    const errors = [];
    const apiCallRegex = /\b([A-Za-z0-9_$]*Api)\.([A-Za-z0-9_$]+)/g;

    scanRoots.forEach((rootDir) => {
      const files = collectFiles(rootDir, { extensions: validExtensions });
      files.forEach((filePath) => {
        const content = stripComments(fs.readFileSync(filePath, 'utf8'), { stripStrings: true });
        const relativePath = path.relative(projectRoot, filePath);

        for (const match of content.matchAll(apiCallRegex)) {
          const apiName = match[1];
          const methodName = match[2];
          const methods = apiMap.get(apiName);
          if (!methods) return;
          if (!methods.has(methodName)) {
            errors.push(`${relativePath}: ${apiName}.${methodName}`);
          }
        }
      });
    });

    if (errors.length) {
      throwSummary('Invalid api method references:', errors);
    }
  });

  it('imports existing exports from local modules', () => {
    const errors = [];
    const files = scanRoots.flatMap((rootDir) => collectFiles(rootDir, { extensions: validExtensions }));

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(projectRoot, filePath);

      for (const match of content.matchAll(importRegex)) {
        const spec = match[1];
        const source = match[2];
        const { defaultImport, namedImports, namespaceImport, typeOnly } = parseImportSpecifiers(spec);
        if (typeOnly) continue;
        const { modulePath, isLocal } = resolveModulePath(filePath, source);
        if (!isLocal) continue;
        if (!modulePath) {
          errors.push(`${relativePath}: unresolved import ${source}`);
          continue;
        }

        const info = getExportInfo(modulePath);

        if (defaultImport) {
          if (!info.hasDefault) {
            errors.push(`${relativePath}: default ${defaultImport} from ${source}`);
          }
        }

        if (namespaceImport) {
          continue;
        }

        namedImports.forEach(({ imported, local }) => {
          if (imported === 'default') {
            if (!info.hasDefault) {
              errors.push(`${relativePath}: { default as ${local} } from ${source}`);
            }
            return;
          }
          if (!info.named.has(imported)) {
            errors.push(`${relativePath}: { ${imported} } from ${source}`);
          }
        });
      }
    });

    if (errors.length) {
      throwSummary('Invalid imports:', errors);
    }
  });

  it('uses existing keys for literal bracket access', () => {
    const errors = [];
    const files = scanRoots.flatMap((rootDir) => collectFiles(rootDir, { extensions: validExtensions }));

    files.forEach((filePath) => {
      const content = stripComments(fs.readFileSync(filePath, 'utf8'), { stripStrings: false });
      const relativePath = path.relative(projectRoot, filePath);
      const importMap = new Map();

      for (const match of content.matchAll(importRegex)) {
        const spec = match[1];
        const source = match[2];
        const { defaultImport, namedImports, namespaceImport, typeOnly } = parseImportSpecifiers(spec);
        if (typeOnly) continue;
        const { modulePath, isLocal } = resolveModulePath(filePath, source);
        if (!isLocal || !modulePath) continue;

        const mod = loadModule(modulePath, errors, `${relativePath}: import ${source}`);
        if (!mod) continue;

        if (defaultImport) {
          const defaultExport = mod?.default ?? mod;
          importMap.set(defaultImport, defaultExport);
        }
        if (namespaceImport) {
          importMap.set(namespaceImport, mod);
        }
        namedImports.forEach(({ imported, local }) => {
          if (imported === 'default') {
            importMap.set(local, mod?.default ?? mod);
            return;
          }
          importMap.set(local, mod[imported]);
        });
      }

      for (const match of content.matchAll(bracketAccessRegex)) {
        const basePath = match[1];
        const key = match[2] ?? match[3] ?? match[4] ?? match[5];

        if (match[4] && match[4].includes('${')) continue;
        if (key === undefined) continue;

        const pathSegments = basePath.split('.');
        const resolved = resolveValueForPath(pathSegments, importMap);
        if (!resolved.resolved) continue;

        const target = resolved.value;
        if (!target || typeof target !== 'object') {
          errors.push(`${relativePath}: ${basePath}[${JSON.stringify(key)}]`);
          continue;
        }
        if (Array.isArray(target)) continue;
        if (!(String(key) in target)) {
          errors.push(`${relativePath}: ${basePath}[${JSON.stringify(key)}]`);
        }
      }
    });

    if (errors.length) {
      throwSummary('Invalid dynamic accesses:', errors);
    }
  });
});
