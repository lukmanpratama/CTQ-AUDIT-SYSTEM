// USP names typed or pasted in Setup CTQ (Add Model form and the models table's Edit row)

/** Names in a typed or pasted text: one per line or cell (a column copied from Excel), or the whole text */
export const splitUspNames = (text: string) =>
    text.split(/\r?\n|\t/).map(n => n.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** USP names are compared without case, like the API does */
export const sameUspName = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/** `names` plus the ones in `added` not already listed */
export const mergeUspNames = (names: string[], added: string[]) => {
    const out = [...names];
    for (const n of added) if (!out.some(x => sameUspName(x, n))) out.push(n);
    return out;
};
