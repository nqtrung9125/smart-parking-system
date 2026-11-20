import { money, vehicleType } from '../lib/format'

export default function ParkingPriceTable({ rates }) {
  return <section className="panel section-gap pricing-table" id="parking-prices" aria-labelledby="pricing-title">
    <h2 id="pricing-title">Bảng giá đặt chỗ</h2>
    <div className="pricing-scroll"><table>
      <thead><tr><th scope="col">Loại xe</th><th scope="col">Phí gửi / giờ</th><th scope="col">Ra sớm / lượt</th><th scope="col">Ra trễ / ngày</th><th scope="col">Phụ phí / lượt</th></tr></thead>
      <tbody>{rates.map(({ vehicleType: type, rate }) => <tr key={type}>
        <th scope="row">{vehicleType(type)}</th>
        <td>{money(rate.hourlyRate)}</td><td>{money(rate.earlyExitFee)}</td><td>{money(rate.lateDailyFee)}</td><td>{money(rate.surcharge)}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="helper-text">Phí gửi làm tròn lên theo giờ, tối thiểu 1 giờ. Ra trong cùng phút với giờ hẹn được tính đúng giờ. Trong 24 giờ đầu tính 1 ngày trễ, sang mỗi 24 giờ tiếp theo tính thêm 1 ngày.</p>
  </section>
}
