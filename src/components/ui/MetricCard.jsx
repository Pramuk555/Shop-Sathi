export default function MetricCard({ title, value, icon, color }) {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ backgroundColor: `${color}1A`, color }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="metric-info">
        <h3 className="metric-value">{value}</h3>
        <p className="metric-title">{title}</p>
      </div>
    </div>
  );
}
