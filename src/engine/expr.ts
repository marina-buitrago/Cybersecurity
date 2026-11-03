/**
 * Boolean expressions over questionnaire flags, as written in the catalogue:
 *   expr := and ('||' and)*      and := atom ('&&' atom)*      atom := FLAG | '(' expr ')'
 * Only flag names from a given vocabulary, `&&`, `||` and parentheses are accepted.
 * The flag `always` is always true. No `eval`: a small recursive-descent parser builds a tree.
 */

export type Expr =
  | { kind: 'var'; name: string }
  | { kind: 'and' | 'or'; left: Expr; right: Expr };

export class ExpressionError extends Error {
  constructor(message: string, readonly source: string) {
    super(`${message} in expression "${source}"`);
    this.name = 'ExpressionError';
  }
}

export const ALWAYS = 'always';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

export function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
    } else if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i += 1;
    } else if (source.startsWith('&&', i) || source.startsWith('||', i)) {
      tokens.push(source.slice(i, i + 2));
      i += 2;
    } else {
      const m = IDENT.exec(source.slice(i));
      if (!m) throw new ExpressionError(`Unexpected character "${ch}" at position ${i}`, source);
      tokens.push(m[0]);
      i += m[0].length;
    }
  }
  return tokens;
}

/** Parse an expression; throws ExpressionError on unknown tokens or bad syntax. */
export function parse(source: string, vocabulary: ReadonlySet<string>): Expr {
  const tokens = tokenize(source);
  if (tokens.length === 0) throw new ExpressionError('Empty expression', source);
  let pos = 0;

  const atom = (): Expr => {
    const t = tokens[pos];
    if (t === undefined) throw new ExpressionError('Unexpected end', source);
    pos += 1;
    if (t === '(') {
      const inner = orExpr();
      if (tokens[pos] !== ')') throw new ExpressionError('Missing ")"', source);
      pos += 1;
      return inner;
    }
    if (t === ')' || t === '&&' || t === '||') throw new ExpressionError(`Unexpected "${t}"`, source);
    if (!vocabulary.has(t)) throw new ExpressionError(`Unknown token "${t}"`, source);
    return { kind: 'var', name: t };
  };
  const andExpr = (): Expr => {
    let left = atom();
    while (tokens[pos] === '&&') {
      pos += 1;
      left = { kind: 'and', left, right: atom() };
    }
    return left;
  };
  const orExpr = (): Expr => {
    let left = andExpr();
    while (tokens[pos] === '||') {
      pos += 1;
      left = { kind: 'or', left, right: andExpr() };
    }
    return left;
  };

  const tree = orExpr();
  if (pos !== tokens.length) throw new ExpressionError(`Unexpected "${tokens[pos]}"`, source);
  return tree;
}

export function evaluate(expr: Expr, trueVars: ReadonlySet<string>): boolean {
  switch (expr.kind) {
    case 'var':
      return expr.name === ALWAYS || trueVars.has(expr.name);
    case 'and':
      return evaluate(expr.left, trueVars) && evaluate(expr.right, trueVars);
    case 'or':
      return evaluate(expr.left, trueVars) || evaluate(expr.right, trueVars);
  }
}

/** Distinct variable names used in the expression, in order of appearance. */
export function variablesOf(expr: Expr): string[] {
  const out: string[] = [];
  const walk = (e: Expr) => {
    if (e.kind === 'var') {
      if (!out.includes(e.name)) out.push(e.name);
    } else {
      walk(e.left);
      walk(e.right);
    }
  };
  walk(expr);
  return out;
}
