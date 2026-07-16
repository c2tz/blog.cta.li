import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const DEFAULT_POSTS_DIRECTORY = resolve(process.cwd(), "src/content/blog");

function escapeYamlDoubleQuotedString(value) {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n");
}

export function slugifyPostTitle(title) {
  return title
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createPostContent(title, { description, listed = false } = {}) {
  const normalizedTitle = title.trim();
  const normalizedDescription = description?.trim();
  if (!normalizedTitle) {
    throw new Error("Le titre doit contenir au moins une lettre ou un chiffre.");
  }
  if (listed && !normalizedDescription) {
    throw new Error("Un article publié doit avoir une description non vide.");
  }

  const descriptionFrontmatter = normalizedDescription
    ? `description: "${escapeYamlDoubleQuotedString(normalizedDescription)}"\n`
    : "";

  return `---
title: "${escapeYamlDoubleQuotedString(normalizedTitle)}"
${descriptionFrontmatter}tags: []
listed: ${listed}
---

Écrivez votre article ici.
`;
}

export async function createPost({
  title,
  postsDirectory = DEFAULT_POSTS_DIRECTORY,
  description,
  listed = false,
}) {
  const normalizedTitle = title.trim();
  const slug = slugifyPostTitle(normalizedTitle);
  if (!slug) {
    throw new Error("Le titre doit contenir au moins une lettre ou un chiffre.");
  }

  const filePath = join(postsDirectory, `${slug}.md`);
  await mkdir(postsDirectory, { recursive: true });

  try {
    await writeFile(filePath, createPostContent(normalizedTitle, { description, listed }), {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Un article existe déjà : ${filePath}`, { cause: error });
    }
    throw error;
  }

  return filePath;
}

function printUsage() {
  console.log('Usage : pnpm new:post "Titre de l’article" [--description "Résumé"] [--publish]');
}

export function parsePostArguments(args) {
  const titleParts = [];
  let description;
  let listed = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--publish") {
      listed = true;
      continue;
    }
    if (argument === "--description") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--description attend un résumé non vide.");
      }
      description = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }
    titleParts.push(argument);
  }

  if (titleParts.length !== 1) {
    throw new Error("Indiquez un titre unique pour le nouvel article.");
  }

  return { description, listed, title: titleParts[0] };
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  let postOptions;
  try {
    postOptions = parsePostArguments(args);
  } catch (error) {
    printUsage();
    throw error;
  }

  const filePath = await createPost(postOptions);
  console.log(`Article créé : ${filePath}`);
  if (!postOptions.listed) {
    console.log("Il est non listé par défaut ; ajoutez --publish ou passez listed à true.");
  }
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
