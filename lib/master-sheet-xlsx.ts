import 'server-only';
import ExcelJS from 'exceljs';
import { MASTER_COLUMNS, STATUS_OPTIONS, type MasterRow } from './master-sheet';

/** The master sheet as a styled .xlsx: frozen header, wrapped text, clickable reference links, status dropdown. */
export async function toXlsx(rows: MasterRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Outlier Desk';
  const ws = wb.addWorksheet('Master sheet', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = MASTER_COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E5C' } };
  head.alignment = { vertical: 'middle', wrapText: true };
  head.height = 22;

  for (const r of rows) {
    const values: Record<string, string | number> = {};
    for (const c of MASTER_COLUMNS) {
      const v = r[c.key];
      // ExcelJS stores strings as text cells (never formulas), so no apostrophe prefix is needed here.
      values[c.key] = typeof v === 'number' ? v : String(v ?? '');
    }
    const row = ws.addRow(values);
    row.alignment = { vertical: 'top', wrapText: true };
    const ref = row.getCell('reference');
    if (/^https:\/\//.test(String(r.reference))) {
      ref.value = { text: String(r.reference), hyperlink: String(r.reference) };
      ref.font = { color: { argb: 'FF0F6E5C' }, underline: true };
    }
    row.getCell('views').numFmt = '#,##0';
    row.getCell('median').numFmt = '#,##0';
    row.getCell('status').dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${STATUS_OPTIONS.join(',')}"`],
    };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: MASTER_COLUMNS.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
