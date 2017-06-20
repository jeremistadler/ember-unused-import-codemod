const fs = require("fs");

module.exports = transform;

/**
 * This is the entry point for this jscodeshift transform.
 */
function transform(file, api, options) {
  let source = file.source;
  let j = api.jscodeshift;

  let root = j(source);

  let fileContainsEmber = findUsageOfEmberGlobal(root);

  // if Ember.* is not used in the file, remove it
  if (fileContainsEmber) {
    return;
  } else {
    // TODO: make command line arg
    let modules = removeUnusedModules(root);
  }

  return root.toSource();

  function removeUnusedModules(root) {
    root
      .find(j.ImportDeclaration)
      .filter(({ node }) => {
        let source = node.source.value;

        let bool = false;
        node.specifiers.forEach(spec => {
          let isDefault = j.ImportDefaultSpecifier.check(spec);

          // Some cases like `import * as bar from "foo"` have neither a
          // default nor a named export, which we don't currently handle.
          let imported = isDefault ? "default" :
            (spec.imported ? spec.imported.name : null);

          if (!imported) { return; }

          if (source === 'ember') {
            bool = true;
          }
        });

        return bool;
      })
      .remove();
  }

  /*
   * Finds all uses of a property looked up on the Ember global (i.e.,
   * `Ember.something`). Makes sure that it is actually the Ember global
   * and not another variable that happens to be called `Ember`.
   */
  function findUsageOfEmberGlobal(root) {
    const isMember = root.find(j.MemberExpression, {
        object: {
          name: "Ember"
        }
      }).size() > 0;
    const isVariable = root.find(j.VariableDeclaration, {
      declarations: [{
        type: "VariableDeclarator",
        init: {
          type: "Identifier",
          name: "Ember"
        }
      }]
    }).size() > 0;
    return isMember || isVariable;
  }

}
