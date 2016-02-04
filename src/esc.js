export default function esc(identifier, quote) {
  if (identifier == null || identifier.length === 0) {
    return '';
  }

  quote = quote || '"';

  if (typeof identifier !== 'string') {
    return identifier;
  }

  identifier = identifier.toString();

  const escaped = identifier.replace(new RegExp(quote, 'g'), quote + quote);

  return quote + escaped + quote;
}
