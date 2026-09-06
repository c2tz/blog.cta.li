const SECTION = /^h[23]$/;

function element(tagName, properties, children) {
  return { type: "element", tagName, properties, children };
}

function textContent(node) {
  if (node.type === "text") return node.value;
  if (node.properties?.ariaHidden === "true") return "";
  return (node.children ?? []).map(textContent).join("");
}

// Run after heading IDs and links are generated. Keeping this in the Markdown
// pipeline places the contents after the introduction and works without JS.
export default function rehypePostToc() {
  return (tree, file) => {
    if (!/[/\\]src[/\\]content[/\\]blog[/\\]/.test(file.path ?? "")) return;

    const sections = tree.children.filter(
      (node) => node.type === "element" && SECTION.test(node.tagName) && node.properties?.id,
    );
    if (sections.length < 4) return;

    const ids = new Set();
    const collectIds = (node) => {
      if (node.properties?.id) ids.add(node.properties.id);
      node.children?.forEach(collectIds);
    };
    collectIds(tree);
    let id = "sommaire";
    for (let suffix = 1; ids.has(id); suffix++) id = `sommaire-${suffix}`;

    const items = [];
    let parentSection;
    for (const section of sections) {
      const link = element("a", { href: `#${section.properties.id}` }, [
        { type: "text", value: textContent(section) },
      ]);
      const item = element("li", {}, [link]);
      if (section.tagName === "h3" && parentSection) {
        let nested = parentSection.children[1];
        if (!nested) {
          nested = element("ul", {}, []);
          parentSection.children.push(nested);
        }
        nested.children.push(item);
      } else {
        items.push(item);
        if (section.tagName === "h2") parentSection = item;
      }
    }

    const toc = element(
      "nav",
      { className: ["post-toc"], ariaLabelledBy: id, "data-pagefind-ignore": "all" },
      [
        element("h2", { id }, [
          element("a", { className: ["heading-link"], href: `#${id}` }, [
            { type: "text", value: "Sommaire" },
          ]),
        ]),
        element("ul", {}, items),
      ],
    );
    tree.children.splice(tree.children.indexOf(sections[0]), 0, toc);
  };
}
