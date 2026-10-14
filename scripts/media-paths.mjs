// Keep CMS media URLs portable between a project URL and a custom domain.
export function mediaPaths({ base }) {
  const prefix = base.replace(/\/$/, '');
  return (tree) => {
    function visit(node) {
      // Figures/captions entered as HTML remain raw nodes in the Markdown AST.
      if (node.type === 'raw') {
        node.value = node.value.replace(/(\b(?:src|href)\s*=\s*["'])(\/(?:assets|uploads)\/[^"']*)(["'])/g, (_, start, path, end) => start + prefix + path + end);
      }
      if (node.type === 'element') {
        for (const key of ['src', 'href']) {
          const value = node.properties?.[key];
          if (typeof value === 'string' && /^\/(assets|uploads)\//.test(value)) node.properties[key] = prefix + value;
        }
        if (node.tagName === 'img') { node.properties.loading = 'lazy'; node.properties.decoding = 'async'; }
      }
      if (node.children) {
        // An original article contains a bare "##". Preserve its source while
        // omitting the empty heading from the accessible document structure.
        node.children = node.children.filter((child) => !(child.type === 'element' && /^h[1-6]$/.test(child.tagName) && child.children?.every((part) => part.type === 'text' && !part.value.trim())));
        node.children.forEach(visit);
      }
    }
    visit(tree);
  };
}
