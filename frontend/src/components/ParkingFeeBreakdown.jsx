import { money } from '../lib/format'

export default function ParkingFeeBreakdown({ charge }) {
  if (charge?.baseFee == null) return null

  return <dl className="bill-facts fee-breakdown" aria-label="Chi tiết các khoản phí">
    <div><dt>Phí gửi xe{charge.billableHours != null ? ` (${charge.billableHours} giờ tính phí)` : ''}</dt><dd>{money(charge.baseFee)}</dd></div>
    {charge.earlyExitFee > 0 && <div><dt>Phí ra sớm</dt><dd>{money(charge.earlyExitFee)}</dd></div>}
    {charge.lateFee > 0 && <div><dt>Phí trễ ({charge.lateDays} ngày)</dt><dd>{money(charge.lateFee)}</dd></div>}
    {charge.surcharge > 0 && <div><dt>Phụ phí</dt><dd>{money(charge.surcharge)}</dd></div>}
  </dl>
}
