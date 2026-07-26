function allCustomElementsDefined(registry, tagNames) {
  return tagNames.every((tagName) => Boolean(registry.get(tagName)));
}

export async function loadMaterialCustomElements({ load, registry = customElements, tagNames }) {
  if (allCustomElementsDefined(registry, tagNames)) return;

  try {
    await load();
  } catch (error) {
    if (error?.name !== "NotSupportedError" || !allCustomElementsDefined(registry, tagNames)) {
      throw error;
    }
  }

  await Promise.all(tagNames.map((tagName) => registry.whenDefined(tagName)));
}
