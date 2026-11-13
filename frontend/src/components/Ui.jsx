export function PageHeader({ eyebrow, title, description, actions }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function Notice({ error, success }) {
  if (!error && !success) return null
  return <div role="status" className={`notice ${error ? 'notice-error' : 'notice-success'}`}>{error || success}</div>
}

export function Loading({ children = 'Đang tải dữ liệu…' }) { return <div className="panel muted">{children}</div> }
export function Empty({ children }) { return <div className="panel muted">{children}</div> }

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
