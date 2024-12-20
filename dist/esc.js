"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = esc;
function esc(identifier, quoteString) {
  if (identifier == null || identifier.length === 0) {
    return '';
  }
  const quote = quoteString || '"';
  if (typeof identifier !== 'string') {
    return identifier;
  }
  const ident = identifier.toString();
  const escaped = ident.replace(new RegExp(quote, 'g'), quote + quote);
  return quote + escaped + quote;
}
//# sourceMappingURL=esc.js.map