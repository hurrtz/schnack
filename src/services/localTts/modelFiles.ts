import {
  copyFile,
  exists as pathExists,
  readDir,
  unlink as unlinkPath,
} from "@dr.pogodin/react-native-fs";
import {
  getLocalModelPathByCategory,
  ModelCategory,
} from "react-native-sherpa-onnx/download";
import { KOKORO_MULTILINGUAL_MODEL_ID } from "./constants";

async function directoryContainsFiles(path: string, files: string[]) {
  if (!(await pathExists(path))) {
    return false;
  }

  const entries = await readDir(path);
  const names = new Set(entries.map((entry) => entry.name));
  return files.every((file) => names.has(file));
}

async function findNestedDirectory(
  path: string,
  predicate: (candidate: string) => Promise<boolean>,
  depth = 0,
): Promise<string | null> {
  if (await predicate(path)) {
    return path;
  }

  if (depth >= 3 || !(await pathExists(path))) {
    return null;
  }

  const entries = await readDir(path);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const nested = await findNestedDirectory(entry.path, predicate, depth + 1);

    if (nested) {
      return nested;
    }
  }

  return null;
}

async function findModelFile(candidate: string) {
  if (!(await pathExists(candidate))) {
    return null;
  }

  const entries = await readDir(candidate);
  const match = entries.find(
    (entry) =>
      !entry.isDirectory() &&
      entry.name.endsWith(".onnx") &&
      !entry.name.endsWith(".onnx.json"),
  );

  return match?.path ?? null;
}

export async function resolveSherpaVitsModelFiles(modelRootPath: string) {
  const resolvedRoot = await findNestedDirectory(
    modelRootPath,
    (candidate) =>
      directoryContainsFiles(candidate, ["tokens.txt", "espeak-ng-data"]),
  );

  if (!resolvedRoot) {
    throw new Error("The local voice pack files could not be resolved.");
  }

  const modelPath = await findModelFile(resolvedRoot);
  if (!modelPath) {
    throw new Error("The local voice model file is missing.");
  }

  const tokensPath = `${resolvedRoot}/tokens.txt`;
  const dataDirPath = `${resolvedRoot}/espeak-ng-data`;
  const lexiconPath = (await pathExists(`${resolvedRoot}/lexicon.txt`))
    ? `${resolvedRoot}/lexicon.txt`
    : undefined;

  return {
    modelPath,
    tokensPath,
    dataDirPath,
    lexiconPath,
  };
}

export async function resolveKokoroModelFiles(rootPath: string) {
  const modelPath = await findModelFile(rootPath);

  if (!modelPath) {
    throw new Error("The Kokoro local model file is missing.");
  }

  const tokensPath = `${rootPath}/tokens.txt`;
  const dataDirPath = `${rootPath}/espeak-ng-data`;
  const voicesPath = `${rootPath}/voices.bin`;
  const lexiconPaths = [
    `${rootPath}/lexicon-us-en.txt`,
    `${rootPath}/lexicon-zh.txt`,
    `${rootPath}/lexicon.txt`,
  ];

  return {
    modelPath,
    tokensPath,
    dataDirPath,
    voicesPath,
    lexiconPaths,
  };
}

export async function getInstalledKokoroMultilingualModelRootPath() {
  const basePath = await getLocalModelPathByCategory(
    ModelCategory.Tts,
    KOKORO_MULTILINGUAL_MODEL_ID,
  );

  if (!basePath) {
    return null;
  }

  return findNestedDirectory(basePath, async (candidate) => {
    const hasRequiredFiles = await directoryContainsFiles(candidate, [
      "voices.bin",
      "tokens.txt",
    ]);

    if (!hasRequiredFiles) {
      return false;
    }

    const [modelPath, hasDataDir] = await Promise.all([
      findModelFile(candidate),
      pathExists(`${candidate}/espeak-ng-data`),
    ]);

    return !!modelPath && hasDataDir;
  });
}

export async function ensureKokoroMultilingualModelRootPath(
  language: "en" | "zh",
) {
  const rootPath = await getInstalledKokoroMultilingualModelRootPath();

  if (!rootPath) {
    throw new Error(
      "The Kokoro multilingual local voice pack is not installed yet.",
    );
  }

  const defaultLexiconPath = `${rootPath}/lexicon.txt`;
  const backupLexiconPath = `${rootPath}/lexicon-default.txt`;
  const englishLexiconPath = `${rootPath}/lexicon-us-en.txt`;
  const chineseLexiconPath = `${rootPath}/lexicon-zh.txt`;

  if (
    !(await pathExists(backupLexiconPath)) &&
    (await pathExists(defaultLexiconPath))
  ) {
    await copyFile(defaultLexiconPath, backupLexiconPath);
  }

  if (language === "zh") {
    if (!(await pathExists(chineseLexiconPath))) {
      throw new Error(
        "The Simplified Chinese local voice pack is missing its lexicon.",
      );
    }

    if (await pathExists(defaultLexiconPath)) {
      await unlinkPath(defaultLexiconPath);
    }

    await copyFile(chineseLexiconPath, defaultLexiconPath);
    return rootPath;
  }

  if (await pathExists(englishLexiconPath)) {
    if (await pathExists(defaultLexiconPath)) {
      await unlinkPath(defaultLexiconPath);
    }

    await copyFile(englishLexiconPath, defaultLexiconPath);
    return rootPath;
  }

  if (await pathExists(backupLexiconPath)) {
    if (await pathExists(defaultLexiconPath)) {
      await unlinkPath(defaultLexiconPath);
    }

    await copyFile(backupLexiconPath, defaultLexiconPath);
  }

  return rootPath;
}
