import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const DEFAULT_POSTS_DIRECTORY = resolve(process.cwd(), "src/content/blog");

function escapeYamlDoubleQuotedString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
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

export function createPostContent(title, { listed = false } = {}) {
  return `---
title: "${escapeYamlDoubleQuotedString(title)}"
description: ""
tags: []
listed: ${listed}
---

# ${title}

Écrivez votre article ici.
`;
}

export async function createPost({
  title,
  postsDirectory = DEFAULT_POSTS_DIRECTORY,
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
    await writeFile(filePath, createPostContent(normalizedTitle, { listed }), {
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
  console.log('Usage : pnpm new:post "Titre de l’article" [--publish]');
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const listed = args.includes("--publish");
  const titleParts = args.filter((argument) => argument !== "--publish");
  if (titleParts.length !== 1) {
    printUsage();
    throw new Error("Indiquez un titre unique pour le nouvel article.");
  }

  const filePath = await createPost({ listed, title: titleParts[0] });
  console.log(`Article créé : ${filePath}`);
  if (!listed) {
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
