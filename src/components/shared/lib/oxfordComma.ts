const oxfordComma = (items) => {
  return items.reduce((o, v, i) => {
    if (i == 0) {
      return v;
    }
    else if (items.length == 2) {
      return `${o} and ${v}`;
    }
    else if (i + 1 == items.length) {
      return `${o}, and ${v}`;
    }
    return `${o}, ${v}`;
  }, "");
}

const isLowerCase = (s) => {
  return s == s.toLowerCase() && s != s.toUpperCase();
}

const Los = (str) => {
  const words = str.split(/[ -]/);
  const matches = [...str.matchAll(/[ -]/g)];
  const seps = matches.map(v => v[0]);
  const n_seps = seps.length;
  // Lowercase of any Title Case Words
  return words.reduce((o, w, i) => {
    const end = i < n_seps ? seps[i] : '';
    const rest = w.slice(1);
    // Only for Title Case Words
    if (isLowerCase(rest)) {
      return o + w[0].toLowerCase() + rest + end;
    }
    // For acronyms etc
    return o + w + end;
  }, "");
}

const Hi = (str) => {
  return [...Los(str)].map((c, i) => {
    return i == 0 ? c.toUpperCase() : c;
  }).join("");
}

const oxfordIds = (ids) => {
  const out = Hi(oxfordComma(ids.map(id => {
    return `the ${id.Type} is "${id.ID}"`;
  })));
  return ` ${out}.`;
}

export {
  oxfordComma, oxfordIds, Hi, Los
}
