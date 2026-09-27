export const Spinner = ({ fullscreen = false, label }) => (
  <div className={fullscreen ? "spinner spinner--fullscreen" : "spinner"} role="status" aria-live="polite">
    <span className="spinner__ring" aria-hidden="true" />
    {label ? <span>{label}</span> : null}
  </div>
);

export const Skeleton = ({ width, height, className = "", style }) => (
  <span
    className={`skeleton ${className}`}
    style={{ width, height, ...style }}
    aria-hidden="true"
  />
);

export const SkeletonText = ({ lines = 3 }) => (
  <div>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="skeleton--text"
        style={{ width: `${100 - i * 12}%` }}
      />
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="stat" aria-hidden="true">
    <Skeleton width="52%" height={11} />
    <Skeleton width="72%" height={28} style={{ marginTop: 8 }} />
    <Skeleton width="40%" height={11} style={{ marginTop: 8 }} />
  </div>
);

export const TableSkeleton = ({ rows = 3, cols = 4 }) => (
  <div className="table-wrap" aria-hidden="true">
    <table className="table">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}>
                <Skeleton height={12} width={c === 0 ? "78%" : "48%"} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Spinner;
