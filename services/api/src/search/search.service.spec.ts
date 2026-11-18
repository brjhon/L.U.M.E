import { searchTerms } from './search.service';

describe('searchTerms', () => {
  it('quebra em palavras e ignora espaços extras', () => {
    expect(searchTerms('  entrega   farmácia ')).toEqual(['entrega', 'farmácia']);
  });

  it('escapa curingas do LIKE', () => {
    expect(searchTerms('50% a_b \\')).toEqual(['50\\%', 'a\\_b', '\\\\']);
  });

  it('limita a 8 palavras e aceita vazio', () => {
    expect(searchTerms('a b c d e f g h i j')).toHaveLength(8);
    expect(searchTerms(undefined)).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
  });
});
