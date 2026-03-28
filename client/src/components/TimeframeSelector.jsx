const ranges = ['1D', '1W', '1M', '1Y', 'ALL'];

export function TimeframeSelector({ value, onChange }) {
  return (
    <div className="segmented">
      {ranges.map((range) => (
        <button
          key={range}
          className={value === range ? 'active' : ''}
          type="button"
          onClick={() => onChange(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
