import ts from 'typescript';
import fs from 'node:fs';

const directory = 'src/locales';
const source = JSON.parse(fs.readFileSync(`${directory}/source.json`, 'utf8'));
const record = node => {
  if (node && ts.isStringLiteralLike(node)) source[node.text] ??= node.text;
  else if (node && ts.isConditionalExpression(node)) {
    record(node.whenTrue);
    record(node.whenFalse);
  }
};
for (const name of fs.readdirSync('src').filter(name => /\.(?:tsx?|mjs)$/.test(name))) {
  const text = fs.readFileSync(`src/${name}`, 'utf8');
  const ast = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true,
    name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't') record(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
fs.writeFileSync(`${directory}/source.json`, JSON.stringify(source, null, 2) + '\n');
console.log(`${Object.keys(source).length} source messages`);
