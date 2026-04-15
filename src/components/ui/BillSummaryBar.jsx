import { useNavigate } from 'react-router-dom';
export default function BillSummaryBar({ totalItems, totalAmount }) {
  const navigate = useNavigate();

  if (totalItems === 0) return null;

  return (
    <div className="bill-summary-bar">
      <div className="summary-info">
        <span className="summary-items">{totalItems} Items</span>
        <span className="summary-total">₹{totalAmount}</span>
      </div>
      <button 
        className="summary-btn gradient-btn" 
        onClick={() => navigate('/bill-confirm')}
      >
        <span>Continue</span>
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  );
}
