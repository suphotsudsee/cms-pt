import type { ChargeLineItem } from '../../types/report';

interface ChargeLinesPanelProps {
  title: string;
  items: ChargeLineItem[];
  loading: boolean;
}

function money(value: number) {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

export function ChargeLinesPanel({ title, items, loading }: ChargeLinesPanelProps) {
  const total = items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <section className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
        <h3 className="text-base font-semibold text-blue-950">{title}</h3>
        <p className="mt-1 text-sm text-blue-800">รวมรายการที่แสดง {money(total)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              {['หมวด', 'รหัส', 'รายการ', 'จำนวน', 'ราคา/หน่วย', 'รวม'].map((header) => (
                <th key={header} scope="col" className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  กำลังโหลดรายการคิดเงิน...
                </td>
              </tr>
            ) : null}
            {!loading && items.map((item) => (
              <tr key={`${item.source}-${item.item_code}-${item.item_name}`} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.source}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.item_code}</td>
                <td className="min-w-[320px] px-4 py-3 text-sm text-slate-700">{item.item_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.quantity.toLocaleString('th-TH')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{money(item.unit_price)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">{money(item.total_price)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  ไม่พบรายการคิดเงินละเอียดของ visit นี้
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
