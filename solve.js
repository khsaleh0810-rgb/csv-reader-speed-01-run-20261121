// A faster drop-in for csv-reader 1.0.0, make.fun's own CSV reader.
//
// It returns the reference's answer on every input: {columns, rows, errors}.
// Where the reference walks the text one character at a time and grows each
// field a character at a time, this reader cuts whole fields out of the text
// with indexOf and slice (a field is the span between two delimiters), and
// takes a whole clean record at once with split(',') when the record holds
// no quote and no carriage return. The slow, character-wise routes stay only
// for the rare broken pieces: a stray CR inside a field, a doubled quote, a
// line break inside quotes, and a quote that never closes.
//
// The rules it follows, exactly as the reference states them:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (error stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it is one quote and each CRLF or lone CR inside it is read as LF;
//     what follows its closing quote, up to the next comma or line break, is
//     appended as it stands (quote_junk, when the field ends); a quote that
//     never closes is a literal character, and the text after it is read again
//     as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it, each padded with "" (short_row, with fields: its count)
//     or cut (long_row, with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met: line the 1-based line
//     its record starts on, row its record's index in rows, null for the header.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters the
  // unquoted read kept (the junk check needs the kept count, not the value).
  let fValue = '';
  let fEnded = COMMA;
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters from pos onto `value`, up to the next comma or
  // line break: a CR not followed by LF is dropped (stray_cr). Sets fValue,
  // fEnded and fAdded (the characters kept by this read, the starting value
  // not counted). The field is one span, cut out whole, unless a stray CR
  // sits inside it; then the CRs come out and one error is kept per CR.
  function readUnquoted(value) {
    let comma = text.indexOf(',', pos);
    let lf = text.indexOf('\n', pos);
    let end;
    let ended;
    if (comma === -1) {
      if (lf === -1) { end = n; ended = END; }
      else { end = lf; ended = LINE_BREAK; }
    } else if (lf === -1) { end = comma; ended = COMMA; }
    else if (comma < lf) { end = comma; ended = COMMA; }
    else { end = lf; ended = LINE_BREAK; }
    // A CRLF end: the field stops before the CR, the break is the LF.
    let fEnd = end;
    if (ended === LINE_BREAK && end > pos && text.charCodeAt(end - 1) === 13) fEnd = end - 1;
    const seg = text.slice(pos, fEnd);
    const cr = seg.indexOf('\r');
    if (cr === -1) {
      fValue = value === '' ? seg : value + seg;
      fAdded = fEnd - pos;
    } else {
      // One or more stray CRs: drop them, keep the rest, one error each.
      let kept = seg;
      let count = 0;
      let at = cr;
      while (at !== -1) {
        count += 1;
        at = seg.indexOf('\r', at + 1);
      }
      if (count === 1) kept = seg.slice(0, cr) + seg.slice(cr + 1);
      else kept = seg.replaceAll('\r', '');
      fValue = value === '' ? kept : value + kept;
      fAdded = fEnd - pos - count;
      for (let i = 0; i < count; i += 1) error('stray_cr');
    }
    pos = ended === END ? n : end + 1;
    if (ended === LINE_BREAK) line += 1;
    fEnded = ended;
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote: the next quote that is not doubled.
    let segStart = pos + 1;
    let acc = null;
    let q = text.indexOf('"', segStart);
    while (q !== -1 && text.charCodeAt(q + 1) === 34) {
      const seg = text.slice(segStart, q);
      acc = acc === null ? seg + '"' : acc + seg + '"';
      segStart = q + 2;
      q = text.indexOf('"', segStart);
    }
    if (q === -1) {
      // The quote never closes: it is a literal character, and the text after
      // it is read again as unquoted, with the line count put back.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      readUnquoted('"');
      return;
    }
    let value = acc === null ? text.slice(segStart, q) : acc + text.slice(segStart, q);
    // Line breaks inside the quotes: each LF, and each CR (a CRLF counts
    // once), moves the line count on, and each CR becomes an LF in the value.
    if (value.indexOf('\r') === -1) {
      let at = value.indexOf('\n');
      while (at !== -1) {
        line += 1;
        at = value.indexOf('\n', at + 1);
      }
    } else {
      let fixed = '';
      for (let i = 0; i < value.length; i += 1) {
        const c = value.charCodeAt(i);
        if (c === 13) {
          fixed += '\n';
          line += 1;
          if (value.charCodeAt(i + 1) === 10) i += 1;
        } else {
          if (c === 10) line += 1;
          fixed += value[i];
        }
      }
      value = fixed;
    }
    pos = q + 1;
    if (pos >= n) {
      fValue = value;
      fEnded = END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = COMMA;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    readUnquoted(value);
    if (fAdded > 0) error('quote_junk');
  }

  // Finishes a record: the header, or a row padded or cut to the first
  // record's width, with its short_row or long_row error when it ends.
  function finishRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // A whole clean record at once: the line up to its LF holds no quote and
    // no CR (a trailing CRLF's CR is left out of the cut), so split(',') is
    // every field. A lone CR at the very end of the text is not clean: it is
    // a stray CR, and the slow route below handles it.
    const lf = text.indexOf('\n', pos);
    const lineEnd = lf === -1 ? n : lf;
    const loneCrAtEnd = lf === -1 && lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13;
    if (!loneCrAtEnd) {
      let bodyEnd = lineEnd;
      if (lf !== -1 && lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) bodyEnd = lineEnd - 1;
      if (bodyEnd > pos) {
        const body = text.slice(pos, bodyEnd);
        if (body.indexOf('"') === -1 && body.indexOf('\r') === -1) {
          const fields = body.split(',');
          pos = lf === -1 ? n : lf + 1;
          if (lf !== -1) line += 1;
          finishRecord(fields);
          continue;
        }
      }
    }

    const fields = [];
    let quoted = false;
    for (;;) {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        readQuoted();
        fields.push(fValue);
        if (fEnded !== COMMA) break;
        continue;
      }
      // Unquoted field, inlined here (the common case): one span cut out
      // whole between its delimiters, stray CRs dropped with an error each.
      quoted = false;
      let comma = text.indexOf(',', pos);
      let lf = text.indexOf('\n', pos);
      let end;
      let ended;
      if (comma === -1) {
        if (lf === -1) { end = n; ended = END; }
        else { end = lf; ended = LINE_BREAK; }
      } else if (lf === -1) { end = comma; ended = COMMA; }
      else if (comma < lf) { end = comma; ended = COMMA; }
      else { end = lf; ended = LINE_BREAK; }
      let fEnd = end;
      if (ended === LINE_BREAK && end > pos && text.charCodeAt(end - 1) === 13) fEnd = end - 1;
      let value = text.slice(pos, fEnd);
      const cr = value.indexOf('\r');
      if (cr !== -1) {
        let count = 0;
        let at = cr;
        while (at !== -1) {
          count += 1;
          at = value.indexOf('\r', at + 1);
        }
        value = count === 1 ? value.slice(0, cr) + value.slice(cr + 1) : value.replaceAll('\r', '');
        for (let i = 0; i < count; i += 1) error('stray_cr');
      }
      pos = ended === END ? n : end + 1;
      if (ended === LINE_BREAK) line += 1;
      fields.push(value);
      if (ended !== COMMA) break;
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    finishRecord(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
