import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { PAGE_SIZES } from '@/lib/constants';

/** Page numbers around the current page: 1 … 4 5 6 … 12 */
function pageWindow(page, pages) {
  const out = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

/** .table-foot: "Showing 1–10 of 26" · rows per page · pager */
export function TableFoot({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="table-foot">
      <span>
        Showing <b>{from}–{to}</b> of <b>{total}</b>
      </span>
      <span className="row" style={{ gap: 8 }}>
        Rows
        <div style={{ width: 80 }}>
          <Dropdown
            size="sm"
            value={pageSize}
            options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))}
            onChange={(v) => onPageSize(Number(v))}
          />
        </div>
      </span>
      <div className="pager">
        <button type="button" disabled={page <= 1} title="Previous" onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </button>
        {pageWindow(page, pages).map((p, i) =>
          p === '…' ? (
            <button type="button" key={`e${i}`} disabled>
              …
            </button>
          ) : (
            <button type="button" key={p} className={p === page ? 'is-active' : ''} onClick={() => onPage(p)}>
              {p}
            </button>
          ),
        )}
        <button type="button" disabled={page >= pages} title="Next" onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
