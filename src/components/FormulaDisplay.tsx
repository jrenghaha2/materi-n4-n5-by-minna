import { useMemo } from 'react';
import { tokenizeFormula, type FormulaTokenKind } from '../utils/formulaTokenizer';

interface FormulaDisplayProps {
  formulas: string[];
  compact?: boolean;
}

const TOKEN_STYLES: Record<FormulaTokenKind, string> = {
  pos: 'px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/80 font-semibold text-xs',
  form: 'px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800/80 font-semibold text-xs',
  particle: 'font-jp font-bold text-rose-700 dark:text-rose-300',
  operator: 'text-slate-400 dark:text-slate-500 font-semibold px-0.5',
  plain: 'font-jp text-slate-800 dark:text-slate-200',
};

function FormulaLine({ formula, compact }: { formula: string; compact?: boolean }) {
  const tokens = useMemo(() => tokenizeFormula(formula), [formula]);
  return (
    <div
      className={`flex flex-wrap items-center gap-y-1 gap-x-0.5 leading-relaxed ${
        compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-[15px]'
      }`}
    >
      {tokens.map((tok, idx) => (
        <span key={idx} className={TOKEN_STYLES[tok.kind]}>
          {tok.text}
        </span>
      ))}
    </div>
  );
}

export function FormulaDisplay({ formulas, compact = false }: FormulaDisplayProps) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {formulas.map((formula, idx) => (
        <div
          key={idx}
          className={`rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/60 ${
            compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2.5'
          }`}
        >
          <FormulaLine formula={formula} compact={compact} />
        </div>
      ))}
    </div>
  );
}
