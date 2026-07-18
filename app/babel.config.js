/**
 * libsodium's wasm loader references `import.meta`, which Hermes can't
 * parse. Its usages are all environment-sniffing (`import.meta.url` to
 * locate the wasm file in Node/browsers) that never run under React
 * Native, so replacing the whole expression with `{}` is safe here.
 */
function replaceImportMeta({ types: t }) {
  return {
    name: 'replace-import-meta',
    visitor: {
      MetaProperty(path) {
        if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
          path.replaceWith(t.objectExpression([]));
        }
      },
    },
  };
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [replaceImportMeta],
};
