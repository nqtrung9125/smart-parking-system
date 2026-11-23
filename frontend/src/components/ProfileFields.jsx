import { Field } from './Ui'

export default function ProfileFields({ profile, onChange }) {
  function update(field, value) {
    onChange({ ...profile, [field]: value })
  }

  return <>
    <Field label="Tên người dùng">
      <input autoComplete="name" maxLength={80} value={profile.displayName}
        onChange={(event) => update('displayName', event.target.value)} placeholder="Nhập tên của bạn" />
    </Field>
    <Field label="Số điện thoại liên hệ">
      <input type="tel" autoComplete="tel" maxLength={20} value={profile.contactPhone}
        onChange={(event) => update('contactPhone', event.target.value)} placeholder="Nhập số điện thoại" />
    </Field>
    <Field label="Địa chỉ">
      <input autoComplete="street-address" maxLength={255} value={profile.address}
        onChange={(event) => update('address', event.target.value)} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" />
    </Field>
  </>
}
