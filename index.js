const fs = require("fs");

module.exports = transform;

/**
 * This is the entry point for this jscodeshift transform.
 */
function transform(file, api, options) {
  let source = file.source;
  let j = api.jscodeshift;

  let root = j(source);

  let modules = findExistingModules(root);
  modules.modules.forEach((mod) => {
    const isUsed = findUsageOfImport(root, mod.local);
    if (!isUsed) {
      if (mod.imported === 'default') {
        removeImportByLocal(root, mod.source)
      }
    }
  });

  return root.toSource();

  function findExistingModules(root) {
    let registry = new ModuleRegistry();

    root
      .find(j.ImportDeclaration)
      .forEach(({ node }) => {
        let source = node.source.value;

        node.specifiers.forEach(spec => {
          let isDefault = j.ImportDefaultSpecifier.check(spec);

          // Some cases like `import * as bar from "foo"` have neither a
          // default nor a named export, which we don't currently handle.
          let imported = isDefault ? "default" :
            (spec.imported ? spec.imported.name : null);

          if (!imported) { return; }

          if (!registry.find(source, imported)) {
            let mod = registry.create(source, imported, spec.local.name);
            mod.node = node;
          }
        });
      });

    return registry;
  }

  /*
   * find if identifier is used mor than once
   */
  function findUsageOfImport(root, local) {
    return root.find(j.Identifier, {
      name: local
    }).size() > 1;
  }

  // function isNotEmberGlobal(local) {
  //   return function(path) {
  //     let localEmber = !path.scope.isGlobal;
  //     return localEmber;
  //   };
  // }

  function removeImportByLocal(root, source) {
    return root.find(j.ImportDeclaration, {
      specifiers: [{
        type: "ImportDefaultSpecifier",
      }],
      source: {
        value: source
      }
    })
    .remove();
  }
}

class ModuleRegistry {
  constructor() {
    this.bySource = {};
    this.modules = [];
  }

  findModule(mod) {
    return this.find(mod.source, mod.imported);
  }

  find(source, imported) {
    let byImported = this.bySource[source];

    if (!byImported) {
      byImported = this.bySource[source] = {};
    }

    return byImported[imported] || null;
  }

  create(source, imported, local) {
    if (this.find(source, imported)) {
      throw new Error(`Module { ${source}, ${imported} } already exists.`);
    }

    let byImported = this.bySource[source];
    if (!byImported) {
      byImported = this.bySource[source] = {};
    }

    let mod = new Module(source, imported, local);
    byImported[imported] = mod;
    this.modules.push(mod);

    return mod;
  }

  get(source, imported, local) {
    let mod = this.find(source, imported, local);
    if (!mod) {
      mod = this.create(source, imported, local);
    }

    return mod;
  }

  hasSource(source) {
    return source in this.bySource;
  }
}

class Module {
  constructor(source, imported, local) {
    this.source = source; // 'my-app/components/...'
    this.imported = imported; // 'default' or object destructuring
    this.local = local; // name of variable in scope of module
    this.node = null;
  }
}
