export default function RecentBillCard({ bill }) {
  return (
    <div className="recent-bill-card">
      <div className="bill-icon">
        <span className="material-symbols-outlined">receipt_long</span>
      </div>
      <div className="bill-details">
        <h4>{bill?.customerName || 'Walk-in Customer'}</h4>
        <p>{bill?.itemsCount || 0} items • {bill?.date || 'Today'}</p>
      </div>
      <div className="bill-amount">
        ₹{bill?.total || '0'}
      </div>
    </div>
  );
}
