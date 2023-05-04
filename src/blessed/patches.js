import './element.js';
import './list.js';
import './listbar.js';
import './listtable.js';
import './node.js';
import './screen.js';
import './table.js';
import './textarea.js';

import blessed from 'blessed';

blessed.with = function (...fns) {
  return new Proxy(blessed, {
    get: function (target, method) {
      return function (...args) {
        const el = Reflect.apply(target[method], target, args);
        return fns.reduce((e, fn) => fn.call(null, e) || e, el);
      };
    },
  });
};

blessed.element.prototype.with = function (...fns) {
  return fns.reduce((e, fn) => fn.call(null, e) || e, this);
};

blessed.element