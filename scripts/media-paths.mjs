// Keep CMS media URLs portable between a project URL and a custom domain.
export function mediaPaths({ base = '/' } = {}) {
  const basePath = base.replace(/^\/+|\/+$/g, '');
  const prefix = basePath ? `/${basePath}` : '';
  const mediaUrl = (value) => {
    // CMS stores portable /uploads URLs. Leave external and already-based URLs alone.
    if (typeof value !== 'string' || !/^\/(?:assets|uploads)\//.test(value)) return value;
    return `${prefix}/${value.replace(/^\//, '')}`;
  };
  return (tree) => {
    function visit(node) {
      // Figures/captions entered as HTML remain raw nodes in the Markdown AST.
      if (node.type === 'raw') {
        node.value = node.value.replace(/<(?:img|a)\b[^>]*>/gi, (tag) => tag.replace(/(\b(?:src|href)\s*=\s*["'])([^"']*)(["'])/gi, (_, start, path, end) => start + mediaUrl(path) + end));
      }
      if (node.type === 'element') {
        for (const key of ['src', 'href']) {
          const value = node.properties?.[key];
          if (typeof value === 'string') node.properties[key] = mediaUrl(value);
        }
        if (node.tagName === 'img') { node.properties.loading = 'lazy'; node.properties.decoding = 'async'; }
        if (node.tagName === 'pre') {
          node.properties.tabIndex = 0;
          node.properties.role = 'region';
          node.properties.ariaLabel = 'Blok koda';
        }
        if (node.tagName === 'table') {
          node.properties.tabIndex = 0;
          node.properties.ariaLabel = 'Tabela u tekstu';
        }
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
